/**
 * JWT 工具（载荷固定：{ actorId, tenantId, role, actorType }）
 * actorType: user | admin | player | super
 * role:      SUPER_ADMIN | CLUB_ADMIN | PLAYER | USER
 */
const jwt = require('jsonwebtoken');
const { env } = require('../config');
const { BizError, Code } = require('./response');

function signToken(payload) {
  return jwt.sign(payload, env.JWT_SECRET, { expiresIn: env.JWT_EXPIRES_IN });
}

function verifyToken(token) {
  try {
    return jwt.verify(token, env.JWT_SECRET);
  } catch (e) {
    throw new BizError(Code.UNAUTHORIZED, '登录已过期，请重新登录');
  }
}

/** 从 Authorization: Bearer xxx 提取 token */
function extractToken(req) {
  const header = req.headers.authorization || '';
  if (header.startsWith('Bearer ')) return header.slice(7);
  return null;
}

module.exports = { signToken, verifyToken, extractToken };
