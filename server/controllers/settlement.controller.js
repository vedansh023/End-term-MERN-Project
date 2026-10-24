const Group = require("../models/group.model");
const Settlement = require("../models/settlement.model");
const { rupeesToPaise } = require("../utils/money");

const addSettlement = async (req, res) => {
  try {
    const { from, to, amount, status = "paid", note } = req.body;
    const group = await Group.findById(req.params.id);

    if (!group) {
      return res.status(404).json({ message: "Group not found" });
    }

    if (!group.members.some((id) => id.toString() === req.user._id.toString())) {
      return res.status(403).json({ message: "You are not in this group" });
    }

    const memberSet = new Set(group.members.map((id) => id.toString()));
    const fromId = from && from.toString();
    const toId = to && to.toString();

    if (!fromId || !toId) {
      return res.status(400).json({ message: "From and to are required" });
    }

    if (fromId === toId) {
      return res.status(400).json({ message: "Cannot settle with yourself" });
    }

    if (!memberSet.has(fromId) || !memberSet.has(toId)) {
      return res.status(400).json({ message: "Both people must be in the group" });
    }

    if (fromId !== req.user._id.toString()) {
      return res.status(403).json({ message: "Only the person paying can update this payment" });
    }

    if (status !== "paid" && status !== "delayed" && status !== "pending") {
      return res.status(400).json({ message: "Payment status must be paid, delayed, or pending" });
    }

    const paise = rupeesToPaise(amount);
    if (!paise) {
      return res.status(400).json({ message: "Amount must be greater than 0" });
    }

    // Prevent duplicate settlement submissions within a short window
    const recentDuplicate = await Settlement.findOne({
      group: group._id,
      from: fromId,
      to: toId,
      amount: paise,
      status,
      createdAt: { $gte: new Date(Date.now() - 5000) },
    });
    if (recentDuplicate) {
      return res.status(409).json({ message: "A matching settlement was just recorded. Please wait a moment." });
    }

    const settlement = await Settlement.create({
      group: group._id,
      from: fromId,
      to: toId,
      amount: paise,
      status,
      note: typeof note === "string" ? note.trim() : "",
    });

    const populated = await Settlement.findById(settlement._id)
      .populate("from", "fullName email")
      .populate("to", "fullName email");

    res.status(201).json(populated);
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};

module.exports = {
  addSettlement,
};
