// utils/auth.js — 登录封装
const { request } = require('./request');

function login() {
  return new Promise((resolve, reject) => {
    const app = getApp();
    // 未配置微信登录时后端进入测试模式：任意 code 直接登录
    // 游客模式（touristappid）下 wx.login 可能失败，用随机串兜底
    wx.login({
      success: async (res) => {
        if (!res.code) return reject(new Error('wx.login 失败'));
        try {
          resolve(await doLogin(res.code));
        } catch (e) {
          reject(e);
        }
      },
      fail: async () => {
        // wx.login 失败兜底：随机测试 code（后端测试模式接受任意 code）
        const fallbackCode = 'dev_' + Date.now() + '_' + Math.random().toString(36).slice(2, 10);
        try {
          resolve(await doLogin(fallbackCode));
        } catch (e) {
          reject(e);
        }
      },
    });
  });
}

async function doLogin(code) {
  const app = getApp();
  const data = await request({
    url: '/api/user/login',
    method: 'POST',
    data: {
      code,
      tenantId: app.globalData.tenantId,
    },
  });
  wx.setStorageSync('token', data.token);
  app.globalData.token = data.token;
  app.globalData.userInfo = data.user;
  return data;
}

function isLoggedIn() {
  return !!(getApp().globalData.token || wx.getStorageSync('token'));
}

module.exports = { login, isLoggedIn };
