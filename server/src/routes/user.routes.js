/**
 * 用户端路由（小程序）
 * 中间件顺序：tenantCtx（公开接口取参数）→ tenantGuard（校验租户）→ 业务
 * 已登录接口：auth → tenantCtx → tenantGuard
 * 注意：小程序端统一 blockExpired=true —— 租户到期后小程序完全不可用（任何请求返回 1002）
 */
const express = require('express');
const router = express.Router();
const { positiveInteger } = require('../middleware/validateParam');
router.param('id', positiveInteger);
const ctrl = require('../controllers/userController');
const auth = require('../middleware/auth');
const tenantCtx = require('../middleware/tenantCtx');
const { tenantGuard } = require('../middleware/tenantGuard');
const rateLimit = require('../middleware/rateLimit');

// 公开接口：登录类（防刷限流）
router.post('/login', rateLimit({ windowMs: 60000, max: 30 }), tenantCtx({ required: true }), tenantGuard({ blockExpired: true }), ctrl.login);
router.post('/login-phone', rateLimit({ windowMs: 60000, max: 30 }), tenantCtx({ required: true }), tenantGuard({ blockExpired: true }), ctrl.loginPhone);
router.post('/send-phone-code', rateLimit({ windowMs: 60000, max: 5 }), tenantCtx({ required: true }), tenantGuard({ blockExpired: true }), ctrl.sendPhoneCode);

// 公开接口：目录浏览（到期不拦截）
router.get('/categories', tenantCtx({ required: true }), tenantGuard({ blockExpired: true }), ctrl.listCategories);
router.get('/products', tenantCtx({ required: true }), tenantGuard({ blockExpired: true }), ctrl.listProducts);
router.get('/products/:id', tenantCtx({ required: true }), tenantGuard({ blockExpired: true }), ctrl.getProduct);
router.get('/home/layout', tenantCtx({ required: true }), tenantGuard({ blockExpired: true }), ctrl.getHomeLayout);
// 公开配置（客服链接等展示项，非敏感）
router.get('/club/config', tenantCtx({ required: true }), tenantGuard({ blockExpired: true }), ctrl.getClubConfig);

// 已登录接口
router.get('/profile', auth(['USER']), tenantCtx(), tenantGuard({ blockExpired: true }), ctrl.getProfile);
router.put('/profile', auth(['USER']), tenantCtx(), tenantGuard({ blockExpired: true }), ctrl.updateProfile);

// 订单：下单/支付为新交易，到期拦截
router.post('/orders', auth(['USER']), tenantCtx(), tenantGuard({ blockExpired: true }), ctrl.createOrder);
router.get('/orders', auth(['USER']), tenantCtx(), tenantGuard({ blockExpired: true }), ctrl.listMyOrders);
router.get('/orders/:id', auth(['USER']), tenantCtx(), tenantGuard({ blockExpired: true }), ctrl.getOrder);
router.put('/orders/:id/cancel', auth(['USER']), tenantCtx(), tenantGuard({ blockExpired: true }), ctrl.cancelOrder);
router.post('/orders/:id/pay', auth(['USER']), tenantCtx(), tenantGuard({ blockExpired: true }), ctrl.repay);

module.exports = router;
