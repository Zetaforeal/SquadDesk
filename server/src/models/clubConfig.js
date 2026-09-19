/**
 * 租户配置访问层（club_configs 表，按 tenantId 内存缓存）
 * 配置键约定（方案 3.4）：
 *   wechat_appid / wechat_secret / wechat_mchid / wechat_api_key / wechat_notify_url
 *   phone_login_url / phone_sms_url
 *   subscribe_tpl_accepted / subscribe_tpl_completed
 *   auto_dispatch_enabled / auto_dispatch_timeout_seconds
 *   profile_col_platform / profile_col_identifier / profile_col_address / profile_col_enabled
 */
const { prisma } = require('../db');

// 注意：此前使用 30s 内存缓存，但 mall-api 为 cluster 多进程部署，
// 写入进程与读取进程缓存不一致会导致"写入后读不到"（与布局缓存同一问题）。
// 故改为 DB 直查（本地 MySQL 单次查询 <1ms），集群下保证强一致。
// invalidate() 保留为兼容调用方（no-op）。

/** 读取某租户全部配置（DB 直查，无缓存） */
async function getTenantConfigMap(tenantId) {
  if (!tenantId) return new Map();
  // 防御：租户 ID 统一转数字（小程序端以字符串传递）
  tenantId = parseInt(tenantId, 10);
  if (Number.isNaN(tenantId)) return new Map();

  const rows = await prisma.clubConfig.findMany({
    where: { tenantId },
    select: { configKey: true, configValue: true },
  });
  return new Map(rows.map((r) => [r.configKey, r.configValue ?? '']));
}

/** 读取单个配置项（带默认值） */
async function getConfig(tenantId, key, defaultValue = '') {
  const map = await getTenantConfigMap(tenantId);
  const v = map.get(key);
  return v === undefined || v === '' ? defaultValue : v;
}

/** 批量读取 */
async function getConfigs(tenantId, keys) {
  const map = await getTenantConfigMap(tenantId);
  const out = {};
  for (const k of keys) out[k] = map.get(k) ?? '';
  return out;
}

/** 写入配置（批量 upsert） */
async function setConfigs(tenantId, entries) {
  await prisma.$transaction(
    Object.entries(entries).map(([key, value]) =>
      prisma.clubConfig.upsert({
        where: { tenantId_configKey: { tenantId, configKey: key } },
        update: { configValue: String(value ?? '') },
        create: { tenantId, configKey: key, configValue: String(value ?? '') },
      })
    )
  );
}

/** 失效租户缓存（已改 DB 直查，保留兼容） */
function invalidate(tenantId) {
  // no-op：DB 直查无缓存
}

/** 微信配置（多租户） */
async function getWechatConfig(tenantId) {
  const c = await getConfigs(tenantId, [
    'wechat_appid',
    'wechat_secret',
    'wechat_mchid',
    'wechat_api_key',
    'wechat_notify_url',
  ]);
  return {
    appId: c.wechat_appid,
    secret: c.wechat_secret,
    mchId: c.wechat_mchid,
    apiKey: c.wechat_api_key,
    notifyUrl: c.wechat_notify_url,
  };
}

function isWechatConfigured(cfg) {
  return Boolean(cfg && cfg.appId && cfg.secret && !cfg.appId.startsWith('your-'));
}

function isPaymentConfigured(cfg) {
  return Boolean(
    isWechatConfigured(cfg) &&
    cfg.mchId && cfg.apiKey && cfg.notifyUrl &&
    !cfg.mchId.startsWith('your-')
  );
}

module.exports = {
  getConfig,
  getConfigs,
  setConfigs,
  invalidate,
  getWechatConfig,
  isWechatConfigured,
  isPaymentConfigured,
};
