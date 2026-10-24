const mongoose = require("mongoose");

const expenseSchema = new mongoose.Schema({
  group: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Group",
    required: true,
  },
  description: {
    type: String,
    required: true,
    trim: true,
  },
  amount: {
    type: Number,
    required: true,
    min: 1,
  },
  category: {
    type: String,
    enum: ["Food", "Travel", "Rent", "Shopping", "Entertainment", "Utilities", "Other"],
    default: "Other",
  },
  notes: {
    type: String,
    trim: true,
    default: "",
  },
  splitMode: {
    type: String,
    enum: ["equal", "custom", "percentage", "shares"],
    default: "equal",
  },
  paidBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  payers: [
    {
      userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
      },
      amount: {
        type: Number,
        required: true,
      },
    },
  ],
  splits: [
    {
      userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
      },
      share: {
        type: Number,
        required: true,
      },
    },
  ],
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model("Expense", expenseSchema);
