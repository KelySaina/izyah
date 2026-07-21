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

const THEME_KEY = 'izyah.theme';
const THEME_COLORS = { dark: '#101012', light: '#fafaf9' } as const;

export const useUiStore = defineStore('ui', () => {
  // Seed from the class the inline bootstrap script already set (no flash).
  const initialDark =
    typeof document !== 'undefined' && document.documentElement.classList.contains('dark');
  const theme = ref<'dark' | 'light'>(initialDark ? 'dark' : 'light');
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
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', THEME_COLORS[theme.value]);
  }
  function toggleTheme(): void {
    theme.value = theme.value === 'dark' ? 'light' : 'dark';
    try {
      localStorage.setItem(THEME_KEY, theme.value);
    } catch {
      /* private mode — ignore */
    }
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
