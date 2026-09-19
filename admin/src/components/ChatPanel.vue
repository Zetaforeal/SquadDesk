<template>
  <div class="chat-panel">
    <div class="messages" ref="listRef">
      <div v-for="m in messages" :key="m.id" class="msg" :class="{ mine: m.senderType === role }">
        <div class="msg-name">{{ m.senderName }}</div>
        <div class="msg-bubble">{{ m.content }}</div>
        <div class="msg-time">{{ fmt(m.createdAt) }}</div>
      </div>
      <el-empty v-if="!messages.length" description="暂无消息" :image-size="60" />
    </div>
    <div class="input-row">
      <el-input v-model="content" placeholder="输入消息..." @keyup.enter="send" />
      <el-button type="primary" @click="send">发送</el-button>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, nextTick } from 'vue';
import request from '@/utils/request';

const props = defineProps({ orderId: [Number, String], role: { type: String, default: 'admin' } });

const messages = ref([]);
const content = ref('');
const listRef = ref();
let timer = null;

function fmt(t) { return t ? String(t).replace('T', ' ').slice(11, 16) : ''; }

async function load() {
  messages.value = await request.get(`/chat/${props.orderId}/messages`);
  await nextTick();
  if (listRef.value) listRef.value.scrollTop = listRef.value.scrollHeight;
}

async function send() {
  if (!content.value.trim()) return;
  await request.post(`/chat/${props.orderId}/messages`, { content: content.value });
  content.value = '';
  load();
}

onMounted(() => {
  load();
  timer = setInterval(load, 15000);
});

onUnmounted(() => clearInterval(timer));
</script>

<style scoped>
.chat-panel { display: flex; flex-direction: column; }
.messages { height: 320px; overflow-y: auto; padding: 8px 4px; }
.msg { margin-bottom: 12px; }
.msg.mine { text-align: right; }
.msg-name { font-size: 12px; color: #909399; margin-bottom: 4px; }
.msg-bubble {
  display: inline-block; max-width: 70%; padding: 8px 12px; border-radius: 8px;
  background: #f0f2f5; color: #1f2d3d; text-align: left; word-break: break-all;
}
.msg.mine .msg-bubble { background: #409eff; color: #fff; }
.msg-time { font-size: 11px; color: #c0c4cc; margin-top: 2px; }
.input-row { display: flex; gap: 8px; margin-top: 8px; }
</style>
