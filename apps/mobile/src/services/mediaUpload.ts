import { Platform } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import { API_BASE_URL, authClient } from './authClient';

export interface CompressedImagePayload {
  dataUrl: string;
  base64: string;
  contentType: 'image/webp' | 'image/jpeg';
  width: number;
  height: number;
  sizeBytes: number;
}

export interface UploadedMediaResult {
  url: string;
  key: string;
  sizeBytes: number;
  uploadedToR2: boolean;
}

const TARGET_MAX_EDGE = 1280;
const TARGET_MAX_BYTES = 85 * 1024; // Objetivo ~80 KB WebP
const QUALITY_STEPS = [0.78, 0.64, 0.5, 0.38, 0.28];

function estimateBase64Bytes(base64: string): number {
  return Math.floor((base64.length * 3) / 4);
}

function loadHtmlImageFromBlob(blob: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(img);
    };
    img.onerror = (err) => {
      URL.revokeObjectURL(objectUrl);
      reject(err);
    };
    img.src = objectUrl;
  });
}

function canvasToDataUrl(
  canvas: HTMLCanvasElement,
  mime: 'image/webp' | 'image/jpeg',
  quality: number
): string {
  return canvas.toDataURL(mime, quality);
}

/**
 * Comprime una imagen en Web a WebP (~80 KB, máx. 1280px) usando Canvas nativo.
 */
export async function compressWebImageFile(
  file: Blob
): Promise<CompressedImagePayload> {
  if (typeof document === 'undefined') {
    throw new Error('DOM Canvas no disponible');
  }

  const img = await loadHtmlImageFromBlob(file);
  const srcWidth = img.naturalWidth || img.width || 1280;
  const srcHeight = img.naturalHeight || img.height || 720;
  const longest = Math.max(srcWidth, srcHeight);
  const scale = longest > TARGET_MAX_EDGE ? TARGET_MAX_EDGE / longest : 1;

  let width = Math.max(1, Math.round(srcWidth * scale));
  let height = Math.max(1, Math.round(srcHeight * scale));

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Contexto Canvas 2D no disponible');
  }
  ctx.drawImage(img, 0, 0, width, height);

  let bestDataUrl = '';
  let bestType: 'image/webp' | 'image/jpeg' = 'image/webp';
  let bestSize = Infinity;

  for (const quality of QUALITY_STEPS) {
    let dataUrl = canvasToDataUrl(canvas, 'image/webp', quality);
    let contentType: 'image/webp' | 'image/jpeg' = 'image/webp';
    if (!dataUrl.startsWith('data:image/webp')) {
      dataUrl = canvasToDataUrl(canvas, 'image/jpeg', quality);
      contentType = 'image/jpeg';
    }
    const base64 = dataUrl.split(',')[1] ?? '';
    const sizeBytes = estimateBase64Bytes(base64);

    bestDataUrl = dataUrl;
    bestType = contentType;
    bestSize = sizeBytes;

    if (sizeBytes <= TARGET_MAX_BYTES) {
      break;
    }
  }

  // Último paso: si una imagen muy densa supera 85 KB, reduce escala un 25% adicional
  if (bestSize > TARGET_MAX_BYTES && Math.max(width, height) > 720) {
    width = Math.max(1, Math.round(width * 0.75));
    height = Math.max(1, Math.round(height * 0.75));
    canvas.width = width;
    canvas.height = height;
    ctx.drawImage(img, 0, 0, width, height);

    const retryUrl = canvasToDataUrl(canvas, bestType, 0.35);
    const retryBase64 = retryUrl.split(',')[1] ?? '';
    const retrySize = estimateBase64Bytes(retryBase64);
    if (retrySize < bestSize) {
      bestDataUrl = retryUrl;
      bestSize = retrySize;
    }
  }

  const finalBase64 = bestDataUrl.split(',')[1] ?? '';
  return {
    dataUrl: bestDataUrl,
    base64: finalBase64,
    contentType: bestType,
    width,
    height,
    sizeBytes: bestSize,
  };
}

function pickWebImageBlob(): Promise<File | null> {
  return new Promise((resolve) => {
    if (typeof document === 'undefined') {
      resolve(null);
      return;
    }
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.style.display = 'none';

    let settled = false;
    const finalize = (file: File | null) => {
      if (settled) return;
      settled = true;
      if (input.parentNode) input.parentNode.removeChild(input);
      resolve(file);
    };

    input.onchange = () => {
      finalize(input.files?.[0] ?? null);
    };
    input.oncancel = () => {
      finalize(null);
    };

    document.body.appendChild(input);
    input.click();
  });
}

/**
 * Selecciona una imagen (Galería o Cámara) y la comprime localmente a WebP (~80 KB).
 */
export async function pickAndCompressImage(
  source: 'gallery' | 'camera' = 'gallery'
): Promise<CompressedImagePayload | null> {
  if (Platform.OS === 'web') {
    const file = await pickWebImageBlob();
    if (!file) return null;
    return compressWebImageFile(file);
  }

  if (source === 'camera') {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) return null;
  } else {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return null;
  }

  const pickerResult =
    source === 'camera'
      ? await ImagePicker.launchCameraAsync({
          mediaTypes: ['images'],
          quality: 0.9,
          exif: false,
        })
      : await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ['images'],
          quality: 0.9,
          exif: false,
        });

  if (pickerResult.canceled || !pickerResult.assets?.[0]) {
    return null;
  }

  const asset = pickerResult.assets[0];
  const srcWidth = asset.width || TARGET_MAX_EDGE;
  const srcHeight = asset.height || TARGET_MAX_EDGE;
  const resizeAction =
    Math.max(srcWidth, srcHeight) > TARGET_MAX_EDGE
      ? srcWidth >= srcHeight
        ? [{ resize: { width: TARGET_MAX_EDGE } }]
        : [{ resize: { height: TARGET_MAX_EDGE } }]
      : [];

  let bestPayload: CompressedImagePayload | null = null;

  for (const quality of QUALITY_STEPS) {
    const result = await manipulateAsync(asset.uri, resizeAction, {
      compress: quality,
      format: SaveFormat.WEBP,
      base64: true,
    });

    const base64 = result.base64 ?? '';
    const sizeBytes = estimateBase64Bytes(base64);
    bestPayload = {
      dataUrl: `data:image/webp;base64,${base64}`,
      base64,
      contentType: 'image/webp',
      width: result.width,
      height: result.height,
      sizeBytes,
    };

    if (sizeBytes <= TARGET_MAX_BYTES) {
      break;
    }
  }

  return bestPayload;
}

/**
 * Sube una imagen ya comprimida (~80 KB WebP) al Worker de Cloudflare R2 (`POST /api/media/upload`).
 * Si el usuario está Offline o en modo Invitado sin sesión, conserva la copia local (`dataUrl`).
 */
export async function uploadCompressedImageToR2(
  payload: Pick<CompressedImagePayload, 'dataUrl' | 'base64' | 'contentType' | 'sizeBytes'>
): Promise<UploadedMediaResult> {
  try {
    const maybeExpoClient = authClient as unknown as {
      getCookie?: () => Promise<string> | string;
    };
    const cookieHeader =
      Platform.OS !== 'web' && typeof maybeExpoClient.getCookie === 'function'
        ? await maybeExpoClient.getCookie()
        : '';

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (cookieHeader) {
      headers.Cookie = cookieHeader;
    }

    const response = await fetch(`${API_BASE_URL}/api/media/upload`, {
      method: 'POST',
      headers,
      credentials: 'include',
      body: JSON.stringify({
        base64: payload.base64,
        contentType: payload.contentType,
      }),
    });

    if (!response.ok) {
      return {
        url: payload.dataUrl,
        key: '',
        sizeBytes: payload.sizeBytes,
        uploadedToR2: false,
      };
    }

    const data = (await response.json()) as {
      ok?: boolean;
      key?: string;
      url?: string;
      sizeBytes?: number;
    };

    if (data?.ok && data.url) {
      const fullUrl = data.url.startsWith('http')
        ? data.url
        : `${API_BASE_URL}${data.url}`;
      return {
        url: fullUrl,
        key: data.key ?? '',
        sizeBytes: data.sizeBytes ?? payload.sizeBytes,
        uploadedToR2: true,
      };
    }
  } catch {
    // Fallback automático offline
  }

  return {
    url: payload.dataUrl,
    key: '',
    sizeBytes: payload.sizeBytes,
    uploadedToR2: false,
  };
}
