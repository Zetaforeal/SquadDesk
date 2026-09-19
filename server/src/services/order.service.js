/**
 * 订单服务：创建（佣金快照 + 自动派单开关快照）、支付回调处理、订单查询
 * 双轴状态机：pay_status × dispatch_status（方案 7.1）
 */
const { prisma } = require('../db');
const { BizError, Code } = require('../utils/response');
const { generateOrderNo } = require('../utils/orderNo');
const { unifiedOrder } = require('../utils/wxpay');
const { getWechatConfig, isPaymentConfigured, getConfig } = require('../models/clubConfig');
const { now } = require('../utils/time');
const { enqueue } = require('../jobs/enqueue');
const logger = require('../utils/logger');

/** 派单状态中文文案（用户端展示） */
const DISPATCH_TEXT = {
  PENDING_GRAB: '等待接单',
  PENDING_PARTNER: '等待搭档确认',
  IN_PROGRESS: '进行中',
  SUBMITTED: '待审核',
  PENDING_SETTLE: '待结算',
  READY_WITHDRAW: '可提现',
  WITHDRAW_PENDING: '提现审核中',
  PENDING_PAYMENT: '待付款',
  COMPLETED: '已完成',
  CANCELLED: '已取消',
};

/**
 * 创建订单（用户端）
 * 校验：租户未到期（中间件已拦）、商品上架、计算 commission_amount 与 auto_dispatch 快照
 * 成功后：微信统一下单返回支付参数
 */
async function createOrder({ tenantId, userId, items, profileData }) {
  if (!items || !items.length) throw new BizError(Code.VALIDATE_ERROR, '订单商品不能为空');

  // 演示版限制：订单总数上限
  const limitClub = await prisma.club.findUnique({
    where: { id: tenantId },
    select: { maxOrders: true },
  });
  if (limitClub && limitClub.maxOrders != null) {
    const orderCount = await prisma.order.count({ where: { tenantId } });
    if (orderCount >= limitClub.maxOrders) {
      throw new BizError(Code.VALIDATE_ERROR, `演示版最多接收 ${limitClub.maxOrders} 个订单，请联系平台管理员升级或重置`);
    }
  }

  // 商品校验（租户内）
  const productIds = items.map((i) => i.productId);
  const products = await prisma.product.findMany({
    where: { tenantId, id: { in: productIds }, published: true },
  });
  if (products.length !== new Set(productIds).size) {
    throw new BizError(Code.VALIDATE_ERROR, '部分商品不存在或已下架');
  }
  const productMap = new Map(products.map((p) => [p.id, p]));

  // 校验数量
  for (const it of items) {
    if (!it.quantity || it.quantity < 1 || it.quantity > 999) {
      throw new BizError(Code.VALIDATE_ERROR, '商品数量不合法');
    }
  }

  // 金额计算（以库中价格为准，防篡改）
  const { Prisma } = require('@prisma/client');
  let totalAmount = new Prisma.Decimal(0);
  const orderItemsData = items.map((it) => {
    const p = productMap.get(it.productId);
    const subtotal = p.price.mul(it.quantity);
    totalAmount = totalAmount.add(subtotal);
    return { productId: p.id, quantity: it.quantity, price: p.price };
  });

  // 佣金快照：按第一个商品佣金比例（方案：佣金 = 订单总额 × 比例）
  // 多商品场景取加权比例；简化实现取第一个商品的佣金比例
  const commissionRate = productMap.get(items[0].productId).commissionRate;
  const commissionAmount = totalAmount.mul(commissionRate);

  // 自动派单开关快照
  const autoDispatchEnabled = (await getConfig(tenantId, 'auto_dispatch_enabled', '0')) === '1';
  const autoDispatchTimeout = parseInt(await getConfig(tenantId, 'auto_dispatch_timeout_seconds', '120'), 10) || 120;

  const club = await prisma.club.findUnique({ where: { id: tenantId }, select: { code: true } });

  // 事务创建订单 + 明细
  const order = await prisma.$transaction(async (tx) => {
    const o = await tx.order.create({
      data: {
        tenantId,
        orderNo: generateOrderNo(club.code),
        userId,
        totalAmount,
        commissionAmount,
        commissionRate,
        autoDispatch: autoDispatchEnabled,
        autoDispatchAt: autoDispatchEnabled ? null : null, // 支付后设置（paid_at + timeout）
        profileData: profileData ? JSON.stringify(profileData) : null,
        items: { create: orderItemsData.map((d) => ({ ...d, tenantId })) },
      },
      include: { items: true },
    });
    return o;
  });

  // 微信统一下单（租户配置）
  const cfg = await getWechatConfig(tenantId);
  if (!isPaymentConfigured(cfg)) {
    // 未配置支付：订单保留为「待支付」，用户可在订单列表再次尝试支付（测试模式自动置已支付）
    logger.biz('order_pending_no_pay_config', { orderId: order.id, orderNo: order.orderNo, tenantId });
    return { order: { id: order.id, orderNo: order.orderNo, totalAmount: totalAmount.toNumber(), payStatus: 'PENDING' }, payParams: null };
  }

  const totalFee = Math.round(totalAmount.toNumber() * 100);
  const user = await prisma.user.findUnique({ where: { id: userId } });
  const { prepayId, payParams } = await unifiedOrder(cfg, {
    outTradeNo: order.orderNo,
    body: orderItemsData.length === 1 ? productMap.get(items[0].productId).name : '商城订单',
    totalFee,
    openid: user.openid,
  });

  await prisma.order.update({ where: { id: order.id }, data: { prepayId } });

  logger.biz('order_created', { orderId: order.id, orderNo: order.orderNo, tenantId, userId, totalAmount: totalAmount.toNumber() });

  return { order: { id: order.id, orderNo: order.orderNo, totalAmount: totalAmount.toNumber() }, payParams };
}

/**
 * 管理员手动下单/派单（无需微信支付，直接 PAID 进入派单流程）
 * 模式 dispatchMode：GRAB=抢单池 / AUTO=自动派单 / ASSIGN=指定打手
 * @param {object} p { tenantId, adminId, productId, quantity, profileData, dispatchMode, playerId? }
 */
async function createOrderByAdmin({ tenantId, adminId, productId, quantity, profileData, dispatchMode, playerId }) {
  if (!productId || !quantity || quantity < 1) {
    throw new BizError(Code.VALIDATE_ERROR, '请选择商品与数量');
  }

  // 演示版限制：订单总数上限
  const limitClub = await prisma.club.findUnique({ where: { id: tenantId }, select: { maxOrders: true } });
  if (limitClub && limitClub.maxOrders != null) {
    const orderCount = await prisma.order.count({ where: { tenantId } });
    if (orderCount >= limitClub.maxOrders) {
      throw new BizError(Code.VALIDATE_ERROR, `演示版最多接收 ${limitClub.maxOrders} 个订单，请联系平台管理员升级或重置`);
    }
  }

  // 商品校验
  const product = await prisma.product.findFirst({ where: { tenantId, id: productId, published: true } });
  if (!product) throw new BizError(Code.VALIDATE_ERROR, '商品不存在或已下架');

  // 指定打手校验（ASSIGN 模式必填）
  let targetPlayer = null;
  if (dispatchMode === 'ASSIGN') {
    if (!playerId) throw new BizError(Code.VALIDATE_ERROR, '指定打手模式请选择打手');
    targetPlayer = await prisma.player.findFirst({ where: { tenantId, id: playerId, status: 'active' } });
    if (!targetPlayer) throw new BizError(Code.NOT_FOUND, '打手不存在或已禁用');
    if (!targetPlayer.qrcodePath) throw new BizError(Code.PLAYER_NO_QRCODE, '该打手未上传收款二维码');
  }

  // 金额/佣金计算
  const { Prisma } = require('@prisma/client');
  const totalAmount = product.price.mul(quantity);
  const commissionAmount = totalAmount.mul(product.commissionRate);
  const club = await prisma.club.findUnique({ where: { id: tenantId }, select: { code: true } });

  // 自动派单开关（AUTO 模式生效前提）
  const autoDispatchEnabled = (await getConfig(tenantId, 'auto_dispatch_enabled', '0')) === '1';

  // 收件人快照
  const customer = profileData && (profileData.name || profileData.identifier || profileData.platform)
    ? profileData
    : { platform: '线下代下单', identifier: '管理员手动下单' };

  // 事务创建订单（PAID 直接进入派单状态机）
  const order = await prisma.$transaction(async (tx) => {
    // 管理员代下单归属一个「线下用户」（复用，不产生微信用户）
    let sysUser = await tx.user.findFirst({ where: { tenantId, openid: 'OFFLINE_ADMIN' } });
    if (!sysUser) {
      sysUser = await tx.user.create({
        data: { tenantId, openid: 'OFFLINE_ADMIN', nickname: '线下代下单' },
      });
    }
    const o = await tx.order.create({
      data: {
        tenantId,
        orderNo: generateOrderNo(club.code),
        userId: sysUser.id,
        totalAmount,
        commissionAmount,
        commissionRate: product.commissionRate,
        autoDispatch: dispatchMode === 'AUTO' && autoDispatchEnabled,
        autoDispatchAt: dispatchMode === 'AUTO' && autoDispatchEnabled ? new Date(Date.now() + 60 * 1000) : null,
        payStatus: 'PAID',
        dispatchStatus: dispatchMode === 'ASSIGN' ? 'IN_PROGRESS' : 'PENDING_GRAB',
        dispatchType: dispatchMode === 'ASSIGN' ? 'ASSIGN' : (dispatchMode === 'AUTO' ? 'AUTO' : 'GRAB'),
        assignedPlayerId: targetPlayer ? targetPlayer.id : null,
        acceptedPlayerId: targetPlayer ? targetPlayer.id : null,
        paidAt: new Date(now()),
        profileData: JSON.stringify(customer),
        items: { create: [{ tenantId, productId: product.id, quantity, price: product.price }] },
      },
      include: { items: true },
    });

    // 销量累加
    await tx.product.update({ where: { id: product.id }, data: { salesCount: { increment: quantity } } });

    // 指定打手：写派单流水
    if (dispatchMode === 'ASSIGN') {
      await tx.dispatchLog.create({
        data: {
          tenantId,
          orderId: o.id,
          action: 'ASSIGN',
          playerId: targetPlayer.id,
          note: `管理员手动派单，指定打手 ${targetPlayer.nickname}`,
        },
      });
    }
    return o;
  });

  logger.biz('admin_create_order', {
    orderId: order.id, orderNo: order.orderNo, tenantId, adminId,
    dispatchMode, totalAmount: totalAmount.toNumber(),
  });

  return {
    order: {
      id: order.id,
      orderNo: order.orderNo,
      totalAmount: totalAmount.toNumber(),
      dispatchStatus: order.dispatchStatus,
      dispatchType: order.dispatchType,
    },
  };
}

/**
 * 支付回调（微信服务器 → /api/payment/notify）
 * order_no 反查租户 → 租户密钥验签 → 置 PAID、销量累加、进派单池、请求订阅消息
 * @param {object} xmlObj 回调 XML 解析对象
 * @returns {{code: 'SUCCESS'|'FAIL', msg?: string, orderNo: string}}
 */
async function handlePaymentNotify(xmlObj) {
  const orderNo = xmlObj.out_trade_no;
  const order = await prisma.order.findUnique({ where: { orderNo } });
  if (!order) return { code: 'FAIL', msg: '订单不存在', orderNo };

  const cfg = await getWechatConfig(order.tenantId);
  const { verifyNotifySign } = require('../utils/wxpay');
  if (!verifyNotifySign(xmlObj, cfg.apiKey)) {
    return { code: 'FAIL', msg: '验签失败', orderNo };
  }
  if (xmlObj.return_code !== 'SUCCESS' || xmlObj.result_code !== 'SUCCESS') {
    return { code: 'FAIL', msg: '支付结果不是成功状态', orderNo };
  }
  if (xmlObj.appid !== cfg.appId || xmlObj.mch_id !== cfg.mchId) {
    return { code: 'FAIL', msg: '支付商户信息不匹配', orderNo };
  }
  const expectedFee = Math.round(order.totalAmount.toNumber() * 100);
  if (Number(xmlObj.total_fee) !== expectedFee) {
    return { code: 'FAIL', msg: '支付金额不匹配', orderNo };
  }

  // 幂等：已 PAID 直接成功
  if (order.payStatus === 'PAID') return { code: 'SUCCESS', orderNo };

  if (order.payStatus !== 'PENDING') {
    return { code: 'FAIL', msg: '订单状态不允许支付回调', orderNo };
  }

  const paidAt = new Date(now());

  // 自动派单触发时间 = paid_at + timeout
  const timeout = parseInt(await getConfig(order.tenantId, 'auto_dispatch_timeout_seconds', '120'), 10) || 120;
  const autoDispatchAt = order.autoDispatch ? new Date(paidAt.getTime() + timeout * 1000) : null;

  const paidNow = await prisma.$transaction(async (tx) => {
    const changed = await tx.order.updateMany({
      where: { id: order.id, payStatus: 'PENDING' },
      data: {
        payStatus: 'PAID',
        transactionId: xmlObj.transaction_id || null,
        paidAt,
        autoDispatchAt,
      },
    });
    if (changed.count !== 1) return false;
    // 销量累加
    const orderItems = await tx.orderItem.findMany({ where: { orderId: order.id } });
    await Promise.all(orderItems.filter((it) => it.productId).map((it) => tx.product.update({
        where: { id: it.productId },
        data: { salesCount: { increment: it.quantity } },
    })));
    return true;
  });

  if (!paidNow) return { code: 'SUCCESS', orderNo };

  logger.biz('order_paid', { orderId: order.id, orderNo, tenantId: order.tenantId, transactionId: xmlObj.transaction_id });

  // 请求订阅消息（用户端「订单已接单」模板，异步）
  try {
    const user = await prisma.user.findUnique({ where: { id: order.userId }, select: { openid: true } });
    if (user) {
      await enqueue(order.tenantId, 'SUBSCRIBE_MSG', {
        scene: 'order_paid', tenantId: order.tenantId, openid: user.openid,
        orderNo, templateKey: 'subscribe_tpl_accepted',
      });
    }
  } catch (error) {
    logger.error(error, { event: 'payment_notification_enqueue_failed', orderId: order.id, tenantId: order.tenantId });
  }

  return { code: 'SUCCESS', orderNo };
}

/** 用户订单列表 */
async function listMyOrders({ tenantId, userId, page, pageSize, status }) {
  const where = { tenantId, userId };
  if (status === 'PAID') where.payStatus = 'PAID';
  const [total, rows] = await Promise.all([
    prisma.order.count({ where }),
    prisma.order.findMany({
      where,
      orderBy: { id: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        items: { include: { product: { select: { id: true, name: true, coverUrl: true } } } },
      },
    }),
  ]);
  return {
    total,
    list: rows.map((o) => ({
      ...o,
      totalAmount: o.totalAmount.toNumber(),
      commissionAmount: o.commissionAmount.toNumber(),
      dispatchText: DISPATCH_TEXT[o.dispatchStatus],
    })),
  };
}

/** 订单详情（用户端，含明细） */
async function getOrderDetail({ tenantId, userId, orderId }) {
  const order = await prisma.order.findFirst({
    where: { tenantId, id: orderId, userId },
    include: {
      items: { include: { product: { select: { id: true, name: true, coverUrl: true } } } },
    },
  });
  if (!order) throw new BizError(Code.NOT_FOUND, '订单不存在');
  return {
    ...order,
    totalAmount: order.totalAmount.toNumber(),
    commissionAmount: order.commissionAmount.toNumber(),
    dispatchText: DISPATCH_TEXT[order.dispatchStatus],
    profileData: order.profileData ? safeParseProfile(order.profileData) : null,
  };
}

/**
 * 管理端订单详情（不限用户，带打手/明细/结算信息）
 */
async function getAdminOrderDetail({ tenantId, orderId }) {
  const order = await prisma.order.findFirst({
    where: { tenantId, id: orderId },
    include: {
      items: { include: { product: { select: { id: true, name: true, coverUrl: true } } } },
      acceptedPlayer: { select: { id: true, username: true, nickname: true, qrcodePath: true } },
      assignedPlayer: { select: { id: true, username: true, nickname: true } },
    },
  });
  if (!order) throw new BizError(Code.NOT_FOUND, '订单不存在');
  return {
    ...order,
    totalAmount: order.totalAmount.toNumber(),
    commissionAmount: order.commissionAmount.toNumber(),
    commissionRate: order.commissionRate.toNumber(),
    dispatchText: DISPATCH_TEXT[order.dispatchStatus],
    profileData: order.profileData ? safeParseProfile(order.profileData) : null,
  };
}

/** 防御性 JSON 解析：无效 JSON 返回 null（不阻断订单展示） */
function safeParseProfile(str) {
  try {
    return JSON.parse(str);
  } catch (e) {
    return null;
  }
}

/** 取消订单（仅待付款 PENDING 可取消） */
async function cancelOrder({ tenantId, userId, orderId }) {
  const order = await prisma.order.findFirst({ where: { tenantId, id: orderId, userId } });
  if (!order) throw new BizError(Code.NOT_FOUND, '订单不存在');
  if (order.payStatus !== 'PENDING') {
    throw new BizError(Code.ORDER_STATUS_INVALID, '仅待付款订单可取消');
  }
  const updated = await prisma.order.update({
    where: { id: order.id },
    data: { payStatus: 'CANCELLED', dispatchStatus: 'CANCELLED', cancelledAt: new Date(now()) },
  });
  logger.biz('order_cancelled', { orderId: order.id, orderNo: order.orderNo, userId });
  return updated;
}

/** 重新发起支付（未配置微信支付时进入测试模式：直接置为已支付） */
async function repay({ tenantId, userId, orderId }) {
  const order = await prisma.order.findFirst({ where: { tenantId, id: orderId, userId } });
  if (!order) throw new BizError(Code.NOT_FOUND, '订单不存在');
  if (order.payStatus !== 'PENDING') {
    throw new BizError(Code.ORDER_STATUS_INVALID, '仅待付款订单可发起支付');
  }
  const cfg = await getWechatConfig(tenantId);
  if (!isPaymentConfigured(cfg)) {
    // 未配置支付：不在此处置为已支付——支付成功只能由管理员后台「标记已支付」完成
    throw new BizError(Code.VALIDATE_ERROR, '俱乐部支付未配置，请联系俱乐部管理员确认收款');
  }
  const user = await prisma.user.findUnique({ where: { id: userId } });
  const totalFee = Math.round(order.totalAmount.toNumber() * 100);
  const { prepayId, payParams } = await unifiedOrder(cfg, {
    outTradeNo: order.orderNo,
    body: '商城订单',
    totalFee,
    openid: user.openid,
  });
  await prisma.order.update({ where: { id: order.id }, data: { prepayId } });
  return payParams;
}

/** 管理员确认线下收款；普通用户端绝不暴露此能力。 */
async function markPaidByAdmin({ tenantId, adminId, orderId }) {
  const order = await prisma.order.findFirst({ where: { tenantId, id: orderId } });
  if (!order) throw new BizError(Code.NOT_FOUND, '订单不存在');
  if (order.payStatus !== 'PENDING') {
    throw new BizError(Code.ORDER_STATUS_INVALID, '仅待付款订单可确认收款');
  }
  const paidAt = new Date(now());
  const timeout = parseInt(await getConfig(tenantId, 'auto_dispatch_timeout_seconds', '120'), 10) || 120;
  await prisma.$transaction(async (tx) => {
    const changed = await tx.order.updateMany({
      where: { id: order.id, tenantId, payStatus: 'PENDING' },
      data: {
        payStatus: 'PAID',
        paidAt,
        transactionId: `MANUAL_${Date.now()}`,
        autoDispatchAt: order.autoDispatch ? new Date(paidAt.getTime() + timeout * 1000) : null,
      },
    });
    if (changed.count !== 1) throw new BizError(Code.ORDER_STATUS_INVALID, '订单状态已变化，请刷新后重试');
    const items = await tx.orderItem.findMany({ where: { orderId: order.id } });
    await Promise.all(items.filter((it) => it.productId).map((it) => tx.product.update({
      where: { id: it.productId },
      data: { salesCount: { increment: it.quantity } },
    })));
  });
  logger.biz('order_manual_paid', { orderId: order.id, orderNo: order.orderNo, adminId });
  return { success: true };
}

/**
 * 管理员删除订单（仅待支付/已取消可删，已支付订单禁止删除防资金纠纷）
 */
async function deleteOrderByAdmin({ tenantId, adminId, orderId }) {
  const order = await prisma.order.findFirst({ where: { tenantId, id: orderId } });
  if (!order) throw new BizError(Code.NOT_FOUND, '订单不存在');
  if (!['PENDING', 'CANCELLED', 'REFUNDED'].includes(order.payStatus)) {
    throw new BizError(Code.ORDER_STATUS_INVALID, '仅待支付或已取消订单可删除');
  }
  await prisma.$transaction(async (tx) => {
    await tx.chatMessage.deleteMany({ where: { orderId: order.id } });
    await tx.commissionLog.deleteMany({ where: { orderId: order.id } });
    await tx.dispatchLog.deleteMany({ where: { orderId: order.id } });
    await tx.orderItem.deleteMany({ where: { orderId: order.id } });
    await tx.order.delete({ where: { id: order.id } });
  });
  logger.biz('order_admin_deleted', { orderId: order.id, orderNo: order.orderNo, adminId });
  return { success: true };
}

module.exports = {
  DISPATCH_TEXT,
  createOrder,
  createOrderByAdmin,
  handlePaymentNotify,
  listMyOrders,
  getOrderDetail,
  getAdminOrderDetail,
  cancelOrder,
  repay,
  markPaidByAdmin,
  deleteOrderByAdmin,
};
