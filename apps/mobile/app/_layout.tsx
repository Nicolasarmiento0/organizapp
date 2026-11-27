import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Platform, StyleSheet, Text, View } from 'react-native';
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
import { AppLogo } from '../src/components/brand/AppLogo';
import { clearLegacyLocalStorageData } from '../src/db/client';
import {
  hydrateWorkspaceFromCloud,
  resetCloudSyncState,
  startCloudAutoSync,
} from '../src/db/sync';
import { authClient } from '../src/services/authClient';
import { configureLocalNotifications } from '../src/services/notifications';
import { registerPwaServiceWorker } from '../src/services/webPush';
import { spacing } from '../src/theme/tokens';

// Limpieza de claves heredadas y configuración de notificaciones al iniciar
clearLegacyLocalStorageData();
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
  const [hydratedUserId, setHydratedUserId] = useState<string | null>(null);
  const segments = useSegments();
  const router = useRouter();

  const sessionUserId = session?.user?.id ?? null;

  useEffect(() => {
    if (!sessionUserId) {
      return undefined;
    }

    let cancelled = false;
    const stopAutoSync = startCloudAutoSync(sessionUserId, {
      skipInitialHydrate: true,
    });

    void hydrateWorkspaceFromCloud(sessionUserId).finally(() => {
      if (!cancelled) {
        setHydratedUserId(sessionUserId);
      }
    });

    return () => {
      cancelled = true;
      stopAutoSync();
    };
  }, [sessionUserId]);

  useEffect(() => {
    if (isPending || isRefetching) {
      return;
    }

    const inAuthGroup = segments[0] === '(auth)';

    if (!session?.user) {
      resetCloudSyncState();
      setHydratedUserId(null);
      if (!inAuthGroup) {
        router.replace('/(auth)/login');
      }
    } else if (inAuthGroup) {
      router.replace('/(tabs)');
    }
  }, [session?.user, isPending, isRefetching, segments, router]);

  const inAuthGroup = segments[0] === '(auth)';
  const showSyncOverlay =
    !inAuthGroup &&
    (isPending || !session?.user || hydratedUserId !== session.user.id);

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

        {showSyncOverlay ? (
          <View
            style={[
              StyleSheet.absoluteFill,
              styles.loadingOverlay,
              { backgroundColor: theme.canvas },
            ]}
          >
            <AppLogo size={58} />
            <ActivityIndicator size="small" color={theme.accentPrimaryLink} />
            <Text style={[styles.loadingText, { color: theme.textSecondary }]}>
              Sincronizando tu workspace...
            </Text>
          </View>
        ) : null}
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
    if (Platform.OS === 'web') {
      void registerPwaServiceWorker();
    }
  }, []);

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
  loadingOverlay: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    zIndex: 50,
  },
  loadingText: {
    fontSize: 13,
    fontWeight: '600',
  },
});
