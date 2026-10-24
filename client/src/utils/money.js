export const formatINR = (paise) => {
  const rupees = (Number(paise) || 0) / 100;
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
  }).format(rupees);
};

export const paiseToRupeesInput = (paise) => ((Number(paise) || 0) / 100).toFixed(2);

export const formatDateTime = (isoString) => {
  if (!isoString) return "";
  const date = new Date(isoString);
  return date.toLocaleString("en-IN", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
};

export const formatDateOnly = (isoString) => {
  if (!isoString) return "";
  const date = new Date(isoString);
  return date.toLocaleDateString("en-IN", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

