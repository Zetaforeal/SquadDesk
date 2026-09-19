/**
 * 系统全局配置（system_configs 表，超管可读写）
 * 键值存储；当前支持的键：
 *   super_entry_path - 超管后台登录入口路径（如 ssuuppeerr），默认 super
 */
const { prisma } = require('../db');

/** 读取单个配置值（无缓存，直接查库） */
async function getSystemConfig(key) {
  const row = await prisma.systemConfig.findUnique({ where: { configKey: key } });
  return row?.configValue ?? null;
}

/** 读取多个配置（返回对象） */
async function getSystemConfigs(keys) {
  const rows = await prisma.systemConfig.findMany({ where: { configKey: { in: keys } } });
  const map = {};
  rows.forEach((r) => { map[r.configKey] = r.configValue; });
  return map;
}

/** 批量写入配置（upsert） */
async function setSystemConfigs(entries) {
  for (const [key, value] of Object.entries(entries)) {
    await prisma.systemConfig.upsert({
      where: { configKey: key },
      update: { configValue: value },
      create: { configKey: key, configValue: value },
    });
  }
  return { success: true };
}

module.exports = { getSystemConfig, getSystemConfigs, setSystemConfigs };
