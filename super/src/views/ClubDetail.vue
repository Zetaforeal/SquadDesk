<template>
  <div>
    <el-card shadow="never" class="mb">
      <template #header><span>俱乐部订单明细（超管全量可见）</span></template>
      <el-select v-model="query.status" placeholder="状态" clearable style="width: 160px" @change="load">
        <el-option v-for="(v, k) in STATUS" :key="k" :label="v" :value="k" />
      </el-select>
      <el-button type="primary" class="ml" @click="load">查询</el-button>

      <el-table :data="rows" v-loading="loading" stripe class="mt">
        <el-table-column prop="orderNo" label="订单号" width="200" />
        <el-table-column label="金额(元)" width="100">
          <template #default="{ row }">{{ row.totalAmount }}</template>
        </el-table-column>
        <el-table-column label="佣金(元)" width="100">
          <template #default="{ row }">{{ row.commissionAmount }}</template>
        </el-table-column>
        <el-table-column prop="payStatus" label="支付状态" width="100" />
        <el-table-column prop="dispatchStatus" label="派单状态" width="140" />
        <el-table-column label="创建时间" width="170">
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
  </div>
</template>

<script setup>
import { reactive, ref, onMounted } from 'vue';
import { useRoute } from 'vue-router';
import request from '@/utils/request';

const route = useRoute();
const STATUS = {
  PENDING_GRAB: '待接单', IN_PROGRESS: '进行中', SUBMITTED: '待审核',
  PENDING_SETTLE: '待结算', READY_WITHDRAW: '可提现', WITHDRAW_PENDING: '提现审核中',
  PENDING_PAYMENT: '待付款', COMPLETED: '已完成', CANCELLED: '已取消',
};

const loading = ref(false);
const rows = ref([]);
const total = ref(0);
const query = reactive({ page: 1, pageSize: 20, status: '' });

function fmt(t) { return t ? String(t).replace('T', ' ').slice(0, 19) : '-'; }

async function load() {
  loading.value = true;
  try {
    const data = await request.get(`/clubs/${route.params.id}/orders`, { params: query });
    rows.value = data.list;
    total.value = data.total;
  } finally {
    loading.value = false;
  }
}

onMounted(load);
</script>

<style scoped>
.mb { margin-bottom: 16px; }
.ml { margin-left: 12px; }
.mt { margin-top: 16px; }
.pager { margin-top: 16px; justify-content: flex-end; }
</style>
