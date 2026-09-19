// utils/time.js — 时间格式化
function formatTime(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// 解析后端返回的 ISO 时间（含 T 与 Z 处理）
function parseTime(str) {
  if (!str) return '';
  return formatTime(str.replace('T', ' ').replace('Z', '').slice(0, 19));
}

module.exports = { formatTime, parseTime };
