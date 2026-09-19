const { BizError, Code } = require('../utils/response');

/** Express router.param 回调：所有资源 ID 必须是正整数。 */
function positiveInteger(req, res, next, value, name) {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 1) {
    return next(new BizError(Code.VALIDATE_ERROR, `${name} 必须是正整数`));
  }
  req.params[name] = String(parsed);
  next();
}

module.exports = { positiveInteger };
