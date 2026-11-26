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
  Cloud,
  FileText,
  LayoutGrid,
  Moon,
  Plus,
  Sun,
  UserCheck,
} from 'lucide-react-native';
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
import { authClient, resolveActiveUserId } from '../../src/services/authClient';

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
  hasSession,
}: {
  hasSession: boolean;
}) {
  const { theme, isDark, toggleTheme } = useTheme();
  const { openQuickCapture } = useQuickCapture();
  const pathname = usePathname();
  const router = useRouter();

  return (
    <View style={[styles.railColumn, { backgroundColor: theme.canvas }]}>
      {/* Monograma minimalista superior */}
      <Pressable
        onPress={() => router.push('/(tabs)')}
        style={[
          styles.brandMark,
          {
            backgroundColor: theme.card,
            borderColor: theme.glassBorder,
          },
        ]}
        accessibilityLabel="Organiza OS Dashboard"
      >
        <Text style={[styles.brandMarkLetter, { color: theme.textPrimary }]}>
          O
        </Text>
      </Pressable>

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
          const activeBg = isDark ? theme.accentVolt : theme.accentCobalt;
          const activeIconColor = isDark ? theme.accentVoltText : '#FFFFFF';

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
                  backgroundColor: isActive ? activeBg : theme.pillBg,
                },
                pressed && { opacity: 0.82, transform: [{ scale: 0.96 }] },
              ]}
            >
              <IconComp
                size={20}
                color={isActive ? activeIconColor : theme.textSecondary}
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
            { backgroundColor: theme.accentCobalt },
            pressed && { opacity: 0.86, transform: [{ scale: 0.96 }] },
          ]}
        >
          <Plus size={20} color="#FFFFFF" strokeWidth={2.2} />
        </Pressable>

        <Pressable
          onPress={toggleTheme}
          accessibilityRole="button"
          accessibilityLabel={
            isDark ? 'Cambiar a Tesla White' : 'Cambiar a Cockpit Dark'
          }
          style={({ pressed }) => [
            styles.railCircleBtn,
            { backgroundColor: theme.pillBg },
            pressed && { opacity: 0.8 },
          ]}
        >
          {isDark ? (
            <Sun size={19} color={theme.accentVolt} strokeWidth={1.85} />
          ) : (
            <Moon size={19} color={theme.textPrimary} strokeWidth={1.85} />
          )}
        </Pressable>

        <Pressable
          onPress={() => router.push('/(auth)/login')}
          accessibilityRole="button"
          accessibilityLabel="Cuenta y sincronización Cloud"
          style={({ pressed }) => [
            styles.railCircleBtn,
            { backgroundColor: theme.pillBg },
            pressed && { opacity: 0.8 },
          ]}
        >
          {hasSession ? (
            <UserCheck size={19} color={theme.success} strokeWidth={1.85} />
          ) : (
            <Cloud size={19} color={theme.textSecondary} strokeWidth={1.85} />
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
  const { theme, isDark } = useTheme();

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
          const palette = theme.modules[item.module];
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
                    { backgroundColor: theme.accentCobalt },
                    pressed && { transform: [{ scale: 0.94 }], opacity: 0.9 },
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel="Captura rápida Offline-First"
                >
                  <Plus size={20} color="#FFFFFF" strokeWidth={2.25} />
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
                      backgroundColor: isDark ? theme.accentVolt : palette.background,
                      borderColor: isDark ? theme.accentVoltBorder : palette.border,
                    },
                  ]}
                >
                  <IconComponent
                    size={18}
                    color={
                      isFocused
                        ? isDark
                          ? theme.accentVoltText
                          : palette.icon
                        : theme.textSecondary
                    }
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
      {isDesktop ? <DesktopIconRail hasSession={Boolean(session?.user)} /> : null}

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
    <QuickCaptureProvider>
      <TabsShellContent />
    </QuickCaptureProvider>
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
  brandMark: {
    width: 44,
    height: 44,
    borderRadius: radii.squircle,
    borderCurve: 'continuous',
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandMarkLetter: {
    fontSize: 19,
    fontWeight: '800',
    letterSpacing: -0.5,
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
