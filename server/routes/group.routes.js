const express = require("express");
const {
  createGroup,
  listGroups,
  joinGroup,
  getGroup,
} = require("../controllers/group.controller");
const { addExpense } = require("../controllers/expense.controller");
const { addSettlement } = require("../controllers/settlement.controller");
const authMiddleware = require("../middlewares/auth.middleware");

const router = express.Router();

router.use(authMiddleware);

router.get("/", listGroups);
router.post("/", createGroup);
router.post("/join", joinGroup);
router.get("/:id", getGroup);
router.post("/:id/expenses", addExpense);
router.post("/:id/settlements", addSettlement);

module.exports = router;
