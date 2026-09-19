/**
 * 短信验证码处理器（SMS_CODE）
 * payload: { tenantId, phone }
 * 调用该租户配置的短信接口 phone_sms_url（预留实现，可对接任意短信服务商）
 */
const { register } = require('./registry');
const { getConfig } = require('../models/clubConfig');
const logger = require('../utils/logger');

register('SMS_CODE', async (payload) => {
  const { tenantId, phone } = payload;
  if (!phone) throw new Error('SMS_CODE payload 缺少 phone');
  const smsUrl = await getConfig(tenantId, 'phone_sms_url', '');
  if (!smsUrl) {
    logger.info({ event: 'sms_skipped', tenantId, phone, reason: 'sms_url_not_configured' });
    return { skipped: true };
  }
  // TODO: 按短信服务商协议实现（预留）
  // const resp = await fetch(smsUrl, { method: 'POST', body: JSON.stringify({ phone, code: genCode() }) });
  throw new Error('短信接口实现待接入');
});
