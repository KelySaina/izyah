/**
 * Notifications abstraction.
 *
 * WEB (now): the Notifications API for local notifications, plus Web Push so
 * RSVP/waitlist/task alerts still arrive while the app is closed.
 * NATIVE (later): `@capacitor/push-notifications` + `@capacitor/local-notifications`.
 */
import { api } from './api';

export function isSupported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window;
}

export function isPushSupported(): boolean {
  return isSupported() && 'serviceWorker' in navigator && 'PushManager' in window;
}

export async function requestPermission(): Promise<boolean> {
  if (!isSupported()) return false;
  const result = await Notification.requestPermission();
  return result === 'granted';
}

export function notify(title: string, body?: string): void {
  if (!isSupported() || Notification.permission !== 'granted') return;
  new Notification(title, { body, icon: '/icons/icon-192.png' });
}

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const base64Safe = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64Safe);
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

/** Current subscription for this browser/device, if any. */
export async function getPushSubscription(): Promise<PushSubscription | null> {
  if (!isPushSupported()) return null;
  const reg = await navigator.serviceWorker.ready;
  return reg.pushManager.getSubscription();
}

/** Subscribes this device to Web Push and registers it with the backend.
 *  Returns null if unsupported, permission is denied, or no VAPID key is
 *  configured server-side. */
export async function subscribeToPush(): Promise<PushSubscription | null> {
  if (!isPushSupported()) return null;

  const { key } = await api.notifications.vapidPublicKey();
  if (!key) return null;

  const reg = await navigator.serviceWorker.ready;
  const existing = await reg.pushManager.getSubscription();
  const subscription =
    existing ??
    (await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(key) as BufferSource,
    }));

  await api.notifications.subscribePush(subscription.toJSON() as PushSubscriptionJSON);
  return subscription;
}

export async function unsubscribeFromPush(): Promise<void> {
  const subscription = await getPushSubscription();
  if (!subscription) return;
  await api.notifications.unsubscribePush(subscription.endpoint);
  await subscription.unsubscribe();
}
