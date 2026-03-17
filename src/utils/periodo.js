function getPeriodoFromDate(date = new Date()) {
  const month = date.getMonth() + 1; // 1..12
  if (month >= 1 && month <= 4) return "Q1";
  if (month >= 5 && month <= 8) return "Q2";
  return "Q3"; // 9..12
}

module.exports = { getPeriodoFromDate };