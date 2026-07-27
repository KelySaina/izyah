import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router';
import { useIdentityStore } from '@/stores/identity';

const routes: RouteRecordRaw[] = [
  { path: '/', name: 'home', component: () => import('@/views/HomeView.vue') },
  { path: '/dashboard', name: 'dashboard', component: () => import('@/views/DashboardView.vue') },
  { path: '/create', name: 'create', component: () => import('@/views/CreateEventView.vue') },
  {
    path: '/event/:idOrSlug',
    name: 'event',
    component: () => import('@/views/EventDetailView.vue'),
    props: true,
  },
  {
    path: '/event/:id/edit',
    name: 'event-edit',
    component: () => import('@/views/EditEventView.vue'),
    props: true,
  },
  { path: '/profile', name: 'profile', component: () => import('@/views/ProfileView.vue') },
  { path: '/callback', name: 'callback', component: () => import('@/views/CallbackView.vue') },
  { path: '/:pathMatch(.*)*', name: 'not-found', component: () => import('@/views/NotFoundView.vue') },
];

export const router = createRouter({
  history: createWebHistory(),
  routes,
  scrollBehavior: () => ({ top: 0 }),
});

// Ensure the anonymous identity exists before any route renders. Idempotent,
// so this only performs the bootstrap network call once per session.
router.beforeEach(async () => {
  const identity = useIdentityStore();
  if (!identity.ready) {
    try {
      await identity.init();
    } catch {
      // Offline / API down: allow navigation; views handle the empty state.
    }
  }
  return true;
});

// Views are lazy-loaded, so after a deploy an old client can ask for a chunk
// whose hashed filename no longer exists — the dynamic import rejects and the
// route renders *nothing* (the "form not displayed" symptom, most visible on a
// stale installed PWA). Recover by doing a single full reload, which refetches
// the (no-cache) index.html and, through it, the current chunk names. A
// sessionStorage guard set before the reload and cleared only on a *successful*
// navigation prevents a reload loop if the chunk is genuinely gone.
const RELOAD_GUARD = 'izyah:chunk-reload';

router.onError((error, to) => {
  const message = String((error as Error)?.message ?? error);
  const isChunkError =
    /dynamically imported module|Importing a module script failed|Failed to fetch|ChunkLoadError|error loading/i.test(
      message,
    );
  if (isChunkError && !sessionStorage.getItem(RELOAD_GUARD)) {
    sessionStorage.setItem(RELOAD_GUARD, '1');
    window.location.assign(to.fullPath);
  }
});

router.afterEach(() => {
  // A route resolved successfully — arm the recovery again for any future stale
  // chunk (the reload above only fires when the guard isn't already set).
  sessionStorage.removeItem(RELOAD_GUARD);
});
