<script setup lang="ts">
/** Small unread-count pill — shared by the header's chat/notifications icons
 *  and the event page's chat entry point, previously duplicated verbatim. */
defineProps<{ count: number }>();
</script>

<template>
  <span
    v-if="count > 0"
    class="grid h-4 min-w-4 place-items-center rounded-full bg-brand-500 px-1 text-[10px] font-bold leading-none text-ink-900"
  >
    {{ count > 9 ? '9+' : count }}
  </span>
</template>
