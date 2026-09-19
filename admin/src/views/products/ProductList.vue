<template>
  <div>
    <el-card shadow="never">
      <div class="toolbar">
        <el-input v-model="query.keyword" placeholder="商品名称" clearable style="width: 200px" @keyup.enter="load" />
        <el-select v-model="query.categoryId" placeholder="分类" clearable style="width: 160px">
          <el-option v-for="c in categories" :key="c.id" :label="c.name" :value="c.id" />
        </el-select>
        <el-button type="primary" @click="load">查询</el-button>
        <el-button type="success" @click="openEdit()">新增商品</el-button>
      </div>

      <el-table :data="rows" v-loading="loading" stripe>
        <el-table-column label="封面" width="80">
          <template #default="{ row }">
            <el-image v-if="row.coverUrl" :src="row.coverUrl" fit="cover" style="width: 48px; height: 48px; border-radius: 6px" />
            <span v-else>-</span>
          </template>
        </el-table-column>
        <el-table-column prop="name" label="商品名称" min-width="160" />
        <el-table-column prop="category?.name" label="分类" width="110" />
        <el-table-column label="价格(元)" width="100">
          <template #default="{ row }">{{ row.price }}</template>
        </el-table-column>
        <el-table-column label="佣金比例" width="100">
          <template #default="{ row }">
            <el-tag size="small" type="warning">{{ (row.commissionRate * 100).toFixed(0) }}%</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="salesCount" label="销量" width="80" />
        <el-table-column label="状态" width="90">
          <template #default="{ row }">
            <el-tag :type="row.published ? 'success' : 'info'" size="small">{{ row.published ? '上架' : '下架' }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="140" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" @click="openEdit(row)">编辑</el-button>
            <el-button link type="danger" @click="remove(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>

      <el-pagination
        v-model:current-page="query.page"
        v-model:page-size="query.pageSize"
        :total="total"
        layout="total, prev, pager, next, sizes"
        :page-sizes="[10, 20, 50]"
        class="pager"
        @change="load"
      />
    </el-card>

    <el-dialog v-model="dialogVisible" :title="form.id ? '编辑商品' : '新增商品'" width="640px" destroy-on-close>
      <el-form :model="form" label-width="90px">
        <el-form-item label="商品名称" required>
          <el-input v-model="form.name" placeholder="商品名称" />
        </el-form-item>
        <el-form-item label="分类" required>
          <el-select v-model="form.categoryId" style="width: 100%">
            <el-option v-for="c in categories" :key="c.id" :label="c.name" :value="c.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="价格(元)" required>
          <el-input-number v-model="form.price" :min="0" :precision="2" style="width: 100%" />
        </el-form-item>
        <el-form-item label="佣金比例(%)" required>
          <el-input-number v-model="form.commissionRatePercent" :min="0" :max="100" :precision="1" style="width: 100%" />
          <div class="tip">佣金 = 订单总额 × 比例，下单时快照</div>
        </el-form-item>
        <el-form-item label="封面图">
          <image-input v-model="form.coverUrl" />
        </el-form-item>
        <el-form-item label="商品描述">
          <el-input v-model="form.description" type="textarea" :rows="3" />
        </el-form-item>
        <el-form-item label="上架">
          <el-switch v-model="form.published" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="save">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { reactive, ref, onMounted } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import request from '@/utils/request';
import ImageInput from '@/components/ImageInput.vue';

const loading = ref(false);
const rows = ref([]);
const total = ref(0);
const categories = ref([]);
const dialogVisible = ref(false);
const saving = ref(false);
const query = reactive({ page: 1, pageSize: 20, keyword: '', categoryId: '' });
const form = reactive({ id: null, name: '', categoryId: null, price: 0, commissionRatePercent: 0, coverUrl: '', description: '', published: true });

async function load() {
  loading.value = true;
  try {
    const data = await request.get('/products', { params: query });
    rows.value = data.list;
    total.value = data.total;
  } finally {
    loading.value = false;
  }
}

async function loadCategories() {
  categories.value = await request.get('/categories');
}

function openEdit(row) {
  Object.assign(form, row ? {
    id: row.id, name: row.name, categoryId: row.categoryId, price: row.price,
    commissionRatePercent: Math.round(row.commissionRate * 10000) / 100,
    coverUrl: row.coverUrl || '', description: row.description || '', published: row.published,
  } : { id: null, name: '', categoryId: null, price: 0, commissionRatePercent: 0, coverUrl: '', description: '', published: true });
  dialogVisible.value = true;
}

async function save() {
  if (!form.name || !form.categoryId || form.price < 0) return ElMessage.warning('请填写完整信息');
  saving.value = true;
  try {
    const payload = {
      name: form.name, categoryId: form.categoryId, price: form.price,
      commissionRate: form.commissionRatePercent / 100,
      coverUrl: form.coverUrl || null, description: form.description, published: form.published,
    };
    if (form.id) await request.put(`/products/${form.id}`, payload);
    else await request.post('/products', payload);
    ElMessage.success('保存成功');
    dialogVisible.value = false;
    load();
  } finally {
    saving.value = false;
  }
}

async function remove(row) {
  await ElMessageBox.confirm(`确定删除商品「${row.name}」？`, '警告', { type: 'warning' });
  await request.delete(`/products/${row.id}`);
  ElMessage.success('已删除');
  load();
}

onMounted(() => { load(); loadCategories(); });
</script>

<style scoped>
.toolbar { display: flex; gap: 12px; margin-bottom: 16px; flex-wrap: wrap; }
.pager { margin-top: 16px; justify-content: flex-end; }
.tip { font-size: 12px; color: #909399; margin-top: 4px; }
</style>
