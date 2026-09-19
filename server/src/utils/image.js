/**
 * 图片双通道工具（方案 2.4 全局约定）
 * - 上传文件：库中存相对路径 /uploads/xxx.jpg，Nginx 静态托管
 * - 外部 URL ：直接存完整 https://... 链接，不做服务端代理
 * 服务端校验：空、/uploads/ 开头相对路径、或合法 http(s):// URL，其余拒绝。
 */

/** 校验图片字段值是否合法，返回 { ok, error } */
function validateImageField(value) {
  if (value === null || value === undefined || value === '') {
    return { ok: true, error: null };
  }
  if (typeof value !== 'string') {
    return { ok: false, error: '图片字段必须为字符串' };
  }
  if (value.startsWith('/uploads/')) {
    return { ok: true, error: null };
  }
  try {
    const u = new URL(value);
    if (u.protocol === 'http:' || u.protocol === 'https:') {
      return { ok: true, error: null };
    }
  } catch (e) {
    // fallthrough
  }
  return { ok: false, error: '图片仅支持 /uploads/ 相对路径或 http(s):// 完整 URL' };
}

/** 前端展示：相对路径补全 baseUrl，完整 URL 原样返回（小程序 resolveImageUrls 同构版本） */
function resolveImageUrl(url, baseUrl) {
  if (!url) return '';
  if (url.startsWith('/uploads/')) {
    return `${baseUrl}${url}`;
  }
  return url;
}

/** 批量补全 */
function resolveImageUrls(urls, baseUrl) {
  if (Array.isArray(urls)) return urls.map((u) => resolveImageUrl(u, baseUrl));
  return resolveImageUrl(urls, baseUrl);
}

/** 判断是否为本地相对路径（删除文件时仅对本地文件执行） */
function isLocalPath(url) {
  return typeof url === 'string' && url.startsWith('/uploads/');
}

module.exports = { validateImageField, resolveImageUrl, resolveImageUrls, isLocalPath };
