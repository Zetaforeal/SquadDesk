/**
 * 超管服务：俱乐部 CRUD、到期设置、全局数据看板
 */
const bcrypt = require('bcryptjs');
const { prisma } = require('../db');
const { BizError, Code } = require('../utils/response');
const { invalidateClubCache } = require('../middleware/tenantGuard');

/** 俱乐部列表（含统计） */
async function listClubs() {
  const [clubs, orderCounts, userCounts, playerCounts, paidAmounts] = await Promise.all([
    prisma.club.findMany({ orderBy: { id: 'desc' } }),
    prisma.order.groupBy({ by: ['tenantId'], _count: { _all: true } }),
    prisma.user.groupBy({ by: ['tenantId'], _count: { _all: true } }),
    prisma.player.groupBy({ by: ['tenantId'], _count: { _all: true } }),
    prisma.order.groupBy({ by: ['tenantId'], where: { payStatus: 'PAID' }, _sum: { totalAmount: true } }),
  ]);
  const toMap = (rows, getValue) => new Map(rows.map((row) => [row.tenantId, getValue(row)]));
  const orders = toMap(orderCounts, (row) => row._count._all);
  const users = toMap(userCounts, (row) => row._count._all);
  const players = toMap(playerCounts, (row) => row._count._all);
  const paid = toMap(paidAmounts, (row) => row._sum.totalAmount?.toNumber() || 0);
  return clubs.map((club) => ({
    ...club,
    orderCount: orders.get(club.id) || 0,
    userCount: users.get(club.id) || 0,
    playerCount: players.get(club.id) || 0,
    paidAmount: paid.get(club.id) || 0,
  }));
}

/**
 * 新增俱乐部：创建俱乐部 + 俱乐部管理员账号 + 初始配置
 * 租户 ID 为 5 位数字（10001 起），俱乐部管理员登录时填写该 ID
 */
async function createClub({ name, code, expiresAt, adminUsername, adminPassword, wechat, maxPlayers, maxOrders }) {
  if (!name || !code) throw new BizError(Code.VALIDATE_ERROR, '俱乐部名称与编码必填');
  const exists = await prisma.club.findUnique({ where: { code } });
  if (exists) throw new BizError(Code.VALIDATE_ERROR, '俱乐部编码已存在');

  if (!adminPassword || adminPassword.length < 12) {
    throw new BizError(Code.VALIDATE_ERROR, '管理员初始密码至少 12 位');
  }
  const passwordHash = await bcrypt.hash(adminPassword, 12);

  const club = await prisma.$transaction(async (tx) => {
    const c = await tx.club.create({
      data: {
        name,
        code,
        status: 1,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
        maxPlayers: maxPlayers != null ? parseInt(maxPlayers, 10) : null,
        maxOrders: maxOrders != null ? parseInt(maxOrders, 10) : null,
      },
    });
    await tx.adminUser.create({
      data: {
        tenantId: c.id,
        username: adminUsername || 'admin',
        password: passwordHash,
        role: 'CLUB_ADMIN',
      },
    });
    // 初始配置：微信支付/登录（占位）、自动派单默认关
    const initialConfigs = {
      wechat_appid: wechat?.appid || '',
      wechat_secret: wechat?.secret || '',
      wechat_mchid: wechat?.mchid || '',
      wechat_api_key: wechat?.apiKey || '',
      wechat_notify_url: wechat?.notifyUrl || '',
      auto_dispatch_enabled: '0',
      auto_dispatch_timeout_seconds: '120',
      profile_col_platform: '平台',
      profile_col_identifier: '账号',
      profile_col_address: '地址',
      profile_col_enabled: '1',
    };
    await tx.clubConfig.createMany({
      data: Object.entries(initialConfigs).map(([configKey, configValue]) => ({
        tenantId: c.id,
        configKey,
        configValue,
      })),
    });
    return c;
  });
  return club;
}

/** 修改俱乐部（含到期时间、启停） */
async function updateClub(clubId, data) {
  const club = await prisma.club.findUnique({ where: { id: clubId } });
  if (!club) throw new BizError(Code.NOT_FOUND, '俱乐部不存在');

  const updateData = {};
  if (data.name !== undefined) updateData.name = data.name;
  if (data.status !== undefined) updateData.status = data.status ? 1 : 0;
  if (data.expiresAt !== undefined) {
    updateData.expiresAt = data.expiresAt ? new Date(data.expiresAt) : null;
  }
  if (data.maxPlayers !== undefined) {
    updateData.maxPlayers = data.maxPlayers != null ? parseInt(data.maxPlayers, 10) : null;
  }
  if (data.maxOrders !== undefined) {
    updateData.maxOrders = data.maxOrders != null ? parseInt(data.maxOrders, 10) : null;
  }
  if (data.code !== undefined) {
    const dup = await prisma.club.findUnique({ where: { code: data.code } });
    if (dup && dup.id !== clubId) throw new BizError(Code.VALIDATE_ERROR, '俱乐部编码已存在');
    updateData.code = data.code;
  }
  const updated = await prisma.club.update({ where: { id: clubId }, data: updateData });
  invalidateClubCache(clubId);
  return updated;
}

/** 删除俱乐部（仅允许无有效订单时） */
async function deleteClub(clubId) {
  const club = await prisma.club.findUnique({ where: { id: clubId } });
  if (!club) throw new BizError(Code.NOT_FOUND, '俱乐部不存在');
  const activeOrders = await prisma.order.count({
    where: { tenantId: clubId, payStatus: { in: ['PENDING', 'PAID'] } },
  });
  if (activeOrders > 0) throw new BizError(Code.VALIDATE_ERROR, '俱乐部存在有效订单，无法删除');

  await prisma.$transaction(async (tx) => {
    await tx.clubConfig.deleteMany({ where: { tenantId: clubId } });
    await tx.chatMessage.deleteMany({ where: { tenantId: clubId } });
    await tx.commissionLog.deleteMany({ where: { tenantId: clubId } });
    await tx.dispatchLog.deleteMany({ where: { tenantId: clubId } });
    await tx.orderItem.deleteMany({ where: { tenantId: clubId } });
    await tx.order.deleteMany({ where: { tenantId: clubId } });
    await tx.player.deleteMany({ where: { tenantId: clubId } });
    await tx.userProfile.deleteMany({ where: { tenantId: clubId } });
    await tx.user.deleteMany({ where: { tenantId: clubId } });
    await tx.homeProductModule.deleteMany({ where: { tenantId: clubId } });
    await tx.homeModule.deleteMany({ where: { tenantId: clubId } });
    await tx.homeLayout.deleteMany({ where: { tenantId: clubId } });
    await tx.productImage.deleteMany({ where: { tenantId: clubId } });
    await tx.product.deleteMany({ where: { tenantId: clubId } });
    await tx.category.deleteMany({ where: { tenantId: clubId } });
    await tx.adminUser.deleteMany({ where: { tenantId: clubId } });
    await tx.club.delete({ where: { id: clubId } });
  });
  invalidateClubCache(clubId);
  return { success: true };
}

/**
 * 清除演示版记录：删除订单/打手/用户/佣金等业务数据，
 * 保留俱乐部本身、管理员账号、商品分类与首页布局（方便继续演示）
 */
async function resetDemoData(clubId) {
  const club = await prisma.club.findUnique({ where: { id: clubId } });
  if (!club) throw new BizError(Code.NOT_FOUND, '俱乐部不存在');

  await prisma.$transaction(async (tx) => {
    await tx.chatMessage.deleteMany({ where: { tenantId: clubId } });
    await tx.commissionLog.deleteMany({ where: { tenantId: clubId } });
    await tx.dispatchLog.deleteMany({ where: { tenantId: clubId } });
    await tx.orderItem.deleteMany({ where: { tenantId: clubId } });
    await tx.order.deleteMany({ where: { tenantId: clubId } });
    await tx.player.deleteMany({ where: { tenantId: clubId } });
    await tx.userProfile.deleteMany({ where: { tenantId: clubId } });
    await tx.user.deleteMany({ where: { tenantId: clubId } });
  });
  invalidateClubCache(clubId);
  return { success: true };
}

/** 全局数据看板 */
async function globalStats() {
  const [clubs, orders, users, players, paidAgg] = await Promise.all([
    prisma.club.count(),
    prisma.order.count(),
    prisma.user.count(),
    prisma.player.count(),
    prisma.order.aggregate({ where: { payStatus: 'PAID' }, _sum: { totalAmount: true } }),
  ]);
  return {
    clubs,
    orders,
    users,
    players,
    paidAmount: paidAgg._sum.totalAmount ? paidAgg._sum.totalAmount.toNumber() : 0,
  };
}

/** 指定俱乐部订单明细（超管全量可见） */
async function clubOrders(clubId, { page, pageSize, status }) {
  const where = { tenantId: clubId };
  if (status) where.dispatchStatus = status;
  const [total, list] = await Promise.all([
    prisma.order.count({ where }),
    prisma.order.findMany({
      where,
      orderBy: { id: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: { items: true },
    }),
  ]);
  return {
    total,
    list: list.map((o) => ({
      ...o,
      totalAmount: o.totalAmount.toNumber(),
      commissionAmount: o.commissionAmount.toNumber(),
    })),
  };
}

module.exports = { listClubs, createClub, updateClub, deleteClub, resetDemoData, globalStats, clubOrders };
