<script setup lang="ts">
import { computed } from 'vue';
import { initials, isColorAvatar } from '@/lib/format';
import type { UserDTO } from '@/types';

const props = withDefaults(
  defineProps<{
    user?: UserDTO;
    name?: string;
    avatar?: string;
    size?: number;
  }>(),
  { user: undefined, name: undefined, avatar: undefined, size: 40 },
);

const displayName = computed(() => props.user?.displayName ?? props.name ?? '');
const avatar = computed(() => props.user?.avatar ?? props.avatar ?? '');
const showImage = computed(() => !!avatar.value && !isColorAvatar(avatar.value));

const boxStyle = computed(() => ({
  width: `${props.size}px`,
  height: `${props.size}px`,
  fontSize: `${Math.round(props.size * 0.4)}px`,
}));
</script>

<template>
  <span
    class="inline-grid shrink-0 place-items-center overflow-hidden rounded-full font-bold text-white"
    :style="showImage ? boxStyle : { ...boxStyle, backgroundColor: avatar || '#7c3aed' }"
  >
    <img
      v-if="showImage"
      :src="avatar"
      :alt="displayName"
      class="h-full w-full object-cover"
    />
    <template v-else>{{ initials(displayName) }}</template>
  </span>
</template>
