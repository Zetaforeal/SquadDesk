/**
 * 环境配置解析
 * 集中管理所有 env 读取，业务代码禁止直接 process.env
 */
const path = require('path');
const { z } = require('zod');

// 加载 .env（开发环境）
const result = require('dotenv').config({ path: path.join(__dirname, '../../.env') });
if (result.error && process.env.NODE_ENV !== 'production') {
  // 生产环境由 PM2 注入 env，不强制 .env 文件
  if (process.env.NODE_ENV !== 'production') {
    console.warn('[config] 未找到 .env 文件，使用环境变量：', result.error.message);
  }
}

const boolFromEnv = z.preprocess(
  (value) => ['1', 'true', 'yes', 'on'].includes(String(value || '').toLowerCase()),
  z.boolean()
);

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  DATABASE_URL: z.string().default(''),
  JWT_SECRET: z.string().default('dev-secret-change-me'),
  JWT_EXPIRES_IN: z.string().default('7d'),
  BASE_URL: z.string().url().default('http://localhost:3000'),
  CORS_ORIGINS: z.string().default(''),
  TRUST_PROXY: boolFromEnv.default(false),
  ALLOW_DEV_LOGIN: boolFromEnv.default(false),
  TIME_SYNC_URLS: z.string().default(''),
  TIME_SYNC_INTERVAL_HOURS: z.coerce.number().int().positive().default(1),
  SUPER_ADMIN_USERNAME: z.string().min(1).default('admin'),
  SUPER_ADMIN_PASSWORD: z.string().default(''),
  SEED_DEMO_DATA: boolFromEnv.default(false),
  DEMO_ADMIN_PASSWORD: z.string().default(''),
  DEMO_PLAYER_PASSWORD: z.string().default(''),
  UPLOAD_DIR: z.string().min(1).default('uploads'),
  UPLOAD_MAX_SIZE_MB: z.coerce.number().positive().max(25).default(10),
});

const parsed = schema.parse(process.env);
const env = {
  ...parsed,
  BASE_URL: parsed.BASE_URL.replace(/\/+$/, ''),
  CORS_ORIGINS: parsed.CORS_ORIGINS.split(',').map((s) => s.trim()).filter(Boolean),
  TIME_SYNC_URLS: parsed.TIME_SYNC_URLS.split(',').map((s) => s.trim()).filter(Boolean),
};

if (env.NODE_ENV === 'production') {
  const errors = [];
  if (!env.DATABASE_URL) errors.push('DATABASE_URL 未配置');
  if (env.JWT_SECRET.length < 32 || env.JWT_SECRET === 'dev-secret-change-me') errors.push('JWT_SECRET 必须是至少 32 位随机值');
  if (env.SUPER_ADMIN_PASSWORD.length < 12) errors.push('SUPER_ADMIN_PASSWORD 必须是至少 12 位强密码');
  if (!env.CORS_ORIGINS.length) errors.push('CORS_ORIGINS 必须配置后台域名白名单');
  if (env.ALLOW_DEV_LOGIN) errors.push('生产环境禁止 ALLOW_DEV_LOGIN');
  if (errors.length) throw new Error(`生产配置不安全：${errors.join('；')}`);
}

module.exports = { env };
