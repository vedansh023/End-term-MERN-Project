const asId = (value) => {
  if (value && typeof value === "object") {
    if (value._id) {
      return value._id.toString();
    }
  }
  return value.toString();
};

const rupeesToPaise = (value) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null;
  }
  return Math.round(parsed * 100);
};

const splitEqually = (totalPaise, memberIds) => {
  const n = memberIds.length;
  const base = Math.floor(totalPaise / n);
  const remainder = totalPaise % n;

  return memberIds.map((id, index) => ({
    userId: id,
    share: base + (index < remainder ? 1 : 0),
  }));
};

const splitByPercentage = (totalPaise, percentageSplits) => {
  let allocated = 0;
  const result = percentageSplits.map((item) => {
    const rawPaise = Math.floor((totalPaise * item.percentage) / 100);
    allocated += rawPaise;
    return {
      userId: item.userId,
      share: rawPaise,
    };
  });

  let remainder = totalPaise - allocated;
  let idx = 0;
  while (remainder > 0 && idx < result.length) {
    result[idx].share += 1;
    remainder -= 1;
    idx = (idx + 1) % result.length;
  }
  return result;
};

const splitByShares = (totalPaise, shareSplits) => {
  const totalShares = shareSplits.reduce((sum, item) => sum + (Number(item.shares) || 0), 0);
  if (totalShares <= 0) return [];

  let allocated = 0;
  const result = shareSplits.map((item) => {
    const rawPaise = Math.floor((totalPaise * (Number(item.shares) || 0)) / totalShares);
    allocated += rawPaise;
    return {
      userId: item.userId,
      share: rawPaise,
    };
  });

  let remainder = totalPaise - allocated;
  let idx = 0;
  while (remainder > 0 && idx < result.length) {
    result[idx].share += 1;
    remainder -= 1;
    idx = (idx + 1) % result.length;
  }
  return result;
};

const computeNets = (memberIds, expenses, settlements) => {
  const net = {};
  memberIds.forEach((id) => {
    net[id] = 0;
  });

  expenses.forEach((expense) => {
    if (Array.isArray(expense.payers) && expense.payers.length > 0) {
      expense.payers.forEach((payer) => {
        const id = asId(payer.userId);
        if (net[id] === undefined) {
          net[id] = 0;
        }
        net[id] += (payer.amount || 0);
      });
    } else {
      const paidBy = asId(expense.paidBy);
      if (net[paidBy] === undefined) {
        net[paidBy] = 0;
      }
      net[paidBy] += expense.amount;
    }

    expense.splits.forEach((split) => {
      const id = asId(split.userId);
      if (net[id] === undefined) {
        net[id] = 0;
      }
      net[id] -= split.share;
    });
  });

  settlements.forEach((settlement) => {
    if (settlement.status && settlement.status !== "paid") {
      return;
    }
    const from = asId(settlement.from);
    const to = asId(settlement.to);
    if (net[from] === undefined) {
      net[from] = 0;
    }
    if (net[to] === undefined) {
      net[to] = 0;
    }
    net[from] += settlement.amount;
    net[to] -= settlement.amount;
  });

  return net;
};

const simplifyDebts = (net) => {
  const debtors = [];
  const creditors = [];

  Object.entries(net).forEach(([id, amount]) => {
    if (amount < 0) {
      debtors.push({ id, amount });
    } else if (amount > 0) {
      creditors.push({ id, amount });
    }
  });

  debtors.sort((a, b) => a.amount - b.amount);
  creditors.sort((a, b) => b.amount - a.amount);

  const suggestions = [];
  let i = 0;
  let j = 0;

  while (i < debtors.length && j < creditors.length) {
    const pay = Math.min(-debtors[i].amount, creditors[j].amount);
    if (pay > 0) {
      suggestions.push({
        from: debtors[i].id,
        to: creditors[j].id,
        amount: pay,
      });
      debtors[i].amount += pay;
      creditors[j].amount -= pay;
    }
    if (debtors[i].amount === 0) {
      i += 1;
    }
    if (creditors[j].amount === 0) {
      j += 1;
    }
  }

  return suggestions;
};

module.exports = {
  rupeesToPaise,
  splitEqually,
  splitByPercentage,
  splitByShares,
  computeNets,
  simplifyDebts,
};
