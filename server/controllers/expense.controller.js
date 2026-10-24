const Group = require("../models/group.model");
const Expense = require("../models/expense.model");
const {
  rupeesToPaise,
  splitEqually,
  splitByPercentage,
  splitByShares,
} = require("../utils/money");

const validCategories = [
  "Food",
  "Travel",
  "Rent",
  "Shopping",
  "Entertainment",
  "Utilities",
  "Other",
];

const calculateSplits = (splitMode, splitAmong, paise, memberSet) => {
  if (splitMode === "custom") {
    if (!Array.isArray(splitAmong) || splitAmong.length === 0) {
      return { error: "Add at least one custom share" };
    }
    const splitIds = splitAmong.map((s) => s?.userId?.toString());
    if (splitIds.some((id) => !id)) return { error: "Each custom share needs a person" };
    if (new Set(splitIds).size !== splitIds.length)
      return { error: "A person can only have one custom share" };
    if (splitIds.some((id) => !memberSet.has(id)))
      return { error: "Splits can only include group members" };

    const splits = splitAmong.map((s, idx) => ({
      userId: splitIds[idx],
      share: rupeesToPaise(s.amount),
    }));
    if (splits.some((s) => !s.share))
      return { error: "Each custom share must be greater than 0" };
    const totalShares = splits.reduce((sum, s) => sum + s.share, 0);
    if (totalShares !== paise) {
      return { error: "Custom shares must add up exactly to the expense total" };
    }
    return { splits };
  }

  if (splitMode === "percentage") {
    if (!Array.isArray(splitAmong) || splitAmong.length === 0) {
      return { error: "Add percentage splits for members" };
    }
    const splitIds = splitAmong.map((s) => s?.userId?.toString());
    if (splitIds.some((id) => !id || !memberSet.has(id))) {
      return { error: "Splits can only include group members" };
    }
    const totalPct = splitAmong.reduce(
      (sum, s) => sum + (Number(s.percentage) || 0),
      0
    );
    if (Math.abs(totalPct - 100) > 0.1) {
      return {
        error: `Percentages must add up to 100% (currently ${totalPct.toFixed(1)}%)`,
      };
    }
    const splits = splitByPercentage(
      paise,
      splitAmong.map((s) => ({
        userId: s.userId.toString(),
        percentage: Number(s.percentage) || 0,
      }))
    );
    return { splits };
  }

  if (splitMode === "shares") {
    if (!Array.isArray(splitAmong) || splitAmong.length === 0) {
      return { error: "Add shares for members" };
    }
    const splitIds = splitAmong.map((s) => s?.userId?.toString());
    if (splitIds.some((id) => !id || !memberSet.has(id))) {
      return { error: "Splits can only include group members" };
    }
    const totalShares = splitAmong.reduce(
      (sum, s) => sum + (Number(s.shares) || 0),
      0
    );
    if (totalShares <= 0) {
      return { error: "Total shares must be greater than 0" };
    }
    const splits = splitByShares(
      paise,
      splitAmong.map((s) => ({
        userId: s.userId.toString(),
        shares: Number(s.shares) || 0,
      }))
    );
    return { splits };
  }

  // Default: equal
  let splitIds =
    Array.isArray(splitAmong) && splitAmong.length > 0
      ? splitAmong.map((item) =>
          typeof item === "object" ? item?.userId?.toString() : item?.toString()
        )
      : [...memberSet];

  splitIds = [...new Set(splitIds)].filter(Boolean);
  if (splitIds.some((id) => !memberSet.has(id))) {
    return { error: "Splits can only include group members" };
  }

  const splits = splitEqually(paise, splitIds);
  return { splits };
};

const addExpense = async (req, res) => {
  try {
    const {
      description,
      amount,
      paidBy,
      payers,
      splitAmong,
      splitMode = "equal",
      category = "Other",
      notes,
    } = req.body;

    const group = await Group.findById(req.params.id);

    if (!group) {
      return res.status(404).json({ message: "Group not found" });
    }

    if (group.isArchived) {
      return res.status(400).json({ message: "This group is archived and cannot be edited" });
    }

    if (!group.members.some((id) => id.toString() === req.user._id.toString())) {
      return res.status(403).json({ message: "You are not in this group" });
    }

    if (!description || !description.trim()) {
      return res.status(400).json({ message: "Description is required" });
    }

    const paise = rupeesToPaise(amount);
    if (!paise) {
      return res.status(400).json({ message: "Amount must be greater than 0" });
    }

    const memberSet = new Set(group.members.map((id) => id.toString()));

    // Handle single or multi-payer
    let finalPayers = [];
    let primaryPayerId = (paidBy || req.user._id).toString();

    if (Array.isArray(payers) && payers.length > 0) {
      let payerSum = 0;
      for (const p of payers) {
        const pId = p.userId?.toString();
        if (!memberSet.has(pId)) {
          return res.status(400).json({ message: "All payers must be group members" });
        }
        const pPaise = rupeesToPaise(p.amount);
        if (!pPaise || pPaise <= 0) {
          return res.status(400).json({ message: "Payer amounts must be greater than 0" });
        }
        payerSum += pPaise;
        finalPayers.push({ userId: pId, amount: pPaise });
      }
      if (payerSum !== paise) {
        return res.status(400).json({ message: "Payer amounts must sum exactly to the expense total" });
      }
      primaryPayerId = finalPayers[0].userId;
    } else {
      if (!memberSet.has(primaryPayerId)) {
        return res.status(400).json({ message: "Payer must be a group member" });
      }
    }

    const { splits, error } = calculateSplits(splitMode, splitAmong, paise, memberSet);
    if (error) {
      return res.status(400).json({ message: error });
    }

    const expense = await Expense.create({
      group: group._id,
      description: description.trim(),
      amount: paise,
      category: validCategories.includes(category) ? category : "Other",
      notes: typeof notes === "string" ? notes.trim() : "",
      splitMode,
      paidBy: primaryPayerId,
      payers: finalPayers,
      splits,
    });

    const populated = await Expense.findById(expense._id)
      .populate("paidBy", "fullName email")
      .populate("payers.userId", "fullName email")
      .populate("splits.userId", "fullName email");

    res.status(201).json(populated);
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};

const updateExpense = async (req, res) => {
  try {
    const { id: groupId, expenseId } = req.params;
    const {
      description,
      amount,
      paidBy,
      payers,
      splitAmong,
      splitMode = "equal",
      category = "Other",
      notes,
    } = req.body;

    const group = await Group.findById(groupId);
    if (!group) {
      return res.status(404).json({ message: "Group not found" });
    }

    if (group.isArchived) {
      return res.status(400).json({ message: "This group is archived and cannot be edited" });
    }

    const expense = await Expense.findById(expenseId);
    if (!expense) {
      return res.status(404).json({ message: "Expense not found" });
    }

    const isAuthorized =
      expense.paidBy.toString() === req.user._id.toString() ||
      group.createdBy.toString() === req.user._id.toString();

    if (!isAuthorized) {
      return res.status(403).json({ message: "Only the payer or group creator can edit this expense" });
    }

    if (!description || !description.trim()) {
      return res.status(400).json({ message: "Description is required" });
    }

    const paise = rupeesToPaise(amount);
    if (!paise) {
      return res.status(400).json({ message: "Amount must be greater than 0" });
    }

    const memberSet = new Set(group.members.map((m) => m.toString()));

    let finalPayers = [];
    let primaryPayerId = (paidBy || expense.paidBy).toString();

    if (Array.isArray(payers) && payers.length > 0) {
      let payerSum = 0;
      for (const p of payers) {
        const pId = p.userId?.toString();
        if (!memberSet.has(pId)) {
          return res.status(400).json({ message: "All payers must be group members" });
        }
        const pPaise = rupeesToPaise(p.amount);
        if (!pPaise || pPaise <= 0) {
          return res.status(400).json({ message: "Payer amounts must be greater than 0" });
        }
        payerSum += pPaise;
        finalPayers.push({ userId: pId, amount: pPaise });
      }
      if (payerSum !== paise) {
        return res.status(400).json({ message: "Payer amounts must sum exactly to the expense total" });
      }
      primaryPayerId = finalPayers[0].userId;
    } else {
      if (!memberSet.has(primaryPayerId)) {
        return res.status(400).json({ message: "Payer must be a group member" });
      }
    }

    const { splits, error } = calculateSplits(splitMode, splitAmong, paise, memberSet);
    if (error) {
      return res.status(400).json({ message: error });
    }

    expense.description = description.trim();
    expense.amount = paise;
    expense.category = validCategories.includes(category) ? category : "Other";
    expense.notes = typeof notes === "string" ? notes.trim() : "";
    expense.splitMode = splitMode;
    expense.paidBy = primaryPayerId;
    expense.payers = finalPayers;
    expense.splits = splits;

    await expense.save();

    const populated = await Expense.findById(expense._id)
      .populate("paidBy", "fullName email")
      .populate("payers.userId", "fullName email")
      .populate("splits.userId", "fullName email");

    res.status(200).json(populated);
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};

const deleteExpense = async (req, res) => {
  try {
    const { id: groupId, expenseId } = req.params;

    const group = await Group.findById(groupId);
    if (!group) {
      return res.status(404).json({ message: "Group not found" });
    }

    if (group.isArchived) {
      return res.status(400).json({ message: "This group is archived and cannot be edited" });
    }

    const expense = await Expense.findById(expenseId);
    if (!expense) {
      return res.status(404).json({ message: "Expense not found" });
    }

    const isAuthorized =
      expense.paidBy.toString() === req.user._id.toString() ||
      group.createdBy.toString() === req.user._id.toString();

    if (!isAuthorized) {
      return res.status(403).json({ message: "Only the payer or group creator can delete this expense" });
    }

    await Expense.findByIdAndDelete(expenseId);

    res.status(200).json({ success: true, message: "Expense deleted" });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};

module.exports = {
  addExpense,
  updateExpense,
  deleteExpense,
};
