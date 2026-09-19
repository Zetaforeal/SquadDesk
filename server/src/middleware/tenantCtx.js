/**
 * 租户上下文中间件
 * 1. 登录/公开接口：从 query/body/header 取 tenantId（小程序构建注入）
 * 2. 已登录接口：优先取 JWT 内 tenantId，并校验与请求参数一致（防越权）
 * 注入 req.tenantId（Int|null）
 */
const { BizError, Code } = require('../utils/response');

function parseTenantId(v) {
  if (!v) return null;
  const n = parseInt(v, 10);
  return Number.isInteger(n) && n > 0 ? n : null;
}

/**
 * @param {object} opts
 * @param {boolean} opts.required  是否强制要求租户（默认 false）
 */
function tenantCtx(opts = {}) {
  return (req, res, next) => {
    // 1. 从 JWT 取（优先且不可绕过）
    let tenantId = req.auth ? req.auth.tenantId : null;

    // 2. 公开接口从请求参数取
    if (!tenantId) {
      const fromParam = parseTenantId(req.query.tenantId || req.body.tenantId || req.headers['x-tenant-id']);
      tenantId = fromParam;
    }

    // 3. 已登录用户，若请求参数也带 tenantId，必须与 JWT 一致（跨租户攻击防护）
    if (req.auth && req.auth.tenantId) {
      const paramTenant = parseTenantId(req.query.tenantId || req.body.tenantId || req.headers['x-tenant-id']);
      if (paramTenant && paramTenant !== req.auth.tenantId) {
        return next(new BizError(Code.FORBIDDEN, '越权访问：租户不匹配'));
      }
    }

    if (opts.required && !tenantId) {
      return next(new BizError(Code.TENANT_NOT_FOUND, '缺少租户上下文 tenantId'));
    }

    req.tenantId = tenantId;
    next();
  };
}

module.exports = tenantCtx;
