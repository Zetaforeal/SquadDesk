/**
 * 鉴权中间件：解析 JWT 注入 req.auth = { actorId, tenantId, role, actorType }
 * 可选参数 roles: 允许的角色数组（未匹配返回 403）
 */
const { verifyToken, extractToken } = require('../utils/jwt');
const { BizError, Code } = require('../utils/response');

function auth(roles) {
  return (req, res, next) => {
    const token = extractToken(req);
    if (!token) return next(new BizError(Code.UNAUTHORIZED, '未登录'));
    try {
      const payload = verifyToken(token);
      // 载荷必须含 actorId 与 tenantId（超管 tenantId 可为 null）
      if (!payload.actorId) return next(new BizError(Code.UNAUTHORIZED, 'token 无效'));
      req.auth = payload;

      if (roles && roles.length && !roles.includes(payload.role)) {
        return next(new BizError(Code.FORBIDDEN, '无权限访问'));
      }
      next();
    } catch (e) {
      next(e);
    }
  };
}

module.exports = auth;
