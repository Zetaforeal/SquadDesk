<template>
  <el-card shadow="never">
    <template #header><span>佣金记录</span></template>
    <el-table :data="rows" v-loading="loading" stripe>
      <el-table-column prop="order?.orderNo" label="订单号" width="220" />
      <el-table-column label="金额(元)" width="120">
        <template #default="{ row }">{{ row.amount }}</template>
      </el-table-column>
      <el-table-column label="发放时间" width="180">
        <template #default="{ row }">{{ fmt(row.createdAt) }}</template>
      </el-table-column>
    </el-table>
    <el-pagination
      v-model:current-page="query.page"
      v-model:page-size="query.pageSize"
      :total="total"
      layout="total, prev, pager, next"
      class="pager"
      @change="load"
    />
  </el-card>
</template>

<script setup>
import { reactive, ref, onMounted } from 'vue';
import request from '@/utils/request';

const loading = ref(false);
const rows = ref([]);
const total = ref(0);
const query = reactive({ page: 1, pageSize: 20 });

function fmt(t) { return t ? String(t).replace('T', ' ').slice(0, 19) : '-'; }

async function load() {
  loading.value = true;
  try {
    const data = await request.get('/commissions', { params: query });
    rows.value = data.list;
    total.value = data.total;
  } finally {
    loading.value = false;
  }
}

onMounted(load);
</script>

<style scoped>
.pager { margin-top: 16px; justify-content: flex-end; }
</style>
