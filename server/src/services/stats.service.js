/**
 * 俱乐部后台控制台统计
 */
const { prisma } = require('../db');

async function dashboardStats({ tenantId }) {
  const [orderCount, paidOrderCount, playerCount, onlinePlayerCount, pendingGrabCount, pendingReviewCount, pendingWithdrawCount, pendingPaymentCount, commissionAgg, paidAgg] =
    await Promise.all([
      prisma.order.count({ where: { tenantId } }),
      prisma.order.count({ where: { tenantId, payStatus: 'PAID' } }),
      prisma.player.count({ where: { tenantId } }),
      prisma.player.count({ where: { tenantId, online: true, status: 'active' } }),
      prisma.order.count({ where: { tenantId, dispatchStatus: 'PENDING_GRAB', payStatus: 'PAID' } }),
      prisma.order.count({ where: { tenantId, dispatchStatus: 'SUBMITTED' } }),
      prisma.order.count({ where: { tenantId, dispatchStatus: 'WITHDRAW_PENDING' } }),
      prisma.order.count({ where: { tenantId, dispatchStatus: 'PENDING_PAYMENT' } }),
      prisma.commissionLog.aggregate({ where: { tenantId }, _sum: { amount: true } }),
      prisma.order.aggregate({ where: { tenantId, payStatus: 'PAID' }, _sum: { totalAmount: true } }),
    ]);

  return {
    orderCount,
    paidOrderCount,
    paidAmount: paidAgg._sum.totalAmount ? paidAgg._sum.totalAmount.toNumber() : 0,
    playerCount,
    onlinePlayerCount,
    pendingGrabCount,
    pendingReviewCount,
    pendingWithdrawCount,
    pendingPaymentCount,
    totalCommission: commissionAgg._sum.amount ? commissionAgg._sum.amount.toNumber() : 0,
  };
}

/** 俱乐部后台订单列表（双轴筛选） */
async function adminOrders({ tenantId, payStatus, dispatchStatus, page, pageSize, keyword }) {
  const where = { tenantId };
  if (payStatus) where.payStatus = payStatus;
  if (dispatchStatus) where.dispatchStatus = dispatchStatus;
  if (keyword) where.orderNo = { contains: keyword };
  const [total, list] = await Promise.all([
    prisma.order.count({ where }),
    prisma.order.findMany({
      where,
      orderBy: { id: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        items: { include: { product: { select: { id: true, name: true } } } },
        acceptedPlayer: { select: { id: true, nickname: true } },
      },
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

/** 佣金发放记录（管理端） */
async function adminCommissions({ tenantId, page, pageSize }) {
  const where = { tenantId };
  const [total, list] = await Promise.all([
    prisma.commissionLog.count({ where }),
    prisma.commissionLog.findMany({
      where,
      orderBy: { id: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: { player: { select: { nickname: true, username: true } }, order: { select: { orderNo: true } } },
    }),
  ]);
  return {
    total,
    list: list.map((c) => ({ ...c, amount: c.amount.toNumber() })),
  };
}

module.exports = { dashboardStats, adminOrders, adminCommissions };
