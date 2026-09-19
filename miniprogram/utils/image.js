// utils/image.js — 图片双通道（相对路径补全 baseUrl，外部 URL 原样返回）
const app = getApp();

function resolveImageUrls(url) {
  if (!url) return '';
  if (Array.isArray(url)) return url.map((u) => resolveImageUrls(u));
  if (typeof url === 'string' && url.startsWith('/uploads/')) {
    return `${app.globalData.baseUrl}${url}`;
  }
  return url;
}

module.exports = { resolveImageUrls };
