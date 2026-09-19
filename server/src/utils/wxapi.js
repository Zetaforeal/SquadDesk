/**
 * 微信开放 API 工具（多租户，按租户 AppID/AppSecret 调用）
 * code2session / 订阅消息发送 / access_token
 */
const { BizError } = require('./response');
const { Code } = require('./response');

/** 小游戏/小程序 access_token（按 appid 缓存，提前 5 分钟过期） */
const tokenCache = new Map(); // appid -> { token, expiresAt }

async function fetchJson(url, options = {}) {
  const response = await fetch(url, { ...options, signal: AbortSignal.timeout(10000) });
  if (!response.ok) throw new Error(`微信接口请求失败: HTTP ${response.status}`);
  return response.json();
}

/**
 * code2session：用租户的 AppID/AppSecret 换 openid
 * @returns {Promise<{openid, session_key, unionid?}>}
 */
async function code2Session(appId, secret, code) {
  const url =
    `https://api.weixin.qq.com/sns/jscode2session?appid=${appId}&secret=${secret}` +
    `&js_code=${encodeURIComponent(code)}&grant_type=authorization_code`;
  const data = await fetchJson(url);
  if (data.errcode) {
    throw new BizError(Code.VALIDATE_ERROR, '微信登录失败: ' + (data.errmsg || data.errcode));
  }
  return { openid: data.openid, sessionKey: data.session_key, unionid: data.unionid || null };
}

/** 获取小程序 access_token（缓存） */
async function getAccessToken(appId, secret) {
  const cached = tokenCache.get(appId);
  if (cached && cached.expiresAt > Date.now() + 300000) return cached.token;
  const url = `https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential&appid=${appId}&secret=${secret}`;
  const data = await fetchJson(url);
  if (data.errcode) {
    throw new BizError(Code.VALIDATE_ERROR, '获取 access_token 失败: ' + (data.errmsg || data.errcode));
  }
  tokenCache.set(appId, { token: data.access_token, expiresAt: Date.now() + data.expires_in * 1000 });
  return data.access_token;
}

/**
 * 发送订阅消息
 * @param {object} args - { appId, secret, openid, templateId, page?, data }
 */
async function sendSubscribeMessage({ appId, secret, openid, templateId, page, data }) {
  const token = await getAccessToken(appId, secret);
  const result = await fetchJson('https://api.weixin.qq.com/cgi-bin/message/subscribe/send?access_token=' + token, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      touser: openid,
      template_id: templateId,
      page: page || 'pages/order/order',
      data,
      miniprogram_state: 'formal',
    }),
  });
  // 43101 用户拒收/未订阅视为可接受（非致命）
  if (result.errcode && result.errcode !== 43101) {
    throw new Error('订阅消息发送失败: ' + (result.errmsg || result.errcode));
  }
  return result;
}

module.exports = { code2Session, getAccessToken, sendSubscribeMessage };
