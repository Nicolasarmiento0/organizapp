import { Platform } from 'react-native';
import { API_BASE_URL } from './authClient';
import { syncWithCloudflareD1 } from '../db/sync';

export type WebPushStatus =
  | 'unsupported'
  | 'ios_needs_install'
  | 'default'
  | 'granted'
  | 'denied'
  | 'subscribed';

export interface WebPushSnapshot {
  status: WebPushStatus;
  vapidConfigured: boolean;
  isIos: boolean;
  isStandalone: boolean;
  endpoint: string | null;
  error?: string;
}

let swListenerBound = false;

export function isIosBrowser(): boolean {
  if (Platform.OS !== 'web' || typeof window === 'undefined') {
    return false;
  }
  const ua = window.navigator?.userAgent || '';
  const isTouchMac =
    window.navigator?.platform === 'MacIntel' &&
    typeof window.navigator?.maxTouchPoints === 'number' &&
    window.navigator.maxTouchPoints > 1;
  return /iPad|iPhone|iPod/i.test(ua) || isTouchMac;
}

export function isPwaStandalone(): boolean {
  if (Platform.OS !== 'web' || typeof window === 'undefined') {
    return false;
  }
  const nav = window.navigator as Navigator & { standalone?: boolean };
  const standaloneDisplay =
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(display-mode: standalone)').matches;
  return Boolean(nav.standalone) || standaloneDisplay;
}

function isWebPushApiAvailable(): boolean {
  if (Platform.OS !== 'web' || typeof window === 'undefined') {
    return false;
  }
  return (
    'serviceWorker' in window.navigator &&
    'PushManager' in window &&
    'Notification' in window
  );
}

function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const buffer = new ArrayBuffer(rawData.length);
  const outputArray = new Uint8Array(buffer);
  for (let i = 0; i < rawData.length; i += 1) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

function arrayBufferToBase64Url(buf: ArrayBuffer | null): string {
  if (!buf) return '';
  const bytes = new Uint8Array(buf);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i += 1) {
    binary += String.fromCharCode(bytes[i]!);
  }
  return window
    .btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

async function fetchVapidConfig(): Promise<{
  configured: boolean;
  publicKey: string | null;
}> {
  try {
    const res = await fetch(`${API_BASE_URL}/api/push/vapid-public-key`, {
      credentials: 'include',
    });
    if (!res.ok) {
      return { configured: false, publicKey: null };
    }
    const data = (await res.json()) as {
      ok?: boolean;
      configured?: boolean;
      publicKey?: string | null;
    };
    return {
      configured: Boolean(data.configured && data.publicKey),
      publicKey: data.publicKey ?? null,
    };
  } catch {
    return { configured: false, publicKey: null };
  }
}

export async function registerPwaServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (Platform.OS !== 'web' || typeof window === 'undefined') {
    return null;
  }
  if (!('serviceWorker' in window.navigator)) {
    return null;
  }

  if (!swListenerBound) {
    swListenerBound = true;
    window.navigator.serviceWorker.addEventListener('message', (event) => {
      const payload = event.data as { type?: string } | null;
      if (payload?.type === 'REMINDER_ACTION_APPLIED') {
        void syncWithCloudflareD1();
      }
    });
  }

  try {
    const registration = await window.navigator.serviceWorker.register('/sw.js', {
      scope: '/',
    });
    return registration;
  } catch {
    return null;
  }
}

export async function getWebPushSnapshot(): Promise<WebPushSnapshot> {
  const ios = isIosBrowser();
  const standalone = isPwaStandalone();

  if (Platform.OS !== 'web') {
    return {
      status: 'unsupported',
      vapidConfigured: false,
      isIos: false,
      isStandalone: false,
      endpoint: null,
    };
  }

  if (ios && !standalone) {
    return {
      status: 'ios_needs_install',
      vapidConfigured: true,
      isIos: true,
      isStandalone: false,
      endpoint: null,
    };
  }

  if (!isWebPushApiAvailable()) {
    return {
      status: 'unsupported',
      vapidConfigured: false,
      isIos: ios,
      isStandalone: standalone,
      endpoint: null,
    };
  }

  const vapid = await fetchVapidConfig();

  if (window.Notification.permission === 'denied') {
    return {
      status: 'denied',
      vapidConfigured: vapid.configured,
      isIos: ios,
      isStandalone: standalone,
      endpoint: null,
    };
  }

  const reg =
    (await window.navigator.serviceWorker.getRegistration('/')) ??
    (await registerPwaServiceWorker());

  const existingSub = reg ? await reg.pushManager.getSubscription() : null;
  if (existingSub) {
    return {
      status: 'subscribed',
      vapidConfigured: vapid.configured,
      isIos: ios,
      isStandalone: standalone,
      endpoint: existingSub.endpoint,
    };
  }

  return {
    status: window.Notification.permission === 'granted' ? 'granted' : 'default',
    vapidConfigured: vapid.configured,
    isIos: ios,
    isStandalone: standalone,
    endpoint: null,
  };
}

export async function subscribeToWebPush(): Promise<WebPushSnapshot> {
  const ios = isIosBrowser();
  const standalone = isPwaStandalone();

  if (ios && !standalone) {
    return {
      status: 'ios_needs_install',
      vapidConfigured: true,
      isIos: true,
      isStandalone: false,
      endpoint: null,
      error: 'Agrega Organiza a tu pantalla de inicio primero.',
    };
  }

  if (!isWebPushApiAvailable()) {
    return {
      status: 'unsupported',
      vapidConfigured: false,
      isIos: ios,
      isStandalone: standalone,
      endpoint: null,
      error: 'Este navegador no soporta Web Push.',
    };
  }

  const permission =
    window.Notification.permission === 'granted'
      ? 'granted'
      : await window.Notification.requestPermission();

  if (permission !== 'granted') {
    return {
      status: permission === 'denied' ? 'denied' : 'default',
      vapidConfigured: true,
      isIos: ios,
      isStandalone: standalone,
      endpoint: null,
      error:
        permission === 'denied'
          ? 'Permiso bloqueado en los ajustes del navegador.'
          : 'Permiso de notificaciones cancelado.',
    };
  }

  const vapid = await fetchVapidConfig();
  if (!vapid.configured || !vapid.publicKey) {
    return {
      status: 'granted',
      vapidConfigured: false,
      isIos: ios,
      isStandalone: standalone,
      endpoint: null,
      error: 'VAPID_PUBLIC_KEY no configurada en el servidor.',
    };
  }

  const reg =
    (await registerPwaServiceWorker()) ??
    (await window.navigator.serviceWorker.ready);

  if (!reg) {
    return {
      status: 'granted',
      vapidConfigured: true,
      isIos: ios,
      isStandalone: standalone,
      endpoint: null,
      error: 'No se pudo registrar el Service Worker.',
    };
  }

  try {
    let subscription = await reg.pushManager.getSubscription();
    if (!subscription) {
      subscription = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapid.publicKey),
      });
    }

    const subJson = subscription.toJSON();
    const p256dh =
      subJson.keys?.p256dh ||
      arrayBufferToBase64Url(subscription.getKey('p256dh'));
    const authKey =
      subJson.keys?.auth || arrayBufferToBase64Url(subscription.getKey('auth'));

    const saveRes = await fetch(`${API_BASE_URL}/api/push/subscribe`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        endpoint: subscription.endpoint,
        keys: { p256dh, auth: authKey },
        userAgent: window.navigator.userAgent,
      }),
    });

    if (!saveRes.ok) {
      throw new Error(`HTTP_${saveRes.status}`);
    }

    return {
      status: 'subscribed',
      vapidConfigured: true,
      isIos: ios,
      isStandalone: standalone,
      endpoint: subscription.endpoint,
    };
  } catch (error) {
    return {
      status: 'granted',
      vapidConfigured: true,
      isIos: ios,
      isStandalone: standalone,
      endpoint: null,
      error:
        error instanceof Error
          ? `No se pudo activar push (${error.message}).`
          : 'No se pudo activar Web Push.',
    };
  }
}

export async function unsubscribeFromWebPush(): Promise<WebPushSnapshot> {
  const ios = isIosBrowser();
  const standalone = isPwaStandalone();

  if (!isWebPushApiAvailable()) {
    return getWebPushSnapshot();
  }

  try {
    const reg = await window.navigator.serviceWorker.getRegistration('/');
    const subscription = reg ? await reg.pushManager.getSubscription() : null;
    const endpoint = subscription?.endpoint;

    if (subscription) {
      await subscription.unsubscribe();
    }

    await fetch(`${API_BASE_URL}/api/push/subscribe`, {
      method: 'DELETE',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(endpoint ? { endpoint } : {}),
    });
  } catch {
    // Continuar para refrescar el estado local
  }

  return {
    status: window.Notification.permission === 'granted' ? 'granted' : 'default',
    vapidConfigured: true,
    isIos: ios,
    isStandalone: standalone,
    endpoint: null,
  };
}

export async function sendTestWebPush(): Promise<{
  ok: boolean;
  sent: number;
  error?: string;
}> {
  if (Platform.OS !== 'web') {
    return { ok: false, sent: 0, error: 'Solo disponible en Web/PWA.' };
  }
  try {
    const res = await fetch(`${API_BASE_URL}/api/push/test`, {
      method: 'POST',
      credentials: 'include',
    });
    const data = (await res.json()) as {
      ok?: boolean;
      sent?: number;
      error?: string;
    };
    if (!res.ok || !data.ok) {
      return {
        ok: false,
        sent: data.sent ?? 0,
        error: data.error || `HTTP_${res.status}`,
      };
    }
    return { ok: true, sent: data.sent ?? 1 };
  } catch (error) {
    return {
      ok: false,
      sent: 0,
      error: error instanceof Error ? error.message : 'ERROR_RED',
    };
  }
}
