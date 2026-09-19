// app.js — 小程序模板入口
// 构建脚本会替换占位符（scripts/build-miniprogram.js）：
//   TENANT_ID_PLACEHOLDER -> 租户 ID
//   BASE_URL_PLACEHOLDER  -> api 域名
App({
  globalData: {
    tenantId: 'TENANT_ID_PLACEHOLDER',
    baseUrl: 'BASE_URL_PLACEHOLDER',
    userInfo: null,
    token: '',
    expired: false, // 租户到期标记：true 时小程序完全不可用
  },

  onLaunch() {
    this.globalData.token = wx.getStorageSync('token') || '';
    // 从本地恢复到期标记（刷新后仍保持不可用）
    this.globalData.expired = !!wx.getStorageSync('tenant_expired');
  },
});
