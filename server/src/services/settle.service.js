/**
 * 结算服务：完整保留项目 B 状态机（方案决策 2）
 * 结单审核 → 72h 冷却 → 提现申请 → 提现审核 → 扫码付款 → 佣金入账
 */
const { prisma } = require('../db');
const { BizError, Code } = require('../utils/response');
const { now } = require('../utils/time');
const { enqueue } = require('../jobs/enqueue');
const { getConfig } = require('../models/clubConfig');
const logger = require('../utils/logger');

const SETTLE_COOLDOWN_HOURS = 72; // 默认冷却期（俱乐部可配置 settle_cooldown_hours 覆盖）

/** 读取俱乐部冷却期（小时），默认 72 */
async function getCooldownHours(tenantId) {
  const v = parseInt(await getConfig(tenantId, 'settle_cooldown_hours', '72'), 10);
  return v > 0 ? v : 72;
}

/**
 * 打手提交结单（截图 + 备注）
 */
async function submitOrder({ tenantId, playerId, orderId, screenshotPath, note }) {
  const order = await prisma.order.findFirst({
    where: {
      tenantId,
      id: orderId,
      OR: [{ acceptedPlayerId: playerId }, { partnerPlayerId: playerId }],
    },
  });
  if (!order) throw new BizError(Code.NOT_FOUND, '订单不存在');
  if (order.dispatchStatus !== 'IN_PROGRESS') {
    throw new BizError(Code.ORDER_STATUS_INVALID, '仅进行中的订单可提交结单');
  }
  const updated = await prisma.order.update({
    where: { id: order.id },
    data: { dispatchStatus: 'SUBMITTED', screenshotPath, submitNote: note || null },
  });
  logger.biz('order_submitted', { orderId: order.id, orderNo: order.orderNo, playerId });
  return updated;
}

/**
 * 管理员审核结单通过 → 待结算（校验打手有收款码）
 */
async function approveSettle({ tenantId, adminId, orderId }) {
  const order = await prisma.order.findFirst({ where: { tenantId, id: orderId } });
  if (!order) throw new BizError(Code.NOT_FOUND, '订单不存在');
  if (order.dispatchStatus !== 'SUBMITTED') {
    throw new BizError(Code.ORDER_STATUS_INVALID, '仅待审核结单可审核通过');
  }
  if (!order.acceptedPlayerId) throw new BizError(Code.ORDER_STATUS_INVALID, '订单无接单打手');

  const player = await prisma.player.findUnique({ where: { id: order.acceptedPlayerId } });
  if (!player.qrcodePath) {
    throw new BizError(Code.PLAYER_NO_QRCODE, '打手未上传收款二维码，无法结算');
  }

  const updated = await prisma.order.update({
    where: { id: order.id },
    data: { dispatchStatus: 'PENDING_SETTLE', settleAt: new Date(now()) },
  });
  logger.biz('settle_approved', { orderId: order.id, orderNo: order.orderNo, adminId });
  return updated;
}

/**
 * 管理员驳回结单 → 回到进行中
 */
async function rejectSettle({ tenantId, adminId, orderId, reason }) {
  const order = await prisma.order.findFirst({ where: { tenantId, id: orderId } });
  if (!order) throw new BizError(Code.NOT_FOUND, '订单不存在');
  if (order.dispatchStatus !== 'SUBMITTED') {
    throw new BizError(Code.ORDER_STATUS_INVALID, '仅待审核结单可驳回');
  }
  const updated = await prisma.order.update({
    where: { id: order.id },
    data: { dispatchStatus: 'IN_PROGRESS', submitNote: reason || '结单被驳回' },
  });
  await prisma.dispatchLog.create({
    data: { tenantId, orderId: order.id, action: 'REJECT', playerId: order.acceptedPlayerId, note: reason || '驳回结单' },
  });
  logger.biz('settle_rejected', { orderId: order.id, orderNo: order.orderNo, adminId, reason });
  return updated;
}

/**
 * 冷却扫描（Worker 每分钟）：PENDING_SETTLE 且 settle_at + 冷却期 <= now → READY_WITHDRAW
 * 冷却期按俱乐部配置（settle_cooldown_hours，默认 72h）
 */
async function scanSettleCooldown() {
  const pendingOrders = await prisma.order.findMany({
    where: { dispatchStatus: 'PENDING_SETTLE', settleAt: { not: null } },
    select: { id: true, tenantId: true, settleAt: true },
    orderBy: { id: 'asc' },
    take: 500,
  });
  if (!pendingOrders.length) return { matured: 0 };

  // 按租户分组读冷却期（避免每单查配置）
  const cooldownCache = new Map();
  let matured = 0;
  for (const o of pendingOrders) {
    if (!cooldownCache.has(o.tenantId)) {
      cooldownCache.set(o.tenantId, await getCooldownHours(o.tenantId));
    }
    const hours = cooldownCache.get(o.tenantId);
    const cutoff = o.settleAt.getTime() + hours * 3600 * 1000;
    if (now() >= cutoff) {
      await prisma.order.update({
        where: { id: o.id },
        data: { dispatchStatus: 'READY_WITHDRAW', readyWithdrawAt: new Date(now()) },
      });
      matured += 1;
    }
  }
  if (matured) logger.biz('settle_cooldown_matured', { matured });
  return { matured };
}

/** 打手待提现汇总 */
async function pendingWithdrawSummary({ tenantId, playerId }) {
  const [ready, pending, processing] = await Promise.all([
    prisma.order.count({ where: { tenantId, acceptedPlayerId: playerId, dispatchStatus: 'READY_WITHDRAW' } }),
    prisma.order.count({ where: { tenantId, acceptedPlayerId: playerId, dispatchStatus: 'WITHDRAW_PENDING' } }),
    prisma.order.count({ where: { tenantId, acceptedPlayerId: playerId, dispatchStatus: 'PENDING_PAYMENT' } }),
  ]);
  const readyOrders = await prisma.order.findMany({
    where: { tenantId, acceptedPlayerId: playerId, dispatchStatus: 'READY_WITHDRAW' },
    select: { id: true, orderNo: true, commissionAmount: true },
  });
  const readyAmount = readyOrders.reduce((s, o) => s + o.commissionAmount.toNumber(), 0);
  return {
    readyCount: ready,
    readyAmount: Math.round(readyAmount * 100) / 100,
    pendingCount: pending,
    processingCount: processing,
    readyOrders,
  };
}

/**
 * 打手申请提现（READY_WITHDRAW → WITHDRAW_PENDING）
 */
async function applyWithdraw({ tenantId, playerId, orderId }) {
  const order = await prisma.order.findFirst({
    where: { tenantId, id: orderId, acceptedPlayerId: playerId },
  });
  if (!order) throw new BizError(Code.NOT_FOUND, '订单不存在');
  if (order.dispatchStatus !== 'READY_WITHDRAW') {
    throw new BizError(Code.ORDER_STATUS_INVALID, '该订单当前不可申请提现');
  }
  const updated = await prisma.order.update({
    where: { id: order.id },
    data: { dispatchStatus: 'WITHDRAW_PENDING', withdrawAppliedAt: new Date(now()) },
  });
  logger.biz('withdraw_applied', { orderId: order.id, orderNo: order.orderNo, playerId });
  return updated;
}

/**
 * 管理员审核提现通过 → PENDING_PAYMENT（待扫码付款）
 */
async function approveWithdraw({ tenantId, adminId, orderId }) {
  const order = await prisma.order.findFirst({ where: { tenantId, id: orderId } });
  if (!order) throw new BizError(Code.NOT_FOUND, '订单不存在');
  if (order.dispatchStatus !== 'WITHDRAW_PENDING') {
    throw new BizError(Code.ORDER_STATUS_INVALID, '仅提现审核中的订单可审核通过');
  }
  const updated = await prisma.order.update({
    where: { id: order.id },
    data: { dispatchStatus: 'PENDING_PAYMENT', pendingPaymentAt: new Date(now()) },
  });
  logger.biz('withdraw_approved', { orderId: order.id, orderNo: order.orderNo, adminId });
  return updated;
}

/**
 * 管理员审核提现驳回 → READY_WITHDRAW（可重新申请）
 */
async function rejectWithdraw({ tenantId, adminId, orderId, reason }) {
  const order = await prisma.order.findFirst({ where: { tenantId, id: orderId } });
  if (!order) throw new BizError(Code.NOT_FOUND, '订单不存在');
  if (order.dispatchStatus !== 'WITHDRAW_PENDING') {
    throw new BizError(Code.ORDER_STATUS_INVALID, '仅提现审核中的订单可驳回');
  }
  const updated = await prisma.order.update({
    where: { id: order.id },
    data: { dispatchStatus: 'READY_WITHDRAW', withdrawAppliedAt: null },
  });
  logger.biz('withdraw_rejected', { orderId: order.id, orderNo: order.orderNo, adminId, reason });
  return updated;
}

/**
 * 管理员扫码付款完成 → COMPLETED，佣金入账
 * 校验打手收款码仍存在（可能被删）
 */
async function payPendingPayment({ tenantId, adminId, orderId }) {
  const order = await prisma.order.findFirst({ where: { tenantId, id: orderId } });
  if (!order) throw new BizError(Code.NOT_FOUND, '订单不存在');
  if (order.dispatchStatus !== 'PENDING_PAYMENT') {
    throw new BizError(Code.ORDER_STATUS_INVALID, '仅待付款订单可完成付款');
  }
  if (!order.acceptedPlayerId) throw new BizError(Code.ORDER_STATUS_INVALID, '订单无接单打手');

  await prisma.$transaction(async (tx) => {
    const changed = await tx.order.updateMany({
      where: { id: order.id, tenantId, dispatchStatus: 'PENDING_PAYMENT' },
      data: { dispatchStatus: 'COMPLETED', completedAt: new Date(now()) },
    });
    if (changed.count !== 1) throw new BizError(Code.ORDER_STATUS_INVALID, '订单状态已变化，请刷新后重试');

    const player = await tx.player.findUnique({ where: { id: order.acceptedPlayerId } });
    if (!player) throw new BizError(Code.NOT_FOUND, '打手不存在');
    if (!player.qrcodePath) throw new BizError(Code.PLAYER_NO_QRCODE, '打手收款码已失效，请联系打手重新上传');

    // 佣金分配：有搭档则平分（各 50%），无搭档全额给接单人
    const totalAmount = order.commissionAmount;
    const hasPartner = Boolean(order.partnerPlayerId);
    const shareAmount = hasPartner ? totalAmount.div(2) : totalAmount;
    const recipients = [{ id: order.acceptedPlayerId, amount: hasPartner ? shareAmount : totalAmount }];
    if (hasPartner) {
      const partner = await tx.player.findUnique({ where: { id: order.partnerPlayerId } });
      if (!partner) throw new BizError(Code.NOT_FOUND, '搭档打手不存在');
      if (!partner.qrcodePath) throw new BizError(Code.PLAYER_NO_QRCODE, '搭档收款码已失效，请联系打手重新上传');
      recipients.push({ id: order.partnerPlayerId, amount: shareAmount });
    }

    for (const r of recipients) {
      await tx.commissionLog.create({
        data: {
          tenantId,
          orderId: order.id,
          playerId: r.id,
          amount: r.amount,
        },
      });
      await tx.player.update({
        where: { id: r.id },
        data: { totalCommission: { increment: r.amount } },
      });
    }
  });

  logger.biz('order_completed', { orderId: order.id, orderNo: order.orderNo, adminId, amount: order.commissionAmount.toNumber(), partner: order.partnerPlayerId ? 'split' : 'solo' });

  // 通知用户「订单已完成」（异步）
  const user = await prisma.user.findUnique({ where: { id: order.userId } });
  await enqueue(tenantId, 'SUBSCRIBE_MSG', {
    scene: 'order_completed',
    tenantId,
    openid: user.openid,
    orderNo: order.orderNo,
    templateKey: 'subscribe_tpl_completed',
  });

  return { success: true, orderNo: order.orderNo };
}

/** 管理员取消已支付未接单订单（同步退款流程入口） */
async function adminCancelOrder({ tenantId, adminId, orderId }) {
  const order = await prisma.order.findFirst({ where: { tenantId, id: orderId } });
  if (!order) throw new BizError(Code.NOT_FOUND, '订单不存在');
  if (order.payStatus !== 'PAID') throw new BizError(Code.ORDER_STATUS_INVALID, '仅已支付订单可取消');
  if (order.dispatchStatus !== 'PENDING_GRAB') {
    throw new BizError(Code.ORDER_STATUS_INVALID, '仅未接单订单可由管理员取消');
  }
  if (order.transactionId && !order.transactionId.startsWith('MANUAL_')) {
    throw new BizError(Code.VALIDATE_ERROR, '微信退款尚未接入，禁止仅修改本地状态；请先完成退款接口接入');
  }
  const updated = await prisma.$transaction(async (tx) => {
    const changed = await tx.order.updateMany({
      where: { id: order.id, tenantId, payStatus: 'PAID', dispatchStatus: 'PENDING_GRAB' },
      data: { payStatus: 'REFUNDED', dispatchStatus: 'CANCELLED', cancelledAt: new Date(now()) },
    });
    if (changed.count !== 1) throw new BizError(Code.ORDER_STATUS_INVALID, '订单状态已变化，请刷新后重试');
    const items = await tx.orderItem.findMany({ where: { orderId: order.id } });
    for (const item of items) {
      if (item.productId) {
        await tx.product.update({ where: { id: item.productId }, data: { salesCount: { decrement: item.quantity } } });
      }
    }
    return tx.order.findUnique({ where: { id: order.id } });
  });
  logger.biz('order_admin_cancelled', { orderId: order.id, orderNo: order.orderNo, adminId });
  return updated;
}

module.exports = {
  SETTLE_COOLDOWN_HOURS,
  submitOrder,
  approveSettle,
  rejectSettle,
  scanSettleCooldown,
  pendingWithdrawSummary,
  applyWithdraw,
  approveWithdraw,
  rejectWithdraw,
  payPendingPayment,
  adminCancelOrder,
};
