/**
 * 支付路由：统一回调（微信服务器调用，不经过 JWT）
 */
const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/paymentController');

// 微信回调：raw body 解析
router.post('/notify', express.text({ type: '*/*' }), ctrl.notify);

module.exports = router;
