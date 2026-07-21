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
