// Minimal RFC 4180 CSV writer with spreadsheet formula-injection protection.
const cell = (v) => {
  if (v === null || v === undefined) return "";
  let s = String(v);
  if (/^[=+\-@\t\r]/.test(s) && !/^-?\d+(\.\d+)?$/.test(s)) s = `'${s}`;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

const toCsv = (headers, rows) =>
  [headers.map(cell).join(","), ...rows.map((r) => r.map(cell).join(","))].join("\r\n");

const sendCsv = (res, filename, headers, rows) => {
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="${filename.replace(/[^\w.-]/g, "_")}"`);
  res.send("﻿" + toCsv(headers, rows));
};

module.exports = { toCsv, sendCsv };
