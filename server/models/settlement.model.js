const mongoose = require("mongoose");

const settlementSchema = new mongoose.Schema({
  group: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Group",
    required: true,
  },
  from: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  to: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  amount: {
    type: Number,
    required: true,
    min: 1,
  },
  status: {
    type: String,
    enum: ["paid", "delayed", "pending"],
    default: "paid",
  },
  note: {
    type: String,
    trim: true,
    default: "",
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model("Settlement", settlementSchema);
