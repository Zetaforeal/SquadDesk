/**
 * 打手端控制器（Web）
 */
const { ok, fail, BizError, Code } = require('../utils/response');
const authService = require('../services/auth.service');
const dispatchService = require('../services/dispatch.service');
const settleService = require('../services/settle.service');
const playerService = require('../services/player.service');
const chatService = require('../services/chat.service');
const { parsePagination } = require('../utils/pagination');
const { singleImage, optionalSingleImage } = require('../middleware/upload');

async function login(req, res, next) {
  try {
    const { username, password, tenantId } = req.body;
    if (!username || !password || !tenantId) return fail(res, Code.VALIDATE_ERROR, '参数不完整');
    const result = await authService.playerLogin({ username, password, tenantId });
    return ok(res, result);
  } catch (e) { next(e); }
}

async function profile(req, res, next) {
  try {
    const p = await playerService.playerProfile({ playerId: req.auth.actorId });
    return ok(res, p);
  } catch (e) { next(e); }
}

async function toggleOnline(req, res, next) {
  try {
    const { online } = req.body;
    if (typeof online !== 'boolean') return fail(res, Code.VALIDATE_ERROR, 'online 必须为布尔值');
    const result = await playerService.toggleOnline({ playerId: req.auth.actorId, online });
    return ok(res, { online: result.online });
  } catch (e) { next(e); }
}

async function availableOrders(req, res, next) {
  try {
    const list = await dispatchService.listAvailableOrders({
      tenantId: req.tenantId,
      playerId: req.auth.actorId,
    });
    return ok(res, list);
  } catch (e) { next(e); }
}

async function availablePartners(req, res, next) {
  try {
    const list = await dispatchService.listOnlinePartners({
      tenantId: req.tenantId,
      excludePlayerId: req.auth.actorId,
    });
    return ok(res, list);
  } catch (e) { next(e); }
}

async function grabOrder(req, res, next) {
  try {
    const { partnerId } = req.body || {};
    const result = await dispatchService.grabOrder({
      tenantId: req.tenantId,
      playerId: req.auth.actorId,
      orderId: parseInt(req.params.id, 10),
      partnerId: partnerId ? parseInt(partnerId, 10) : null,
    });
    return ok(res, result);
  } catch (e) { next(e); }
}

/** 搭档确认：同意 → 订单进入进行中 */
async function confirmPartner(req, res, next) {
  try {
    const result = await dispatchService.confirmPartner({
      tenantId: req.tenantId,
      playerId: req.auth.actorId,
      orderId: parseInt(req.params.id, 10),
    });
    return ok(res, result);
  } catch (e) { next(e); }
}

/** 搭档拒绝：订单重回可抢池 */
async function rejectPartner(req, res, next) {
  try {
    const { reason } = req.body || {};
    const result = await dispatchService.rejectPartner({
      tenantId: req.tenantId,
      playerId: req.auth.actorId,
      orderId: parseInt(req.params.id, 10),
      reason,
    });
    return ok(res, result);
  } catch (e) { next(e); }
}

async function cancelPartnerInvite(req, res, next) {
  try {
    const result = await dispatchService.cancelPartnerInvite({
      tenantId: req.tenantId,
      playerId: req.auth.actorId,
      orderId: parseInt(req.params.id, 10),
    });
    return ok(res, result);
  } catch (e) { next(e); }
}

async function myOrders(req, res, next) {
  try {
    const { page, pageSize } = parsePagination(req.query);
    const result = await playerService.myOrders({
      tenantId: req.tenantId,
      playerId: req.auth.actorId,
      status: req.query.status || 'ALL',
      page,
      pageSize,
    });
    return ok(res, result);
  } catch (e) { next(e); }
}

async function getOrder(req, res, next) {
  try {
    const result = await playerService.orderDetail({
      tenantId: req.tenantId,
      playerId: req.auth.actorId,
      orderId: parseInt(req.params.id, 10),
    });
    return ok(res, result);
  } catch (e) { next(e); }
}

async function submitOrder(req, res, next) {
  try {
    const { note } = req.body;
    // 结单截图：上传文件(req.imagePath) 或 URL 直填(req.body.screenshotUrl)
    const screenshotPath = req.imagePath || req.body.screenshotUrl || '';
    if (!screenshotPath) return fail(res, Code.VALIDATE_ERROR, '请上传结单截图或填写图片链接');
    const result = await settleService.submitOrder({
      tenantId: req.tenantId,
      playerId: req.auth.actorId,
      orderId: parseInt(req.params.id, 10),
      screenshotPath,
      note,
    });
    return ok(res, result);
  } catch (e) { next(e); }
}

async function pendingWithdraw(req, res, next) {
  try {
    const result = await settleService.pendingWithdrawSummary({
      tenantId: req.tenantId,
      playerId: req.auth.actorId,
    });
    return ok(res, result);
  } catch (e) { next(e); }
}

async function applyWithdraw(req, res, next) {
  try {
    const result = await settleService.applyWithdraw({
      tenantId: req.tenantId,
      playerId: req.auth.actorId,
      orderId: parseInt(req.params.id, 10),
    });
    return ok(res, result);
  } catch (e) { next(e); }
}

async function setQrcode(req, res, next) {
  try {
    const qrcodePath = req.imagePath || req.body.qrcodeUrl || '';
    if (!qrcodePath) return fail(res, Code.VALIDATE_ERROR, '请上传收款二维码或填写图片链接');
    const result = await playerService.setQrcode({ playerId: req.auth.actorId, qrcodePath });
    return ok(res, { qrcodePath: result.qrcodePath });
  } catch (e) { next(e); }
}

async function removeQrcode(req, res, next) {
  try {
    const result = await playerService.removeQrcode({ playerId: req.auth.actorId });
    return ok(res, { qrcodePath: null });
  } catch (e) { next(e); }
}

async function myCommissions(req, res, next) {
  try {
    const { page, pageSize } = parsePagination(req.query);
    const result = await playerService.myCommissions({
      tenantId: req.tenantId,
      playerId: req.auth.actorId,
      page,
      pageSize,
    });
    return ok(res, result);
  } catch (e) { next(e); }
}

async function chatList(req, res, next) {
  try {
    const result = await chatService.listMessages({
      tenantId: req.tenantId,
      orderId: parseInt(req.params.orderId, 10),
      role: 'player',
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
      role: 'player',
      actorId: req.auth.actorId,
      actorName: req.player?.nickname || '打手',
      content: req.body.content,
    });
    return ok(res, result);
  } catch (e) { next(e); }
}

module.exports = {
  login,
  profile,
  toggleOnline,
  availableOrders,
  availablePartners,
  grabOrder,
  confirmPartner,
  rejectPartner,
  cancelPartnerInvite,
  myOrders,
  getOrder,
  submitOrder,
  pendingWithdraw,
  applyWithdraw,
  setQrcode,
  removeQrcode,
  myCommissions,
  chatList,
  chatSend,
  singleImage,
  optionalSingleImage,
};
