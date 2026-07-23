<script setup lang="ts">
import { ref, watch } from 'vue';
import { Check, Download, Moon, Sun, ImagePlus, Camera, ShieldCheck, LogIn, LogOut } from 'lucide-vue-next';
import { useImageUpload } from '@/composables/useImageUpload';
import { useIdentityStore } from '@/stores/identity';
import { useUiStore } from '@/stores/ui';
import { ApiError } from '@/services/api';
import Avatar from '@/components/Avatar.vue';

const identity = useIdentityStore();
const ui = useUiStore();

const { uploading: avatarUploading, pickAndUpload: pickAvatar } = useImageUpload('avatar');
async function uploadAvatar(camera: boolean): Promise<void> {
  const url = await pickAvatar(camera);
  if (!url) return;
  try {
    await identity.updateProfile({ avatar: url });
    ui.toast('Avatar updated', 'success');
  } catch (err) {
    ui.toast(err instanceof ApiError ? err.message : 'Something went wrong', 'error');
  }
}

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

const linking = ref(false);

async function claim(): Promise<void> {
  if (linking.value) return;
  linking.value = true;
  try {
    await identity.claim(); // redirects to the identity provider
  } catch (err) {
    linking.value = false;
    ui.toast(err instanceof ApiError ? err.message : 'Could not start sign-in', 'error');
  }
}

async function signOut(): Promise<void> {
  const ok = await ui.confirm({
    title: 'Sign out?',
    message: 'Sign out on this device? You can sign back in anytime.',
    confirmText: 'Sign out',
  });
  if (!ok) return;
  try {
    await identity.signOut();
    ui.toast('Signed out', 'success');
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
      <div class="flex gap-2">
        <button type="button" class="btn-ghost text-xs" :disabled="avatarUploading" @click="uploadAvatar(false)">
          <ImagePlus :size="15" /> Upload photo
        </button>
        <button type="button" class="btn-ghost text-xs" :disabled="avatarUploading" @click="uploadAvatar(true)">
          <Camera :size="15" /> Take photo
        </button>
      </div>
      <p v-if="avatarUploading" class="text-xs text-fg-3">Uploading…</p>
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

    <!-- Account (OIDC linking) — only when the provider is configured -->
    <section v-if="identity.canLink" class="card space-y-3 p-4">
      <p class="label">Account</p>

      <template v-if="identity.isClaimed">
        <div class="flex items-center gap-2 text-sm text-fg">
          <ShieldCheck :size="18" class="shrink-0 text-accent" />
          <span class="min-w-0">
            <span class="font-medium">Saved</span>
            <span v-if="identity.email" class="block truncate text-fg-3">{{ identity.email }}</span>
          </span>
        </div>
        <p class="text-xs text-fg-3">
          Your events are linked to this account and follow you across devices.
        </p>
        <button type="button" class="btn-ghost w-full text-sm" @click="signOut">
          <LogOut :size="16" /> Sign out on this device
        </button>
      </template>

      <template v-else>
        <p class="text-xs text-fg-3">
          Right now you're a guest on this device — clearing your browser loses your events.
          Sign in to save them and pick up on any device.
        </p>
        <button type="button" class="btn-primary w-full" :disabled="linking" @click="claim">
          <LogIn :size="16" /> {{ linking ? 'Redirecting…' : 'Save your account' }}
        </button>
      </template>
    </section>

    <!-- Avatar color palette -->
    <section class="card space-y-3 p-4">
      <p class="label">Avatar color</p>
      <div class="flex flex-wrap gap-3">
        <button
          v-for="color in PRESET_COLORS"
          :key="color"
          type="button"
          class="grid h-10 w-10 place-items-center rounded-full ring-2 ring-offset-2 ring-offset-surface transition active:scale-95"
          :class="identity.avatar === color ? 'ring-fg' : 'ring-transparent'"
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
    <p class="text-center text-xs text-fg-3">ID: {{ identity.id ?? '—' }}</p>
  </div>
</template>
