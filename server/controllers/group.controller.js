const Group = require("../models/group.model");
const Expense = require("../models/expense.model");
const Settlement = require("../models/settlement.model");
const makeInviteCode = require("../utils/inviteCode");
const { computeNets, simplifyDebts } = require("../utils/money");

const memberIds = (group) => group.members.map((member) => member._id.toString());

const isMember = (group, userId) => memberIds(group).includes(userId.toString());

const computeAnalytics = (group, expenses) => {
  const totalSpending = expenses.reduce((sum, exp) => sum + (exp.amount || 0), 0);

  const memberPaidMap = {};
  const memberShareMap = {};
  group.members.forEach((m) => {
    const id = m._id.toString();
    memberPaidMap[id] = 0;
    memberShareMap[id] = 0;
  });

  expenses.forEach((exp) => {
    const payerId = exp.paidBy?._id ? exp.paidBy._id.toString() : exp.paidBy?.toString();
    if (memberPaidMap[payerId] !== undefined) {
      memberPaidMap[payerId] += exp.amount;
    }
    exp.splits?.forEach((split) => {
      const splitId = split.userId?._id ? split.userId._id.toString() : split.userId?.toString();
      if (memberShareMap[splitId] !== undefined) {
        memberShareMap[splitId] += split.share;
      }
    });
  });

  let topPayer = null;
  let maxPaid = -1;
  group.members.forEach((m) => {
    const id = m._id.toString();
    const paid = memberPaidMap[id] || 0;
    if (paid > maxPaid) {
      maxPaid = paid;
      topPayer = {
        userId: id,
        fullName: m.fullName,
        amount: paid,
      };
    }
  });

  const categoryTotals = {};
  expenses.forEach((exp) => {
    const cat = exp.category || "Other";
    categoryTotals[cat] = (categoryTotals[cat] || 0) + exp.amount;
  });

  const categories = Object.entries(categoryTotals)
    .map(([category, amount]) => ({
      category,
      amount,
      percentage: totalSpending > 0 ? Math.round((amount / totalSpending) * 100) : 0,
    }))
    .sort((a, b) => b.amount - a.amount);

  const monthlyTotals = {};
  expenses.forEach((exp) => {
    const date = new Date(exp.createdAt);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    const label = date.toLocaleDateString("en-US", { month: "short", year: "numeric" });
    if (!monthlyTotals[key]) {
      monthlyTotals[key] = { key, label, amount: 0 };
    }
    monthlyTotals[key].amount += exp.amount;
  });

  const monthlySpending = Object.values(monthlyTotals).sort((a, b) => a.key.localeCompare(b.key));

  return {
    totalSpending,
    topPayer,
    categories,
    monthlySpending,
    memberStats: group.members.map((m) => {
      const id = m._id.toString();
      return {
        userId: id,
        fullName: m.fullName,
        totalPaid: memberPaidMap[id] || 0,
        totalShare: memberShareMap[id] || 0,
      };
    }),
  };
};

const buildSummary = (group, expenses, settlements) => {
  const ids = memberIds(group);
  const paidSettlements = settlements.filter((settlement) => settlement.status === "paid");
  const nets = computeNets(ids, expenses, paidSettlements);
  const suggestions = simplifyDebts(nets);
  const analytics = computeAnalytics(group, expenses);

  return {
    group,
    expenses,
    settlements,
    balances: ids.map((id) => ({
      userId: id,
      net: nets[id] || 0,
    })),
    suggestions,
    analytics,
  };
};

const createGroup = async (req, res) => {
  try {
    const { name } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ message: "Group name is required" });
    }

    const group = await Group.create({
      name: name.trim(),
      inviteCode: makeInviteCode(),
      createdBy: req.user._id,
      members: [req.user._id],
    });

    const populated = await Group.findById(group._id).populate("members", "fullName email");
    res.status(201).json(populated);
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ message: "Please try again" });
    }
    res.status(500).json({ message: "Server error" });
  }
};

const listGroups = async (req, res) => {
  try {
    const groups = await Group.find({ members: req.user._id })
      .populate("members", "fullName email")
      .sort({ createdAt: -1 });

    res.status(200).json(groups);
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};

const joinGroup = async (req, res) => {
  try {
    const { inviteCode } = req.body;

    if (!inviteCode) {
      return res.status(400).json({ message: "Invite code is required" });
    }

    const group = await Group.findOne({
      inviteCode: inviteCode.trim().toUpperCase(),
    });

    if (!group) {
      return res.status(404).json({ message: "No group found with that code" });
    }

    if (!group.members.some((id) => id.toString() === req.user._id.toString())) {
      group.members.push(req.user._id);
      await group.save();
    }

    const populated = await Group.findById(group._id).populate("members", "fullName email");
    res.status(200).json(populated);
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};

const getGroup = async (req, res) => {
  try {
    const group = await Group.findById(req.params.id).populate("members", "fullName email");

    if (!group) {
      return res.status(404).json({ message: "Group not found" });
    }

    if (!isMember(group, req.user._id)) {
      return res.status(403).json({ message: "You are not in this group" });
    }

    const expenses = await Expense.find({ group: group._id })
      .populate("paidBy", "fullName email")
      .populate("splits.userId", "fullName email")
      .sort({ createdAt: -1 });

    const settlements = await Settlement.find({ group: group._id })
      .populate("from", "fullName email")
      .populate("to", "fullName email")
      .sort({ createdAt: -1 });

    res.status(200).json(buildSummary(group, expenses, settlements));
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};

module.exports = {
  createGroup,
  listGroups,
  joinGroup,
  getGroup,
};
