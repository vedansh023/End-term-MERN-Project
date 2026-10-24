import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import Navbar from "../components/Navbar";
import { addExpense, addSettlement, getGroup } from "../services/api";
import { formatINR, paiseToRupeesInput } from "../utils/money";
import { useAuth } from "../context/AuthContext";

function GroupDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState(null);

  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [paidBy, setPaidBy] = useState("");
  const [splitAmong, setSplitAmong] = useState([]);
  const [splitMode, setSplitMode] = useState("equal");
  const [customAmounts, setCustomAmounts] = useState({});

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
    () => splitAmong.reduce(
      (total, memberId) => total + (Math.round(Number(customAmounts[memberId]) * 100) || 0),
      0
    ),
    [customAmounts, splitAmong]
  );

  const handleExpense = async (event) => {
    event.preventDefault();
    setError("");

    try {
      await addExpense(id, {
        description,
        amount,
        paidBy,
        splitMode,
        splitAmong: splitMode === "custom"
          ? splitAmong.map((memberId) => ({
            userId: memberId,
            amount: customAmounts[memberId],
          }))
          : splitAmong,
      });
      setDescription("");
      setAmount("");
      await load();
    } catch (err) {
      setError(err.response?.data?.message || "Could not add expense");
    }
  };

  const recordSettlement = async (from, to, paise, status) => {
    setError("");
    try {
      await addSettlement(id, {
        from,
        to,
        amount: paiseToRupeesInput(paise),
        status,
      });
      await load();
      setSelectedPayment(null);
    } catch (err) {
      setError(err.response?.data?.message || "Could not record settlement");
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

  const { group, expenses, settlements, balances, suggestions } = data;

  return (
    <div>
      <Navbar />
      <main className="page">
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
          <button type="button" className="code-chip" onClick={copyCode}>
            Invite {group.inviteCode} {copied ? "copied" : "copy"}
          </button>
        </div>

        {error && <p className="error">{error}</p>}

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
              <article key={balance.userId} className={`balance-card ${net < 0 ? "owe" : net > 0 ? "owed" : "even"}`}>
                <h3>{nameById[balance.userId] || "Member"}</h3>
                <p>{label}</p>
              </article>
            );
          })}
        </section>

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
                      onClick={() => setSelectedPayment(item)}
                    >
                      Review payment
                    </button>
                  ) : (
                    <span className="payment-waiting">Awaiting {nameById[item.from]}</span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>

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
              Paid by
              <select value={paidBy} onChange={(event) => setPaidBy(event.target.value)}>
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
              <legend>{splitMode === "equal" ? "Split equally among" : "Custom shares"}</legend>
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
                      onChange={(event) => setCustomAmounts((current) => ({
                        ...current,
                        [member._id]: event.target.value,
                      }))}
                      placeholder="₹ amount"
                      disabled={!splitAmong.includes(member._id)}
                      aria-label={`${member.fullName}'s share`}
                    />
                  )}
                </div>
              ))}
              {splitMode === "custom" && (
                <p className="custom-split-total">
                  Entered: {formatINR(customSplitTotal)} · Total: {formatINR(Math.round(Number(amount) * 100) || 0)}
                </p>
              )}
            </fieldset>
            <button type="submit" className="btn-primary">
              Save expense
            </button>
          </form>

          <div className="paper-card">
            <h2>Activity</h2>
            {expenses.length === 0 && settlements.length === 0 ? (
              <p className="muted">Nothing yet. Add the first expense.</p>
            ) : (
              <ul className="activity">
                {[
                  ...expenses.map((expense) => ({ kind: "expense", at: expense.createdAt, expense })),
                  ...settlements.map((settlement) => ({
                    kind: "settlement",
                    at: settlement.createdAt,
                    settlement,
                  })),
                ]
                  .sort((a, b) => new Date(b.at) - new Date(a.at))
                  .map((entry) =>
                    entry.kind === "expense" ? (
                      <li key={entry.expense._id}>
                        <strong>{entry.expense.description}</strong>
                        <span>{formatINR(entry.expense.amount)}</span>
                        <p>
                          {entry.expense.paidBy.fullName} paid · split with{" "}
                          {entry.expense.splits.map((split) => split.userId.fullName).join(", ")}
                        </p>
                      </li>
                    ) : (
                      <li
                        key={entry.settlement._id}
                        className={entry.settlement.status === "delayed" ? "delayed" : "settled"}
                      >
                        <strong>
                          {entry.settlement.status === "delayed" ? "Payment delayed" : "Settlement"}
                        </strong>
                        <span>{formatINR(entry.settlement.amount)}</span>
                        <p>
                          {entry.settlement.from.fullName} {entry.settlement.status === "delayed" ? "delayed payment to" : "paid"}{" "}
                          {entry.settlement.to.fullName}
                        </p>
                      </li>
                    )
                  )}
              </ul>
            )}
          </div>
        </div>
      </main>
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
            <p className="muted">Marking this payment as delayed keeps the balance unchanged.</p>
            <div className="payment-actions">
              <button
                type="button"
                className="btn-ghost"
                onClick={() => setSelectedPayment(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => recordSettlement(
                  selectedPayment.from,
                  selectedPayment.to,
                  selectedPayment.amount,
                  "delayed"
                )}
              >
                Mark delayed
              </button>
              <button
                type="button"
                className="btn-primary"
                onClick={() => recordSettlement(
                  selectedPayment.from,
                  selectedPayment.to,
                  selectedPayment.amount,
                  "paid"
                )}
              >
                Mark paid
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

export default GroupDetail;
