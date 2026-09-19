<template>
  <el-container class="main-layout">
    <el-aside width="220px" class="aside">
      <div class="logo">
        <Store class="logo-icon" />
        <span>俱乐部后台</span>
      </div>
      <el-menu :default-active="$route.path" router background-color="#1f2d3d" text-color="#b8c4d4" active-text-color="#ffffff">
        <el-menu-item v-for="item in menuItems" :key="item.path" :index="item.path">
          <component :is="item.icon" class="menu-icon" />
          <span>{{ item.title }}</span>
        </el-menu-item>
      </el-menu>
    </el-aside>
    <el-container>
      <el-header class="header">
        <div class="page-title">{{ $route.meta.title || '' }}</div>
        <div class="user-area">
          <span class="username">{{ username }}</span>
          <el-button link type="danger" @click="logout">退出登录</el-button>
        </div>
      </el-header>
      <el-main class="main">
        <router-view />
      </el-main>
    </el-container>
  </el-container>
</template>

<script setup>
import { computed } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { ElMessageBox } from 'element-plus';
import {
  Store, LayoutDashboard, ClipboardList, Package, FolderTree, LayoutTemplate,
  Users, BadgeDollarSign, Wallet, Banknote, Coins, Settings,
} from 'lucide-vue-next';

const router = useRouter();
const route = useRoute();
const username = localStorage.getItem('admin_username') || '管理员';

const menuItems = [
  { path: '/dashboard', title: '控制台', icon: LayoutDashboard },
  { path: '/orders', title: '订单管理', icon: ClipboardList },
  { path: '/products', title: '商品管理', icon: Package },
  { path: '/categories', title: '分类管理', icon: FolderTree },
  { path: '/home-layout', title: '首页布局', icon: LayoutTemplate },
  { path: '/players', title: '打手管理', icon: Users },
  { path: '/settle', title: '结算管理', icon: BadgeDollarSign },
  { path: '/withdraws', title: '提现审核', icon: Wallet },
  { path: '/pending-payments', title: '待结付款', icon: Banknote },
  { path: '/commissions', title: '佣金记录', icon: Coins },
  { path: '/settings', title: '系统设置', icon: Settings },
];

async function logout() {
  await ElMessageBox.confirm('确定退出登录？', '提示', { type: 'warning' });
  localStorage.removeItem('admin_token');
  localStorage.removeItem('admin_tenantId');
  router.push('/login');
}
</script>

<style scoped>
.main-layout { height: 100vh; }
.aside { background: #1f2d3d; display: flex; flex-direction: column; }
.logo {
  height: 60px; display: flex; align-items: center; justify-content: center; gap: 8px;
  color: #fff; font-size: 16px; font-weight: 600; border-bottom: 1px solid rgba(255,255,255,0.08);
}
.logo-icon { width: 22px; height: 22px; }
.aside :deep(.el-menu) { border-right: none; }
.menu-icon { width: 18px; height: 18px; margin-right: 4px; }
.header {
  background: #fff; display: flex; align-items: center; justify-content: space-between;
  border-bottom: 1px solid #e4e7ed; height: 60px;
}
.page-title { font-size: 16px; font-weight: 600; color: #1f2d3d; }
.user-area { display: flex; align-items: center; gap: 16px; }
.username { color: #606266; font-size: 14px; }
.main { background: #f5f7fa; padding: 20px; }
</style>
