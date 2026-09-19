/**
 * 异步任务处理器注册表：job_type → execute(payload, job)
 * Worker 消费 async_jobs 时按 job_type 分发
 * 约定：企业微信推送（WECOM_PUSH）同步调用，不经过本表
 */

const handlers = new Map();

function register(jobType, handler) {
  handlers.set(jobType, handler);
}

function getHandler(jobType) {
  return handlers.get(jobType);
}

module.exports = { register, getHandler, handlers };
