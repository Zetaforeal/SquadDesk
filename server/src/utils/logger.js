/**
 * 统一日志（异步写入标准输出，由部署平台负责收集与轮转）
 *
 * 三通道：
 *   logger.request({...})  请求日志中间件
 *   logger.biz({...})      业务事件日志（订单状态流转 / 派单 / 结算 / 登录 / 配置变更）
 *   logger.error(...)      错误日志（err 流）
 *
 * 脱敏约定：手机号中间四位掩码、token/密钥不落日志 —— 调用方传值前先经 maskSensitive 处理。
 */
const pino = require('pino');
const { env } = require('../config');
const destination = pino.destination({ dest: 1, sync: false, minLength: 4096 });
const baseLogger = pino({
  level: env.LOG_LEVEL,
  redact: {
    paths: ['*.token', '*.password', '*.secret', '*.apiKey', '*.api_key', '*.authorization'],
    censor: '[REDACTED]',
  },
}, destination);

/** 手机号脱敏：138****1234 */
function maskPhone(p) {
  if (!p) return p;
  return String(p).replace(/^(\d{3})\d{4}(\d{4})$/, '$1****$2');
}

/** 敏感字段脱敏（深度处理 token / password / secret 等键） */
const SENSITIVE_KEYS = /(token|password|secret|apikey|api_key|key|sign)/i;
function maskSensitive(obj) {
  if (obj === null || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(maskSensitive);
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    if (typeof v === 'string' && SENSITIVE_KEYS.test(k)) {
      out[k] = v.length > 8 ? `${v.slice(0, 4)}****` : '****';
    } else if (typeof v === 'object' && v !== null) {
      out[k] = maskSensitive(v);
    } else {
      out[k] = v;
    }
  }
  return out;
}

/** 请求日志 */
function request(meta) {
  baseLogger.info({ stream: 'req', ...maskSensitive(meta) }, 'request');
}

/** 业务事件日志 */
function biz(event, meta = {}) {
  baseLogger.info({ stream: 'biz', event, ...maskSensitive(meta) }, event);
}

/** 错误日志 */
function error(err, meta = {}) {
  baseLogger.error({ stream: 'err', err, ...maskSensitive(meta) }, err?.message || 'error');
}

/** 通用日志 */
function info(obj) {
  baseLogger.info({ stream: 'app', ...maskSensitive(obj) });
}

module.exports = { request, biz, error, info, maskPhone, maskSensitive };
