/**
 * 打手管理服务（俱乐部后台）+ 打手端个人操作（上下线/收款码/佣金）
 */
const bcrypt = require('bcryptjs');
const { prisma } = require('../db');
const { BizError, Code } = require('../utils/response');
const { validateImageField } = require('../utils/image');

const PUBLIC_PLAYER_FIELDS = {
  id: true,
  tenantId: true,
  username: true,
  nickname: true,
  status: true,
  online: true,
  qrcodePath: true,
  createdAt: true,
  updatedAt: true,
};

// ---------- 俱乐部后台：打手管理 ----------

async function listPlayers({ tenantId, page, pageSize, status, keyword }) {
  const where = { tenantId };
  if (status) where.status = status;
  if (keyword) where.nickname = { contains: keyword };
  const [total, list] = await Promise.all([
    prisma.player.count({ where }),
    prisma.player.findMany({
      where,
      orderBy: { id: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        username: true,
        nickname: true,
        status: true,
        online: true,
        totalCommission: true,
        qrcodePath: true,
        lastLoginAt: true,
        createdAt: true,
        _count: { select: { orders: true } },
      },
    }),
  ]);
  return {
    total,
    list: list.map((p) => ({ ...p, totalCommission: p.totalCommission.toNumber() })),
  };
}

async function createPlayer({ tenantId, username, password, nickname }) {
  if (!username || !password || !nickname) {
    throw new BizError(Code.VALIDATE_ERROR, '用户名、密码、昵称必填');
  }
  if (password.length < 12) throw new BizError(Code.VALIDATE_ERROR, '密码至少 12 位');
  const dup = await prisma.player.findUnique({ where: { tenantId_username: { tenantId, username } } });
  if (dup) throw new BizError(Code.VALIDATE_ERROR, '用户名已存在');

  // 演示版限制：打手数量上限
  const club = await prisma.club.findUnique({
    where: { id: tenantId },
    select: { maxPlayers: true },
  });
  if (club && club.maxPlayers != null) {
    const count = await prisma.player.count({ where: { tenantId } });
    if (count >= club.maxPlayers) {
      throw new BizError(Code.VALIDATE_ERROR, `演示版最多添加 ${club.maxPlayers} 名打手，请联系平台管理员升级或重置`);
    }
  }

  return prisma.player.create({
    data: {
      tenantId,
      username,
      password: await bcrypt.hash(password, 12),
      nickname,
    },
    select: PUBLIC_PLAYER_FIELDS,
  });
}

async function updatePlayer({ tenantId, playerId, data }) {
  const exists = await prisma.player.findFirst({ where: { tenantId, id: playerId } });
  if (!exists) throw new BizError(Code.NOT_FOUND, '打手不存在');
  const updateData = {};
  if (data.nickname !== undefined) updateData.nickname = data.nickname;
  if (data.password) {
    if (data.password.length < 12) throw new BizError(Code.VALIDATE_ERROR, '密码至少 12 位');
    updateData.password = await bcrypt.hash(data.password, 12);
  }
  if (data.status !== undefined) updateData.status = data.status === 'active' ? 'active' : 'disabled';
  if (data.qrcodePath !== undefined) {
    const r = validateImageField(data.qrcodePath);
    if (!r.ok) throw new BizError(Code.VALIDATE_ERROR, r.error);
    updateData.qrcodePath = data.qrcodePath || null;
  }
  return prisma.player.update({ where: { id: playerId }, data: updateData, select: PUBLIC_PLAYER_FIELDS });
}

async function deletePlayer({ tenantId, playerId }) {
  const exists = await prisma.player.findFirst({ where: { tenantId, id: playerId } });
  if (!exists) throw new BizError(Code.NOT_FOUND, '打手不存在');
  const activeOrders = await prisma.order.count({
    where: { tenantId, acceptedPlayerId: playerId, dispatchStatus: { notIn: ['COMPLETED', 'CANCELLED'] } },
  });
  if (activeOrders > 0) throw new BizError(Code.VALIDATE_ERROR, '打手存在进行中订单，无法删除');
  await prisma.player.delete({ where: { id: playerId } });
  return { success: true };
}

// ---------- 打手端：个人操作 ----------

async function playerProfile({ playerId }) {
  const p = await prisma.player.findUnique({
    where: { id: playerId },
    select: {
      id: true,
      username: true,
      nickname: true,
      status: true,
      online: true,
      totalCommission: true,
      qrcodePath: true,
      lastLoginAt: true,
      createdAt: true,
    },
  });
  if (!p) throw new BizError(Code.UNAUTHORIZED, '账号不存在');
  return {
    ...p,
    totalCommission: p.totalCommission.toNumber(),
    hasQrcode: Boolean(p.qrcodePath),
  };
}

/** 切换上线/下线（核心新增） */
async function toggleOnline({ playerId, online }) {
  const p = await prisma.player.findUnique({ where: { id: playerId } });
  if (!p) throw new BizError(Code.UNAUTHORIZED, '账号不存在');
  if (p.status === 'disabled') throw new BizError(Code.UNAUTHORIZED, '账号已被禁用');
  return prisma.player.update({ where: { id: playerId }, data: { online: !!online } });
}

async function setQrcode({ playerId, qrcodePath }) {
  const r = validateImageField(qrcodePath);
  if (!r.ok) throw new BizError(Code.VALIDATE_ERROR, r.error);
  return prisma.player.update({ where: { id: playerId }, data: { qrcodePath } });
}

async function removeQrcode({ playerId }) {
  return prisma.player.update({ where: { id: playerId }, data: { qrcodePath: null } });
}

/** 我的佣金记录 */
async function myCommissions({ tenantId, playerId, page, pageSize }) {
  const where = { tenantId, playerId };
  const [total, list] = await Promise.all([
    prisma.commissionLog.count({ where }),
    prisma.commissionLog.findMany({
      where,
      orderBy: { id: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: { order: { select: { orderNo: true, completedAt: true } } },
    }),
  ]);
  return {
    total,
    list: list.map((c) => ({ ...c, amount: c.amount.toNumber() })),
  };
}

/** 我的接单列表（含搭档：接单人 acceptedPlayerId 或被邀请搭档 partnerPlayerId） */
async function myOrders({ tenantId, playerId, status, page, pageSize }) {
  const where = {
    tenantId,
    OR: [{ acceptedPlayerId: playerId }, { partnerPlayerId: playerId }],
  };
  if (status && status !== 'ALL') where.dispatchStatus = status;
  const [total, list] = await Promise.all([
    prisma.order.count({ where }),
    prisma.order.findMany({
      where,
      orderBy: { id: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: { items: { include: { product: { select: { id: true, name: true, coverUrl: true } } } } },
    }),
  ]);
  const { DISPATCH_TEXT } = require('./order.service');
  return {
    total,
    list: list.map((o) => ({
      ...o,
      totalAmount: o.totalAmount.toNumber(),
      commissionAmount: o.commissionAmount.toNumber(),
      dispatchText: DISPATCH_TEXT[o.dispatchStatus],
    })),
  };
}

/** 打手端订单详情：仅接单人或搭档可查看 */
async function orderDetail({ tenantId, playerId, orderId }) {
  const order = await prisma.order.findFirst({
    where: {
      tenantId,
      id: orderId,
      OR: [{ acceptedPlayerId: playerId }, { partnerPlayerId: playerId }],
    },
    include: { items: { include: { product: { select: { id: true, name: true, coverUrl: true } } } } },
  });
  if (!order) throw new BizError(Code.NOT_FOUND, '订单不存在');
  const { DISPATCH_TEXT } = require('./order.service');
  let profileData = null;
  if (order.profileData) {
    try { profileData = JSON.parse(order.profileData); } catch (e) { profileData = null; }
  }
  return {
    ...order,
    totalAmount: order.totalAmount.toNumber(),
    commissionAmount: order.commissionAmount.toNumber(),
    dispatchText: DISPATCH_TEXT[order.dispatchStatus],
    profileData,
  };
}

module.exports = {
  listPlayers,
  createPlayer,
  updatePlayer,
  deletePlayer,
  playerProfile,
  toggleOnline,
  setQrcode,
  removeQrcode,
  myCommissions,
  myOrders,
  orderDetail,
};
