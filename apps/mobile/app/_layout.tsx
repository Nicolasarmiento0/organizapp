import React, { useEffect, useState } from 'react';
import { StyleSheet } from 'react-native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
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

function RootNavigator() {
  const { theme } = useTheme();
  const { data: session, isPending } = authClient.useSession();
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
    if (!isGuestPrefLoaded || (isPending && !isOfflineGuest)) {
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
