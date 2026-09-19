/**
 * 输入安全工具：过滤 HTML 标签，防存储型 XSS（纵深防御）
 * 前端默认转义已拦截大部分，此处防止数据被第三方消费或未来富文本渲染引入风险
 */
const TAG_REGEX = /<[^>]*>/g;

/** 去除字符串中的 HTML 标签 */
function stripHtml(str) {
  if (typeof str !== 'string') return str;
  return str.replace(TAG_REGEX, '').replace(/[<>]/g, '').trim();
}

/** 安全文本：可选长度限制 */
function safeText(value, maxLen = 200) {
  if (typeof value !== 'string') return value;
  const cleaned = stripHtml(value);
  return maxLen ? cleaned.slice(0, maxLen) : cleaned;
}

module.exports = { stripHtml, safeText };
