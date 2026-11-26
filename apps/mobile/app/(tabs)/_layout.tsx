import React from 'react';
import {
  Platform,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { Tabs, usePathname, useRouter } from 'expo-router';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import {
  Bell,
  Calendar,
  CheckSquare,
  FileText,
  LayoutGrid,
  Moon,
  Plus,
  Sun,
  User,
} from '../../src/components/icons';
import {
  iconMetrics,
  radii,
  shadows,
  spacing,
  type MacModuleType,
} from '../../src/theme/tokens';
import { useTheme } from '../../src/theme/ThemeContext';
import { LiquidGlassCard } from '../../src/components/glass/LiquidGlassCard';
import { QuickCaptureSheet } from '../../src/components/glass/QuickCaptureSheet';
import {
  QuickCaptureProvider,
  useQuickCapture,
} from '../../src/components/glass/QuickCaptureContext';
import {
  AccountSheetProvider,
  useAccountSheet,
} from '../../src/components/auth/AccountSheet';
import {
  authClient,
  getUserInitials,
  resolveActiveUserId,
} from '../../src/services/authClient';

interface NavModuleItem {
  routeName: string;
  href: '/(tabs)' | '/(tabs)/calendar' | '/(tabs)/reminders' | '/(tabs)/habits' | '/(tabs)/notes';
  matchPaths: string[];
  label: string;
  shortLabel: string;
  module: MacModuleType;
  icon: typeof LayoutGrid;
}

const NAV_ITEMS: readonly NavModuleItem[] = [
  {
    routeName: 'index',
    href: '/(tabs)',
    matchPaths: ['/', '/index'],
    label: 'Dashboard',
    shortLabel: 'Inicio',
    module: 'dashboard',
    icon: LayoutGrid,
  },
  {
    routeName: 'calendar',
    href: '/(tabs)/calendar',
    matchPaths: ['/calendar'],
    label: 'Calendario',
    shortLabel: 'Agenda',
    module: 'calendar',
    icon: Calendar,
  },
  {
    routeName: 'reminders',
    href: '/(tabs)/reminders',
    matchPaths: ['/reminders'],
    label: 'Recordatorios',
    shortLabel: 'Avisos',
    module: 'reminders',
    icon: Bell,
  },
  {
    routeName: 'habits',
    href: '/(tabs)/habits',
    matchPaths: ['/habits'],
    label: 'Hábitos',
    shortLabel: 'Hábitos',
    module: 'habits',
    icon: CheckSquare,
  },
  {
    routeName: 'notes',
    href: '/(tabs)/notes',
    matchPaths: ['/notes'],
    label: 'Notas',
    shortLabel: 'Notas',
    module: 'notes',
    icon: FileText,
  },
];

function DesktopIconRail({
  userName,
  userEmail,
  hasSession,
}: {
  userName?: string | null;
  userEmail?: string | null;
  hasSession: boolean;
}) {
  const { theme, isDark, toggleTheme } = useTheme();
  const { openQuickCapture } = useQuickCapture();
  const { openAccountSheet } = useAccountSheet();
  const pathname = usePathname();
  const router = useRouter();
  const initials = getUserInitials(userName, userEmail);

  return (
    <View style={[styles.railColumn, { backgroundColor: theme.canvas }]}>
      {/* Cápsula vertical principal con botones circulares */}
      <View
        style={[
          styles.railCapsule,
          {
            backgroundColor: theme.railBg,
            borderColor: theme.glassBorder,
          },
          shadows.floatingDock,
        ]}
      >
        {NAV_ITEMS.map((item) => {
          const isActive = item.matchPaths.includes(pathname);
          const IconComp = item.icon;

          return (
            <Pressable
              key={item.routeName}
              onPress={() => router.push(item.href)}
              accessibilityRole="tab"
              accessibilityLabel={item.label}
              accessibilityState={{ selected: isActive }}
              style={({ pressed }) => [
                styles.railCircleBtn,
                {
                  backgroundColor: isActive ? theme.accentPrimary : theme.pillBg,
                },
                pressed && { opacity: 0.82, transform: [{ scale: 0.96 }] },
              ]}
            >
              <IconComp
                size={20}
                color={isActive ? theme.accentPrimaryText : theme.textSecondary}
                strokeWidth={isActive ? 2.1 : iconMetrics.strokeWidth}
              />
            </Pressable>
          );
        })}
      </View>

      {/* Cápsula inferior de utilidades */}
      <View
        style={[
          styles.railCapsule,
          {
            backgroundColor: theme.railBg,
            borderColor: theme.glassBorder,
          },
          shadows.subtle,
        ]}
      >
        <Pressable
          onPress={() => openQuickCapture('task')}
          accessibilityRole="button"
          accessibilityLabel="Captura rápida"
          style={({ pressed }) => [
            styles.railCircleBtn,
            { backgroundColor: theme.accentVolt },
            pressed && { opacity: 0.86, transform: [{ scale: 0.96 }] },
          ]}
        >
          <Plus size={20} color={theme.accentVoltText} strokeWidth={2.2} />
        </Pressable>

        <Pressable
          onPress={toggleTheme}
          accessibilityRole="button"
          accessibilityLabel={
            isDark ? 'Cambiar a Titanium Light' : 'Cambiar a Titanium Dark'
          }
          style={({ pressed }) => [
            styles.railCircleBtn,
            { backgroundColor: theme.pillBg },
            pressed && { opacity: 0.8 },
          ]}
        >
          {isDark ? (
            <Sun size={19} color={theme.textPrimary} strokeWidth={1.85} />
          ) : (
            <Moon size={19} color={theme.textPrimary} strokeWidth={1.85} />
          )}
        </Pressable>

        <Pressable
          onPress={openAccountSheet}
          accessibilityRole="button"
          accessibilityLabel="Cuenta y sincronización Cloud"
          style={({ pressed }) => [
            styles.railCircleBtn,
            {
              backgroundColor: hasSession ? theme.accentPrimarySoft : theme.pillBg,
              borderWidth: hasSession ? 1 : 0,
              borderColor: theme.accentPrimaryBorder,
            },
            pressed && { opacity: 0.8 },
          ]}
        >
          {hasSession ? (
            <Text style={[styles.railInitials, { color: theme.accentPrimaryLink }]}>
              {initials}
            </Text>
          ) : (
            <User size={19} color={theme.textSecondary} strokeWidth={1.85} />
          )}
        </Pressable>
      </View>
    </View>
  );
}

function FloatingLiquidGlassDock({
  state,
  navigation,
  onOpenQuickCapture,
}: BottomTabBarProps & { onOpenQuickCapture: () => void }) {
  const { theme } = useTheme();

  return (
    <View style={styles.dockWrapper} pointerEvents="box-none">
      <LiquidGlassCard
        variant="floating"
        intensity={82}
        noPadding
        style={styles.dockCard}
        contentStyle={styles.dockContent}
      >
        {NAV_ITEMS.map((item, idx) => {
          const routeIndex = state.routes.findIndex((r) => r.name === item.routeName);
          const isFocused = state.index === routeIndex;
          const IconComponent = item.icon;

          const handlePress = () => {
            const route = state.routes[routeIndex];
            if (!route) return;
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });
            if (!isFocused && !event.defaultPrevented) {
              navigation.navigate(route.name);
            }
          };

          return (
            <React.Fragment key={item.routeName}>
              {idx === 2 && (
                <Pressable
                  onPress={onOpenQuickCapture}
                  style={({ pressed }) => [
                    styles.mobileQuickCaptureBtn,
                    { backgroundColor: theme.accentVolt },
                    pressed && { transform: [{ scale: 0.94 }], opacity: 0.9 },
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel="Captura rápida Offline-First"
                >
                  <Plus size={20} color={theme.accentVoltText} strokeWidth={2.25} />
                </Pressable>
              )}

              <Pressable
                onPress={handlePress}
                style={styles.tabButton}
                accessibilityRole="tab"
                accessibilityState={{ selected: isFocused }}
              >
                <View
                  style={[
                    styles.iconSquircle,
                    isFocused && {
                      backgroundColor: theme.accentPrimary,
                      borderColor: theme.accentPrimaryBorder,
                    },
                  ]}
                >
                  <IconComponent
                    size={18}
                    color={isFocused ? theme.accentPrimaryText : theme.textSecondary}
                    strokeWidth={iconMetrics.strokeWidth}
                  />
                </View>
                <Text
                  style={[
                    styles.tabLabel,
                    { color: isFocused ? theme.textPrimary : theme.textSecondary },
                    isFocused && { fontWeight: '700' },
                  ]}
                  numberOfLines={1}
                >
                  {item.shortLabel}
                </Text>
              </Pressable>
            </React.Fragment>
          );
        })}
      </LiquidGlassCard>
    </View>
  );
}

function TabsShellContent() {
  const { width } = useWindowDimensions();
  const isDesktop = width >= 860;
  const { theme } = useTheme();
  const { isOpen, initialMode, openQuickCapture, closeQuickCapture } =
    useQuickCapture();
  const { data: session } = authClient.useSession();
  const activeUserId = resolveActiveUserId(session?.user?.id);

  return (
    <View
      style={[
        styles.shellContainer,
        {
          backgroundColor: theme.canvas,
          flexDirection: isDesktop ? 'row' : 'column',
        },
      ]}
    >
      {isDesktop ? (
        <DesktopIconRail
          userName={session?.user?.name}
          userEmail={session?.user?.email}
          hasSession={Boolean(session?.user)}
        />
      ) : null}

      <View style={styles.mainStage}>
        <Tabs
          screenOptions={{
            headerShown: false,
            sceneStyle: { backgroundColor: theme.canvas },
          }}
          tabBar={(props) =>
            isDesktop ? null : (
              <FloatingLiquidGlassDock
                {...props}
                onOpenQuickCapture={() => openQuickCapture('task')}
              />
            )
          }
        >
          <Tabs.Screen name="index" options={{ title: 'Dashboard' }} />
          <Tabs.Screen name="calendar" options={{ title: 'Calendario' }} />
          <Tabs.Screen name="reminders" options={{ title: 'Recordatorios' }} />
          <Tabs.Screen name="habits" options={{ title: 'Hábitos' }} />
          <Tabs.Screen name="notes" options={{ title: 'Notas' }} />
        </Tabs>
      </View>

      <QuickCaptureSheet
        visible={isOpen}
        onClose={closeQuickCapture}
        userId={activeUserId}
        initialMode={initialMode}
      />
    </View>
  );
}

export default function TabsLayout() {
  return (
    <AccountSheetProvider>
      <QuickCaptureProvider>
        <TabsShellContent />
      </QuickCaptureProvider>
    </AccountSheetProvider>
  );
}

const styles = StyleSheet.create({
  shellContainer: {
    flex: 1,
  },
  mainStage: {
    flex: 1,
  },
  railColumn: {
    width: 84,
    paddingVertical: 20,
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  railCapsule: {
    borderRadius: 999,
    borderWidth: 1,
    padding: 8,
    gap: 10,
    alignItems: 'center',
  },
  railCircleBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  railInitials: {
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  dockWrapper: {
    position: 'absolute',
    left: spacing.sm,
    right: spacing.sm,
    bottom: Platform.OS === 'ios' ? 24 : 14,
    alignItems: 'center',
  },
  dockCard: {
    width: '100%',
    maxWidth: 460,
    borderRadius: radii.xl,
  },
  dockContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.sm,
    paddingVertical: 8,
    gap: 2,
  },
  tabButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
  },
  iconSquircle: {
    width: 34,
    height: 30,
    borderRadius: 10,
    borderCurve: 'continuous',
    borderWidth: 1,
    borderColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabLabel: {
    fontSize: 10,
    fontWeight: '500',
    letterSpacing: -0.1,
  },
  mobileQuickCaptureBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 4,
    ...shadows.floatingDock,
  },
});
