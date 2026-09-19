/**
 * 打手端路由（Web，/api/player/*）
 */
const express = require('express');
const router = express.Router();
const { positiveInteger } = require('../middleware/validateParam');
router.param('id', positiveInteger);
router.param('orderId', positiveInteger);
const ctrl = require('../controllers/playerController');
const auth = require('../middleware/auth');
const tenantCtx = require('../middleware/tenantCtx');
const { tenantGuard } = require('../middleware/tenantGuard');
const rateLimit = require('../middleware/rateLimit');

router.post('/login', rateLimit({ windowMs: 60000, max: 30 }), tenantCtx({ required: true }), tenantGuard(), ctrl.login);

// 已登录：所有操作带租户校验；抢单为新交易，到期拦截
router.get('/profile', auth(['PLAYER']), tenantCtx(), tenantGuard(), ctrl.profile);
router.put('/online', auth(['PLAYER']), tenantCtx(), tenantGuard(), ctrl.toggleOnline);
router.get('/available-partners', auth(['PLAYER']), tenantCtx(), tenantGuard(), ctrl.availablePartners);
router.get('/available-orders', auth(['PLAYER']), tenantCtx(), tenantGuard(), ctrl.availableOrders);
router.post('/orders/:id/grab', auth(['PLAYER']), tenantCtx(), tenantGuard({ blockNewTrade: true }), ctrl.grabOrder);
router.post('/orders/:id/partner/confirm', auth(['PLAYER']), tenantCtx(), tenantGuard(), ctrl.confirmPartner);
router.post('/orders/:id/partner/reject', auth(['PLAYER']), tenantCtx(), tenantGuard(), ctrl.rejectPartner);
router.post('/orders/:id/partner/cancel', auth(['PLAYER']), tenantCtx(), tenantGuard(), ctrl.cancelPartnerInvite);
router.get('/orders', auth(['PLAYER']), tenantCtx(), tenantGuard(), ctrl.myOrders);
router.get('/orders/:id', auth(['PLAYER']), tenantCtx(), tenantGuard(), ctrl.getOrder);
router.post('/orders/:id/submit', auth(['PLAYER']), tenantCtx(), tenantGuard(), ctrl.optionalSingleImage('screenshot'), ctrl.submitOrder);
router.get('/pending-withdraw', auth(['PLAYER']), tenantCtx(), tenantGuard(), ctrl.pendingWithdraw);
router.post('/withdraw/:id/apply', auth(['PLAYER']), tenantCtx(), tenantGuard(), ctrl.applyWithdraw);
router.get('/commissions', auth(['PLAYER']), tenantCtx(), tenantGuard(), ctrl.myCommissions);
router.get('/qrcode', auth(['PLAYER']), tenantCtx(), tenantGuard(), ctrl.profile);
router.put('/qrcode', auth(['PLAYER']), tenantCtx(), tenantGuard(), ctrl.optionalSingleImage('qrcode'), ctrl.setQrcode);
router.delete('/qrcode', auth(['PLAYER']), tenantCtx(), tenantGuard(), ctrl.removeQrcode);

// 沟通
router.get('/chat/:orderId/messages', auth(['PLAYER']), tenantCtx(), tenantGuard(), ctrl.chatList);
router.post('/chat/:orderId/messages', auth(['PLAYER']), tenantCtx(), tenantGuard(), ctrl.chatSend);

// 通用上传（打手端，纯文件上传入口：前端上传后拿路径再提交）
router.post('/upload', auth(['PLAYER']), tenantCtx(), tenantGuard(), ctrl.singleImage('file'), (req, res) => {
  res.json({ code: 0, message: 'success', data: { path: req.imagePath } });
});

module.exports = router;
