/**
 * 超级管理端路由（/api/super/*）
 */
const express = require('express');
const router = express.Router();
const { positiveInteger } = require('../middleware/validateParam');
router.param('id', positiveInteger);
const ctrl = require('../controllers/superController');
const auth = require('../middleware/auth');
const rateLimit = require('../middleware/rateLimit');

router.post('/login', rateLimit({ windowMs: 60000, max: 30 }), ctrl.login);

// 仅 SUPER_ADMIN（tenantId = null，不经过 tenantGuard）
router.get('/clubs', auth(['SUPER_ADMIN']), ctrl.listClubs);
router.post('/clubs', auth(['SUPER_ADMIN']), ctrl.createClub);
router.put('/clubs/:id', auth(['SUPER_ADMIN']), ctrl.updateClub);
router.delete('/clubs/:id', auth(['SUPER_ADMIN']), ctrl.deleteClub);
router.get('/stats', auth(['SUPER_ADMIN']), ctrl.stats);
router.get('/clubs/:id/orders', auth(['SUPER_ADMIN']), ctrl.clubOrders);

// 超管自身：改密码 + 系统配置（登录入口）
router.put('/me/password', auth(['SUPER_ADMIN']), ctrl.changePassword);
router.get('/system/config', auth(['SUPER_ADMIN']), ctrl.getSystemConfig);
router.put('/system/config', auth(['SUPER_ADMIN']), ctrl.updateSystemConfig);

// 一键生成小程序源码包（zip 下载）
router.post('/miniprogram/build/:id', auth(['SUPER_ADMIN']), ctrl.buildMiniprogram);

// 清除演示版记录（仅演示俱乐部）
router.post('/clubs/:id/reset-demo', auth(['SUPER_ADMIN']), ctrl.resetDemo);

module.exports = router;
