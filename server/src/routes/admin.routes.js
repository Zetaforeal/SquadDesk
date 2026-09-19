/**
 * 俱乐部管理端路由（/api/admin/*）
 */
const express = require('express');
const router = express.Router();
const { positiveInteger } = require('../middleware/validateParam');
router.param('id', positiveInteger);
router.param('orderId', positiveInteger);
const ctrl = require('../controllers/adminController');
const auth = require('../middleware/auth');
const tenantCtx = require('../middleware/tenantCtx');
const { tenantGuard } = require('../middleware/tenantGuard');
const rateLimit = require('../middleware/rateLimit');
const { singleImage } = require('../middleware/upload');

router.post('/login', rateLimit({ windowMs: 60000, max: 30 }), tenantCtx({ required: true }), tenantGuard(), ctrl.login);

// 已登录：仅 CLUB_ADMIN
const adminAuth = [auth(['CLUB_ADMIN']), tenantCtx(), tenantGuard()];

router.get('/info', ...adminAuth, ctrl.info);
router.put('/me/password', ...adminAuth, ctrl.changePassword);

// 分类
router.get('/categories', ...adminAuth, ctrl.listCategories);
router.post('/categories', ...adminAuth, ctrl.createCategory);
router.put('/categories/:id', ...adminAuth, ctrl.updateCategory);
router.delete('/categories/:id', ...adminAuth, ctrl.deleteCategory);

// 商品
router.get('/products', ...adminAuth, ctrl.listProducts);
router.get('/products/:id', ...adminAuth, ctrl.getProduct);
router.post('/products', ...adminAuth, ctrl.createProduct);
router.put('/products/:id', ...adminAuth, ctrl.updateProduct);
router.delete('/products/:id', ...adminAuth, ctrl.deleteProduct);

// 首页布局
router.get('/home/layout', ...adminAuth, ctrl.getLayout);
router.put('/home/layout', ...adminAuth, ctrl.saveLayout);

// 俱乐部配置
router.get('/club/config', ...adminAuth, ctrl.getClubConfig);
router.put('/club/config', ...adminAuth, ctrl.updateClubConfig);

// 订单（指派/取消为新交易，到期拦截）
router.get('/orders', ...adminAuth, ctrl.listOrders);
router.get('/orders/:id', ...adminAuth, ctrl.getOrder);
router.post('/orders/:id/assign', auth(['CLUB_ADMIN']), tenantCtx(), tenantGuard({ blockNewTrade: true }), ctrl.assignOrder);
router.delete('/orders/:id', ...adminAuth, ctrl.deleteOrder);
router.post('/orders/:id/cancel', ...adminAuth, ctrl.adminCancelOrder);
router.post('/orders/admin-create', auth(['CLUB_ADMIN']), tenantCtx(), tenantGuard({ blockNewTrade: true }), ctrl.adminCreateOrder);
router.post('/orders/:id/mark-paid', ...adminAuth, ctrl.markPaid);

// 结算
router.post('/orders/:id/approve', ...adminAuth, ctrl.approveSettle);
router.post('/orders/:id/reject', ...adminAuth, ctrl.rejectSettle);
router.get('/withdraws', ...adminAuth, ctrl.listWithdraws);
router.post('/withdraws/:id/approve', ...adminAuth, ctrl.approveWithdraw);
router.post('/withdraws/:id/reject', ...adminAuth, ctrl.rejectWithdraw);
router.get('/pending-payments', ...adminAuth, ctrl.listPendingPayments);
router.post('/pending-payments/:id/pay', ...adminAuth, ctrl.payPendingPayment);

// 打手管理
router.get('/players', ...adminAuth, ctrl.listPlayers);
router.post('/players', ...adminAuth, ctrl.createPlayer);
router.put('/players/:id', ...adminAuth, ctrl.updatePlayer);
router.delete('/players/:id', ...adminAuth, ctrl.deletePlayer);

// 佣金与统计
router.get('/commissions', ...adminAuth, ctrl.listCommissions);
router.get('/dashboard/stats', ...adminAuth, ctrl.dashboard);

// 沟通
router.get('/chat/:orderId/messages', ...adminAuth, ctrl.chatList);
router.post('/chat/:orderId/messages', ...adminAuth, ctrl.chatSend);

// 上传（通用单图）
router.post('/upload', auth(['CLUB_ADMIN']), tenantCtx(), tenantGuard(), singleImage('file'), (req, res) => {
  res.json({ code: 0, message: 'success', data: { path: req.imagePath } });
});

module.exports = router;
