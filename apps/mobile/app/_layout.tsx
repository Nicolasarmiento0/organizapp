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

export default function RootLayout() {
  useFonts({
    PlusJakartaSans_500Medium,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
  });

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
