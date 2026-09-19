/**
 * 异步任务入队（API 侧统一入口）
 * 所有通知类任务：写 async_jobs 立即返回，Worker 消费执行（失败重试）
 * 约定：企业微信推送（WECOM_PUSH）为唯一同步通道，不写入本表
 */
const { prisma } = require('../db');
const { now } = require('../utils/time');

/**
 * @param {number|null} tenantId 租户上下文（平台级任务为 null）
 * @param {string} jobType SUBSCRIBE_MSG / SMS_CODE / PHONE_LOGIN / ...
 * @param {object} payload 任务参数
 * @param {object} opts { maxRetries, runAt }
 */
async function enqueue(tenantId, jobType, payload, opts = {}) {
  const job = await prisma.asyncJob.create({
    data: {
      tenantId,
      jobType,
      payload,
      maxRetries: opts.maxRetries ?? 3,
      nextRunAt: opts.runAt ? new Date(opts.runAt) : new Date(now()),
    },
  });
  return job;
}

module.exports = { enqueue };
