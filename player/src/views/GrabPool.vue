<template>
  <div>
    <el-card shadow="never">
      <template #header>
        <div class="head">
          <span>抢单大厅（仅在线可见）</span>
          <el-tag size="small" type="warning">新单实时刷新</el-tag>
        </div>
      </template>

      <el-empty v-if="!orders.length" description="暂无待抢订单，请稍候..." />

      <el-row :gutter="16">
        <el-col :span="8" v-for="o in orders" :key="o.id" class="mb">
          <el-card shadow="hover" class="order-card">
            <div class="order-head">
              <span class="order-no">{{ o.orderNo }}</span>
              <el-tag size="small" type="danger">{{ o.dispatchType === 'ASSIGN' ? '指派给我' : o.dispatchType === 'AUTO' ? '自动派单' : '抢单' }}</el-tag>
            </div>
            <div class="items">
              <div v-for="(it, i) in o.items" :key="i" class="item">{{ it.productName }} x{{ it.quantity }}</div>
            </div>
            <div class="profile" v-if="o.profileData">
              <div v-if="o.profileData.platform">平台：{{ o.profileData.platform }}</div>
              <div v-if="o.profileData.identifier">账号：{{ o.profileData.identifier }}</div>
              <div v-if="o.profileData.address">地址：{{ o.profileData.address }}</div>
            </div>
            <div class="amount-row">
              <div class="commission">佣金 <b>{{ o.commissionAmount }}</b> 元</div>
              <el-button type="primary" size="small" :loading="grabbingId === o.id" @click="grab(o)">抢 单</el-button>
            </div>
            <div class="partner-row">
              <span class="partner-label">搭档（可选）</span>
              <el-select v-model="partnerMap[o.id]" clearable filterable placeholder="选择在线打手" size="small" style="width: 100%">
                <el-option v-for="p in partners" :key="p.id" :label="p.nickname || p.username" :value="p.id" />
              </el-select>
            </div>
          </el-card>
        </el-col>
      </el-row>
    </el-card>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, onUnmounted } from 'vue';
import { ElMessage } from 'element-plus';
import request from '@/utils/request';

const orders = ref([]);
const partners = ref([]);
const grabbingId = ref(null);
const partnerMap = reactive({});
let timer = null;

async function load() {
  try {
    orders.value = await request.get('/available-orders');
  } catch (e) { /* 未上线提示由后端返回，轮询静默 */ }
}

async function loadPartners() {
  try {
    partners.value = await request.get('/available-partners');
  } catch (e) { /* 静默 */ }
}

async function grab(o) {
  const partnerId = partnerMap[o.id] || null;
  grabbingId.value = o.id;
  try {
    const res = await request.post(`/orders/${o.id}/grab`, { partnerId });
    if (res.pendingPartner) {
      ElMessage.success(`已抢单，等待搭档「${res.partnerName}」确认`);
    } else {
      ElMessage.success('抢单成功，请尽快处理订单');
    }
    delete partnerMap[o.id];
    load();
  } catch (e) { /* 错误信息已由拦截器提示 */ } finally {
    grabbingId.value = null;
  }
}

onMounted(() => {
  load();
  loadPartners();
  timer = setInterval(() => { load(); loadPartners(); }, 10000);
});
onUnmounted(() => clearInterval(timer));
</script>

<style scoped>
.head { display: flex; justify-content: space-between; align-items: center; }
.mb { margin-bottom: 16px; }
.order-card :deep(.el-card__body) { padding: 16px; }
.items { margin-bottom: 10px; }
.item { font-size: 13px; line-height: 1.8; }
.profile { font-size: 12px; color: #606266; margin-bottom: 10px; line-height: 1.8; }
.amount-row { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; }
.commission { font-size: 13px; color: #606266; }
.commission b { color: #f56c6c; font-size: 16px; }
.partner-row { border-top: 1px dashed #ebeef5; padding-top: 10px; }
.partner-label { display: block; font-size: 12px; color: #909399; margin-bottom: 6px; }
</style>
