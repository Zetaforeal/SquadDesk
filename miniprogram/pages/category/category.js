// pages/category/category.js — 分类页（左侧分类 + 右侧商品 + 顶部搜索）
const { request } = require('../../utils/request');
const { resolveImageUrls } = require('../../utils/image');
const { guardExpired } = require('../../utils/expired');

Page({
  data: {
    categories: [],
    activeId: null,
    products: [],
    loading: false,
    keyword: '',
    tenantExpired: false,
  },

  onShow() {
    guardExpired(this).then((expired) => {
      if (expired) return;
      if (!this.data.categories.length) this.loadCategories();
    });
  },

  onLoad() {
    // onShow 已处理（tab 页切换也触发 onShow）
  },

  async loadCategories() {
    const list = await request({ url: '/api/categories' });
    const categories = list.map((c) => ({ ...c, icon: resolveImageUrls(c.icon) }));
    this.setData({ categories });
    if (categories.length) {
      this.selectCategory(categories[0].id);
    }
  },

  async selectCategory(e) {
    const id = typeof e === 'object' ? e.currentTarget.dataset.id : e;
    this.setData({ activeId: id, loading: true, keyword: '' });
    try {
      const data = await request({ url: '/api/products', data: { categoryId: id, page: 1, pageSize: 50 } });
      this.setData({ products: (data.list || []).map((p) => ({ ...p, coverUrl: resolveImageUrls(p.coverUrl) })) });
    } finally {
      this.setData({ loading: false });
    }
  },

  onSearchInput(e) {
    this.setData({ keyword: e.detail.value });
  },

  async onSearch() {
    const keyword = (this.data.keyword || '').trim();
    if (!keyword) return;
    this.setData({ loading: true });
    try {
      // 搜索模式：跨分类按关键词搜索
      const data = await request({ url: '/api/products', data: { keyword, page: 1, pageSize: 50 } });
      this.setData({
        products: (data.list || []).map((p) => ({ ...p, coverUrl: resolveImageUrls(p.coverUrl) })),
        searching: true,
      });
    } finally {
      this.setData({ loading: false });
    }
  },

  clearSearch() {
    this.setData({ keyword: '', searching: false });
    if (this.data.categories.length) this.selectCategory(this.data.categories[0].id);
  },

  goProduct(e) {
    wx.navigateTo({ url: `/pages/product/product?id=${e.currentTarget.dataset.id}` });
  },
});
