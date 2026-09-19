import { createRouter, createWebHistory } from 'vue-router';

const routes = [
  { path: '/login', component: () => import('@/views/Login.vue'), meta: { title: '登录' } },
  {
    path: '/',
    component: () => import('@/layouts/MainLayout.vue'),
    redirect: '/dashboard',
    children: [
      { path: 'dashboard', component: () => import('@/views/Dashboard.vue'), meta: { title: '控制台', icon: 'LayoutDashboard' } },
      { path: 'orders', component: () => import('@/views/orders/OrderList.vue'), meta: { title: '订单管理', icon: 'ClipboardList' } },
      { path: 'orders/:id', component: () => import('@/views/orders/OrderDetail.vue'), meta: { title: '订单详情' } },
      { path: 'products', component: () => import('@/views/products/ProductList.vue'), meta: { title: '商品管理', icon: 'Package' } },
      { path: 'categories', component: () => import('@/views/products/CategoryList.vue'), meta: { title: '分类管理', icon: 'FolderTree' } },
      { path: 'home-layout', component: () => import('@/views/HomeLayout.vue'), meta: { title: '首页布局', icon: 'LayoutTemplate' } },
      { path: 'players', component: () => import('@/views/players/PlayerList.vue'), meta: { title: '打手管理', icon: 'Users' } },
      { path: 'settle', component: () => import('@/views/settle/SettleList.vue'), meta: { title: '结算管理', icon: 'BadgeDollarSign' } },
      { path: 'withdraws', component: () => import('@/views/settle/WithdrawList.vue'), meta: { title: '提现审核', icon: 'Wallet' } },
      { path: 'pending-payments', component: () => import('@/views/settle/PendingPaymentList.vue'), meta: { title: '待结付款', icon: 'Banknote' } },
      { path: 'commissions', component: () => import('@/views/settle/CommissionList.vue'), meta: { title: '佣金记录', icon: 'Coins' } },
      { path: 'settings', component: () => import('@/views/Settings.vue'), meta: { title: '系统设置', icon: 'Settings' } },
    ],
  },
  { path: '/:pathMatch(.*)*', redirect: '/dashboard' },
];

const router = createRouter({ history: createWebHistory('/admin/'), routes });

router.beforeEach((to) => {
  const token = localStorage.getItem('admin_token');
  if (to.path !== '/login' && !token) return '/login';
  if (to.path === '/login' && token) return '/dashboard';
});

export default router;
