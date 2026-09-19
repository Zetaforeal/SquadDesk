/**
 * 订阅消息处理器（SUBSCRIBE_MSG）
 * payload: { scene, tenantId, openid, orderNo, templateKey }
 * scene: order_paid / order_accepted / order_completed
 * templateKey 从俱乐部配置读取：subscribe_tpl_accepted / subscribe_tpl_completed
 */
const { register } = require('./registry');
const { getWechatConfig, getConfig } = require('../models/clubConfig');
const { sendSubscribeMessage } = require('../utils/wxapi');
const { prisma } = require('../db');
const logger = require('../utils/logger');

register('SUBSCRIBE_MSG', async (payload, job) => {
  const { tenantId, openid, orderNo, templateKey, scene } = payload;
  if (!tenantId || !openid || !orderNo) {
    throw new Error('SUBSCRIBE_MSG payload 不完整');
  }

  const templateId = await getConfig(tenantId, templateKey, '');
  if (!templateId) {
    // 未配置模板：视为可跳过（不发也不报错，避免无意义重试）
    logger.info({ event: 'subscribe_msg_skipped', tenantId, scene, reason: 'template_not_configured' });
    return { skipped: true };
  }

  const cfg = await getWechatConfig(tenantId);
  if (!cfg.appId || !cfg.secret) {
    throw new Error('微信凭证未配置');
  }

  // 模板数据按场景组装（字段名需与微信后台模板字段一致，此处为约定示例）
  const data = {
    thing1: { value: `订单 ${orderNo.slice(-10)}` },
    phrase2: { value: scene === 'order_completed' ? '已完成' : scene === 'order_accepted' ? '已接单' : '已支付' },
  };

  const result = await sendSubscribeMessage({
    appId: cfg.appId,
    secret: cfg.secret,
    openid,
    templateId,
    page: 'pages/order/order',
    data,
  });
  return result;
});
