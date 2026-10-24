const Group = require("../models/group.model");
const Expense = require("../models/expense.model");
const Settlement = require("../models/settlement.model");
const makeInviteCode = require("../utils/inviteCode");
const { computeNets, simplifyDebts } = require("../utils/money");

const memberIds = (group) => group.members.map((member) => member._id.toString());

const isMember = (group, userId) => memberIds(group).includes(userId.toString());

const buildSummary = (group, expenses, settlements) => {
  const ids = memberIds(group);
  const paidSettlements = settlements.filter((settlement) => settlement.status !== "delayed");
  const nets = computeNets(ids, expenses, paidSettlements);
  const suggestions = simplifyDebts(nets);

  return {
    group,
    expenses,
    settlements,
    balances: ids.map((id) => ({
      userId: id,
      net: nets[id] || 0,
    })),
    suggestions,
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
