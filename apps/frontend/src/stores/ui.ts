import { defineStore } from 'pinia';
import { computed, ref } from 'vue';

export type ToastType = 'info' | 'success' | 'error';
export interface Toast {
  id: number;
  message: string;
  type: ToastType;
}

// Minimal BeforeInstallPromptEvent typing (not in lib.dom yet).
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export const useUiStore = defineStore('ui', () => {
  const theme = ref<'dark' | 'light'>('dark');
  const toasts = ref<Toast[]>([]);
  const deferredInstall = ref<BeforeInstallPromptEvent | null>(null);
  const canInstall = computed(() => deferredInstall.value !== null);

  let seq = 0;

  function toast(message: string, type: ToastType = 'info'): void {
    const id = ++seq;
    toasts.value.push({ id, message, type });
    setTimeout(() => removeToast(id), 3500);
  }
  function removeToast(id: number): void {
    toasts.value = toasts.value.filter((t) => t.id !== id);
  }

  function applyTheme(): void {
    document.documentElement.classList.toggle('dark', theme.value === 'dark');
  }
  function toggleTheme(): void {
    theme.value = theme.value === 'dark' ? 'light' : 'dark';
    applyTheme();
  }

  function setInstallPrompt(e: BeforeInstallPromptEvent | null): void {
    deferredInstall.value = e;
  }
  async function promptInstall(): Promise<void> {
    const e = deferredInstall.value;
    if (!e) return;
    await e.prompt();
    await e.userChoice;
    deferredInstall.value = null;
  }

  return {
    theme,
    toasts,
    canInstall,
    toast,
    removeToast,
    applyTheme,
    toggleTheme,
    setInstallPrompt,
    promptInstall,
  };
});
