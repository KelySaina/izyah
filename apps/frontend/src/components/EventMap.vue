<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref } from 'vue';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { ExternalLink, Maximize2, Minimize2 } from 'lucide-vue-next';

/**
 * Read-only location map: OSM tiles + a single pin at the event's coordinates,
 * a link out to a full map, and a fullscreen toggle. Keyless. Mounted only when
 * the event has coords, so Leaflet stays off the critical path otherwise.
 *
 * A divIcon (inline SVG) avoids Leaflet's default-marker broken-image issue.
 */
const props = defineProps<{ lat: number; lng: number; label?: string }>();

const el = ref<HTMLElement | null>(null);
const isFull = ref(false);
let map: L.Map | null = null;

const osmUrl = `https://www.openstreetmap.org/?mlat=${props.lat}&mlon=${props.lng}#map=17/${props.lat}/${props.lng}`;

const pinSvg =
  '<svg xmlns="http://www.w3.org/2000/svg" width="30" height="30" viewBox="0 0 24 24" ' +
  'fill="#F7C331" stroke="#101012" stroke-width="1.5"><path d="M12 21s-6-5.686-6-10a6 6 0 1 1 12 0c0 4.314-6 10-6 10z"/>' +
  '<circle cx="12" cy="11" r="2.2" fill="#101012" stroke="none"/></svg>';

async function toggleFull(): Promise<void> {
  isFull.value = !isFull.value;
  document.body.style.overflow = isFull.value ? 'hidden' : '';
  await nextTick();
  map?.invalidateSize(); // Leaflet must recompute after the container resizes.
}

function onKey(e: KeyboardEvent): void {
  if (e.key === 'Escape' && isFull.value) void toggleFull();
}

onMounted(() => {
  if (!el.value) return;
  map = L.map(el.value, { scrollWheelZoom: false, attributionControl: true }).setView(
    [props.lat, props.lng],
    15,
  );
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; OpenStreetMap contributors',
  }).addTo(map);
  const icon = L.divIcon({ className: 'izyah-pin', html: pinSvg, iconSize: [30, 30], iconAnchor: [15, 29] });
  const marker = L.marker([props.lat, props.lng], { icon }).addTo(map);
  if (props.label) {
    // Hand Leaflet a real text node, not a string — bindPopup(string) treats
    // its argument as HTML, which would let a location containing markup
    // (fully host-controlled free text) execute as script in every viewer's
    // browser.
    const popupEl = document.createElement('div');
    popupEl.textContent = props.label;
    marker.bindPopup(popupEl);
  }
  document.addEventListener('keydown', onKey);
});

onBeforeUnmount(() => {
  document.removeEventListener('keydown', onKey);
  document.body.style.overflow = '';
  map?.remove();
  map = null;
});
</script>

<template>
  <div class="space-y-2">
    <div :class="isFull ? 'fixed inset-0 z-[70] bg-app p-2 pt-[max(0.5rem,env(safe-area-inset-top))]' : 'relative h-48'">
      <div ref="el" class="h-full w-full overflow-hidden rounded-xl border border-line/10" />
      <button
        type="button"
        class="absolute right-3 top-3 z-[1100] grid h-9 w-9 place-items-center rounded-full bg-black/50 text-white transition hover:bg-black/70"
        :aria-label="isFull ? 'Exit fullscreen' : 'Fullscreen map'"
        @click="toggleFull"
      >
        <Minimize2 v-if="isFull" :size="18" />
        <Maximize2 v-else :size="18" />
      </button>
    </div>

    <a
      v-if="!isFull"
      :href="osmUrl"
      target="_blank"
      rel="noopener noreferrer"
      class="inline-flex items-center gap-1.5 text-xs font-semibold text-accent"
    >
      <ExternalLink :size="13" /> Open in map
    </a>
  </div>
</template>

<style>
.izyah-pin {
  background: transparent;
  border: none;
}
</style>
