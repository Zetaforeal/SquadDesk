/**
 * Worker 入口（PM2: mall-worker，必须单实例）
 * 任务清单（方案 6.5）：
 *   ① 自动派单扫描（30s）
 *   ② 72h 结算冷却（每分钟）
 *   ③ async_jobs 异步通知消费（1s 轮询）
 * 所有循环均在上一次完成后再调度，避免 setInterval 重入。
 */
const { prisma } = require('../db');
const logger = require('../utils/logger');
const { now } = require('../utils/time');

// 注册异步任务处理器
require('../jobs/subscribeMsg.job');
require('../jobs/smsCode.job');

const { scanAutoDispatch } = require('../services/dispatch.service');
const { scanSettleCooldown } = require('../services/settle.service');
const { getHandler } = require('../jobs/registry');

// 指数退避：attempt → 延迟秒数
function backoffSeconds(retryCount) {
  return Math.min(60 * Math.pow(2, retryCount), 3600);
}

/** 消费单个异步任务 */
async function processJob(job) {
  const handler = getHandler(job.jobType);
  if (!handler) {
    // 未知任务类型：直接失败（不重试）
    await prisma.asyncJob.update({
      where: { id: job.id },
      data: { status: 'FAILED', lastError: `未知任务类型: ${job.jobType}`, executedAt: new Date(now()) },
    });
    return;
  }

  try {
    await handler(job.payload, job);
    await prisma.asyncJob.update({
      where: { id: job.id },
      data: { status: 'SUCCESS', executedAt: new Date(now()), lastError: null },
    });
    logger.biz('async_job_success', { jobId: job.id, jobType: job.jobType, tenantId: job.tenantId });
  } catch (e) {
    const retryCount = job.retryCount + 1;
    if (retryCount >= job.maxRetries) {
      await prisma.asyncJob.update({
        where: { id: job.id },
        data: { status: 'FAILED', retryCount, lastError: e.message, executedAt: new Date(now()) },
      });
      logger.error(e, { event: 'async_job_failed', jobId: job.id, jobType: job.jobType, tenantId: job.tenantId });
    } else {
      const nextRunAt = new Date(now() + backoffSeconds(retryCount) * 1000);
      await prisma.asyncJob.update({
        where: { id: job.id },
        data: { status: 'PENDING', retryCount, lastError: e.message, nextRunAt },
      });
      logger.info({ event: 'async_job_retry', jobId: job.id, jobType: job.jobType, retryCount, nextRunAt });
    }
  }
}

/** 批量消费到期任务（每秒轮询） */
async function consumeJobs() {
  const candidates = await prisma.asyncJob.findMany({
    where: { status: 'PENDING', nextRunAt: { lte: new Date(now()) } },
    orderBy: { id: 'asc' },
    take: 20,
  });
  for (const job of candidates) {
    // 条件更新即轻量原子领取；即使误启动多个 Worker，也只有一个能领取成功。
    const claimed = await prisma.asyncJob.updateMany({
      where: { id: job.id, status: 'PENDING', nextRunAt: { lte: new Date(now()) } },
      data: { status: 'RUNNING' },
    });
    if (claimed.count === 1) await processJob({ ...job, status: 'RUNNING' });
  }
}

/** 上一轮完成后再等待 intervalMs，杜绝任务重入。 */
function scheduleLoop(name, intervalMs, task, onResult) {
  const run = async () => {
    try {
      const result = await task();
      if (onResult) onResult(result);
    } catch (e) {
      logger.error(e, { event: `${name}_error` });
    } finally {
      setTimeout(run, intervalMs).unref();
    }
  };
  run();
}

/** 启动所有定时任务 */
async function start() {
  // 单 Worker 重启时恢复上次崩溃遗留的 RUNNING 任务。
  const recovered = await prisma.asyncJob.updateMany({
    where: { status: 'RUNNING' },
    data: { status: 'PENDING', nextRunAt: new Date(now()), lastError: 'Worker 重启后自动恢复' },
  });
  if (recovered.count) logger.info({ event: 'async_jobs_recovered', count: recovered.count });

  scheduleLoop('auto_dispatch_scan', 30000, scanAutoDispatch, (result) => {
    if (result.dispatched) logger.biz('auto_dispatch_scan', result);
  });
  scheduleLoop('settle_cooldown_scan', 60000, scanSettleCooldown, (result) => {
    if (result.matured) logger.biz('settle_cooldown_scan', result);
  });
  scheduleLoop('async_job_consume', 1000, consumeJobs);

  logger.info({ event: 'worker_started', time: require('../utils/time').formatNow() });
  console.log('[worker] mall-worker 已启动（自动派单 30s / 结算冷却 1min / 任务消费 1s）');
}

start().catch((error) => {
  logger.error(error, { event: 'worker_start_failed' });
  process.exitCode = 1;
});
