export const formatINR = (paise) => {
  const rupees = (Number(paise) || 0) / 100;
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
  }).format(rupees);
};

export const paiseToRupeesInput = (paise) => ((Number(paise) || 0) / 100).toFixed(2);
