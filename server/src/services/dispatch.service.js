/**
 * 派单服务：抢单（行锁防并发）、指派、自动派单（Worker 调用）、可抢订单池
 * 约束（方案 7.2）：打手必须 active + online + 已上传收款码
 */
const { prisma } = require('../db');
const { BizError, Code } = require('../utils/response');
const { now } = require('../utils/time');
const { enqueue } = require('../jobs/enqueue');
const logger = require('../utils/logger');

/** 校验打手抢单前置条件 */
async function assertPlayerCanGrab(tenantId, playerId) {
  const player = await prisma.player.findFirst({ where: { id: playerId, tenantId } });
  if (!player || player.status === 'disabled') throw new BizError(Code.UNAUTHORIZED, '账号不可用');
  if (!player.online) throw new BizError(Code.PLAYER_OFFLINE, '请先上线再抢单');
  if (!player.qrcodePath) throw new BizError(Code.PLAYER_NO_QRCODE, '请先上传收款二维码');
  return player;
}

/**
 * 可抢订单池（打手端）
 * 本租户 PENDING_GRAB 且（GRAB 全部 或 ASSIGN 指派给本人）
 * 仅 online 打手可看到抢单列表
 */
/**
 * 在线打手列表（选搭档用）：同租户 online + active + 已传收款码
 */
async function listOnlinePartners({ tenantId, excludePlayerId }) {
  return prisma.player.findMany({
    where: { tenantId, status: 'active', online: true, qrcodePath: { not: null }, NOT: { id: excludePlayerId } },
    select: { id: true, username: true, nickname: true, online: true },
    orderBy: { id: 'asc' },
  });
}

async function listAvailableOrders({ tenantId, playerId }) {
  await assertPlayerCanGrab(tenantId, playerId);
  const orders = await prisma.order.findMany({
    where: {
      tenantId,
      dispatchStatus: 'PENDING_GRAB',
      payStatus: 'PAID',
      OR: [{ dispatchType: 'GRAB' }, { dispatchType: 'ASSIGN', assignedPlayerId: playerId }],
    },
    orderBy: { id: 'desc' },
    take: 50,
    include: { items: { include: { product: { select: { id: true, name: true, coverUrl: true } } } } },
  });
  return orders.map((o) => ({
    id: o.id,
    orderNo: o.orderNo,
    totalAmount: o.totalAmount.toNumber(),
    commissionAmount: o.commissionAmount.toNumber(),
    dispatchType: o.dispatchType,
    createdAt: o.createdAt,
    profileData: o.profileData ? safeParseProfile(o.profileData) : null,
    items: o.items.map((it) => ({ productName: it.product?.name, quantity: it.quantity, price: it.price.toNumber() })),
  }));
}

/** 防御性 JSON 解析：无效 JSON 返回 null（不阻断订单列表） */
function safeParseProfile(str) {
  try {
    return JSON.parse(str);
  } catch (e) {
    return null;
  }
}

/**
 * 抢单（事务 + 行锁防并发）
 * 语义：同单并发抢 → 只有一个成功（FOR UPDATE 锁行后复查状态）
 */
async function grabOrder({ tenantId, playerId, orderId, partnerId }) {
  const player = await assertPlayerCanGrab(tenantId, playerId);

  // 搭档校验（须为同租户在线打手，且非本人）
  let partner = null;
  if (partnerId) {
    if (partnerId === playerId) throw new BizError(Code.VALIDATE_ERROR, '不能选择自己作为搭档');
    partner = await prisma.player.findFirst({
      where: { tenantId, id: partnerId, status: 'active', online: true },
    });
    if (!partner) throw new BizError(Code.NOT_FOUND, '搭档打手不存在或不在线');
  }

  const result = await prisma.$transaction(async (tx) => {
    // 行锁锁定订单
    const [order] = await tx.$queryRaw`
      SELECT * FROM orders WHERE id = ${orderId} FOR UPDATE
    `;
    if (!order) throw new BizError(Code.NOT_FOUND, '订单不存在');
    if (order.tenant_id !== tenantId) throw new BizError(Code.FORBIDDEN, '越权访问');
    if (order.dispatch_status !== 'PENDING_GRAB' || order.pay_status !== 'PAID') {
      throw new BizError(Code.ORDER_STATUS_INVALID, '订单已被抢或状态不允许');
    }
    // ASSIGN 单仅限被指派打手
    if (order.dispatch_type === 'ASSIGN' && order.assigned_player_id !== playerId) {
      throw new BizError(Code.FORBIDDEN, '该订单仅限被指派打手接单');
    }

    const hasPartner = Boolean(partner);
    await tx.order.update({
      where: { id: order.id },
      data: {
        dispatchStatus: hasPartner ? 'PENDING_PARTNER' : 'IN_PROGRESS',
        acceptedPlayerId: playerId,
        partnerPlayerId: hasPartner ? partner.id : null,
      },
    });
    await tx.dispatchLog.create({
      data: {
        tenantId,
        orderId: order.id,
        action: hasPartner ? 'GRAB_WITH_PARTNER' : 'GRAB',
        playerId,
        note: hasPartner
          ? '打手 ' + player.nickname + ' 抢单，等待搭档 ' + partner.nickname + ' 确认'
          : '打手 ' + player.nickname + ' 抢单',
      },
    });
    return order;
  });

  logger.biz('order_grabbed', { orderId, orderNo: result.order_no, playerId, tenantId, partnerId: partner ? partner.id : null });

  // 通知用户：订单已接单（异步）
  await enqueue(tenantId, 'SUBSCRIBE_MSG', {
    scene: 'order_accepted',
    tenantId,
    userId: result.user_id,
    orderNo: result.order_no,
    templateKey: 'subscribe_tpl_accepted',
  });

  return {
    success: true,
    orderNo: result.order_no,
    pendingPartner: Boolean(partner),
    partnerName: partner ? partner.nickname : null,
  };
}

/**
 * 搭档确认（搭档打手同意 → IN_PROGRESS）
 */
async function confirmPartner({ tenantId, playerId, orderId }) {
  const order = await prisma.order.findFirst({ where: { tenantId, id: orderId } });
  if (!order) throw new BizError(Code.NOT_FOUND, '订单不存在');
  if (order.dispatchStatus !== 'PENDING_PARTNER') {
    throw new BizError(Code.ORDER_STATUS_INVALID, '该订单不在等待搭档确认状态');
  }
  if (order.partnerPlayerId !== playerId) {
    throw new BizError(Code.FORBIDDEN, '只有被邀请的搭档可确认');
  }
  const partner = await prisma.player.findUnique({ where: { id: playerId } });
  const updated = await prisma.order.update({
    where: { id: order.id },
    data: { dispatchStatus: 'IN_PROGRESS' },
  });
  await prisma.dispatchLog.create({
    data: { tenantId, orderId: order.id, action: 'PARTNER_CONFIRM', playerId, note: '搭档 ' + (partner ? partner.nickname : playerId) + ' 已同意' },
  });
  logger.biz('order_partner_confirm', { orderId: order.id, orderNo: order.orderNo, playerId });
  return updated;
}

/**
 * 搭档拒绝（搭档打手拒绝 → 订单重回可抢池，清空搭档）
 */
async function rejectPartner({ tenantId, playerId, orderId, reason }) {
  const order = await prisma.order.findFirst({ where: { tenantId, id: orderId } });
  if (!order) throw new BizError(Code.NOT_FOUND, '订单不存在');
  if (order.dispatchStatus !== 'PENDING_PARTNER') {
    throw new BizError(Code.ORDER_STATUS_INVALID, '该订单不在等待搭档确认状态');
  }
  if (order.partnerPlayerId !== playerId) {
    throw new BizError(Code.FORBIDDEN, '只有被邀请的搭档可拒绝');
  }
  const partner = await prisma.player.findUnique({ where: { id: playerId } });
  const updated = await prisma.order.update({
    where: { id: order.id },
    data: { dispatchStatus: 'PENDING_GRAB', partnerPlayerId: null },
  });
  await prisma.dispatchLog.create({
    data: {
      tenantId,
      orderId: order.id,
      action: 'PARTNER_REJECT',
      playerId,
      note: '搭档 ' + (partner ? partner.nickname : playerId) + ' 拒绝：' + (reason || '未说明原因'),
    },
  });
  logger.biz('order_partner_reject', { orderId: order.id, orderNo: order.orderNo, playerId });
  return updated;
}

/**
 * 发起人取消搭档邀请（抢单打手取消 → 订单重回可抢池，清空搭档）
 */
async function cancelPartnerInvite({ tenantId, playerId, orderId }) {
  const order = await prisma.order.findFirst({ where: { tenantId, id: orderId } });
  if (!order) throw new BizError(Code.NOT_FOUND, '订单不存在');
  if (order.dispatchStatus !== 'PENDING_PARTNER') {
    throw new BizError(Code.ORDER_STATUS_INVALID, '该订单不在等待搭档确认状态');
  }
  if (order.acceptedPlayerId !== playerId) {
    throw new BizError(Code.FORBIDDEN, '只有发起人可取消搭档邀请');
  }
  const leader = await prisma.player.findUnique({ where: { id: playerId } });
  const updated = await prisma.order.update({
    where: { id: order.id },
    data: { dispatchStatus: 'PENDING_GRAB', partnerPlayerId: null },
  });
  await prisma.dispatchLog.create({
    data: {
      tenantId,
      orderId: order.id,
      action: 'PARTNER_CANCEL',
      playerId,
      note: '发起人 ' + (leader ? leader.nickname : playerId) + ' 取消搭档邀请，订单重回抢单池',
    },
  });
  logger.biz('order_partner_cancel', { orderId: order.id, orderNo: order.orderNo, playerId });
  return updated;
}

async function assignOrder({ tenantId, adminId, orderId, playerId }) {
  const order = await prisma.order.findFirst({ where: { tenantId, id: orderId } });
  if (!order) throw new BizError(Code.NOT_FOUND, '订单不存在');
  if (order.dispatchStatus !== 'PENDING_GRAB' || order.payStatus !== 'PAID') {
    throw new BizError(Code.ORDER_STATUS_INVALID, '仅待接单订单可指派');
  }
  const player = await prisma.player.findFirst({ where: { tenantId, id: playerId, status: 'active' } });
  if (!player) throw new BizError(Code.NOT_FOUND, '打手不存在或已禁用');
  if (!player.qrcodePath) throw new BizError(Code.PLAYER_NO_QRCODE, '该打手未上传收款二维码');

  const updated = await prisma.$transaction(async (tx) => {
    const changed = await tx.order.updateMany({
      where: { id: order.id, tenantId, dispatchStatus: 'PENDING_GRAB', payStatus: 'PAID' },
      data: {
        dispatchStatus: 'IN_PROGRESS',
        dispatchType: 'ASSIGN',
        assignedPlayerId: playerId,
        acceptedPlayerId: playerId,
      },
    });
    if (changed.count !== 1) throw new BizError(Code.ORDER_STATUS_INVALID, '订单状态已变化，请刷新后重试');
    await tx.dispatchLog.create({
      data: { tenantId, orderId: order.id, action: 'ASSIGN', playerId, note: `管理员指派给 ${player.nickname}` },
    });
    return tx.order.findUnique({ where: { id: order.id } });
  });
  logger.biz('order_assigned', { orderId: order.id, orderNo: order.orderNo, adminId, playerId });
  return updated;
}

/**
 * 自动派单（Worker 调用，单实例 + 行锁 + auto_dispatch_done 幂等）
 * 扫描：PENDING_GRAB + auto_dispatch=1 + auto_dispatch_done=0 + auto_dispatch_at <= now
 * 有在线打手 → 随机派 1 名 → IN_PROGRESS + 写流水 + 通知用户
 * 无打手 → 延后下次扫描，避免持续写重复日志
 */
async function autoDispatchOne(orderId) {
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) return { ok: false, reason: 'not_found' };
  if (order.dispatchStatus !== 'PENDING_GRAB' || !order.autoDispatch || order.autoDispatchDone) {
    return { ok: false, reason: 'not_eligible' };
  }

  const nowTs = now();
  if (order.autoDispatchAt && order.autoDispatchAt.getTime() > nowTs) {
    return { ok: false, reason: 'not_yet' };
  }

  return prisma.$transaction(async (tx) => {
    // 行锁复查（双保险）
    const [row] = await tx.$queryRaw`
      SELECT * FROM orders WHERE id = ${orderId} FOR UPDATE
    `;
    if (!row) return { ok: false, reason: 'not_found' };
    if (row.dispatch_status !== 'PENDING_GRAB' || !row.auto_dispatch || row.auto_dispatch_done) {
      return { ok: false, reason: 'already_handled' };
    }

    // 在线打手（active + online + 有收款码）
    const players = await tx.player.findMany({
      where: { tenantId: order.tenantId, status: 'active', online: true, qrcodePath: { not: null } },
      select: { id: true, nickname: true },
    });

    if (!players.length) {
      await tx.order.update({
        where: { id: order.id },
        data: { autoDispatchAt: new Date(now() + 60000) },
      });
      return { ok: false, reason: 'no_online_player' };
    }

    // 随机取 1 名
    const target = players[Math.floor(Math.random() * players.length)];
    await tx.order.update({
      where: { id: order.id },
      data: {
        dispatchStatus: 'IN_PROGRESS',
        dispatchType: 'AUTO',
        acceptedPlayerId: target.id,
        autoDispatchDone: true,
      },
    });
    await tx.dispatchLog.create({
      data: {
        tenantId: order.tenantId,
        orderId: order.id,
        action: 'AUTO_ASSIGN',
        playerId: target.id,
        note: `自动派单给 ${target.nickname}`,
      },
    });
    return { ok: true, playerId: target.id, orderNo: order.orderNo };
  });
}

/** 扫描待自动派单订单（Worker 30s 循环调用） */
async function scanAutoDispatch() {
  const orders = await prisma.order.findMany({
    where: {
      dispatchStatus: 'PENDING_GRAB',
      autoDispatch: true,
      autoDispatchDone: false,
      autoDispatchAt: { lte: new Date(now()) },
    },
    select: { id: true },
    take: 100,
  });
  const results = [];
  for (let i = 0; i < orders.length; i += 10) {
    results.push(...await Promise.all(orders.slice(i, i + 10).map((order) => autoDispatchOne(order.id))));
  }
  const dispatched = results.filter((r) => r.ok).length;
  if (dispatched) {
    logger.biz('auto_dispatch_scan', { scanned: orders.length, dispatched });
  }
  return { scanned: orders.length, dispatched };
}

module.exports = {
  assertPlayerCanGrab,
  listOnlinePartners,
  listAvailableOrders,
  grabOrder,
  confirmPartner,
  rejectPartner,
  cancelPartnerInvite,
  assignOrder,
  autoDispatchOne,
  scanAutoDispatch,
};
