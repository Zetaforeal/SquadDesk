// pages/index/index.js — 首页（布局模块 + 分类 + 热销）
const { request } = require('../../utils/request');
const { resolveImageUrls } = require('../../utils/image');
const { isLoggedIn, login } = require('../../utils/auth');
const { guardExpired } = require('../../utils/expired');

Page({
  data: {
    layout: null,
    categories: [],
    loading: true,
    tenantExpired: false,
  },

  onShow() {
    // 租户到期：显示全屏提示，不加载数据
    guardExpired(this).then((expired) => {
      if (expired) return;
      // 首次进入自动静默登录
      if (!isLoggedIn()) {
        login().catch(() => {});
      }
      this.loadHome();
    });
  },

  onLoad() {
    // onShow 已处理数据加载（tab 页切换也会触发 onShow）
  },

  onPullDownRefresh() {
    this.loadHome().finally(() => wx.stopPullDownRefresh());
  },

  async loadHome() {
    this.setData({ loading: true });
    try {
      const [layout, categories] = await Promise.all([
        request({ url: '/api/home/layout' }),
        request({ url: '/api/categories' }),
      ]);
      // 补全图片（双通道）
      const modules = (layout?.modules || []).map((m) => {
        const config = { ...(m.config || {}) };
        if (config.image) config.image = resolveImageUrls(config.image);
        // BANNER 多图归一：优先 banners 数组，兼容旧单图 image 字段
        if (m.type === 'BANNER') {
          if (Array.isArray(config.banners) && config.banners.length) {
            config.banners = config.banners.map((b) => ({
              ...b,
              image: resolveImageUrls(b.image),
            }));
          } else if (config.image) {
            config.banners = [{ image: config.image, link: config.link || '' }];
          } else {
            config.banners = [];
          }
        }
        return { ...m, config, products: (m.products || []).map((p) => ({ ...p, coverUrl: resolveImageUrls(p.coverUrl) })) };
      });
      this.setData({
        layout: { ...layout, modules },
        categories: (categories || []).map((c) => ({ ...c, icon: resolveImageUrls(c.icon) })),
        loading: false,
      });
    } catch (e) {
      this.setData({ loading: false });
    }
  },

  goCategory() {
    wx.switchTab({ url: '/pages/category/category' });
  },

  goProduct(e) {
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({ url: `/pages/product/product?id=${id}` });
  },

  onBannerTap(e) {
    // 优先跳商品（productId），其次自定义链接
    const { productId, link } = e.currentTarget.dataset;
    if (productId) {
      wx.navigateTo({ url: `/pages/product/product?id=${productId}` });
    } else if (link) {
      wx.navigateTo({ url: link });
    }
  },
});
