// utils/dateUtils.js
const normalizeDate = (dateInput) => {
  const d = new Date(dateInput);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
};

const getMonthRange = (year, month) => {
  // month: 1-12
  const y = Number(year);
  const m = Number(month);
  const start = new Date(y, m - 1, 1);
  const end = new Date(y, m, 1);
  return { start, end };
};

module.exports = {
  normalizeDate,
  getMonthRange,
};
