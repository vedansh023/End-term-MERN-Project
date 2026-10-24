const crypto = require("crypto");

const makeInviteCode = () => {
  return crypto.randomBytes(3).toString("hex").toUpperCase();
};

module.exports = makeInviteCode;
