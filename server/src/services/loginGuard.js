/**
 * 登录防爆破（数据库级，跨进程/跨 IP 共享）
 * 策略：连续失败 MAX_FAIL 次锁定 LOCK_MINUTES 分钟；成功登录清零
 * 按账号维度锁定（攻击者换 IP 也无法绕过）
 * 注意：超管 tenantId=null，findUnique 复合键不支持 null，需用 findFirst
 */
const { prisma } = require('../db');
const { BizError, Code } = require('../utils/response');

const MAX_FAIL = 5;        // 连续失败 5 次
const LOCK_MINUTES = 15;   // 锁定 15 分钟

/** 按条件查找账号（超管 tenantId=null 用 findFirst，其余用 findUnique） */
function findAccount(model, keyWhere) {
  if (keyWhere.tenantId_username && keyWhere.tenantId_username.tenantId === null) {
    const { username } = keyWhere.tenantId_username;
    return model.findFirst({ where: { tenantId: null, username } });
  }
  return model.findUnique({ where: keyWhere });
}

/** 检查账号是否被锁定（锁定中抛异常） */
async function assertNotLocked(model, keyWhere) {
  const row = await findAccount(model, keyWhere).then((r) => r || null);
  if (row && row.lockUntil && new Date() < row.lockUntil) {
    const remainMin = Math.ceil((row.lockUntil.getTime() - Date.now()) / 60000);
    throw new BizError(Code.VALIDATE_ERROR, `登录失败次数过多，账号已锁定 ${remainMin} 分钟后重试`);
  }
}

/** 登录失败：计数 +1，达到阈值锁定 */
async function onLoginFail(model, keyWhere) {
  const row = await findAccount(model, keyWhere).then((r) => r || null);
  if (!row) return;
  const failCount = (row.loginFailCount || 0) + 1;
  const lockUntil = failCount >= MAX_FAIL
    ? new Date(Date.now() + LOCK_MINUTES * 60000)
    : null;
  await model.update({
    where: row.tenantId === null
      ? { id: row.id }
      : keyWhere,
    data: { loginFailCount: failCount, lockUntil },
  });
}

/** 登录成功：清零计数与锁定 */
async function onLoginSuccess(model, keyWhere) {
  const row = await findAccount(model, keyWhere).then((r) => r || null);
  if (!row) return;
  await model.update({
    where: row.tenantId === null ? { id: row.id } : keyWhere,
    data: { loginFailCount: 0, lockUntil: null },
  }).catch(() => {});
}

module.exports = { assertNotLocked, onLoginFail, onLoginSuccess, MAX_FAIL, LOCK_MINUTES };
