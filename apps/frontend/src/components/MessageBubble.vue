<script setup lang="ts">
import Avatar from '@/components/Avatar.vue';
import { timeOfDay } from '@/lib/format';
import type { MessageDTO } from '@/types';

defineProps<{ message: MessageDTO; mine: boolean }>();
</script>

<template>
  <div class="flex items-end gap-2" :class="mine ? 'flex-row-reverse' : 'flex-row'">
    <Avatar v-if="!mine" :user="message.user" :size="28" class="shrink-0" />

    <div class="flex max-w-[78%] flex-col" :class="mine ? 'items-end' : 'items-start'">
      <span v-if="!mine" class="mb-0.5 px-1 text-xs font-medium text-slate-400">
        {{ message.user.displayName }}
      </span>

      <div
        class="whitespace-pre-wrap break-words rounded-2xl px-3.5 py-2 text-sm"
        :class="
          mine
            ? 'rounded-br-md bg-brand-500 font-medium text-ink-900'
            : 'rounded-bl-md bg-ink-700 text-slate-100'
        "
      >
        {{ message.content }}
      </div>

      <span class="mt-0.5 px-1 text-[10px] text-slate-500">
        {{ timeOfDay(message.createdAt) }}
      </span>
    </div>
  </div>
</template>
