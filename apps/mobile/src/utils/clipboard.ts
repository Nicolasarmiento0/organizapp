import { Clipboard, Platform } from 'react-native';

/**
 * Copia texto al portapapeles de forma segura en Web (Navigator Clipboard + fallback DOM)
 * e iOS/Android sin requerir librerías nativas adicionales.
 */
export async function copyTextToClipboard(text: string): Promise<boolean> {
  if (!text) return false;

  if (Platform.OS === 'web' && typeof navigator !== 'undefined') {
    try {
      if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
        await navigator.clipboard.writeText(text);
        return true;
      }
    } catch {
      // Fallback DOM
    }

    if (typeof document !== 'undefined') {
      try {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.setAttribute('readonly', '');
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        textarea.style.pointerEvents = 'none';
        document.body.appendChild(textarea);
        textarea.focus();
        textarea.select();
        const ok = document.execCommand('copy');
        document.body.removeChild(textarea);
        return ok;
      } catch {
        return false;
      }
    }
    return false;
  }

  try {
    Clipboard.setString(text);
    return true;
  } catch {
    return false;
  }
}
