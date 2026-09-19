/**
 * 俱乐部管理端控制器
 */
const { ok, fail, BizError, Code } = require('../utils/response');
const authService = require('../services/auth.service');
const catalogService = require('../services/catalog.service');
const dispatchService = require('../services/dispatch.service');
const settleService = require('../services/settle.service');
const playerService = require('../services/player.service');
const statsService = require('../services/stats.service');
const chatService = require('../services/chat.service');
const { getConfig, getConfigs, setConfigs, invalidate } = require('../models/clubConfig');
const { parsePagination } = require('../utils/pagination');
const { singleImage } = require('../middleware/upload');
const { prisma } = require('../db');

async function login(req, res, next) {
  try {
    const { username, password, tenantId } = req.body;
    if (!username || !password || !tenantId) return fail(res, Code.VALIDATE_ERROR, '参数不完整');
    const result = await authService.adminLogin({ username, password, tenantId });
    return ok(res, result);
  } catch (e) { next(e); }
}

async function info(req, res, next) {
  try {
    const admin = await prisma.adminUser.findUnique({ where: { id: req.auth.actorId } });
    return ok(res, { id: admin.id, username: admin.username, role: admin.role, tenantId: admin.tenantId });
  } catch (e) { next(e); }
}

/** 俱乐部管理员修改自己的密码 */
async function changePassword(req, res, next) {
  try {
    const { oldPassword, newPassword } = req.body;
    if (!oldPassword || !newPassword) return fail(res, Code.VALIDATE_ERROR, '参数不完整');
    const result = await authService.changeAdminPassword({
      actorId: req.auth.actorId,
      tenantId: req.auth.tenantId,
      oldPassword,
      newPassword,
    });
    return ok(res, result);
  } catch (e) { next(e); }
}

// ---------- 分类 ----------

async function listCategories(req, res, next) {
  try {
    const list = await catalogService.listCategories({ tenantId: req.tenantId });
    return ok(res, list);
  } catch (e) { next(e); }
}

async function createCategory(req, res, next) {
  try {
    const result = await catalogService.createCategory({ tenantId: req.tenantId, ...req.body });
    return ok(res, result);
  } catch (e) { next(e); }
}

async function updateCategory(req, res, next) {
  try {
    const result = await catalogService.updateCategory({ tenantId: req.tenantId, categoryId: parseInt(req.params.id, 10), data: req.body });
    return ok(res, result);
  } catch (e) { next(e); }
}

async function deleteCategory(req, res, next) {
  try {
    const result = await catalogService.deleteCategory({ tenantId: req.tenantId, categoryId: parseInt(req.params.id, 10) });
    return ok(res, result);
  } catch (e) { next(e); }
}

// ---------- 商品 ----------

async function listProducts(req, res, next) {
  try {
    const { page, pageSize } = parsePagination(req.query);
    const result = await catalogService.listProducts({
      tenantId: req.tenantId,
      categoryId: req.query.categoryId,
      page,
      pageSize,
      keyword: req.query.keyword,
    });
    return ok(res, result);
  } catch (e) { next(e); }
}

async function getProduct(req, res, next) {
  try {
    const product = await catalogService.getProduct({ tenantId: req.tenantId, productId: parseInt(req.params.id, 10) });
    return ok(res, product);
  } catch (e) { next(e); }
}

async function createProduct(req, res, next) {
  try {
    const { images } = req.body;
    const result = await catalogService.createProduct({ tenantId: req.tenantId, data: req.body, images });
    return ok(res, result);
  } catch (e) { next(e); }
}

async function updateProduct(req, res, next) {
  try {
    const result = await catalogService.updateProduct({
      tenantId: req.tenantId,
      productId: parseInt(req.params.id, 10),
      data: req.body,
      images: req.body.images,
    });
    return ok(res, result);
  } catch (e) { next(e); }
}

async function deleteProduct(req, res, next) {
  try {
    const result = await catalogService.deleteProduct({ tenantId: req.tenantId, productId: parseInt(req.params.id, 10) });
    return ok(res, result);
  } catch (e) { next(e); }
}

// ---------- 首页布局 ----------

async function getLayout(req, res, next) {
  try {
    const layout = await catalogService.getActiveLayout({ tenantId: req.tenantId });
    return ok(res, layout);
  } catch (e) { next(e); }
}

async function saveLayout(req, res, next) {
  try {
    const layout = await catalogService.saveLayout({ tenantId: req.tenantId, modules: req.body.modules });
    return ok(res, layout);
  } catch (e) { next(e); }
}

// ---------- 俱乐部配置 ----------

const CONFIG_KEYS = [
  'wechat_appid', 'wechat_secret', 'wechat_mchid', 'wechat_api_key', 'wechat_notify_url',
  'phone_login_url', 'phone_sms_url',
  'subscribe_tpl_accepted', 'subscribe_tpl_completed',
  'auto_dispatch_enabled', 'auto_dispatch_timeout_seconds',
  'settle_cooldown_hours',
  'profile_col_platform', 'profile_col_identifier', 'profile_col_address', 'profile_col_enabled',
  'customer_service_link',
];

async function getClubConfig(req, res, next) {
  try {
    const configs = await getConfigs(req.tenantId, CONFIG_KEYS);
    return ok(res, configs);
  } catch (e) { next(e); }
}

async function updateClubConfig(req, res, next) {
  try {
    const body = req.body || {};
    const entries = {};
    for (const k of CONFIG_KEYS) {
      if (body[k] !== undefined) entries[k] = body[k];
    }
    if (!Object.keys(entries).length) return fail(res, Code.VALIDATE_ERROR, '没有可更新的配置项');
    await setConfigs(req.tenantId, entries);
    return ok(res, entries);
  } catch (e) { next(e); }
}

// ---------- 订单管理 ----------

async function listOrders(req, res, next) {
  try {
    const { page, pageSize } = parsePagination(req.query);
    const result = await statsService.adminOrders({
      tenantId: req.tenantId,
      payStatus: req.query.payStatus,
      dispatchStatus: req.query.dispatchStatus,
      page,
      pageSize,
      keyword: req.query.keyword,
    });
    return ok(res, result);
  } catch (e) { next(e); }
}

/** 管理端订单详情 */
async function getOrder(req, res, next) {
  try {
    const orderService = require('../services/order.service');
    const result = await orderService.getAdminOrderDetail({
      tenantId: req.tenantId,
      orderId: parseInt(req.params.id, 10),
    });
    return ok(res, result);
  } catch (e) { next(e); }
}

async function assignOrder(req, res, next) {
  try {
    const { playerId } = req.body;
    if (!playerId) return fail(res, Code.VALIDATE_ERROR, '请选择打手');
    const result = await dispatchService.assignOrder({
      tenantId: req.tenantId,
      adminId: req.auth.actorId,
      orderId: parseInt(req.params.id, 10),
      playerId: parseInt(playerId, 10),
    });
    return ok(res, result);
  } catch (e) { next(e); }
}

async function adminCancelOrder(req, res, next) {
  try {
    const result = await settleService.adminCancelOrder({
      tenantId: req.tenantId,
      adminId: req.auth.actorId,
      orderId: parseInt(req.params.id, 10),
    });
    return ok(res, result);
  } catch (e) { next(e); }
}

/** 管理员删除订单（仅待支付/已取消可删） */
async function deleteOrder(req, res, next) {
  try {
    const orderService = require('../services/order.service');
    const result = await orderService.deleteOrderByAdmin({
      tenantId: req.tenantId,
      adminId: req.auth.actorId,
      orderId: parseInt(req.params.id, 10),
    });
    return ok(res, result);
  } catch (e) { next(e); }
}

async function markPaid(req, res, next) {
  try {
    const orderService = require('../services/order.service');
    const result = await orderService.markPaidByAdmin({
      tenantId: req.tenantId,
      adminId: req.auth.actorId,
      orderId: parseInt(req.params.id, 10),
    });
    return ok(res, result);
  } catch (e) { next(e); }
}

/** 管理员手动下单/派单（填收货信息 + 选商品 + 抢单/自动/指定打手） */
async function adminCreateOrder(req, res, next) {
  try {
    const orderService = require('../services/order.service');
    const { productId, quantity, profileData, dispatchMode, playerId } = req.body || {};
    const result = await orderService.createOrderByAdmin({
      tenantId: req.tenantId,
      adminId: req.auth.actorId,
      productId: parseInt(productId, 10),
      quantity: parseInt(quantity, 10),
      profileData,
      dispatchMode: dispatchMode || 'GRAB',
      playerId: playerId ? parseInt(playerId, 10) : null,
    });
    return ok(res, result);
  } catch (e) { next(e); }
}

// ---------- 结算 ----------

async function approveSettle(req, res, next) {
  try {
    const result = await settleService.approveSettle({ tenantId: req.tenantId, adminId: req.auth.actorId, orderId: parseInt(req.params.id, 10) });
    return ok(res, result);
  } catch (e) { next(e); }
}

async function rejectSettle(req, res, next) {
  try {
    const result = await settleService.rejectSettle({ tenantId: req.tenantId, adminId: req.auth.actorId, orderId: parseInt(req.params.id, 10), reason: req.body.reason });
    return ok(res, result);
  } catch (e) { next(e); }
}

async function listWithdraws(req, res, next) {
  try {
    const { page, pageSize } = parsePagination(req.query);
    const [total, list] = await Promise.all([
      prisma.order.count({ where: { tenantId: req.tenantId, dispatchStatus: 'WITHDRAW_PENDING' } }),
      prisma.order.findMany({
        where: { tenantId: req.tenantId, dispatchStatus: 'WITHDRAW_PENDING' },
        orderBy: { withdrawAppliedAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: { acceptedPlayer: { select: { id: true, nickname: true, qrcodePath: true } } },
      }),
    ]);
    return ok(res, { total, list: list.map((o) => ({ ...o, commissionAmount: o.commissionAmount.toNumber() })) });
  } catch (e) { next(e); }
}

async function approveWithdraw(req, res, next) {
  try {
    const result = await settleService.approveWithdraw({ tenantId: req.tenantId, adminId: req.auth.actorId, orderId: parseInt(req.params.id, 10) });
    return ok(res, result);
  } catch (e) { next(e); }
}

async function rejectWithdraw(req, res, next) {
  try {
    const result = await settleService.rejectWithdraw({ tenantId: req.tenantId, adminId: req.auth.actorId, orderId: parseInt(req.params.id, 10), reason: req.body.reason });
    return ok(res, result);
  } catch (e) { next(e); }
}

async function listPendingPayments(req, res, next) {
  try {
    const list = await prisma.order.findMany({
      where: { tenantId: req.tenantId, dispatchStatus: 'PENDING_PAYMENT' },
      orderBy: { pendingPaymentAt: 'desc' },
      include: { acceptedPlayer: { select: { id: true, nickname: true, qrcodePath: true } } },
    });
    return ok(res, list.map((o) => ({ ...o, commissionAmount: o.commissionAmount.toNumber() })));
  } catch (e) { next(e); }
}

async function payPendingPayment(req, res, next) {
  try {
    const result = await settleService.payPendingPayment({ tenantId: req.tenantId, adminId: req.auth.actorId, orderId: parseInt(req.params.id, 10) });
    return ok(res, result);
  } catch (e) { next(e); }
}

// ---------- 打手管理 ----------

async function listPlayers(req, res, next) {
  try {
    const { page, pageSize } = parsePagination(req.query);
    const result = await playerService.listPlayers({
      tenantId: req.tenantId,
      page,
      pageSize,
      status: req.query.status,
      keyword: req.query.keyword,
    });
    return ok(res, result);
  } catch (e) { next(e); }
}

async function createPlayer(req, res, next) {
  try {
    const result = await playerService.createPlayer({ tenantId: req.tenantId, ...req.body });
    return ok(res, result);
  } catch (e) { next(e); }
}

async function updatePlayer(req, res, next) {
  try {
    const result = await playerService.updatePlayer({ tenantId: req.tenantId, playerId: parseInt(req.params.id, 10), data: req.body });
    return ok(res, result);
  } catch (e) { next(e); }
}

async function deletePlayer(req, res, next) {
  try {
    const result = await playerService.deletePlayer({ tenantId: req.tenantId, playerId: parseInt(req.params.id, 10) });
    return ok(res, result);
  } catch (e) { next(e); }
}

// ---------- 佣金 ----------

async function listCommissions(req, res, next) {
  try {
    const { page, pageSize } = parsePagination(req.query);
    const result = await statsService.adminCommissions({ tenantId: req.tenantId, page, pageSize });
    return ok(res, result);
  } catch (e) { next(e); }
}

// ---------- 统计 ----------

async function dashboard(req, res, next) {
  try {
    const result = await statsService.dashboardStats({ tenantId: req.tenantId });
    return ok(res, result);
  } catch (e) { next(e); }
}

// ---------- 沟通 ----------

async function chatList(req, res, next) {
  try {
    const result = await chatService.listMessages({
      tenantId: req.tenantId,
      orderId: parseInt(req.params.orderId, 10),
      role: 'admin',
      actorId: req.auth.actorId,
    });
    return ok(res, result);
  } catch (e) { next(e); }
}

async function chatSend(req, res, next) {
  try {
    const result = await chatService.sendMessage({
      tenantId: req.tenantId,
      orderId: parseInt(req.params.orderId, 10),
      role: 'admin',
      actorId: req.auth.actorId,
      actorName: req.auth.actorId ? '管理员' : '管理员',
      content: req.body.content,
    });
    return ok(res, result);
  } catch (e) { next(e); }
}

module.exports = {
  login,
  info,
  listCategories,
  createCategory,
  updateCategory,
  deleteCategory,
  listProducts,
  getProduct,
  createProduct,
  updateProduct,
  deleteProduct,
  getLayout,
  saveLayout,
  getClubConfig,
  updateClubConfig,
  listOrders,
  getOrder,
  assignOrder,
  adminCancelOrder,
  deleteOrder,
  markPaid,
  adminCreateOrder,
  approveSettle,
  rejectSettle,
  listWithdraws,
  approveWithdraw,
  rejectWithdraw,
  listPendingPayments,
  payPendingPayment,
  listPlayers,
  createPlayer,
  updatePlayer,
  deletePlayer,
  listCommissions,
  dashboard,
  chatList,
  chatSend,
  changePassword,
};
