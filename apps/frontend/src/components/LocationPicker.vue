<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { MapPin, Maximize2, Minimize2, Search, X } from 'lucide-vue-next';
import {
  getCurrentPosition,
  reverseGeocode,
  searchAddress,
  type Place,
} from '@/services/locationService';

/**
 * Location picker with a decoupled label. Two inputs:
 *   • "Location name" — the free-text label stored on the event (what shows on
 *     the card). The user owns it; nothing overwrites a non-empty value.
 *   • "Find on map" — a debounced OSM search that only sets the pin/coords.
 * You can also tap the map, drag the marker, or use your device location. When
 * the name is still empty we prefill a SHORT place name (never the long address).
 * Keyless (Nominatim + OSM tiles).
 */
const props = defineProps<{
  location: string;
  latitude: number | null;
  longitude: number | null;
}>();
const emit = defineEmits<{
  (e: 'update', v: { location: string; latitude: number | null; longitude: number | null }): void;
}>();

const label = ref(props.location); // stored display name
const search = ref(''); // transient address query
const suggestions = ref<Place[]>([]);
const searching = ref(false);
const locating = ref(false);
const lat = ref<number | null>(props.latitude);
const lng = ref<number | null>(props.longitude);

const el = ref<HTMLElement | null>(null);
const isFull = ref(false);
let map: L.Map | null = null;
let marker: L.Marker | null = null;

const pinIcon = L.divIcon({
  className: 'izyah-pin',
  html:
    '<svg xmlns="http://www.w3.org/2000/svg" width="30" height="30" viewBox="0 0 24 24" ' +
    'fill="#F7C331" stroke="#101012" stroke-width="1.5"><path d="M12 21s-6-5.686-6-10a6 6 0 1 1 12 0c0 4.314-6 10-6 10z"/>' +
    '<circle cx="12" cy="11" r="2.2" fill="#101012" stroke="none"/></svg>',
  iconSize: [30, 30],
  iconAnchor: [15, 29],
});

function emitUpdate(): void {
  emit('update', { location: label.value.trim(), latitude: lat.value, longitude: lng.value });
}

/** Fill the label only if the user hasn't set one — never clobber a custom name. */
function fillNameIfEmpty(name: string | null): void {
  if (name && !label.value.trim()) label.value = name;
}

function placePin(la: number, ln: number, recenter: boolean): void {
  lat.value = la;
  lng.value = ln;
  if (!map) return;
  if (!marker) {
    marker = L.marker([la, ln], { icon: pinIcon, draggable: true }).addTo(map);
    marker.on('dragend', async () => {
      const p = marker!.getLatLng();
      lat.value = p.lat;
      lng.value = p.lng;
      fillNameIfEmpty(await reverseGeocode({ lat: p.lat, lng: p.lng }));
      emitUpdate();
    });
  } else {
    marker.setLatLng([la, ln]);
  }
  if (recenter) map.setView([la, ln], Math.max(map.getZoom(), 15));
}

async function toggleFull(): Promise<void> {
  isFull.value = !isFull.value;
  document.body.style.overflow = isFull.value ? 'hidden' : '';
  await nextTick();
  map?.invalidateSize();
}
function onKey(e: KeyboardEvent): void {
  if (e.key === 'Escape' && isFull.value) void toggleFull();
}

onMounted(() => {
  if (!el.value) return;
  const hasPin = lat.value != null && lng.value != null;
  map = L.map(el.value, { scrollWheelZoom: false, attributionControl: true }).setView(
    hasPin ? [lat.value!, lng.value!] : [20, 0],
    hasPin ? 15 : 2,
  );
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; OpenStreetMap contributors',
  }).addTo(map);
  if (hasPin) placePin(lat.value!, lng.value!, false);

  map.on('click', async (e: L.LeafletMouseEvent) => {
    placePin(e.latlng.lat, e.latlng.lng, false);
    fillNameIfEmpty(await reverseGeocode({ lat: e.latlng.lat, lng: e.latlng.lng }));
    emitUpdate();
  });

  document.addEventListener('keydown', onKey);
});

onBeforeUnmount(() => {
  document.removeEventListener('keydown', onKey);
  document.body.style.overflow = '';
  map?.remove();
  map = null;
  marker = null;
});

// Label edits propagate straight up (free text, no geocoding).
watch(label, emitUpdate);

// Debounced autocomplete on the search field only.
let timer: ReturnType<typeof setTimeout> | null = null;
let ctrl: AbortController | null = null;
watch(search, (q) => {
  if (timer) clearTimeout(timer);
  if (q.trim().length < 3) {
    suggestions.value = [];
    return;
  }
  timer = setTimeout(async () => {
    ctrl?.abort();
    ctrl = new AbortController();
    searching.value = true;
    try {
      suggestions.value = await searchAddress(q, ctrl.signal);
    } finally {
      searching.value = false;
    }
  }, 500);
});

function pick(p: Place): void {
  suggestions.value = [];
  search.value = p.name; // tidy the search box
  placePin(p.lat, p.lng, true);
  fillNameIfEmpty(p.name);
  emitUpdate();
}

async function useMyLocation(): Promise<void> {
  if (locating.value) return;
  locating.value = true;
  try {
    const c = await getCurrentPosition();
    if (!c) return;
    placePin(c.lat, c.lng, true);
    fillNameIfEmpty(await reverseGeocode(c));
    emitUpdate();
  } finally {
    locating.value = false;
  }
}

function clearPin(): void {
  lat.value = null;
  lng.value = null;
  marker?.remove();
  marker = null;
  emitUpdate();
}
</script>

<template>
  <div class="space-y-3">
    <!-- Display name (stored label) -->
    <div>
      <label class="label" for="ev-loc-name">Location name</label>
      <input
        id="ev-loc-name"
        v-model="label"
        class="input"
        type="text"
        placeholder="e.g. La Verdure, Home, The office"
        autocomplete="off"
      />
    </div>

    <!-- Address search → drops the pin (not stored as the label) -->
    <div>
      <label class="label" for="ev-loc-search">Find on map</label>
      <div class="relative">
        <span class="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-fg-3">
          <Search :size="16" />
        </span>
        <input
          id="ev-loc-search"
          v-model="search"
          class="input !pl-9"
          type="text"
          placeholder="Search an address or place"
          autocomplete="off"
        />
        <ul
          v-if="suggestions.length"
          class="absolute z-[1100] mt-1 max-h-60 w-full overflow-auto rounded-xl border border-line/15 bg-surface shadow-card"
        >
          <li v-for="(s, i) in suggestions" :key="i">
            <button
              type="button"
              class="block w-full px-3 py-2 text-left text-sm text-fg hover:bg-surface-2"
              @click="pick(s)"
            >
              {{ s.label }}
            </button>
          </li>
        </ul>
      </div>
    </div>

    <!-- Actions -->
    <div class="flex items-center gap-2">
      <button type="button" class="btn-ghost !py-2 text-xs" :disabled="locating" @click="useMyLocation">
        <MapPin :size="14" /> {{ locating ? 'Locating…' : 'Use my location' }}
      </button>
      <span v-if="searching" class="text-xs text-fg-3">Searching…</span>
      <button
        v-if="lat != null"
        type="button"
        class="ml-auto inline-flex items-center gap-1 text-xs font-semibold text-fg-3 hover:text-fg"
        @click="clearPin"
      >
        <X :size="12" /> Clear pin
      </button>
    </div>

    <!-- Map: tap or drag the pin to fine-tune -->
    <div :class="isFull ? 'fixed inset-0 z-[70] bg-app p-2 pt-[max(0.5rem,env(safe-area-inset-top))]' : 'relative h-52'">
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
    <p v-if="!isFull" class="text-xs text-fg-3">Tap the map or drag the pin to adjust.</p>
  </div>
</template>

<style>
.izyah-pin {
  background: transparent;
  border: none;
}
</style>
