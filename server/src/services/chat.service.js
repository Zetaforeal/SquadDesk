/**
 * 订单沟通服务（管理员-打手，项目 B chat_messages 迁移）
 * 打手仅限本人订单；管理员限本租户订单
 */
const { prisma } = require('../db');
const { BizError, Code } = require('../utils/response');
const { safeText } = require('../utils/sanitize');

/** 校验访问权限并返回订单（接单人或搭档可访问） */
async function assertChatAccess({ tenantId, orderId, role, actorId }) {
  const order = await prisma.order.findFirst({ where: { tenantId, id: orderId } });
  if (!order) throw new BizError(Code.NOT_FOUND, '订单不存在');
  if (role === 'player' && order.acceptedPlayerId !== actorId && order.partnerPlayerId !== actorId) {
    throw new BizError(Code.FORBIDDEN, '无权访问该订单');
  }
  return order;
}

/** 获取消息列表 */
async function listMessages({ tenantId, orderId, role, actorId }) {
  await assertChatAccess({ tenantId, orderId, role, actorId });
  return prisma.chatMessage.findMany({
    where: { tenantId, orderId },
    orderBy: { id: 'asc' },
  });
}

/** 发送消息 */
async function sendMessage({ tenantId, orderId, role, actorId, actorName, content }) {
  await assertChatAccess({ tenantId, orderId, role, actorId });
  const cleanContent = safeText(content, 2000);
  if (!cleanContent) throw new BizError(Code.VALIDATE_ERROR, '消息内容不能为空');

  const senderType = role === 'admin' ? 'admin' : 'player';
  return prisma.chatMessage.create({
    data: {
      tenantId,
      orderId,
      senderType,
      senderId: actorId,
      senderName: actorName,
      content: cleanContent,
    },
  });
}

module.exports = { listMessages, sendMessage };
