const Group = require("../models/group.model");
const Expense = require("../models/expense.model");
const { rupeesToPaise, splitEqually } = require("../utils/money");

const validCategories = ["Food", "Travel", "Rent", "Shopping", "Entertainment", "Utilities", "Other"];

const addExpense = async (req, res) => {
  try {
    const { description, amount, paidBy, splitAmong, splitMode = "equal", category = "Other", notes } = req.body;
    const group = await Group.findById(req.params.id);

    if (!group) {
      return res.status(404).json({ message: "Group not found" });
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
    const payerId = (paidBy || req.user._id).toString();

    if (!memberSet.has(payerId)) {
      return res.status(400).json({ message: "Payer must be a group member" });
    }

    if (splitMode !== "equal" && splitMode !== "custom") {
      return res.status(400).json({ message: "Split mode must be equal or custom" });
    }

    let splits;

    if (splitMode === "custom") {
      if (!Array.isArray(splitAmong) || splitAmong.length === 0) {
        return res.status(400).json({ message: "Add at least one custom share" });
      }

      const splitIds = splitAmong.map((split) => split?.userId?.toString());
      if (splitIds.some((id) => !id)) {
        return res.status(400).json({ message: "Each custom share needs a person" });
      }
      if (new Set(splitIds).size !== splitIds.length) {
        return res.status(400).json({ message: "A person can only have one custom share" });
      }
      if (splitIds.some((id) => !memberSet.has(id))) {
        return res.status(400).json({ message: "Splits can only include group members" });
      }

      splits = splitAmong.map((split, index) => ({
        userId: splitIds[index],
        share: rupeesToPaise(split.amount),
      }));

      if (splits.some((split) => !split.share)) {
        return res.status(400).json({ message: "Each custom share must be greater than 0" });
      }

      const totalShares = splits.reduce((sum, split) => sum + split.share, 0);
      if (totalShares !== paise) {
        return res.status(400).json({
          message: "Custom shares must add up exactly to the expense total",
        });
      }
    } else {
      let splitIds = Array.isArray(splitAmong) && splitAmong.length > 0
        ? splitAmong.map((id) => id.toString())
        : [...memberSet];

      splitIds = [...new Set(splitIds)];

      if (splitIds.some((id) => !memberSet.has(id))) {
        return res.status(400).json({ message: "Splits can only include group members" });
      }

      splits = splitEqually(paise, splitIds);
    }

    const expense = await Expense.create({
      group: group._id,
      description: description.trim(),
      amount: paise,
      category: validCategories.includes(category) ? category : "Other",
      notes: typeof notes === "string" ? notes.trim() : "",
      paidBy: payerId,
      splits,
    });

    const populated = await Expense.findById(expense._id)
      .populate("paidBy", "fullName email")
      .populate("splits.userId", "fullName email");

    res.status(201).json(populated);
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};

module.exports = {
  addExpense,
};
