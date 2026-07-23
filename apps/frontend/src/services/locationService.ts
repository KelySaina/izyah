/**
 * Location abstraction.
 *
 * WEB (now): navigator.geolocation.
 * NATIVE (later): swap to `@capacitor/geolocation` Geolocation.getCurrentPosition().
 */
export interface Coords {
  lat: number;
  lng: number;
}

export interface Place {
  /** Full address ("La Verdure, …, Madagascar") — shown in the suggestion row. */
  label: string;
  /** Short primary name ("La Verdure") — a sensible default for the label field. */
  name: string;
  lat: number;
  lng: number;
}

export async function getCurrentPosition(): Promise<Coords | null> {
  if (!('geolocation' in navigator)) return null;
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => resolve(null),
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 60_000 },
    );
  });
}

/**
 * Reverse-geocode coords to a human label via OSM Nominatim (keyless, best
 * effort). Nominatim asks for light, non-autocomplete use — this fires once,
 * only when the user taps "use my current location". Returns null on failure.
 */
export async function reverseGeocode(coords: Coords): Promise<string | null> {
  try {
    const url =
      `https://nominatim.openstreetmap.org/reverse?format=jsonv2` +
      `&lat=${coords.lat}&lon=${coords.lng}&zoom=18&addressdetails=0`;
    const res = await fetch(url, { headers: { Accept: 'application/json' } });
    if (!res.ok) return null;
    const data = (await res.json()) as { name?: string; display_name?: string };
    // Prefer the short primary name; fall back to the first address segment.
    const short = data.name?.trim() || data.display_name?.split(',')[0]?.trim();
    return short || null;
  } catch {
    return null;
  }
}

/**
 * Forward-geocode an address to candidate places (OSM Nominatim, keyless).
 * Call this DEBOUNCED (Nominatim asks for ≤1 req/s, no per-keystroke spam) and
 * pass an AbortSignal so stale in-flight lookups are cancelled. Empty on failure
 * or a too-short query.
 */
export async function searchAddress(query: string, signal?: AbortSignal): Promise<Place[]> {
  const q = query.trim();
  if (q.length < 3) return [];
  try {
    const url =
      `https://nominatim.openstreetmap.org/search?format=jsonv2` +
      `&q=${encodeURIComponent(q)}&limit=5&addressdetails=0`;
    const res = await fetch(url, { headers: { Accept: 'application/json' }, signal });
    if (!res.ok) return [];
    const data = (await res.json()) as Array<{
      name?: string;
      display_name: string;
      lat: string;
      lon: string;
    }>;
    return data.map((d) => ({
      label: d.display_name,
      name: d.name?.trim() || d.display_name.split(',')[0]!.trim(),
      lat: Number(d.lat),
      lng: Number(d.lon),
    }));
  } catch {
    return [];
  }
}
