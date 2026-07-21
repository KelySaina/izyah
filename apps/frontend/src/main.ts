import { createApp } from 'vue';
import { createPinia } from 'pinia';
import App from './App.vue';
import { router } from './router';
import { useUiStore } from './stores/ui';
import '@fontsource-variable/fredoka'; // self-hosted display font (offline-safe)
import './style.css';

const app = createApp(App);
const pinia = createPinia();

app.use(pinia);
app.use(router);

// Apply the persisted/default theme before first paint.
useUiStore(pinia).applyTheme();

app.mount('#app');
