/**
 * 租户守卫：校验俱乐部存在/启用/未到期
 * blockNewTrade=true 时（下单/支付/抢单/指派/自动派单）：到期返回 1002，只禁新交易
 * 否则仅校验俱乐部存在（浏览/查询/结算不受限）
 */
const { prisma } = require('../db');
const { BizError, Code } = require('../utils/response');
const { now } = require('../utils/time');

// 简单租户缓存（10s），避免每个请求都查库
const clubCache = new Map(); // tenantId -> { status, expiresAt, expiresAtMs, cachedAt }

async function loadClub(tenantId) {
  const cached = clubCache.get(tenantId);
  if (cached && Date.now() - cached.cachedAt < 10000) return cached;

  const club = await prisma.club.findUnique({
    where: { id: tenantId },
    select: { id: true, status: true, expiresAt: true },
  });
  if (!club) return null;

  const entry = {
    status: club.status,
    expiresAtMs: club.expiresAt ? club.expiresAt.getTime() : null,
    cachedAt: Date.now(),
  };
  clubCache.set(tenantId, entry);
  return entry;
}

function invalidateClubCache(tenantId) {
  clubCache.delete(tenantId);
}

/**
 * @param {object} opts
 * @param {boolean} opts.blockNewTrade 是否拦截新交易（默认 false）
 * @param {boolean} opts.blockExpired  到期后是否完全拦截（小程序端用，默认 false）
 *                                     true：到期任何请求都返回 1002（含浏览/登录），小程序完全不可用
 */
function tenantGuard(opts = {}) {
  return async (req, res, next) => {
    try {
      const tenantId = req.tenantId;
      if (!tenantId) return next(new BizError(Code.TENANT_NOT_FOUND, '租户不存在'));

      const club = await loadClub(tenantId);
      if (!club || club.status !== 1) {
        // 租户不存在/停用 = 会话持有无效租户，语义等同未登录 → 401 让前端强制重新登录
        return next(new BizError(Code.UNAUTHORIZED, '租户不存在或已停用，请重新登录'));
      }

      const expired = club.expiresAtMs !== null && now() > club.expiresAtMs;
      if (expired && (opts.blockNewTrade || opts.blockExpired)) {
        return next(new BizError(Code.CLUB_EXPIRED, '俱乐部服务已到期，请联系平台续费'));
      }

      // 到期但允许浏览/结算等非新交易操作（blockExpired 未开启时）
      req.clubExpired = expired;
      next();
    } catch (e) {
      next(e);
    }
  };
}

module.exports = { tenantGuard, invalidateClubCache };
