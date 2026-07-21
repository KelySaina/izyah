/**
 * Notifications abstraction.
 *
 * WEB (now): the Notifications API for local notifications; Web Push wiring is
 * left as a documented extension point.
 * NATIVE (later): `@capacitor/push-notifications` + `@capacitor/local-notifications`.
 */
export function isSupported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window;
}

export async function requestPermission(): Promise<boolean> {
  if (!isSupported()) return false;
  const result = await Notification.requestPermission();
  return result === 'granted';
}

export function notify(title: string, body?: string): void {
  if (!isSupported() || Notification.permission !== 'granted') return;
  new Notification(title, { body, icon: '/icons/icon.svg' });
}

// Extension point: subscribe to Web Push. Requires a VAPID key + backend route.
export async function subscribeToPush(): Promise<PushSubscription | null> {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return null;
  // TODO(v2): const reg = await navigator.serviceWorker.ready;
  //           return reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey });
  return null;
}
