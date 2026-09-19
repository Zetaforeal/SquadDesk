/** 标准 Express 限流器；生产多实例可无缝替换为 Redis store。 */
const { rateLimit: createRateLimit } = require('express-rate-limit');

/**
 * @param {object} opts
 * @param {number} opts.windowMs  窗口毫秒
 * @param {number} opts.max       窗口内最大次数
 */
function rateLimit(opts = {}) {
  return createRateLimit({
    windowMs: opts.windowMs || 60000,
    limit: opts.max || 60,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    handler(req, res) {
      res.status(429).json({ code: 429, message: '请求过于频繁，请稍后再试', data: null });
    },
  });
}

module.exports = rateLimit;
