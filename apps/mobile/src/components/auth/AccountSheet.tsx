import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import {
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import {
  Cloud,
  Database,
  LogIn,
  LogOut,
  Moon,
  RefreshCw,
  Sun,
  X,
} from 'lucide-react-native';
import { iconMetrics, radii, shadows, spacing } from '../../theme/tokens';
import { useTheme } from '../../theme/ThemeContext';
import { LiquidGlassCard } from '../glass/LiquidGlassCard';
import {
  authClient,
  getUserInitials,
  signOutAndReset,
} from '../../services/authClient';
import {
  subscribeSyncStatus,
  syncWithCloudflareD1,
  type SyncStatusSnapshot,
} from '../../db/sync';

interface AccountSheetContextValue {
  openAccountSheet: () => void;
  closeAccountSheet: () => void;
}

const AccountSheetContext = createContext<AccountSheetContextValue>({
  openAccountSheet: () => {},
  closeAccountSheet: () => {},
});

export function useAccountSheet(): AccountSheetContextValue {
  return useContext(AccountSheetContext);
}

function formatLastSyncLabel(timestamp: number): string {
  if (!timestamp) return 'Sin sincronización reciente';
  try {
    const time = new Date(timestamp).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    });
    return `Último sync ${time}`;
  } catch {
    return 'Sincronizado';
  }
}

export const AccountSheet: React.FC<{
  visible: boolean;
  onClose: () => void;
}> = ({ visible, onClose }) => {
  const { theme, isDark, toggleTheme } = useTheme();
  const router = useRouter();
  const { data: session } = authClient.useSession();
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [syncState, setSyncState] = useState<SyncStatusSnapshot>({
    status: 'idle',
    lastSyncedAt: 0,
    dirtyCount: 0,
    lastError: null,
  });

  useEffect(() => {
    return subscribeSyncStatus(setSyncState);
  }, []);

  const user = session?.user;
  const initials = getUserInitials(user?.name, user?.email);

  const handleSyncNow = async () => {
    await syncWithCloudflareD1();
  };

  const handleGoToLogin = () => {
    onClose();
    router.push('/(auth)/login');
  };

  const handleSignOut = async () => {
    setIsSigningOut(true);
    await signOutAndReset();
    setIsSigningOut(false);
    onClose();
    router.replace('/(auth)/login');
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View
        style={[
          styles.backdrop,
          {
            backgroundColor: isDark
              ? 'rgba(5, 7, 10, 0.72)'
              : 'rgba(15, 17, 21, 0.28)',
          },
        ]}
      >
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />

        <LiquidGlassCard
          variant="floating"
          intensity={85}
          style={styles.sheetContainer}
          contentStyle={styles.sheetContent}
        >
          {/* Header */}
          <View style={styles.headerRow}>
            <Text style={[styles.headerTitle, { color: theme.textPrimary }]}>
              Cuenta & Sincronización
            </Text>
            <Pressable
              onPress={onClose}
              style={[styles.closeButton, { backgroundColor: theme.pillBg }]}
              hitSlop={10}
            >
              <X
                size={17}
                color={theme.textSecondary}
                strokeWidth={iconMetrics.strokeWidth}
              />
            </Pressable>
          </View>

          {user ? (
            <>
              {/* Perfil autenticado */}
              <View
                style={[
                  styles.profileCard,
                  {
                    backgroundColor: theme.cardElevated,
                    borderColor: theme.glassBorder,
                  },
                ]}
              >
                <View
                  style={[
                    styles.avatarCircle,
                    { backgroundColor: theme.accentVolt },
                  ]}
                >
                  <Text
                    style={[
                      styles.avatarInitials,
                      { color: theme.accentVoltText },
                    ]}
                  >
                    {initials}
                  </Text>
                </View>

                <View style={styles.profileInfo}>
                  <Text
                    style={[styles.profileName, { color: theme.textPrimary }]}
                    numberOfLines={1}
                  >
                    {user.name || 'Usuario Organiza'}
                  </Text>
                  <Text
                    style={[styles.profileEmail, { color: theme.textSecondary }]}
                    numberOfLines={1}
                  >
                    {user.email}
                  </Text>
                </View>

                <View
                  style={[
                    styles.cloudBadge,
                    {
                      backgroundColor: theme.successSoft,
                      borderColor: theme.glassBorder,
                    },
                  ]}
                >
                  <Cloud size={12} color={theme.success} strokeWidth={2} />
                  <Text style={[styles.cloudBadgeText, { color: theme.success }]}>
                    D1 Cloud
                  </Text>
                </View>
              </View>

              {/* Estado de sincronización */}
              <View
                style={[
                  styles.infoRowCard,
                  {
                    backgroundColor: theme.inputBg,
                    borderColor: theme.glassBorder,
                  },
                ]}
              >
                <View style={styles.syncTextCol}>
                  <Text style={[styles.infoTitle, { color: theme.textPrimary }]}>
                    {syncState.status === 'syncing'
                      ? 'Sincronizando cambios...'
                      : formatLastSyncLabel(syncState.lastSyncedAt)}
                  </Text>
                  <Text style={[styles.infoSub, { color: theme.textSecondary }]}>
                    {syncState.dirtyCount > 0
                      ? `${syncState.dirtyCount} cambios locales pendientes`
                      : 'Todo respaldado en Cloudflare D1'}
                  </Text>
                </View>
                <Pressable
                  onPress={() => void handleSyncNow()}
                  style={[
                    styles.syncBtn,
                    {
                      backgroundColor: theme.pillBg,
                      borderColor: theme.glassBorder,
                    },
                  ]}
                >
                  <RefreshCw
                    size={14}
                    color={theme.textPrimary}
                    strokeWidth={2}
                  />
                  <Text style={[styles.syncBtnText, { color: theme.textPrimary }]}>
                    Sincronizar
                  </Text>
                </Pressable>
              </View>
            </>
          ) : (
            <View
              style={[
                styles.localModeBox,
                {
                  backgroundColor: theme.cardElevated,
                  borderColor: theme.glassBorder,
                },
              ]}
            >
              <View style={styles.localModeHeader}>
                <View
                  style={[
                    styles.localBadgeIcon,
                    { backgroundColor: theme.pillBg },
                  ]}
                >
                  <Database size={18} color={theme.textPrimary} strokeWidth={1.8} />
                </View>
                <View style={styles.localTextCol}>
                  <Text style={[styles.profileName, { color: theme.textPrimary }]}>
                    Modo Local (Sin cuenta)
                  </Text>
                  <Text style={[styles.infoSub, { color: theme.textSecondary }]}>
                    Tus datos viven en SQLite local (0 ms). Inicia sesión para
                    sincronizar entre dispositivos.
                  </Text>
                </View>
              </View>

              <Pressable
                onPress={handleGoToLogin}
                style={({ pressed }) => [
                  styles.primaryBtn,
                  { backgroundColor: theme.accentVolt },
                  pressed && { opacity: 0.88 },
                ]}
              >
                <LogIn size={16} color={theme.accentVoltText} strokeWidth={2.1} />
                <Text
                  style={[
                    styles.primaryBtnText,
                    { color: theme.accentVoltText },
                  ]}
                >
                  Iniciar sesión / Crear cuenta
                </Text>
              </Pressable>
            </View>
          )}

          {/* Toggle rápido de tema */}
          <Pressable
            onPress={toggleTheme}
            style={[
              styles.themeToggleRow,
              {
                backgroundColor: theme.inputBg,
                borderColor: theme.glassBorder,
              },
            ]}
          >
            <View style={styles.themeToggleLeft}>
              {isDark ? (
                <Moon size={16} color={theme.textPrimary} strokeWidth={1.9} />
              ) : (
                <Sun size={16} color={theme.textPrimary} strokeWidth={1.9} />
              )}
              <Text style={[styles.themeToggleText, { color: theme.textPrimary }]}>
                Apariencia: {isDark ? 'Titanium Dark' : 'Titanium Light'}
              </Text>
            </View>
            <Text style={[styles.themeToggleAction, { color: theme.textSecondary }]}>
              Cambiar
            </Text>
          </Pressable>

          {user ? (
            <Pressable
              onPress={() => void handleSignOut()}
              disabled={isSigningOut}
              style={({ pressed }) => [
                styles.signOutBtn,
                {
                  backgroundColor: theme.dangerSoft,
                  borderColor: theme.glassBorder,
                },
                pressed && { opacity: 0.85 },
              ]}
            >
              <LogOut size={16} color={theme.danger} strokeWidth={2} />
              <Text style={[styles.signOutText, { color: theme.danger }]}>
                {isSigningOut ? 'Cerrando sesión...' : 'Cerrar sesión'}
              </Text>
            </Pressable>
          ) : null}
        </LiquidGlassCard>
      </View>
    </Modal>
  );
};

export const AccountSheetProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [visible, setVisible] = useState(false);

  const openAccountSheet = useCallback(() => setVisible(true), []);
  const closeAccountSheet = useCallback(() => setVisible(false), []);

  return (
    <AccountSheetContext.Provider value={{ openAccountSheet, closeAccountSheet }}>
      {children}
      <AccountSheet visible={visible} onClose={closeAccountSheet} />
    </AccountSheetContext.Provider>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: Platform.OS === 'web' ? 'center' : 'flex-end',
    paddingHorizontal: spacing.md,
    paddingBottom: Platform.OS === 'ios' ? spacing.xxl : spacing.lg,
  },
  sheetContainer: {
    width: '100%',
    maxWidth: 460,
    alignSelf: 'center',
    borderRadius: radii.xl,
    ...shadows.modal,
  },
  sheetContent: {
    padding: spacing.xl,
    gap: spacing.md,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderWidth: 1,
    borderRadius: radii.md,
    padding: spacing.md,
  },
  avatarCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitials: {
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  profileInfo: {
    flex: 1,
    gap: 2,
  },
  profileName: {
    fontSize: 15,
    fontWeight: '700',
  },
  profileEmail: {
    fontSize: 12,
  },
  cloudBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderRadius: radii.pill,
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  cloudBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  infoRowCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    borderWidth: 1,
    borderRadius: radii.md,
    padding: spacing.md,
  },
  syncTextCol: {
    flex: 1,
    gap: 2,
  },
  infoTitle: {
    fontSize: 13,
    fontWeight: '600',
  },
  infoSub: {
    fontSize: 12,
    lineHeight: 17,
  },
  syncBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: radii.pill,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  syncBtnText: {
    fontSize: 12,
    fontWeight: '600',
  },
  localModeBox: {
    borderWidth: 1,
    borderRadius: radii.md,
    padding: spacing.md,
    gap: spacing.md,
  },
  localModeHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  localBadgeIcon: {
    width: 38,
    height: 38,
    borderRadius: radii.squircle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  localTextCol: {
    flex: 1,
    gap: 3,
  },
  primaryBtn: {
    borderRadius: radii.md,
    height: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  primaryBtnText: {
    fontSize: 14,
    fontWeight: '700',
  },
  themeToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
  },
  themeToggleLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  themeToggleText: {
    fontSize: 13,
    fontWeight: '600',
  },
  themeToggleAction: {
    fontSize: 12,
    fontWeight: '600',
  },
  signOutBtn: {
    borderWidth: 1,
    borderRadius: radii.md,
    height: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  signOutText: {
    fontSize: 14,
    fontWeight: '700',
  },
});

export default AccountSheet;
