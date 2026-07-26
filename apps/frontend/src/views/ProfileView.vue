<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { Check, Download, Moon, Sun, ImagePlus, Camera, ShieldCheck, LogIn, LogOut, Bell, BellOff, BarChart3 } from 'lucide-vue-next';
import { useImageUpload } from '@/composables/useImageUpload';
import { useIdentityStore } from '@/stores/identity';
import { useUiStore } from '@/stores/ui';
import { api, ApiError } from '@/services/api';
import { isColorAvatar } from '@/lib/format';
import Avatar from '@/components/Avatar.vue';
import Lightbox from '@/components/Lightbox.vue';
import AnalyticsSheet from '@/components/AnalyticsSheet.vue';
import type { AnalyticsKey } from '@/types';
import {
  isPushSupported,
  getPushSubscription,
  requestPermission,
  subscribeToPush,
  unsubscribeFromPush,
} from '@/services/notificationService';

const identity = useIdentityStore();
const ui = useUiStore();

// Aggregated across every event *this* user has created — never other
// users' data, so no gating beyond just being signed in.
const analyticsOpen = ref(false);
const ANALYTICS_KEYS: AnalyticsKey[] = [
  'event_created',
  'invitation_opened',
  'rsvp_going',
  'rsvp_maybe',
  'rsvp_not_going',
  'rsvp_waitlisted',
  'message_sent',
  'media_uploaded',
];
const ANALYTICS_LABELS: Record<AnalyticsKey, string> = {
  event_created: 'Events hosted',
  invitation_opened: 'Invitation opens',
  rsvp_going: 'Said "going"',
  rsvp_maybe: 'Said "maybe"',
  rsvp_not_going: "Said they can't go",
  rsvp_waitlisted: 'Waitlisted',
  message_sent: 'Messages sent',
  media_uploaded: 'Photos & videos shared',
};

// Only a real uploaded photo can be enlarged (color tokens can't).
const avatarIsPhoto = computed(() => !!identity.avatar && !isColorAvatar(identity.avatar));
const avatarLightbox = ref<number | null>(null);

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

// Push notifications ("off-app" alerts for RSVPs, waitlist, tasks…).
const pushSupported = isPushSupported();
const pushOn = ref(false);
const pushBusy = ref(false);

onMounted(async () => {
  if (!pushSupported) return;
  pushOn.value = !!(await getPushSubscription().catch(() => null));
});

async function togglePush(): Promise<void> {
  if (pushBusy.value) return;
  pushBusy.value = true;
  try {
    if (pushOn.value) {
      await unsubscribeFromPush();
      pushOn.value = false;
      ui.toast('Notifications turned off', 'info');
      return;
    }
    if (Notification.permission === 'denied') {
      ui.toast('Notifications are blocked — enable them in your browser settings', 'error');
      return;
    }
    const granted = await requestPermission();
    if (!granted) {
      ui.toast('Notifications permission denied', 'error');
      return;
    }
    const sub = await subscribeToPush();
    if (!sub) {
      ui.toast('Notifications are unavailable right now', 'error');
      return;
    }
    pushOn.value = true;
    ui.toast("You're all set — notifications enabled", 'success');
  } catch (err) {
    ui.toast(err instanceof ApiError ? err.message : 'Something went wrong', 'error');
  } finally {
    pushBusy.value = false;
  }
}
</script>

<template>
  <div class="space-y-6">
    <h1 class="text-2xl font-black tracking-tight">You</h1>

    <!-- Avatar + identity -->
    <section class="flex flex-col items-center gap-3 text-center">
      <component
        :is="avatarIsPhoto ? 'button' : 'div'"
        :type="avatarIsPhoto ? 'button' : undefined"
        :class="avatarIsPhoto ? 'cursor-zoom-in rounded-full' : ''"
        :aria-label="avatarIsPhoto ? 'View photo' : undefined"
        @click="avatarIsPhoto && (avatarLightbox = 0)"
      >
        <Avatar :name="identity.displayName" :avatar="identity.avatar" :size="96" />
      </component>
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
      <button
        v-if="pushSupported"
        type="button"
        class="btn-ghost w-full"
        :disabled="pushBusy"
        @click="togglePush"
      >
        <BellOff v-if="pushOn" :size="18" />
        <Bell v-else :size="18" />
        {{ pushOn ? 'Turn off notifications' : 'Enable notifications' }}
      </button>
      <button type="button" class="btn-ghost w-full" @click="analyticsOpen = true">
        <BarChart3 :size="18" /> View analytics
      </button>
    </section>

    <!-- Debug / identity id -->
    <p class="text-center text-xs text-fg-3">ID: {{ identity.id ?? '—' }}</p>

    <AnalyticsSheet
      v-model="analyticsOpen"
      title="Your hosting stats"
      :keys="ANALYTICS_KEYS"
      :labels="ANALYTICS_LABELS"
      :load="() => api.users.myAnalytics()"
    />

    <Lightbox
      v-model="avatarLightbox"
      :items="avatarIsPhoto ? [{ url: identity.avatar, type: 'IMAGE' }] : []"
    />
  </div>
</template>
