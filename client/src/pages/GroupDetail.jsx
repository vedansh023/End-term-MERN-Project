import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import Navbar from "../components/Navbar";
import { addExpense, addSettlement, getGroup } from "../services/api";
import { formatDateTime, formatINR, paiseToRupeesInput } from "../utils/money";
import { useAuth } from "../context/AuthContext";

const CATEGORIES = [
  "Food",
  "Travel",
  "Rent",
  "Shopping",
  "Entertainment",
  "Utilities",
  "Other",
];

function GroupDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState(null);
  const [paymentNote, setPaymentNote] = useState("");
  const [isSubmittingSettlement, setIsSubmittingSettlement] = useState(false);
  const [isSubmittingExpense, setIsSubmittingExpense] = useState(false);

  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("Other");
  const [notes, setNotes] = useState("");
  const [paidBy, setPaidBy] = useState("");
  const [splitAmong, setSplitAmong] = useState([]);
  const [splitMode, setSplitMode] = useState("equal");
  const [customAmounts, setCustomAmounts] = useState({});

  // Activity filter state
  const [filterType, setFilterType] = useState("all");
  const [filterCategory, setFilterCategory] = useState("all");
  const [filterMember, setFilterMember] = useState("all");

  const [printTimestamp] = useState(() => new Date().toLocaleString("en-IN"));

  const load = useCallback(async () => {
    const response = await getGroup(id);
    setData(response.data);
    const members = response.data.group.members;
    setPaidBy(user._id);
    setSplitAmong(members.map((member) => member._id));
    setCustomAmounts(Object.fromEntries(members.map((member) => [member._id, ""])));
  }, [id, user._id]);

  useEffect(() => {
    const run = async () => {
      try {
        await load();
      } catch (err) {
        setError(err.response?.data?.message || "Could not load group");
      }
    };

    run();
  }, [load]);

  const nameById = useMemo(() => {
    const map = {};
    data?.group.members.forEach((member) => {
      map[member._id] = member.fullName;
    });
    return map;
  }, [data]);

  const toggleSplit = (memberId) => {
    setSplitAmong((current) => {
      if (current.includes(memberId)) {
        return current.filter((idValue) => idValue !== memberId);
      }
      return [...current, memberId];
    });
  };

  const customSplitTotal = useMemo(
    () =>
      splitAmong.reduce(
        (total, memberId) =>
          total + (Math.round(Number(customAmounts[memberId]) * 100) || 0),
        0
      ),
    [customAmounts, splitAmong]
  );

  const personalSummary = useMemo(() => {
    if (!data) return { paid: 0, share: 0, net: 0 };
    const myBalance = data.balances?.find((b) => b.userId === user._id)?.net || 0;
    const myStat = data.analytics?.memberStats?.find((m) => m.userId === user._id);
    return {
      paid: myStat?.totalPaid || 0,
      share: myStat?.totalShare || 0,
      net: myBalance,
    };
  }, [data, user._id]);

  const handleExpense = async (event) => {
    event.preventDefault();
    setError("");
    setIsSubmittingExpense(true);

    try {
      await addExpense(id, {
        description,
        amount,
        category,
        notes,
        paidBy,
        splitMode,
        splitAmong:
          splitMode === "custom"
            ? splitAmong.map((memberId) => ({
                userId: memberId,
                amount: customAmounts[memberId],
              }))
            : splitAmong,
      });
      setDescription("");
      setAmount("");
      setNotes("");
      setCategory("Other");
      await load();
    } catch (err) {
      setError(err.response?.data?.message || "Could not add expense");
    } finally {
      setIsSubmittingExpense(false);
    }
  };

  const recordSettlement = async (from, to, paise, status, note) => {
    if (isSubmittingSettlement) return;
    setIsSubmittingSettlement(true);
    setError("");

    try {
      await addSettlement(id, {
        from,
        to,
        amount: paiseToRupeesInput(paise),
        status,
        note,
      });
      await load();
      setSelectedPayment(null);
      setPaymentNote("");
    } catch (err) {
      setError(err.response?.data?.message || "Could not record settlement");
    } finally {
      setIsSubmittingSettlement(false);
    }
  };

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(data.group.inviteCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setError("Could not copy invite code");
    }
  };

  const handleExportCSV = () => {
    if (!data) return;
    const headers = [
      "Date",
      "Type",
      "Description / Details",
      "Category",
      "Amount (INR)",
      "Paid By / From",
      "Split With / To",
      "Status",
      "Notes",
    ];

    const rows = [];

    data.expenses?.forEach((exp) => {
      rows.push([
        `"${new Date(exp.createdAt).toLocaleString("en-IN")}"`,
        "Expense",
        `"${(exp.description || "").replace(/"/g, '""')}"`,
        `"${exp.category || "Other"}"`,
        ((exp.amount || 0) / 100).toFixed(2),
        `"${(exp.paidBy?.fullName || "").replace(/"/g, '""')}"`,
        `"${(exp.splits?.map((s) => s.userId?.fullName).filter(Boolean).join("; ") || "").replace(/"/g, '""')}"`,
        "Settled in balance",
        `"${(exp.notes || "").replace(/"/g, '""')}"`,
      ]);
    });

    data.settlements?.forEach((s) => {
      rows.push([
        `"${new Date(s.createdAt).toLocaleString("en-IN")}"`,
        "Settlement",
        `"Settlement from ${(s.from?.fullName || "")} to ${(s.to?.fullName || "")}"`,
        "-",
        ((s.amount || 0) / 100).toFixed(2),
        `"${(s.from?.fullName || "").replace(/"/g, '""')}"`,
        `"${(s.to?.fullName || "").replace(/"/g, '""')}"`,
        `"${s.status || "paid"}"`,
        `"${(s.note || "").replace(/"/g, '""')}"`,
      ]);
    });

    const csvContent =
      "\uFEFF" +
      [headers.join(","), ...rows.map((row) => row.join(","))].join("\r\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const safeName = (data.group.name || "splitfair").replace(/[^a-zA-Z0-9_-]/g, "_");
    link.setAttribute("href", url);
    link.setAttribute("download", `${safeName}_expenses.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handlePrint = () => {
    window.print();
  };

  const filteredActivity = useMemo(() => {
    if (!data) return [];
    const expensesList = data.expenses || [];
    const settlementsList = data.settlements || [];

    const combined = [
      ...expensesList.map((expense) => ({
        id: expense._id,
        kind: "expense",
        at: expense.createdAt,
        expense,
      })),
      ...settlementsList.map((settlement) => ({
        id: settlement._id,
        kind: "settlement",
        at: settlement.createdAt,
        settlement,
      })),
    ].sort((a, b) => new Date(b.at) - new Date(a.at));

    return combined.filter((entry) => {
      // Filter by type / status
      if (filterType === "expenses" && entry.kind !== "expense") return false;
      if (filterType === "settlements" && entry.kind !== "settlement") return false;
      if (
        filterType === "paid" &&
        (entry.kind !== "settlement" || entry.settlement.status !== "paid")
      )
        return false;
      if (
        filterType === "pending" &&
        (entry.kind !== "settlement" || entry.settlement.status !== "pending")
      )
        return false;
      if (
        filterType === "delayed" &&
        (entry.kind !== "settlement" || entry.settlement.status !== "delayed")
      )
        return false;

      // Filter by category (applies to expenses)
      if (filterCategory !== "all") {
        if (entry.kind !== "expense" || (entry.expense.category || "Other") !== filterCategory) {
          return false;
        }
      }

      // Filter by member
      if (filterMember !== "all") {
        if (entry.kind === "expense") {
          const payerId = entry.expense.paidBy?._id || entry.expense.paidBy;
          const splitUserIds = entry.expense.splits?.map((s) => s.userId?._id || s.userId) || [];
          if (payerId !== filterMember && !splitUserIds.includes(filterMember)) {
            return false;
          }
        } else {
          const fromId = entry.settlement.from?._id || entry.settlement.from;
          const toId = entry.settlement.to?._id || entry.settlement.to;
          if (fromId !== filterMember && toId !== filterMember) {
            return false;
          }
        }
      }

      return true;
    });
  }, [data, filterType, filterCategory, filterMember]);

  if (error && !data) {
    return (
      <div>
        <Navbar />
        <main className="page">
          <p className="error">{error}</p>
          <Link to="/">Back to groups</Link>
        </main>
      </div>
    );
  }

  if (!data) {
    return (
      <div>
        <Navbar />
        <div className="loading">Loading group...</div>
      </div>
    );
  }

  const { group, expenses, settlements, balances, suggestions, analytics } = data;

  return (
    <div>
      <Navbar />
      <main className="page">
        <div className="print-header">
          <h1>{group.name} — Settlement & Expense Summary</h1>
          <p>
            Generated on {printTimestamp} · {group.members.length} members (
            {group.members.map((m) => m.fullName).join(", ")})
          </p>
        </div>

        <p className="crumb">
          <Link to="/">Groups</Link> / {group.name}
        </p>

        <div className="page-head">
          <div>
            <h1>{group.name}</h1>
            <p className="muted">
              {group.members.map((member) => member.fullName).join(" · ")}
            </p>
          </div>
          <div className="header-actions">
            <button type="button" className="btn-outline" onClick={handleExportCSV}>
              Export CSV
            </button>
            <button type="button" className="btn-outline" onClick={handlePrint}>
              Print Summary
            </button>
            <button type="button" className="code-chip" onClick={copyCode}>
              Invite {group.inviteCode} {copied ? "copied" : "copy"}
            </button>
          </div>
        </div>

        {error && <p className="error">{error}</p>}

        {/* Balance cards */}
        <section className="balance-grid">
          {balances.map((balance) => {
            const net = balance.net;
            let label = "settled up";
            if (net > 0) {
              label = `is owed ${formatINR(net)}`;
            } else if (net < 0) {
              label = `owes ${formatINR(-net)}`;
            }

            return (
              <article
                key={balance.userId}
                className={`balance-card ${
                  net < 0 ? "owe" : net > 0 ? "owed" : "even"
                }`}
              >
                <h3>{nameById[balance.userId] || "Member"}</h3>
                <p>{label}</p>
              </article>
            );
          })}
        </section>

        {/* Settle in the fewest payments */}
        <section className="paper-card settle-card">
          <h2>Settle in the fewest payments</h2>
          {suggestions.length === 0 ? (
            <p className="muted">Everyone is settled. Nice.</p>
          ) : (
            <ul className="settle-list">
              {suggestions.map((item) => (
                <li key={`${item.from}-${item.to}-${item.amount}`}>
                  <span>
                    <strong>{nameById[item.from]}</strong> pays{" "}
                    <strong>{nameById[item.to]}</strong> {formatINR(item.amount)}
                  </span>
                  {item.from === user._id ? (
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={() => {
                        setSelectedPayment(item);
                        setPaymentNote("");
                      }}
                    >
                      Review payment
                    </button>
                  ) : (
                    <span className="payment-waiting">
                      Awaiting {nameById[item.from]}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Dashboard and Analytics */}
        <section className="paper-card analytics-card">
          <h2>Dashboard & Analytics</h2>
          <div className="analytics-stats-grid">
            <div className="stat-card">
              <span className="stat-label">Total group spending</span>
              <p className="stat-val">{formatINR(analytics?.totalSpending || 0)}</p>
              <span className="stat-sub">
                {expenses.length} expense{expenses.length === 1 ? "" : "s"} logged
              </span>
            </div>
            <div className="stat-card">
              <span className="stat-label">Who paid the most</span>
              <p className="stat-val">
                {analytics?.topPayer?.amount > 0
                  ? analytics.topPayer.fullName
                  : "None yet"}
              </p>
              <span className="stat-sub">
                {analytics?.topPayer?.amount > 0
                  ? `Paid ${formatINR(analytics.topPayer.amount)}`
                  : "No payments recorded"}
              </span>
            </div>
            <div className="stat-card">
              <span className="stat-label">Your personal summary</span>
              <p className="stat-val">
                {personalSummary.net > 0
                  ? `+${formatINR(personalSummary.net)}`
                  : personalSummary.net < 0
                  ? `-${formatINR(-personalSummary.net)}`
                  : "₹0.00"}
              </p>
              <span className="stat-sub">
                You paid {formatINR(personalSummary.paid)} · Your share {formatINR(personalSummary.share)}
              </span>
            </div>
          </div>

          {(analytics?.categories?.length > 0 || analytics?.monthlySpending?.length > 0) && (
            <div className="analytics-breakdown-grid">
              {analytics?.categories?.length > 0 && (
                <div>
                  <h3 className="analytics-subtitle">Spending by category</h3>
                  {analytics.categories.map((cat) => (
                    <div key={cat.category} className="category-item">
                      <div className="category-header">
                        <span>{cat.category}</span>
                        <span>
                          <strong>{formatINR(cat.amount)}</strong> ({cat.percentage}%)
                        </span>
                      </div>
                      <div className="category-bar-track">
                        <div
                          className="category-bar-fill"
                          style={{
                            width: `${Math.min(100, Math.max(4, cat.percentage))}%`,
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {analytics?.monthlySpending?.length > 0 && (
                <div>
                  <h3 className="analytics-subtitle">Monthly spending</h3>
                  <div className="monthly-chart-wrap">
                    {analytics.monthlySpending.map((m) => {
                      const maxAmount = Math.max(
                        ...analytics.monthlySpending.map((item) => item.amount),
                        1
                      );
                      const heightPercent = Math.max(
                        14,
                        Math.round((m.amount / maxAmount) * 100)
                      );
                      return (
                        <div key={m.key} className="monthly-col">
                          <span className="monthly-val">{formatINR(m.amount)}</span>
                          <div
                            className="monthly-bar"
                            style={{ height: `${heightPercent}%` }}
                          />
                          <span className="monthly-label">{m.label}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </section>

        {/* Expense form and Activity feed */}
        <div className="two-col">
          <form className="paper-card" onSubmit={handleExpense}>
            <h2>Add expense</h2>
            <label>
              What for
              <input
                type="text"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="Dinner, cab, groceries"
                required
              />
            </label>
            <label>
              Category
              <select
                value={category}
                onChange={(event) => setCategory(event.target.value)}
              >
                {CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Amount (₹)
              <input
                type="number"
                min="0.01"
                step="0.01"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                required
              />
            </label>
            <label>
              Notes or receipt (optional)
              <input
                type="text"
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                placeholder="Receipt #, hotel invoice, or details"
              />
            </label>
            <label>
              Paid by
              <select
                value={paidBy}
                onChange={(event) => setPaidBy(event.target.value)}
              >
                {group.members.map((member) => (
                  <option key={member._id} value={member._id}>
                    {member.fullName}
                  </option>
                ))}
              </select>
            </label>
            <fieldset>
              <legend>How to split</legend>
              <label className="check-row">
                <input
                  type="radio"
                  name="split-mode"
                  value="equal"
                  checked={splitMode === "equal"}
                  onChange={(event) => setSplitMode(event.target.value)}
                />
                Split equally
              </label>
              <label className="check-row">
                <input
                  type="radio"
                  name="split-mode"
                  value="custom"
                  checked={splitMode === "custom"}
                  onChange={(event) => setSplitMode(event.target.value)}
                />
                Enter different amounts
              </label>
            </fieldset>
            <fieldset>
              <legend>
                {splitMode === "equal" ? "Split equally among" : "Custom shares"}
              </legend>
              {group.members.map((member) => (
                <div
                  key={member._id}
                  className={splitMode === "custom" ? "custom-split-row" : ""}
                >
                  <label className="check-row">
                    <input
                      type="checkbox"
                      checked={splitAmong.includes(member._id)}
                      onChange={() => toggleSplit(member._id)}
                    />
                    {member.fullName}
                  </label>
                  {splitMode === "custom" && (
                    <input
                      type="number"
                      min="0.01"
                      step="0.01"
                      value={customAmounts[member._id] || ""}
                      onChange={(event) =>
                        setCustomAmounts((current) => ({
                          ...current,
                          [member._id]: event.target.value,
                        }))
                      }
                      placeholder="₹ amount"
                      disabled={!splitAmong.includes(member._id)}
                      aria-label={`${member.fullName}'s share`}
                    />
                  )}
                </div>
              ))}
              {splitMode === "custom" && (
                <p className="custom-split-total">
                  Entered: {formatINR(customSplitTotal)} · Total:{" "}
                  {formatINR(Math.round(Number(amount) * 100) || 0)}
                </p>
              )}
            </fieldset>
            <button
              type="submit"
              className="btn-primary"
              disabled={isSubmittingExpense}
            >
              {isSubmittingExpense ? "Saving expense..." : "Save expense"}
            </button>
          </form>

          {/* Activity Timeline with filters */}
          <div className="paper-card">
            <h2>Activity</h2>

            {/* Filter controls */}
            <div className="activity-filters">
              <select
                className="filter-select"
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                aria-label="Filter activity type"
              >
                <option value="all">All activity</option>
                <option value="expenses">Expenses only</option>
                <option value="settlements">Settlements only</option>
                <option value="paid">Paid settlements</option>
                <option value="pending">Pending settlements</option>
                <option value="delayed">Delayed settlements</option>
              </select>

              <select
                className="filter-select"
                value={filterCategory}
                onChange={(e) => setFilterCategory(e.target.value)}
                aria-label="Filter category"
              >
                <option value="all">All categories</option>
                {CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>

              <select
                className="filter-select"
                value={filterMember}
                onChange={(e) => setFilterMember(e.target.value)}
                aria-label="Filter person"
              >
                <option value="all">All members</option>
                {group.members.map((m) => (
                  <option key={m._id} value={m._id}>
                    {m.fullName}
                  </option>
                ))}
              </select>
            </div>

            {filteredActivity.length === 0 ? (
              <p className="muted">
                {expenses.length === 0 && settlements.length === 0
                  ? "Nothing yet. Add the first expense."
                  : "No activity matches your filters."}
              </p>
            ) : (
              <ul className="activity">
                {filteredActivity.map((entry) =>
                  entry.kind === "expense" ? (
                    <li key={entry.expense._id}>
                      <div>
                        <strong>{entry.expense.description}</strong>
                        <span className="category-tag">
                          {entry.expense.category || "Other"}
                        </span>
                        <div className="activity-date">
                          {formatDateTime(entry.expense.createdAt)}
                        </div>
                      </div>
                      <span>{formatINR(entry.expense.amount)}</span>
                      <p>
                        {entry.expense.paidBy?.fullName} paid · split with{" "}
                        {entry.expense.splits
                          ?.map((split) => split.userId?.fullName)
                          .filter(Boolean)
                          .join(", ")}
                      </p>
                      {entry.expense.notes && (
                        <p className="activity-note">Note: {entry.expense.notes}</p>
                      )}
                    </li>
                  ) : (
                    <li
                      key={entry.settlement._id}
                      className={
                        entry.settlement.status === "delayed"
                          ? "delayed"
                          : entry.settlement.status === "pending"
                          ? "pending"
                          : "settled"
                      }
                    >
                      <div>
                        <strong>
                          {entry.settlement.status === "delayed"
                            ? "Payment delayed"
                            : entry.settlement.status === "pending"
                            ? "Payment pending"
                            : "Settlement"}
                        </strong>
                        <span
                          className={`status-tag ${entry.settlement.status || "paid"}`}
                        >
                          {entry.settlement.status === "delayed"
                            ? "Delayed"
                            : entry.settlement.status === "pending"
                            ? "Pending"
                            : "Paid"}
                        </span>
                        <div className="activity-date">
                          {formatDateTime(entry.settlement.createdAt)}
                        </div>
                      </div>
                      <span>{formatINR(entry.settlement.amount)}</span>
                      <p>
                        {entry.settlement.from?.fullName}{" "}
                        {entry.settlement.status === "delayed"
                          ? "delayed payment to"
                          : entry.settlement.status === "pending"
                          ? "initiated payment to"
                          : "paid"}{" "}
                        {entry.settlement.to?.fullName}
                      </p>
                      {entry.settlement.note && (
                        <p className="activity-note">Note: {entry.settlement.note}</p>
                      )}
                    </li>
                  )
                )}
              </ul>
            )}
          </div>
        </div>
      </main>

      {/* Payment Settlement Modal */}
      {selectedPayment && (
        <div className="payment-modal-backdrop" role="presentation">
          <section
            className="paper-card payment-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="payment-modal-title"
          >
            <p className="eyebrow">Payment details</p>
            <h2 id="payment-modal-title">Review your payment</h2>
            <dl className="payment-details">
              <div>
                <dt>Group</dt>
                <dd>{group.name}</dd>
              </div>
              <div>
                <dt>From</dt>
                <dd>{nameById[selectedPayment.from]}</dd>
              </div>
              <div>
                <dt>To</dt>
                <dd>{nameById[selectedPayment.to]}</dd>
              </div>
              <div>
                <dt>Amount</dt>
                <dd>{formatINR(selectedPayment.amount)}</dd>
              </div>
            </dl>

            <label>
              Payment note (optional)
              <input
                type="text"
                value={paymentNote}
                onChange={(e) => setPaymentNote(e.target.value)}
                placeholder="e.g. UPI ref #, Cash, GPay"
                disabled={isSubmittingSettlement}
              />
            </label>

            <p className="muted" style={{ marginTop: 8 }}>
              Marking as pending or delayed keeps balances active until confirmed as paid.
            </p>

            <div className="payment-actions">
              <button
                type="button"
                className="btn-ghost"
                disabled={isSubmittingSettlement}
                onClick={() => {
                  setSelectedPayment(null);
                  setPaymentNote("");
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn-secondary"
                disabled={isSubmittingSettlement}
                onClick={() =>
                  recordSettlement(
                    selectedPayment.from,
                    selectedPayment.to,
                    selectedPayment.amount,
                    "delayed",
                    paymentNote
                  )
                }
              >
                {isSubmittingSettlement ? "Saving..." : "Mark delayed"}
              </button>
              <button
                type="button"
                className="btn-secondary"
                disabled={isSubmittingSettlement}
                onClick={() =>
                  recordSettlement(
                    selectedPayment.from,
                    selectedPayment.to,
                    selectedPayment.amount,
                    "pending",
                    paymentNote
                  )
                }
              >
                {isSubmittingSettlement ? "Saving..." : "Mark pending"}
              </button>
              <button
                type="button"
                className="btn-primary"
                disabled={isSubmittingSettlement}
                onClick={() =>
                  recordSettlement(
                    selectedPayment.from,
                    selectedPayment.to,
                    selectedPayment.amount,
                    "paid",
                    paymentNote
                  )
                }
              >
                {isSubmittingSettlement ? "Saving..." : "Mark paid"}
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

export default GroupDetail;
