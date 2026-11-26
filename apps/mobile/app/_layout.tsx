import React, { useEffect, useState } from 'react';
import { Platform, StyleSheet } from 'react-native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import {
  useFonts,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
} from '@expo-google-fonts/plus-jakarta-sans';
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
} from '@expo-google-fonts/inter';
import { ThemeProvider, useTheme } from '../src/theme/ThemeContext';
import { initializeLocalDatabase } from '../src/db/client';
import { claimLocalRecordsForUser, syncWithCloudflareD1 } from '../src/db/sync';
import {
  authClient,
  getOfflineGuestPreferenceSync,
  loadOfflineGuestPreference,
  subscribeOfflineGuestPreference,
} from '../src/services/authClient';
import { configureLocalNotifications } from '../src/services/notifications';

// Inicialización síncrona en 0 ms antes del primer frame de UI
initializeLocalDatabase('local-user');
configureLocalNotifications();

// Elimina el borde/anillo azul nativo del navegador en Web al enfocar inputs de texto
if (Platform.OS === 'web' && typeof document !== 'undefined') {
  const styleId = 'organiza-web-input-reset';
  if (!document.getElementById(styleId)) {
    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = `
      input, textarea, [contenteditable="true"],
      input:focus, textarea:focus, [contenteditable="true"]:focus,
      input:focus-visible, textarea:focus-visible, [contenteditable="true"]:focus-visible {
        outline: none !important;
        outline-width: 0 !important;
        box-shadow: none !important;
      }
    `;
    document.head.appendChild(style);
  }
}

function RootNavigator() {
  const { theme } = useTheme();
  const { data: session, isPending, isRefetching } = authClient.useSession();
  const [isGuestPrefLoaded, setIsGuestPrefLoaded] = useState(false);
  const [isOfflineGuest, setIsOfflineGuest] = useState<boolean>(() =>
    getOfflineGuestPreferenceSync()
  );
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    let mounted = true;
    void loadOfflineGuestPreference().then((enabled) => {
      if (mounted) {
        setIsOfflineGuest(enabled);
        setIsGuestPrefLoaded(true);
      }
    });
    const unsubscribe = subscribeOfflineGuestPreference(setIsOfflineGuest);
    return () => {
      mounted = false;
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (session?.user?.id) {
      claimLocalRecordsForUser(session.user.id);
      void syncWithCloudflareD1();
    }
  }, [session?.user?.id]);

  useEffect(() => {
    if (!isGuestPrefLoaded || ((isPending || isRefetching) && !isOfflineGuest)) {
      return;
    }

    const inAuthGroup = segments[0] === '(auth)';
    const hasAccess = Boolean(session?.user) || isOfflineGuest;

    if (!hasAccess && !inAuthGroup) {
      router.replace('/(auth)/login');
    } else if (Boolean(session?.user) && inAuthGroup) {
      router.replace('/(tabs)');
    }
  }, [
    session?.user,
    isOfflineGuest,
    isGuestPrefLoaded,
    isPending,
    isRefetching,
    segments,
    router,
  ]);

  return (
    <GestureHandlerRootView style={[styles.root, { backgroundColor: theme.canvas }]}>
      <SafeAreaProvider>
        <StatusBar style={theme.statusBarStyle} backgroundColor={theme.canvas} />
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: theme.canvas },
            animation: 'fade',
          }}
        >
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen
            name="(auth)/login"
            options={{
              headerShown: false,
              presentation: 'modal',
            }}
          />
        </Stack>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const INTER_WEIGHT_MAP: Array<{ name: string; weight: number }> = [
  { name: 'Inter_400Regular', weight: 400 },
  { name: 'Inter_500Medium', weight: 500 },
  { name: 'Inter_600SemiBold', weight: 600 },
  { name: 'Inter_700Bold', weight: 700 },
  { name: 'Inter_700Bold', weight: 800 },
];

function resolveExpoFontUrls(names: string[]): Record<string, string> {
  const urls: Record<string, string> = {};
  if (typeof document === 'undefined') return urls;
  const styleEl = document.getElementById('expo-generated-fonts');
  if (!(styleEl instanceof HTMLStyleElement)) return urls;

  const targetSet = new Set(names);
  try {
    const rules = styleEl.sheet?.cssRules;
    if (rules) {
      for (let i = 0; i < rules.length; i += 1) {
        const rule = rules[i];
        if (rule instanceof CSSFontFaceRule) {
          const family = rule.style.fontFamily.replace(/['"]/g, '').trim();
          const src = rule.style.getPropertyValue('src') || rule.cssText;
          const match = src.match(/url\(([^)]+)\)/);
          if (targetSet.has(family) && match?.[1]) {
            urls[family] = match[1].replace(/['"]/g, '');
          }
        }
      }
    }
  } catch {
    // Fallback al contenido textual del style tag
  }

  if (Object.keys(urls).length === 0 && styleEl.textContent) {
    const regex = /@font-face\s*\{[^}]*font-family:\s*['"]?([^;'"}]+)['"]?[^}]*src:\s*url\(([^)]+)\)/gi;
    let m: RegExpExecArray | null = regex.exec(styleEl.textContent);
    while (m) {
      const family = (m[1] ?? '').trim();
      const url = (m[2] ?? '').replace(/['"]/g, '').trim();
      if (targetSet.has(family) && url) {
        urls[family] = url;
      }
      m = regex.exec(styleEl.textContent);
    }
  }

  return urls;
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    PlusJakartaSans_500Medium,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  useEffect(() => {
    if (Platform.OS !== 'web' || !fontsLoaded || typeof document === 'undefined') {
      return;
    }

    const fontUrls = resolveExpoFontUrls([
      'Inter_400Regular',
      'Inter_500Medium',
      'Inter_600SemiBold',
      'Inter_700Bold',
    ]);

    const fontFacesCss = INTER_WEIGHT_MAP.map(({ name, weight }) => {
      const url = fontUrls[name];
      if (!url) return '';
      return `@font-face { font-family: 'OrganizaInter'; src: url('${url}'); font-weight: ${weight}; font-style: normal; font-display: swap; }`;
    })
      .filter(Boolean)
      .join('\n');

    const styleId = 'organiza-web-typography';
    let styleEl = document.getElementById(styleId) as HTMLStyleElement | null;
    if (!styleEl) {
      styleEl = document.createElement('style');
      styleEl.id = styleId;
      document.head.appendChild(styleEl);
    }

    styleEl.textContent = `
      ${fontFacesCss}
      html, body, #root {
        font-family: 'OrganizaInter', -apple-system, BlinkMacSystemFont, sans-serif;
        -webkit-font-smoothing: antialiased;
        -moz-osx-font-smoothing: grayscale;
        font-feature-settings: "cv02", "cv03", "cv04", "cv11";
      }
      [class*="css-text-"]:not([class*="r-fontFamily-"]),
      [class*="css-textinput-"]:not([class*="r-fontFamily-"]),
      input:not([class*="r-fontFamily-"]):not([style*="font-family"]),
      textarea:not([class*="r-fontFamily-"]):not([style*="font-family"]) {
        font-family: 'OrganizaInter', -apple-system, BlinkMacSystemFont, sans-serif;
        letter-spacing: -0.012em;
      }
    `;
  }, [fontsLoaded]);

  return (
    <ThemeProvider>
      <RootNavigator />
    </ThemeProvider>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
});
