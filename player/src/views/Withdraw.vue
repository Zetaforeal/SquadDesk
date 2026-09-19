<template>
  <div>
    <el-row :gutter="16" class="mb">
      <el-col :span="8">
        <el-card shadow="hover">
          <div class="stat"><div class="val warn">{{ summary.readyAmount }}</div><div class="label">可提现金额(元)</div></div>
        </el-card>
      </el-col>
      <el-col :span="8">
        <el-card shadow="hover">
          <div class="stat"><div class="val">{{ summary.readyCount }}</div><div class="label">可提现订单</div></div>
        </el-card>
      </el-col>
      <el-col :span="8">
        <el-card shadow="hover">
          <div class="stat"><div class="val">{{ summary.pendingCount + summary.processingCount }}</div><div class="label">审核中/待付款</div></div>
        </el-card>
      </el-col>
    </el-row>

    <el-card shadow="never">
      <template #header><span>可提现订单</span></template>
      <el-table :data="summary.readyOrders || []" stripe>
        <el-table-column prop="orderNo" label="订单号" width="220" />
        <el-table-column label="佣金(元)" width="120">
          <template #default="{ row }">{{ row.commissionAmount }}</template>
        </el-table-column>
        <el-table-column label="操作" width="130">
          <template #default="{ row }">
            <el-button link type="primary" @click="apply(row)">申请提现</el-button>
          </template>
        </el-table-column>
      </el-table>
      <el-empty v-if="!(summary.readyOrders || []).length" description="暂无待提现订单" />
    </el-card>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { ElMessage } from 'element-plus';
import request from '@/utils/request';

const summary = ref({ readyCount: 0, readyAmount: 0, pendingCount: 0, processingCount: 0, readyOrders: [] });

async function load() {
  summary.value = await request.get('/pending-withdraw');
}

async function apply(row) {
  await request.post(`/withdraw/${row.id}/apply`);
  ElMessage.success('已申请提现，等待管理员审核');
  load();
}

onMounted(load);
</script>

<style scoped>
.mb { margin-bottom: 16px; }
.stat { text-align: center; padding: 12px 0; }
.val { font-size: 28px; font-weight: 700; color: #1f2d3d; }
.val.warn { color: #e6a23c; }
.label { font-size: 13px; color: #909399; margin-top: 6px; }
</style>
