<script setup lang="ts">
import { ref, watch } from 'vue';
import { Check, Download, Moon, Sun } from 'lucide-vue-next';
import { useIdentityStore } from '@/stores/identity';
import { useUiStore } from '@/stores/ui';
import { ApiError } from '@/services/api';
import Avatar from '@/components/Avatar.vue';

const identity = useIdentityStore();
const ui = useUiStore();

const PRESET_COLORS = [
  '#7C3AED',
  '#EC4899',
  '#F43F5E',
  '#F59E0B',
  '#10B981',
  '#14B8A6',
  '#3B82F6',
  '#8B5CF6',
];

const name = ref('');
watch(
  () => identity.user,
  (user) => {
    if (user) name.value = user.displayName;
  },
  { immediate: true },
);

const saving = ref(false);

async function saveName(): Promise<void> {
  const value = name.value.trim();
  if (!value) {
    ui.toast('Name cannot be empty', 'error');
    return;
  }
  saving.value = true;
  try {
    await identity.updateProfile({ displayName: value });
    ui.toast('Profile updated', 'success');
  } catch (err) {
    ui.toast(err instanceof ApiError ? err.message : 'Something went wrong', 'error');
  } finally {
    saving.value = false;
  }
}

async function pickColor(color: string): Promise<void> {
  try {
    await identity.updateProfile({ avatar: color });
    ui.toast('Avatar updated', 'success');
  } catch (err) {
    ui.toast(err instanceof ApiError ? err.message : 'Something went wrong', 'error');
  }
}
</script>

<template>
  <div class="space-y-6">
    <h1 class="text-2xl font-black tracking-tight">You</h1>

    <!-- Avatar + identity -->
    <section class="flex flex-col items-center gap-3 text-center">
      <Avatar :name="identity.displayName" :avatar="identity.avatar" :size="96" />
      <p class="text-lg font-semibold">{{ identity.displayName }}</p>
    </section>

    <!-- Display name -->
    <section class="card space-y-3 p-4">
      <label for="displayName" class="label">Display name</label>
      <div class="flex items-center gap-2">
        <input
          id="displayName"
          v-model="name"
          class="input"
          type="text"
          placeholder="Your name"
          autocomplete="name"
          @keyup.enter="saveName"
        />
        <button type="button" class="btn-primary shrink-0" :disabled="saving" @click="saveName">
          Save
        </button>
      </div>
    </section>

    <!-- Avatar color palette -->
    <section class="card space-y-3 p-4">
      <p class="label">Avatar color</p>
      <div class="flex flex-wrap gap-3">
        <button
          v-for="color in PRESET_COLORS"
          :key="color"
          type="button"
          class="grid h-10 w-10 place-items-center rounded-full ring-2 ring-offset-2 ring-offset-ink-800 transition active:scale-95"
          :class="identity.avatar === color ? 'ring-white' : 'ring-transparent'"
          :style="{ backgroundColor: color }"
          :aria-label="'Use color ' + color"
          :aria-pressed="identity.avatar === color"
          @click="pickColor(color)"
        >
          <Check v-if="identity.avatar === color" :size="16" :stroke-width="3" class="text-white drop-shadow" />
        </button>
      </div>
    </section>

    <!-- App controls -->
    <section class="space-y-2">
      <button
        v-if="ui.canInstall"
        type="button"
        class="btn-ghost w-full"
        @click="ui.promptInstall()"
      >
        <Download :size="18" /> Install app
      </button>
      <button type="button" class="btn-ghost w-full" @click="ui.toggleTheme()">
        <Moon v-if="ui.theme === 'dark'" :size="18" />
        <Sun v-else :size="18" />
        {{ ui.theme === 'dark' ? 'Dark theme' : 'Light theme' }}
      </button>
    </section>

    <!-- Debug / identity id -->
    <p class="text-center text-xs text-slate-600">ID: {{ identity.id ?? '—' }}</p>
  </div>
</template>
