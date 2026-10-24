import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import Navbar from "../components/Navbar";
import {
  addExpense,
  updateExpense,
  deleteExpense,
  addSettlement,
  getGroup,
  toggleArchiveGroup,
  updateBudget,
} from "../services/api";
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
  const [budgetModalOpen, setBudgetModalOpen] = useState(false);
  const [budgetAmount, setBudgetAmount] = useState("");
  const [paymentNote, setPaymentNote] = useState("");
  const [nudgeToast, setNudgeToast] = useState("");
  const [isSubmittingSettlement, setIsSubmittingSettlement] = useState(false);
  const [isSubmittingExpense, setIsSubmittingExpense] = useState(false);

  // Expense form state
  const [editingExpenseId, setEditingExpenseId] = useState(null);
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("Other");
  const [notes, setNotes] = useState("");
  const [paidBy, setPaidBy] = useState("");
  const [splitAmong, setSplitAmong] = useState([]);
  const [splitMode, setSplitMode] = useState("equal");
  const [customAmounts, setCustomAmounts] = useState({});
  const [customPercentages, setCustomPercentages] = useState({});
  const [customShares, setCustomShares] = useState({});

  // Multi-payer state
  const [isMultiPayer, setIsMultiPayer] = useState(false);
  const [payerAmounts, setPayerAmounts] = useState({});

  // Activity filter state
  const [filterType, setFilterType] = useState("all");
  const [filterCategory, setFilterCategory] = useState("all");
  const [filterMember, setFilterMember] = useState("all");

  const [printTimestamp] = useState(() => new Date().toLocaleString("en-IN"));

  const load = useCallback(async () => {
    const response = await getGroup(id);
    setData(response.data);
    const members = response.data.group.members;
    setPaidBy((current) => current || user._id);
    setSplitAmong((current) => (current.length > 0 ? current : members.map((m) => m._id)));
    setCustomAmounts((current) =>
      Object.keys(current).length > 0
        ? current
        : Object.fromEntries(members.map((m) => [m._id, ""]))
    );
    setCustomPercentages((current) =>
      Object.keys(current).length > 0
        ? current
        : Object.fromEntries(members.map((m) => [m._id, ""]))
    );
    setCustomShares((current) =>
      Object.keys(current).length > 0
        ? current
        : Object.fromEntries(members.map((m) => [m._id, "1"]))
    );
    setPayerAmounts((current) =>
      Object.keys(current).length > 0
        ? current
        : Object.fromEntries(members.map((m) => [m._id, ""]))
    );
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

  const customPercentageTotal = useMemo(
    () =>
      splitAmong.reduce(
        (total, memberId) => total + (Number(customPercentages[memberId]) || 0),
        0
      ),
    [customPercentages, splitAmong]
  );

  const customSharesTotal = useMemo(
    () =>
      splitAmong.reduce(
        (total, memberId) => total + (Number(customShares[memberId]) || 0),
        0
      ),
    [customShares, splitAmong]
  );

  const multiPayerTotal = useMemo(
    () =>
      Object.values(payerAmounts).reduce(
        (total, val) => total + (Math.round(Number(val) * 100) || 0),
        0
      ),
    [payerAmounts]
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

  const resetExpenseForm = () => {
    setEditingExpenseId(null);
    setDescription("");
    setAmount("");
    setNotes("");
    setCategory("Other");
    setSplitMode("equal");
    setIsMultiPayer(false);
    if (data?.group?.members) {
      setPaidBy(user._id);
      setSplitAmong(data.group.members.map((m) => m._id));
      setCustomAmounts(Object.fromEntries(data.group.members.map((m) => [m._id, ""])));
      setCustomPercentages(Object.fromEntries(data.group.members.map((m) => [m._id, ""])));
      setCustomShares(Object.fromEntries(data.group.members.map((m) => [m._id, "1"])));
      setPayerAmounts(Object.fromEntries(data.group.members.map((m) => [m._id, ""])));
    }
  };

  const startEditExpense = (exp) => {
    setEditingExpenseId(exp._id);
    setDescription(exp.description);
    setAmount((exp.amount / 100).toFixed(2));
    setCategory(exp.category || "Other");
    setNotes(exp.notes || "");
    setSplitMode(exp.splitMode || "equal");

    const payerId = exp.paidBy?._id || exp.paidBy;
    setPaidBy(payerId);

    if (Array.isArray(exp.payers) && exp.payers.length > 1) {
      setIsMultiPayer(true);
      const payerMap = Object.fromEntries(
        data.group.members.map((m) => [m._id, ""])
      );
      exp.payers.forEach((p) => {
        const pId = p.userId?._id || p.userId;
        payerMap[pId] = (p.amount / 100).toFixed(2);
      });
      setPayerAmounts(payerMap);
    } else {
      setIsMultiPayer(false);
    }

    const splitIds = exp.splits.map((s) => s.userId?._id || s.userId);
    setSplitAmong(splitIds);

    const amountsMap = Object.fromEntries(
      data.group.members.map((m) => [m._id, ""])
    );
    exp.splits.forEach((s) => {
      const sId = s.userId?._id || s.userId;
      amountsMap[sId] = (s.share / 100).toFixed(2);
    });
    setCustomAmounts(amountsMap);

    // Scroll to expense form
    window.scrollTo({ top: document.querySelector(".page-head")?.offsetTop || 0, behavior: "smooth" });
  };

  const handleDeleteExpense = async (expenseId) => {
    if (!window.confirm("Are you sure you want to delete this expense?")) {
      return;
    }
    setError("");
    try {
      await deleteExpense(id, expenseId);
      if (editingExpenseId === expenseId) {
        resetExpenseForm();
      }
      await load();
    } catch (err) {
      setError(err.response?.data?.message || "Could not delete expense");
    }
  };

  const handleExpense = async (event) => {
    event.preventDefault();
    setError("");
    setIsSubmittingExpense(true);

    try {
      let splitPayload = splitAmong;
      if (splitMode === "custom") {
        splitPayload = splitAmong.map((memberId) => ({
          userId: memberId,
          amount: customAmounts[memberId],
        }));
      } else if (splitMode === "percentage") {
        splitPayload = splitAmong.map((memberId) => ({
          userId: memberId,
          percentage: customPercentages[memberId],
        }));
      } else if (splitMode === "shares") {
        splitPayload = splitAmong.map((memberId) => ({
          userId: memberId,
          shares: customShares[memberId],
        }));
      }

      let payersPayload = null;
      if (isMultiPayer) {
        payersPayload = Object.entries(payerAmounts)
          .filter(([, val]) => Number(val) > 0)
          .map(([userId, val]) => ({ userId, amount: val }));
      }

      const payload = {
        description,
        amount,
        category,
        notes,
        paidBy,
        payers: payersPayload,
        splitMode,
        splitAmong: splitPayload,
      };

      if (editingExpenseId) {
        await updateExpense(id, editingExpenseId, payload);
      } else {
        await addExpense(id, payload);
      }

      resetExpenseForm();
      await load();
    } catch (err) {
      setError(err.response?.data?.message || "Could not save expense");
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

  const handleNudge = async (debtorName, amountPaise) => {
    const msg = `Hey ${debtorName}! Friendly reminder to settle ${formatINR(
      amountPaise
    )} for "${data.group.name}" on SplitFair when you get a chance!`;
    try {
      await navigator.clipboard.writeText(msg);
      setNudgeToast(`Nudge copied for ${debtorName}!`);
      setTimeout(() => setNudgeToast(""), 3500);
    } catch {
      setNudgeToast(`Reminder: ${msg}`);
      setTimeout(() => setNudgeToast(""), 3500);
    }
  };

  const handleToggleArchive = async () => {
    try {
      await toggleArchiveGroup(id);
      await load();
    } catch {
      setError("Could not toggle archive state");
    }
  };

  const handleSetBudget = () => {
    setBudgetAmount(data.group.budget ? (data.group.budget / 100).toFixed(2) : "");
    setBudgetModalOpen(true);
  };

  const saveBudget = async (event) => {
    event.preventDefault();
    setError("");
    try {
      await updateBudget(id, { budget: budgetAmount });
      setBudgetModalOpen(false);
      await load();
    } catch (err) {
      setError(err.response?.data?.message || "Could not update budget");
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

      if (filterCategory !== "all") {
        if (entry.kind !== "expense" || (entry.expense.category || "Other") !== filterCategory) {
          return false;
        }
      }

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
            <h1>
              {group.name} {group.isArchived && <span className="category-tag">Archived</span>}
            </h1>
            <p className="muted">
              {group.members.map((member) => member.fullName).join(" · ")}
            </p>
          </div>
          <div className="header-actions">
            <button type="button" className="btn-outline" onClick={handleToggleArchive}>
              {group.isArchived ? "Restore Group" : "Archive Group"}
            </button>
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

        {group.isArchived && (
          <div className="archive-banner">
            <span>📁 This group is archived. Balances are frozen and modifications are locked.</span>
            <button type="button" className="btn-secondary" onClick={handleToggleArchive}>
              Unarchive
            </button>
          </div>
        )}

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
                  {item.from === user._id && !group.isArchived ? (
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
                    <div style={{ display: "flex", alignItems: "center" }}>
                      <span className="payment-waiting">
                        Awaiting {nameById[item.from]}
                      </span>
                      <button
                        type="button"
                        className="nudge-btn"
                        onClick={() => handleNudge(nameById[item.from], item.amount)}
                        title="Copy polite payment reminder"
                      >
                        Nudge 🔔
                      </button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Dashboard and Analytics */}
        <section className="paper-card analytics-card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <h2>Dashboard & Analytics</h2>
            <button type="button" className="btn-link" onClick={handleSetBudget}>
              {analytics?.budget?.target > 0 ? "✏️ Edit budget" : "➕ Set trip budget"}
            </button>
          </div>

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

          {/* Group Budget Progress Meter */}
          {analytics?.budget?.target > 0 && (
            <div className="budget-section">
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                <span>
                  <strong>Trip Budget:</strong> {formatINR(analytics.budget.spent)} of{" "}
                  {formatINR(analytics.budget.target)} ({analytics.budget.percentage}%)
                </span>
                <span>
                  {analytics.budget.isOverBudget ? (
                    <span className="budget-alert">
                      Over budget by {formatINR(analytics.budget.spent - analytics.budget.target)}
                    </span>
                  ) : (
                    <span>Remaining: {formatINR(analytics.budget.remaining)}</span>
                  )}
                </span>
              </div>
              <div className="budget-meter-track">
                <div
                  className={`budget-meter-fill ${
                    analytics.budget.isOverBudget
                      ? "danger"
                      : analytics.budget.percentage >= 75
                      ? "warning"
                      : "normal"
                  }`}
                  style={{ width: `${Math.min(100, analytics.budget.percentage)}%` }}
                />
              </div>
            </div>
          )}

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
          {!group.isArchived ? (
            <form className="paper-card" onSubmit={handleExpense}>
              <h2>{editingExpenseId ? "Edit expense" : "Add expense"}</h2>

              {editingExpenseId && (
                <div className="edit-form-banner">
                  <span>Modifying existing expense</span>
                  <button type="button" className="btn-link" onClick={resetExpenseForm}>
                    Cancel edit
                  </button>
                </div>
              )}

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

              <fieldset>
                <legend>Paid by</legend>
                <label className="check-row">
                  <input
                    type="checkbox"
                    checked={isMultiPayer}
                    onChange={(e) => setIsMultiPayer(e.target.checked)}
                  />
                  Multiple people paid for this
                </label>

                {!isMultiPayer ? (
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
                ) : (
                  <div>
                    {group.members.map((member) => (
                      <div key={member._id} className="custom-split-row" style={{ marginTop: 6 }}>
                        <span>{member.fullName}</span>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          placeholder="₹ paid"
                          value={payerAmounts[member._id] || ""}
                          onChange={(e) =>
                            setPayerAmounts((cur) => ({
                              ...cur,
                              [member._id]: e.target.value,
                            }))
                          }
                        />
                      </div>
                    ))}
                    <p className="custom-split-total">
                      Total paid: {formatINR(multiPayerTotal)} · Target:{" "}
                      {formatINR(Math.round(Number(amount) * 100) || 0)}
                    </p>
                  </div>
                )}
              </fieldset>

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
                  Enter different amounts (₹)
                </label>
                <label className="check-row">
                  <input
                    type="radio"
                    name="split-mode"
                    value="percentage"
                    checked={splitMode === "percentage"}
                    onChange={(event) => setSplitMode(event.target.value)}
                  />
                  Split by percentages (%)
                </label>
                <label className="check-row">
                  <input
                    type="radio"
                    name="split-mode"
                    value="shares"
                    checked={splitMode === "shares"}
                    onChange={(event) => setSplitMode(event.target.value)}
                  />
                  Split by shares / weights
                </label>
              </fieldset>

              <fieldset>
                <legend>
                  {splitMode === "equal"
                    ? "Split equally among"
                    : splitMode === "percentage"
                    ? "Percentages for members"
                    : splitMode === "shares"
                    ? "Shares for members"
                    : "Custom shares"}
                </legend>
                {group.members.map((member) => (
                  <div
                    key={member._id}
                    className={splitMode !== "equal" ? "custom-split-row" : ""}
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

                    {splitMode === "percentage" && (
                      <input
                        type="number"
                        min="0.1"
                        step="0.1"
                        value={customPercentages[member._id] || ""}
                        onChange={(event) =>
                          setCustomPercentages((current) => ({
                            ...current,
                            [member._id]: event.target.value,
                          }))
                        }
                        placeholder="% share"
                        disabled={!splitAmong.includes(member._id)}
                        aria-label={`${member.fullName}'s percentage`}
                      />
                    )}

                    {splitMode === "shares" && (
                      <input
                        type="number"
                        min="1"
                        step="1"
                        value={customShares[member._id] || "1"}
                        onChange={(event) =>
                          setCustomShares((current) => ({
                            ...current,
                            [member._id]: event.target.value,
                          }))
                        }
                        placeholder="Shares (e.g. 1, 2)"
                        disabled={!splitAmong.includes(member._id)}
                        aria-label={`${member.fullName}'s shares`}
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
                {splitMode === "percentage" && (
                  <p className="custom-split-total">
                    Total percentage: {customPercentageTotal.toFixed(1)}% / 100%
                  </p>
                )}
                {splitMode === "shares" && (
                  <p className="custom-split-total">
                    Total shares: {customSharesTotal}
                  </p>
                )}
              </fieldset>

              <button
                type="submit"
                className="btn-primary"
                disabled={isSubmittingExpense}
              >
                {isSubmittingExpense
                  ? "Saving..."
                  : editingExpenseId
                  ? "Update expense"
                  : "Save expense"}
              </button>
            </form>
          ) : (
            <div className="paper-card">
              <h2>Group is archived</h2>
              <p className="muted">
                This group has been archived. Unarchive it to add or edit expenses.
              </p>
            </div>
          )}

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
                        {Array.isArray(entry.expense.payers) && entry.expense.payers.length > 1
                          ? `Split across payers (${entry.expense.payers
                              .map((p) => p.userId?.fullName || "Member")
                              .join(", ")})`
                          : `${entry.expense.paidBy?.fullName} paid`}{" "}
                        · split with{" "}
                        {entry.expense.splits
                          ?.map((split) => split.userId?.fullName)
                          .filter(Boolean)
                          .join(", ")}
                      </p>
                      {entry.expense.notes && (
                        <p className="activity-note">Note: {entry.expense.notes}</p>
                      )}

                      {!group.isArchived &&
                        (entry.expense.paidBy?._id === user._id ||
                          group.createdBy === user._id) && (
                          <div className="activity-actions">
                            <button
                              type="button"
                              className="btn-link"
                              onClick={() => startEditExpense(entry.expense)}
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              className="btn-link danger"
                              onClick={() => handleDeleteExpense(entry.expense._id)}
                            >
                              Delete
                            </button>
                          </div>
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

      {/* Toast Notification */}
      {nudgeToast && <div className="toast">{nudgeToast}</div>}

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
      {budgetModalOpen && (
        <div className="payment-modal-backdrop" role="presentation">
          <form
            className="paper-card payment-modal"
            onSubmit={saveBudget}
            role="dialog"
            aria-modal="true"
            aria-labelledby="budget-modal-title"
          >
            <p className="eyebrow">Group budget</p>
            <h2 id="budget-modal-title">Set trip budget</h2>
            <p className="muted">
              Set the total spending limit for {group.name}. Expenses will be tracked against it.
            </p>
            <label>
              Budget amount (₹)
              <input
                type="number"
                min="0.01"
                step="0.01"
                value={budgetAmount}
                onChange={(event) => setBudgetAmount(event.target.value)}
                placeholder="5000.00"
                required
                autoFocus
              />
            </label>
            <div className="payment-actions">
              <button type="button" className="btn-ghost" onClick={() => setBudgetModalOpen(false)}>
                Cancel
              </button>
              <button type="submit" className="btn-primary">
                Save budget
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

export default GroupDetail;
