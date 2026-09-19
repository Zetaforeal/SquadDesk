<template>
  <el-card shadow="never">
    <el-table :data="rows" v-loading="loading" stripe>
      <el-table-column prop="orderNo" label="订单号" width="200" />
      <el-table-column label="佣金(元)" width="110">
        <template #default="{ row }">{{ row.commissionAmount }}</template>
      </el-table-column>
      <el-table-column prop="acceptedPlayer?.nickname" label="打手" width="120">
        <template #default="{ row }">{{ row.acceptedPlayer?.nickname || '-' }}</template>
      </el-table-column>
      <el-table-column label="收款码" width="100">
        <template #default="{ row }">
          <el-image v-if="row.acceptedPlayer?.qrcodePath" :src="row.acceptedPlayer.qrcodePath" fit="cover" style="width: 48px; height: 48px; border-radius: 6px" :preview-src-list="[row.acceptedPlayer.qrcodePath]" />
          <el-tag v-else size="small" type="danger">缺失</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="进入待付时间" width="170">
        <template #default="{ row }">{{ fmt(row.pendingPaymentAt) }}</template>
      </el-table-column>
      <el-table-column label="操作" width="120" fixed="right">
        <template #default="{ row }">
          <el-button link type="success" @click="pay(row)">扫码付款</el-button>
        </template>
      </el-table-column>
    </el-table>
  </el-card>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import request from '@/utils/request';

const loading = ref(false);
const rows = ref([]);

function fmt(t) { return t ? String(t).replace('T', ' ').slice(0, 19) : '-'; }

async function load() {
  loading.value = true;
  try {
    rows.value = await request.get('/pending-payments');
  } finally {
    loading.value = false;
  }
}

async function pay(row) {
  await ElMessageBox.confirm(`确认已向打手「${row.acceptedPlayer?.nickname}」扫码付款 ${row.commissionAmount} 元？`, '确认', { type: 'warning' });
  await request.post(`/pending-payments/${row.id}/pay`);
  ElMessage.success('付款完成，佣金已入账');
  load();
}

onMounted(load);
</script>
