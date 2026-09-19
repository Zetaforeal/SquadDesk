/**
 * 用户端控制器（小程序）
 */
const { ok, fail, BizError, Code } = require('../utils/response');
const authService = require('../services/auth.service');
const orderService = require('../services/order.service');
const catalogService = require('../services/catalog.service');
const { parsePagination, paginated } = require('../utils/pagination');
const { getConfigs } = require('../models/clubConfig');
const { prisma } = require('../db');
const { safeText } = require('../utils/sanitize');

// ---------- 登录 ----------

async function login(req, res, next) {
  try {
    const { code, tenantId, nickname, avatarUrl } = req.body;
    if (!code || !tenantId) return fail(res, Code.VALIDATE_ERROR, '缺少 code 或 tenantId');
    const result = await authService.userLoginWechat({ tenantId, code, nickname, avatarUrl });
    return ok(res, result);
  } catch (e) { next(e); }
}

async function sendPhoneCode(req, res, next) {
  try {
    const { phone, tenantId } = req.body;
    if (!/^1\d{10}$/.test(String(phone)) || !tenantId) return fail(res, Code.VALIDATE_ERROR, '手机号或 tenantId 不合法');
    const result = await authService.sendPhoneCode({ tenantId, phone });
    return ok(res, result);
  } catch (e) { next(e); }
}

async function loginPhone(req, res, next) {
  try {
    const { phone, code, tenantId } = req.body;
    if (!/^1\d{10}$/.test(String(phone)) || !/^\d{6}$/.test(String(code)) || !tenantId) return fail(res, Code.VALIDATE_ERROR, '手机号、验证码或 tenantId 不合法');
    const result = await authService.userLoginPhone({ tenantId, phone, code });
    return ok(res, result);
  } catch (e) { next(e); }
}

// ---------- 收货资料 ----------

async function getProfile(req, res, next) {
  try {
    const profile = await prisma.userProfile.findUnique({
      where: { userId: req.auth.actorId },
    });
    return ok(res, profile);
  } catch (e) { next(e); }
}

async function updateProfile(req, res, next) {
  try {
    const { platform, identifier, address } = req.body;
    const profile = await prisma.userProfile.upsert({
      where: { userId: req.auth.actorId },
      update: {
        ...(platform !== undefined ? { platform: safeText(platform, 100) } : {}),
        ...(identifier !== undefined ? { identifier: safeText(identifier, 100) } : {}),
        ...(address !== undefined ? { address: safeText(address, 100) } : {}),
      },
      create: {
        tenantId: req.tenantId,
        userId: req.auth.actorId,
        platform: safeText(platform || '', 100),
        identifier: safeText(identifier || '', 100),
        address: safeText(address || '', 100),
      },
    });
    return ok(res, profile);
  } catch (e) { next(e); }
}

// ---------- 目录 ----------

async function listCategories(req, res, next) {
  try {
    const list = await catalogService.listCategories({ tenantId: req.tenantId, onlyEnabled: true });
    return ok(res, list);
  } catch (e) { next(e); }
}

async function listProducts(req, res, next) {
  try {
    const { page, pageSize, skip, take } = parsePagination(req.query);
    const result = await catalogService.listProducts({
      tenantId: req.tenantId,
      categoryId: req.query.categoryId,
      onlyPublished: true,
      page,
      pageSize,
      keyword: req.query.keyword,
    });
    return ok(res, result);
  } catch (e) { next(e); }
}

async function getProduct(req, res, next) {
  try {
    const product = await catalogService.getProduct({ tenantId: req.tenantId, productId: parseInt(req.params.id, 10), onlyPublished: true });
    return ok(res, product);
  } catch (e) { next(e); }
}

async function getHomeLayout(req, res, next) {
  try {
    const layout = await catalogService.getActiveLayout({ tenantId: req.tenantId });
    return ok(res, layout);
  } catch (e) { next(e); }
}

// ---------- 公开配置（小程序端展示用，非敏感项） ----------

/** 小程序端公开配置：联系客服链接等（仅返回白名单内的非敏感配置） */
const USER_CONFIG_KEYS = ['customer_service_link'];

async function getClubConfig(req, res, next) {
  try {
    const configs = await getConfigs(req.tenantId, USER_CONFIG_KEYS);
    return ok(res, configs);
  } catch (e) { next(e); }
}

// ---------- 订单 ----------

async function createOrder(req, res, next) {
  try {
    const { items, profileData } = req.body;
    if (!items || !items.length) return fail(res, Code.VALIDATE_ERROR, '订单商品不能为空');
    const result = await orderService.createOrder({
      tenantId: req.tenantId,
      userId: req.auth.actorId,
      items,
      profileData,
    });
    return ok(res, result);
  } catch (e) { next(e); }
}

async function listMyOrders(req, res, next) {
  try {
    const { page, pageSize } = parsePagination(req.query);
    const result = await orderService.listMyOrders({
      tenantId: req.tenantId,
      userId: req.auth.actorId,
      page,
      pageSize,
      status: req.query.status,
    });
    return ok(res, result);
  } catch (e) { next(e); }
}

async function getOrder(req, res, next) {
  try {
    const order = await orderService.getOrderDetail({
      tenantId: req.tenantId,
      userId: req.auth.actorId,
      orderId: parseInt(req.params.id, 10),
    });
    return ok(res, order);
  } catch (e) { next(e); }
}

async function cancelOrder(req, res, next) {
  try {
    const result = await orderService.cancelOrder({
      tenantId: req.tenantId,
      userId: req.auth.actorId,
      orderId: parseInt(req.params.id, 10),
    });
    return ok(res, result);
  } catch (e) { next(e); }
}

async function repay(req, res, next) {
  try {
    const payParams = await orderService.repay({
      tenantId: req.tenantId,
      userId: req.auth.actorId,
      orderId: parseInt(req.params.id, 10),
    });
    return ok(res, payParams);
  } catch (e) { next(e); }
}

module.exports = {
  login,
  sendPhoneCode,
  loginPhone,
  getProfile,
  updateProfile,
  listCategories,
  listProducts,
  getProduct,
  getHomeLayout,
  getClubConfig,
  createOrder,
  listMyOrders,
  getOrder,
  cancelOrder,
  repay,
};
