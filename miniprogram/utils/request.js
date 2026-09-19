// utils/request.js — 统一网络请求（带 token + 租户头）
const app = getApp();
const { markExpired } = require('./expired');

function request(options) {
  return new Promise((resolve, reject) => {
    const token = app.globalData.token || wx.getStorageSync('token') || '';
    // 统一用户端 API 前缀：/api/categories -> /api/user/categories
    // 已带 /api/user 前缀（如 /api/user/login）则原样使用，避免拼出 /api/user/api/...
    let rawUrl = options.url || '';
    if (rawUrl.startsWith('/api/user')) {
      // 已带前缀，原样使用
    } else if (rawUrl.startsWith('/api/')) {
      rawUrl = rawUrl.replace('/api/', '/api/user/');
    } else {
      rawUrl = `/api/user${rawUrl.startsWith('/') ? rawUrl : '/' + rawUrl}`;
    }
    wx.request({
      url: `${app.globalData.baseUrl}${rawUrl}`,
      method: options.method || 'GET',
      data: options.data || {},
      header: {
        'Content-Type': 'application/json',
        Authorization: token ? `Bearer ${token}` : '',
        'X-Tenant-Id': String(app.globalData.tenantId),
        ...(options.header || {}),
      },
      success: (res) => {
        const body = res.data;
        if (body.code === 0) {
          resolve(body.data);
        } else if (body.code === 1002) {
          // 租户到期：小程序完全不可用，弹窗提示并清登录态
          wx.removeStorageSync('token');
          app.globalData.token = '';
          markExpired();
          wx.showModal({
            title: '服务已到期',
            content: '租户到期，请联系俱乐部管理员！',
            showCancel: false,
            confirmText: '知道了',
          });
          reject(body);
        } else if (body.code === 401) {
          // token 失效：清空后重新登录
          wx.removeStorageSync('token');
          app.globalData.token = '';
          const pages = getCurrentPages();
          const current = pages[pages.length - 1];
          current.setData({ needLogin: true });
          reject(body);
        } else {
          wx.showToast({ title: body.message || '请求失败', icon: 'none' });
          reject(body);
        }
      },
      fail: (err) => {
        wx.showToast({ title: '网络错误', icon: 'none' });
        reject(err);
      },
    });
  });
}

module.exports = { request };
