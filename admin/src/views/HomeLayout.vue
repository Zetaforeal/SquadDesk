<template>
  <div class="layout-page">
    <!-- 工具栏 -->
    <el-card shadow="never" class="toolbar-card">
      <div class="toolbar">
        <el-button type="success" @click="addModule">添加模块</el-button>
        <el-button type="primary" :loading="saving" @click="save">保存布局</el-button>
        <span class="tip">拖动左侧模块卡片可调整顺序 · 右侧实时预览小程序首页</span>
      </div>
    </el-card>

    <div class="editor-wrap">
      <!-- 左：模块编辑 -->
      <el-card shadow="never" class="editor-panel">
        <template #header><span>模块列表（共 {{ modules.length }} 个）</span></template>

        <el-empty v-if="!modules.length" description="暂无模块，点击「添加模块」开始搭建首页" />

        <div
          v-for="(m, idx) in modules"
          :key="m._key"
          class="module-card"
          :class="{ dragging: dragIdx === idx }"
          draggable="true"
          @dragstart="onDragStart(idx)"
          @dragover.prevent="onDragOver(idx)"
          @drop.prevent="onDrop(idx)"
          @dragend="onDragEnd"
        >
          <div class="module-head">
            <div class="drag-handle">
              <GripVertical :size="16" />
            </div>
            <div class="module-type">
              <el-tag :type="typeTag(m.type)" size="small">{{ TYPE_TEXT[m.type] }}</el-tag>
              <span class="module-title">{{ m.config?.title || moduleDefaultTitle(m.type) }}</span>
            </div>
            <div>
              <el-button link type="primary" :disabled="idx === 0" @click="move(idx, -1)">上移</el-button>
              <el-button link type="primary" :disabled="idx === modules.length - 1" @click="move(idx, 1)">下移</el-button>
              <el-button link type="danger" @click="modules.splice(idx, 1)">删除</el-button>
            </div>
          </div>

          <div class="module-body">
            <div class="row">
              <span class="label">类型</span>
              <el-select v-model="m.type" style="width: 180px">
                <el-option v-for="(v, k) in TYPE_TEXT" :key="k" :label="v" :value="k" />
              </el-select>
            </div>

            <!-- 通用：标题 -->
            <div class="row" v-if="m.type === 'SECTION_TITLE' || m.type === 'BANNER' || m.type === 'ACTIVITY' || m.type === 'PRODUCT_LIST'">
              <span class="label">标题</span>
              <el-input v-model="m.config.title" placeholder="模块标题（可选）" style="width: 320px" />
            </div>

            <!-- BANNER / ACTIVITY：图片 + 跳转 -->
            <div class="row" v-if="m.type === 'BANNER'">
              <span class="label">轮播图</span>
              <div class="banner-list">
                <div v-for="(b, bi) in m.config.banners" :key="bi" class="banner-item">
                  <image-input v-model="b.image" />
                  <div class="banner-links">
                    <div class="banner-link-row">
                      <span class="banner-link-label">跳转商品</span>
                      <el-select v-model="b.productId" clearable filterable placeholder="选择跳转到的商品（可选）" size="small" style="flex: 1">
                        <el-option v-for="p in products" :key="p.id" :label="p.name" :value="p.id" />
                      </el-select>
                    </div>
                    <div class="banner-link-row">
                      <span class="banner-link-label">自定义链接</span>
                      <el-input v-model="b.link" placeholder="自定义跳转链接（可选，商品优先）" size="small" style="flex: 1" />
                    </div>
                    <div class="banner-ops">
                      <el-button link type="primary" size="small" :disabled="bi === 0" @click="moveBanner(m, bi, -1)">上移</el-button>
                      <el-button link type="primary" size="small" :disabled="bi === m.config.banners.length - 1" @click="moveBanner(m, bi, 1)">下移</el-button>
                      <el-button link type="danger" size="small" @click="removeBanner(m, bi)">删除</el-button>
                    </div>
                  </div>
                </div>
                <el-button size="small" type="primary" plain @click="addBanner(m)">+ 添加轮播图</el-button>
                <div class="tip">多张轮播图将循环播放；跳转商品与自定义链接二选一，商品优先</div>
              </div>
            </div>
            <div class="row" v-if="m.type === 'ACTIVITY'">
              <span class="label">图片</span>
              <image-input v-model="m.config.image" />
              <div class="tip">建议上传横向长图（宽高比约 3:1），小程序端会以横条展示</div>
            </div>
            <div class="row" v-if="m.type === 'ACTIVITY'">
              <span class="label">跳转链接</span>
              <el-input v-model="m.config.link" placeholder="点击活动跳转链接（可选）" style="width: 320px" />
            </div>

            <!-- PRODUCT_LIST：选择商品 -->
            <div class="row" v-if="m.type === 'PRODUCT_LIST'">
              <span class="label">商品</span>
              <el-select v-model="m.productIds" multiple filterable placeholder="选择要展示的商品" style="width: 100%; max-width: 480px">
                <el-option v-for="p in products" :key="p.id" :label="p.name" :value="p.id" />
              </el-select>
            </div>
          </div>
        </div>
      </el-card>

      <!-- 右：手机预览 -->
      <el-card shadow="never" class="preview-panel">
        <template #header>
          <div class="preview-head">
            <span>首页预览</span>
            <el-tag size="small" type="info">实时</el-tag>
          </div>
        </template>
        <div class="phone-wrap">
          <div class="phone">
            <div class="phone-statusbar"></div>
            <div class="phone-nav">俱乐部商城</div>
            <div class="phone-body">
              <!-- BANNER -->
              <div v-for="(m, i) in modules" :key="m._key" class="pv-module">
                <div v-if="m.type === 'BANNER'" class="pv-banner">
                  <div v-if="(m.config.banners || []).length" class="pv-banner-stack">
                    <el-image
                      v-for="(b, bi) in m.config.banners"
                      :key="bi"
                      :src="b.image"
                      fit="cover"
                      class="pv-banner-img"
                      :class="{ 'pv-banner-front': bi === (m.config.banners || []).length - 1 }"
                    />
                    <div class="pv-banner-dots">
                      <span v-for="(b, bi) in m.config.banners" :key="bi" class="pv-dot" :class="{ on: bi === (m.config.banners || []).length - 1 }"></span>
                    </div>
                    <div class="pv-banner-count">{{ (m.config.banners || []).length }} 张循环</div>
                  </div>
                  <div v-else class="pv-placeholder" :style="{ height: '120px' }">轮播图（{{ m.config.title || '未设置' }}）</div>
                </div>

                <div v-else-if="m.type === 'SECTION_TITLE'" class="pv-title">{{ m.config.title || '标题' }}</div>

                <div v-else-if="m.type === 'ACTIVITY'" class="pv-activity">
                  <el-image v-if="m.config.image" :src="m.config.image" fit="cover" class="pv-activity-img" />
                  <div v-else class="pv-placeholder" :style="{ height: '80px' }">活动图（{{ m.config.title || '未设置' }}）</div>
                </div>

                <div v-else-if="m.type === 'PRODUCT_LIST'" class="pv-products">
                  <div class="pv-products-title">{{ m.config.title || '精选商品' }}</div>
                  <div v-if="previewProducts(m).length" class="pv-grid">
                    <div v-for="p in previewProducts(m)" :key="p.id" class="pv-item">
                      <el-image v-if="p.coverUrl" :src="p.coverUrl" fit="cover" class="pv-item-img" />
                      <div v-else class="pv-placeholder pv-item-img">无图</div>
                      <div class="pv-item-name">{{ p.name }}</div>
                      <div class="pv-item-price">¥{{ p.price }}</div>
                    </div>
                  </div>
                  <div v-else class="pv-empty">未选择商品</div>
                </div>

                <div v-else class="pv-placeholder" :style="{ height: '60px' }">未知模块</div>
              </div>
              <div v-if="!modules.length" class="pv-empty-total">暂无模块，先添加模块吧</div>
            </div>
            <div class="phone-tabbar">
              <span class="tab active">首页</span>
              <span class="tab">分类</span>
              <span class="tab">订单</span>
              <span class="tab">我的</span>
            </div>
          </div>
        </div>
      </el-card>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { ElMessage } from 'element-plus';
import { GripVertical } from 'lucide-vue-next';
import request from '@/utils/request';
import ImageInput from '@/components/ImageInput.vue';

const TYPE_TEXT = { BANNER: '轮播图', SECTION_TITLE: '标题', ACTIVITY: '活动图', PRODUCT_LIST: '商品列表' };
const typeTag = (t) => ({ BANNER: 'warning', SECTION_TITLE: 'info', ACTIVITY: 'danger', PRODUCT_LIST: 'success' }[t] || 'info');

const modules = ref([]);
const products = ref([]);
const saving = ref(false);
const dragIdx = ref(-1);
let keySeq = 1;

function moduleDefaultTitle(t) {
  return { BANNER: '轮播图', SECTION_TITLE: '标题模块', ACTIVITY: '活动图', PRODUCT_LIST: '商品列表' }[t] || '';
}

function addModule() {
  modules.value.push({ _key: keySeq++, type: 'BANNER', config: { title: '', image: '', link: '', banners: [] }, productIds: [] });
}

// ===== BANNER 多图管理 =====
function addBanner(m) {
  if (!m.config.banners) m.config.banners = [];
  m.config.banners.push({ image: '', link: '' });
}

function removeBanner(m, bi) {
  m.config.banners.splice(bi, 1);
}

function moveBanner(m, bi, dir) {
  const target = bi + dir;
  if (target < 0 || target >= m.config.banners.length) return;
  const arr = m.config.banners;
  [arr[bi], arr[target]] = [arr[target], arr[bi]];
}

function move(idx, dir) {
  const target = idx + dir;
  if (target < 0 || target >= modules.value.length) return;
  const arr = modules.value;
  [arr[idx], arr[target]] = [arr[target], arr[idx]];
}

// ===== 拖拽排序（原生 HTML5） =====
function onDragStart(idx) {
  dragIdx.value = idx;
}

function onDragOver(idx) {
  if (dragIdx.value === -1 || dragIdx.value === idx) return;
  const arr = modules.value;
  const [moved] = arr.splice(dragIdx.value, 1);
  arr.splice(idx, 0, moved);
  dragIdx.value = idx;
}

function onDrop() {
  dragIdx.value = -1;
}

function onDragEnd() {
  dragIdx.value = -1;
}

// 预览商品：按选中的 productIds 过滤
function previewProducts(m) {
  const ids = m.productIds || [];
  return products.value.filter((p) => ids.includes(p.id));
}

async function load() {
  const layout = await request.get('/home/layout');
  if (layout?.modules) {
    modules.value = layout.modules.map((m) => {
      const config = m.config || { title: '', image: '', link: '' };
      // BANNER 兼容：旧单图 → banners 数组；已有 banners 则保留
      if (m.type === 'BANNER') {
        if (!Array.isArray(config.banners) || !config.banners.length) {
          config.banners = config.image ? [{ image: config.image, link: config.link || '' }] : [];
        }
        config.banners = config.banners.map((b) => ({ image: b.image || '', link: b.link || '' }));
      }
      return {
        _key: keySeq++,
        type: m.type,
        config,
        productIds: m.products?.map((p) => p.id) || [],
      };
    });
  }
}

async function loadProducts() {
  const data = await request.get('/products', { params: { page: 1, pageSize: 100 } });
  products.value = data.list;
}

async function save() {
  // 检查是否有未完成上传（blob 本地预览未替换）
  const blobPending = JSON.stringify(modules.value).includes('blob:');
  if (blobPending) {
    return ElMessage.warning('有图片正在上传，请等待上传完成后再保存');
  }
  saving.value = true;
  try {
    const payload = modules.value.map((m, i) => {
      const config = { ...(m.config || {}) };
      // BANNER：只保留有图的轮播项（保留 image/link/productId）
      if (m.type === 'BANNER') {
        config.banners = (config.banners || [])
          .filter((b) => b.image)
          .map((b) => ({ image: b.image, link: b.link || '', productId: b.productId || null }));
      }
      return {
        type: m.type,
        sortOrder: i,
        config,
        productIds: m.type === 'PRODUCT_LIST' ? (m.productIds || []) : undefined,
      };
    });
    await request.put('/home/layout', { modules: payload });
    ElMessage.success('布局已保存');
  } finally {
    saving.value = false;
  }
}

onMounted(() => { load(); loadProducts(); });
</script>

<style scoped>
.layout-page { display: flex; flex-direction: column; gap: 16px; }
.toolbar-card { flex-shrink: 0; }
.toolbar { display: flex; gap: 12px; align-items: center; flex-wrap: wrap; }
.tip { font-size: 12px; color: #909399; }

.editor-wrap { display: flex; gap: 16px; align-items: flex-start; }
.editor-panel { flex: 1; min-width: 0; }
.preview-panel { width: 360px; flex-shrink: 0; }
.preview-head { display: flex; align-items: center; justify-content: space-between; }

/* 模块卡片 */
.module-card { border: 1px solid #e4e7ed; border-radius: 10px; margin-bottom: 16px; overflow: hidden; cursor: grab; }
.module-card.dragging { border-color: #409eff; box-shadow: 0 4px 16px rgba(64,158,255,0.25); opacity: 0.8; }
.module-head {
  display: flex; align-items: center; gap: 8px;
  padding: 12px 16px; background: #f8f9fb; border-bottom: 1px solid #e4e7ed;
}
.drag-handle { color: #c0c4cc; display: flex; align-items: center; cursor: grab; }
.module-type { display: flex; align-items: center; gap: 10px; flex: 1; }
.module-title { font-weight: 600; color: #1f2d3d; }
.module-body { padding: 16px; cursor: default; }
.row { display: flex; align-items: center; gap: 12px; margin-bottom: 12px; }
.label { width: 60px; color: #606266; font-size: 13px; flex-shrink: 0; }

/* BANNER 多图 */
.banner-list { flex: 1; }
.banner-item {
  display: flex; gap: 12px; align-items: flex-start;
  border: 1px solid #f0f2f5; border-radius: 8px; padding: 10px; margin-bottom: 10px;
}
.banner-links { flex: 1; display: flex; flex-direction: column; gap: 6px; }
.banner-link-row { display: flex; align-items: center; gap: 8px; }
.banner-link-label { font-size: 12px; color: #909399; white-space: nowrap; }
.banner-ops { display: flex; gap: 4px; }
.tip { font-size: 12px; color: #909399; }

/* 手机预览 */
.phone-wrap { display: flex; justify-content: center; }
.phone {
  width: 300px; border: 8px solid #1f2d3d; border-radius: 28px; overflow: hidden;
  background: #f5f7fa; box-shadow: 0 8px 24px rgba(0,0,0,0.15);
}
.phone-statusbar { height: 18px; background: #fff; }
.phone-nav {
  height: 36px; background: #fff; display: flex; align-items: center; justify-content: center;
  font-size: 13px; font-weight: 600; color: #1f2d3d; border-bottom: 1px solid #f0f2f5;
}
.phone-body { height: 420px; overflow-y: auto; padding: 8px; }
.pv-module { margin-bottom: 8px; }
.pv-banner-img, .pv-activity-img { width: 100%; border-radius: 6px; }
.pv-banner { position: relative; }
.pv-banner-stack { position: relative; height: 120px; }
.pv-banner-img {
  position: absolute; left: 0; top: 0; width: 100%; height: 120px;
  border-radius: 6px; opacity: 0.45; transform: scale(0.97); transform-origin: bottom center;
}
.pv-banner-img.pv-banner-front { opacity: 1; transform: none; }
.pv-banner-dots { position: absolute; bottom: 8px; left: 0; right: 0; display: flex; justify-content: center; gap: 4px; }
.pv-dot { width: 5px; height: 5px; border-radius: 50%; background: rgba(255,255,255,0.7); }
.pv-dot.on { background: #2d6a9f; width: 12px; border-radius: 3px; }
.pv-banner-count {
  position: absolute; top: 6px; right: 6px; background: rgba(0,0,0,0.5);
  color: #fff; font-size: 9px; padding: 2px 6px; border-radius: 8px;
}
.pv-title { font-size: 14px; font-weight: 700; color: #1f2d3d; padding: 6px 2px; }
.pv-placeholder {
  width: 100%; background: #e9edf2; border-radius: 6px;
  display: flex; align-items: center; justify-content: center;
  color: #909399; font-size: 11px;
}
.pv-products { background: #fff; border-radius: 6px; padding: 8px; }
.pv-products-title { font-size: 13px; font-weight: 700; color: #1f2d3d; margin-bottom: 6px; }
.pv-grid { display: flex; flex-wrap: wrap; gap: 6px; }
.pv-item { width: 88px; }
.pv-item-img { width: 88px; height: 88px; border-radius: 4px; }
.pv-item-name { font-size: 10px; color: #1f2d3d; margin-top: 2px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.pv-item-price { font-size: 11px; color: #e6a23c; font-weight: 700; }
.pv-empty { font-size: 11px; color: #909399; text-align: center; padding: 12px 0; }
.pv-empty-total { text-align: center; color: #c0c4cc; font-size: 12px; padding: 40px 0; }
.phone-tabbar {
  height: 36px; background: #fff; display: flex; align-items: center; justify-content: space-around;
  border-top: 1px solid #f0f2f5;
}
.tab { font-size: 10px; color: #909399; }
.tab.active { color: #2d6a9f; font-weight: 600; }
</style>
