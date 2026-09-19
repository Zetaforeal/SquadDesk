/**
 * 请求日志中间件（全局挂载，方案 2.5 / 4.7）
 * 记录 { method, path, query, tenantId, actor, role, status, durationMs, clientIp }
 * 4xx/5xx 附加错误摘要
 */
const logger = require('../utils/logger');

function requestLog(req, res, next) {
  const start = Date.now();
  const clientIp =
    (req.headers['x-forwarded-for'] || '').split(',')[0].trim() ||
    req.socket.remoteAddress ||
    '';

  res.on('finish', () => {
    const durationMs = Date.now() - start;
    logger.request({
      method: req.method,
      path: req.originalUrl.split('?')[0],
      query: req.query && Object.keys(req.query).length ? req.query : undefined,
      tenantId: req.tenantId ?? undefined,
      actor: req.auth ? req.auth.actorId : undefined,
      role: req.auth ? req.auth.role : undefined,
      status: res.statusCode,
      durationMs,
      clientIp,
    });
  });

  next();
}

module.exports = requestLog;
