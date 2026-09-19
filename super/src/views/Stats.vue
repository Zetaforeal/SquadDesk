<template>
  <div>
    <el-row :gutter="16" class="mb">
      <el-col :span="5" v-for="card in cards" :key="card.label">
        <el-card shadow="hover">
          <div class="stat">
            <div class="val" :style="{ color: card.color }">{{ card.value }}</div>
            <div class="label">{{ card.label }}</div>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <el-card shadow="never">
      <template #header><span>各俱乐部数据一览</span></template>
      <el-table :data="clubs" v-loading="loading" stripe>
        <el-table-column prop="name" label="俱乐部" min-width="140" />
        <el-table-column prop="orderCount" label="订单数" width="90" />
        <el-table-column prop="userCount" label="用户数" width="90" />
        <el-table-column prop="playerCount" label="打手数" width="90" />
        <el-table-column label="交易额(元)" width="120">
          <template #default="{ row }">{{ row.paidAmount }}</template>
        </el-table-column>
        <el-table-column label="到期时间" width="170">
          <template #default="{ row }">{{ fmt(row.expiresAt) || '永久' }}</template>
        </el-table-column>
      </el-table>
    </el-card>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import request from '@/utils/request';

const stats = ref({});
const clubs = ref([]);
const loading = ref(false);

const cards = computed(() => [
  { label: '俱乐部数', value: stats.value.clubs ?? '-', color: '#409eff' },
  { label: '订单总数', value: stats.value.orders ?? '-', color: '#67c23a' },
  { label: '用户总数', value: stats.value.users ?? '-', color: '#e6a23c' },
  { label: '打手总数', value: stats.value.players ?? '-', color: '#f56c6c' },
  { label: '平台交易额(元)', value: stats.value.paidAmount ?? '-', color: '#9b59b6' },
]);

function fmt(t) { return t ? String(t).replace('T', ' ').slice(0, 19) : ''; }

onMounted(async () => {
  stats.value = await request.get('/stats');
  loading.value = true;
  try {
    clubs.value = await request.get('/clubs');
  } finally {
    loading.value = false;
  }
});
</script>

<style scoped>
.mb { margin-bottom: 16px; }
.stat { text-align: center; padding: 12px 0; }
.val { font-size: 26px; font-weight: 700; }
.label { font-size: 13px; color: #909399; margin-top: 6px; }
</style>
