const express = require("express");
const {
  createGroup,
  listGroups,
  joinGroup,
  getGroup,
  toggleArchiveGroup,
  updateBudget,
} = require("../controllers/group.controller");
const {
  addExpense,
  updateExpense,
  deleteExpense,
} = require("../controllers/expense.controller");
const { addSettlement } = require("../controllers/settlement.controller");
const authMiddleware = require("../middlewares/auth.middleware");

const router = express.Router();

router.use(authMiddleware);

router.get("/", listGroups);
router.post("/", createGroup);
router.post("/join", joinGroup);
router.get("/:id", getGroup);
router.post("/:id/archive", toggleArchiveGroup);
router.put("/:id/budget", updateBudget);
router.post("/:id/expenses", addExpense);
router.put("/:id/expenses/:expenseId", updateExpense);
router.delete("/:id/expenses/:expenseId", deleteExpense);
router.post("/:id/settlements", addSettlement);

module.exports = router;
