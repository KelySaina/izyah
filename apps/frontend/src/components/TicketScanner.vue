<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from 'vue';
import QrScanner from 'qr-scanner';
import { X, CheckCircle2 } from 'lucide-vue-next';
import Avatar from '@/components/Avatar.vue';
import { useEventsStore } from '@/stores/events';
import { ApiError } from '@/services/api';
import type { CheckinResultDTO } from '@/types';

const isOpen = defineModel<boolean>({ default: false });
const props = defineProps<{ eventId: string }>();

const events = useEventsStore();

const videoEl = ref<HTMLVideoElement | null>(null);
let scanner: QrScanner | null = null;
const cameraError = ref<string | null>(null);
const lastResult = ref<CheckinResultDTO | null>(null);
const lastError = ref<string | null>(null);

// A held-steady badge fires the decode callback on every frame — debounce so
// the same code doesn't hammer the check-in endpoint repeatedly.
let lastCode = '';
let lastCodeAt = 0;
const COOLDOWN_MS = 1500;

function onDecode(raw: string): void {
  const prefix = `izyah:ticket:v1:${props.eventId}:`;
  if (!raw.startsWith(prefix)) return; // not this event's ticket — ignore, keep scanning

  const code = raw.slice(prefix.length);
  const now = Date.now();
  if (code === lastCode && now - lastCodeAt < COOLDOWN_MS) return;
  lastCode = code;
  lastCodeAt = now;

  events
    .checkin(props.eventId, code)
    .then((result) => {
      lastResult.value = result;
      lastError.value = null;
    })
    .catch((err) => {
      lastResult.value = null;
      lastError.value = err instanceof ApiError ? err.message : 'Could not check in this ticket';
    });
}

async function startScanner(): Promise<void> {
  if (!videoEl.value) return;
  try {
    scanner = new QrScanner(videoEl.value, (result) => onDecode(result.data), {
      highlightScanRegion: true,
      highlightCodeOutline: true,
    });
    await scanner.start();
    cameraError.value = null;
  } catch {
    cameraError.value = 'Camera unavailable — use the manual toggle in the attendee list below.';
  }
}

function stopScanner(): void {
  scanner?.stop();
  scanner?.destroy();
  scanner = null;
}

watch(isOpen, (open) => {
  if (open) {
    lastResult.value = null;
    lastError.value = null;
    cameraError.value = null;
    // The <video> element mounts on this same tick — wait a frame for it.
    requestAnimationFrame(() => void startScanner());
  } else {
    stopScanner();
  }
});

onBeforeUnmount(stopScanner);

function close(): void {
  isOpen.value = false;
}
</script>

<template>
  <Teleport to="body">
    <transition name="fade">
      <div v-if="isOpen" class="fixed inset-0 z-50 flex flex-col bg-ink-900">
      <div class="flex items-center justify-between p-4 text-white">
        <h2 class="text-base font-bold">Scan tickets</h2>
        <button
          type="button"
          class="grid h-11 w-11 place-items-center rounded-full transition hover:bg-white/10"
          aria-label="Close scanner"
          @click="close"
        >
          <X :size="20" />
        </button>
      </div>

      <div class="relative flex-1 overflow-hidden">
        <video ref="videoEl" class="h-full w-full object-cover" muted playsinline></video>
        <div
          v-if="cameraError"
          class="absolute inset-0 flex items-center justify-center bg-ink-900/95 p-6 text-center text-sm text-white"
        >
          {{ cameraError }}
        </div>
      </div>

      <div v-if="lastResult" class="flex items-center gap-3 bg-surface p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
        <Avatar :user="lastResult.attendee.user" :size="36" />
        <div class="min-w-0 flex-1">
          <p class="truncate text-sm font-medium text-fg">{{ lastResult.attendee.user.displayName }}</p>
          <p
            class="flex items-center gap-1 text-xs"
            :class="lastResult.alreadyCheckedIn ? 'text-fg-3' : 'text-accent'"
          >
            <CheckCircle2 :size="13" />
            {{ lastResult.alreadyCheckedIn ? 'Already checked in' : 'Checked in' }}
          </p>
        </div>
      </div>
      <div
        v-else-if="lastError"
        class="bg-surface p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] text-center text-sm text-red-500"
      >
        {{ lastError }}
      </div>
      </div>
    </transition>
  </Teleport>
</template>
