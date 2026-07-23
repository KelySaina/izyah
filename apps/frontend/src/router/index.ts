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
