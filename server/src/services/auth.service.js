/**
 * 认证服务：微信登录 / 手机号登录 / 管理员登录 / 打手登录
 */
const bcrypt = require('bcryptjs');
const { prisma } = require('../db');
const { signToken } = require('../utils/jwt');
const { BizError, Code } = require('../utils/response');
const { code2Session } = require('../utils/wxapi');
const { getWechatConfig, isWechatConfigured, getConfig } = require('../models/clubConfig');
const { now } = require('../utils/time');
const { env } = require('../config');

// 异步 bcrypt 比较（不阻塞事件循环，登录并发性能关键）
function bcryptCompare(plain, hash) {
  return new Promise((resolve, reject) => {
    bcrypt.compare(plain, hash, (err, ok) => (err ? reject(err) : resolve(ok)));
  });
}
const { assertNotLocked, onLoginFail, onLoginSuccess } = require('./loginGuard');

/**
 * 小程序微信登录（按租户 AppID/Secret 调 code2session）
 * @returns {Promise<{token, user}>}
 */
async function userLoginWechat({ tenantId, code, nickname, avatarUrl }) {
  // 统一转数字：小程序端 tenantId 以字符串传递
  tenantId = parseInt(tenantId, 10);
  const cfg = await getWechatConfig(tenantId);

  // 仅显式启用的非生产环境允许开发登录；生产配置缺失必须失败。
  let openid = null;
  let unionid = null;
  if (isWechatConfigured(cfg)) {
    const session = await code2Session(cfg.appId, cfg.secret, code);
    openid = session.openid;
    unionid = session.unionid || null;
  } else if (env.NODE_ENV !== 'production' && env.ALLOW_DEV_LOGIN) {
    // 测试 openid：租户前缀 + 小程序 code（同一客户端稳定）
    openid = `dev_${tenantId}_${(code || 'x').slice(0, 28)}`;
  } else {
    throw new BizError(Code.VALIDATE_ERROR, '俱乐部未配置微信登录');
  }

  const user = await prisma.user.upsert({
    where: { tenantId_openid: { tenantId, openid } },
    update: {
      ...(nickname ? { nickname } : {}),
      ...(avatarUrl ? { avatarUrl } : {}),
      unionid: unionid || undefined,
    },
    create: { tenantId, openid, unionid, nickname: nickname || null, avatarUrl: avatarUrl || null },
  });

  const token = signToken({
    actorId: user.id,
    tenantId: user.tenantId,
    role: 'USER',
    actorType: 'user',
  });

  return { token, user: { id: user.id, nickname: user.nickname, avatarUrl: user.avatarUrl } };
}

/**
 * 发送手机验证码（外部短信接口，异步任务入队后立即返回）
 * 俱乐部独立配置 phone_sms_url；未配置时：
 *   非生产环境（开发/测试）返回固定码 123456 便于联调；
 *   生产环境禁用（无短信接口则不能发码，防滥用）
 */
async function sendPhoneCode({ tenantId, phone }) {
  const smsUrl = await getConfig(tenantId, 'phone_sms_url', '');
  if (!smsUrl) {
    const isProd = env.NODE_ENV === 'production';
    if (isProd || !env.ALLOW_DEV_LOGIN) {
      throw new BizError(Code.VALIDATE_ERROR, '短信服务未配置，请联系管理员');
    }
    return { devCode: '123456', queued: false };
  }
  // 异步入队（job: SMS_CODE）
  const { enqueue } = require('../jobs/enqueue');
  await enqueue(tenantId, 'SMS_CODE', { phone });
  return { queued: true };
}

/**
 * 手机号登录（调用租户外部验证接口）
 * 未配置接口时：仅非生产环境允许固定验证码 123456
 */
async function userLoginPhone({ tenantId, phone, code }) {
  // 统一转数字：小程序端 tenantId 以字符串传递
  tenantId = parseInt(tenantId, 10);
  const loginUrl = await getConfig(tenantId, 'phone_login_url', '');
  if (!loginUrl) {
    const isProd = env.NODE_ENV === 'production';
    if (isProd || !env.ALLOW_DEV_LOGIN) {
      throw new BizError(Code.VALIDATE_ERROR, '手机号登录未配置，请联系管理员');
    }
    if (code !== '123456') throw new BizError(Code.VALIDATE_ERROR, '验证码错误');
  } else {
    // TODO: 调用租户外部验证接口（按该租户 phone_login_url）
    // const ok = await verifyExternalPhoneLogin(loginUrl, { phone, code, tenantId });
    // if (!ok) throw new BizError(Code.VALIDATE_ERROR, '验证码错误');
    throw new BizError(Code.VALIDATE_ERROR, '手机号登录外部接口待配置');
  }

  // 手机号登录：openid 用 phone 虚拟键（租户内唯一）
  const openid = `phone_${phone}`;
  const user = await prisma.user.upsert({
    where: { tenantId_openid: { tenantId, openid } },
    update: {},
    create: { tenantId, openid },
  });

  const token = signToken({
    actorId: user.id,
    tenantId: user.tenantId,
    role: 'USER',
    actorType: 'user',
  });
  return { token, user: { id: user.id, nickname: user.nickname, avatarUrl: user.avatarUrl } };
}

/**
 * 俱乐部管理员登录（含防爆破：连续失败 5 次锁定 15 分钟）
 */
async function adminLogin({ username, password, tenantId }) {
  const keyWhere = { tenantId_username: { tenantId, username } };
  await assertNotLocked(prisma.adminUser, keyWhere);

  const admin = await prisma.adminUser.findUnique({ where: keyWhere });
  if (!admin || admin.role !== 'CLUB_ADMIN') {
    await onLoginFail(prisma.adminUser, keyWhere);
    throw new BizError(Code.TENANT_NOT_FOUND, '账号不存在');
  }
  if (!(await bcryptCompare(password, admin.password))) {
    await onLoginFail(prisma.adminUser, keyWhere);
    throw new BizError(Code.VALIDATE_ERROR, '密码错误');
  }
  await onLoginSuccess(prisma.adminUser, keyWhere);
  const token = signToken({
    actorId: admin.id,
    tenantId: admin.tenantId,
    role: 'CLUB_ADMIN',
    actorType: 'admin',
  });
  return { token, admin: { id: admin.id, username: admin.username } };
}

/**
 * 超级管理员登录（含防爆破）
 */
async function superLogin({ username, password }) {
  const keyWhere = { tenantId_username: { tenantId: null, username } };
  await assertNotLocked(prisma.adminUser, keyWhere);

  const admin = await prisma.adminUser.findFirst({
    where: { tenantId: null, username },
  });
  if (!admin || admin.role !== 'SUPER_ADMIN') {
    await onLoginFail(prisma.adminUser, keyWhere);
    throw new BizError(Code.UNAUTHORIZED, '账号不存在');
  }
  if (!(await bcryptCompare(password, admin.password))) {
    await onLoginFail(prisma.adminUser, keyWhere);
    throw new BizError(Code.UNAUTHORIZED, '密码错误');
  }
  await onLoginSuccess(prisma.adminUser, keyWhere);
  const token = signToken({
    actorId: admin.id,
    tenantId: null,
    role: 'SUPER_ADMIN',
    actorType: 'super',
  });
  return { token, admin: { id: admin.id, username: admin.username } };
}

/**
 * 打手登录（含防爆破）
 */
async function playerLogin({ username, password, tenantId }) {
  tenantId = parseInt(tenantId, 10);
  const keyWhere = { tenantId_username: { tenantId, username } };
  await assertNotLocked(prisma.player, keyWhere);

  const player = await prisma.player.findUnique({ where: keyWhere });
  if (!player) {
    await onLoginFail(prisma.player, keyWhere);
    throw new BizError(Code.UNAUTHORIZED, '账号不存在');
  }
  if (player.status === 'disabled') {
    throw new BizError(Code.UNAUTHORIZED, '账号已被禁用，请联系管理员');
  }
  if (!(await bcryptCompare(password, player.password))) {
    await onLoginFail(prisma.player, keyWhere);
    throw new BizError(Code.UNAUTHORIZED, '密码错误');
  }
  await onLoginSuccess(prisma.player, keyWhere);
  await prisma.player.update({
    where: { id: player.id },
    data: { lastLoginAt: new Date(now()) },
  });
  const token = signToken({
    actorId: player.id,
    tenantId: player.tenantId,
    role: 'PLAYER',
    actorType: 'player',
  });
  return {
    token,
    player: {
      id: player.id,
      username: player.username,
      nickname: player.nickname,
      online: player.online,
      status: player.status,
    },
  };
}

/**
 * 俱乐部管理员修改自己的密码（校验原密码）
 */
async function changeAdminPassword({ actorId, tenantId, oldPassword, newPassword }) {
  const admin = await prisma.adminUser.findUnique({ where: { id: actorId } });
  if (!admin || admin.tenantId !== tenantId || admin.role !== 'CLUB_ADMIN') {
    throw new BizError(Code.UNAUTHORIZED, '账号不存在');
  }
  if (!(await bcryptCompare(oldPassword, admin.password))) {
    throw new BizError(Code.VALIDATE_ERROR, '原密码错误');
  }
  if (!newPassword || newPassword.length < 12) {
    throw new BizError(Code.VALIDATE_ERROR, '新密码至少 12 位');
  }
  const hash = await bcrypt.hash(newPassword, 12);
  await prisma.adminUser.update({ where: { id: admin.id }, data: { password: hash } });
  return { success: true };
}

/**
 * 超级管理员修改自己的密码（校验原密码）
 */
async function changeSuperPassword({ actorId, oldPassword, newPassword }) {
  const admin = await prisma.adminUser.findFirst({ where: { id: actorId, tenantId: null } });
  if (!admin || admin.role !== 'SUPER_ADMIN') {
    throw new BizError(Code.UNAUTHORIZED, '账号不存在');
  }
  if (!(await bcryptCompare(oldPassword, admin.password))) {
    throw new BizError(Code.VALIDATE_ERROR, '原密码错误');
  }
  if (!newPassword || newPassword.length < 12) {
    throw new BizError(Code.VALIDATE_ERROR, '新密码至少 12 位');
  }
  const hash = await bcrypt.hash(newPassword, 12);
  await prisma.adminUser.update({ where: { id: admin.id }, data: { password: hash } });
  return { success: true };
}

module.exports = {
  userLoginWechat,
  sendPhoneCode,
  userLoginPhone,
  adminLogin,
  superLogin,
  playerLogin,
  changeAdminPassword,
  changeSuperPassword,
};
