import React, { useCallback, useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  ArrowRight,
  Database,
  Eye,
  EyeOff,
  Lock,
  Mail,
  Moon,
  RefreshCw,
  Sun,
  User,
} from 'lucide-react-native';
import { iconMetrics, radii, spacing } from '../../src/theme/tokens';
import { useTheme } from '../../src/theme/ThemeContext';
import { LiquidGlassCard } from '../../src/components/glass/LiquidGlassCard';
import {
  API_BASE_URL,
  authClient,
  setOfflineGuestPreference,
} from '../../src/services/authClient';
import {
  claimLocalRecordsForUser,
  syncWithCloudflareD1,
} from '../../src/db/sync';

type ApiHealthState = 'checking' | 'online' | 'offline';

function mapAuthErrorMessage(err: {
  message?: string;
  status?: number;
  code?: string;
}): string {
  const msg = (err.message || '').toLowerCase();
  const code = (err.code || '').toLowerCase();

  if (
    err.status === 0 ||
    msg.includes('failed to fetch') ||
    msg.includes('network') ||
    msg.includes('load failed')
  ) {
    return `No se pudo conectar al servidor (${API_BASE_URL}). Ejecuta "npm run dev:api" o continúa en Modo Local.`;
  }

  if (
    msg.includes('already exists') ||
    code.includes('user_already_exists')
  ) {
    return 'Ya existe una cuenta con este correo. Prueba Iniciar Sesión.';
  }

  if (
    msg.includes('invalid email or password') ||
    code.includes('invalid_email_or_password')
  ) {
    return 'Correo o contraseña incorrectos.';
  }

  if (msg.includes('invalid origin') || code.includes('invalid_origin')) {
    return 'Origen de navegador no autorizado en Better Auth. Revisa TRUSTED_ORIGINS en apps/api.';
  }

  return err.message || 'No se pudo completar la autenticación.';
}

export default function LoginScreen() {
  const { theme, isDark, toggleTheme } = useTheme();
  const router = useRouter();
  const { refetch: refetchSession } = authClient.useSession();

  const [isRegisterMode, setIsRegisterMode] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [apiHealth, setApiHealth] = useState<ApiHealthState>('checking');

  const checkApiHealth = useCallback(async () => {
    setApiHealth('checking');
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 3500);
      const res = await fetch(`${API_BASE_URL}/api/health`, {
        signal: controller.signal,
      });
      clearTimeout(timeout);
      setApiHealth(res.ok ? 'online' : 'offline');
    } catch {
      setApiHealth('offline');
    }
  }, []);

  useEffect(() => {
    void checkApiHealth();
  }, [checkApiHealth]);

  const handleAuthSubmit = async () => {
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      setStatusMessage('Ingresa un correo electrónico válido.');
      return;
    }
    if (password.length < 8) {
      setStatusMessage('La contraseña debe tener al menos 8 caracteres.');
      return;
    }

    setIsSubmitting(true);
    setStatusMessage(null);

    try {
      let authenticatedUserId: string | undefined;

      if (isRegisterMode) {
        const res = await authClient.signUp.email({
          email: cleanEmail,
          password,
          name: name.trim() || cleanEmail.split('@')[0] || 'Usuario Organiza',
        });

        if (res.error) {
          setStatusMessage(mapAuthErrorMessage(res.error));
          setIsSubmitting(false);
          return;
        }
        authenticatedUserId = res.data?.user?.id;
      } else {
        const res = await authClient.signIn.email({
          email: cleanEmail,
          password,
        });

        if (res.error) {
          setStatusMessage(mapAuthErrorMessage(res.error));
          setIsSubmitting(false);
          return;
        }
        authenticatedUserId = res.data?.user?.id;
      }

      await setOfflineGuestPreference(false);
      await refetchSession();

      if (authenticatedUserId) {
        claimLocalRecordsForUser(authenticatedUserId);
        void syncWithCloudflareD1();
      }

      setIsSubmitting(false);
      router.replace('/(tabs)');
    } catch {
      setStatusMessage(
        `No se pudo conectar al servidor (${API_BASE_URL}). Ejecuta "npm run dev:api" o continúa en Modo Local 0 ms.`
      );
      setApiHealth('offline');
      setIsSubmitting(false);
    }
  };

  const handleContinueOfflineFirst = async () => {
    await setOfflineGuestPreference(true);
    router.replace('/(tabs)');
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.canvas }]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.flex}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {/* Barra superior discreta */}
          <View style={styles.topBar}>
            <View
              style={[
                styles.brandMonogram,
                {
                  backgroundColor: theme.card,
                  borderColor: theme.glassBorder,
                },
              ]}
            >
              <Text style={[styles.brandMonogramText, { color: theme.textPrimary }]}>
                O
              </Text>
            </View>

            <View style={styles.topRightRow}>
              <Pressable
                onPress={() => void checkApiHealth()}
                style={[
                  styles.healthPill,
                  {
                    backgroundColor: theme.card,
                    borderColor: theme.glassBorder,
                  },
                ]}
              >
                <View
                  style={[
                    styles.healthDot,
                    {
                      backgroundColor:
                        apiHealth === 'online'
                          ? theme.success
                          : apiHealth === 'offline'
                            ? theme.danger
                            : theme.warning,
                    },
                  ]}
                />
                <Text style={[styles.healthText, { color: theme.textSecondary }]}>
                  {apiHealth === 'online'
                    ? 'API Conectada'
                    : apiHealth === 'offline'
                      ? 'API Offline · Reintentar'
                      : 'Verificando API...'}
                </Text>
                {apiHealth === 'offline' ? (
                  <RefreshCw size={12} color={theme.textSecondary} strokeWidth={2} />
                ) : null}
              </Pressable>

              <Pressable
                onPress={toggleTheme}
                style={[
                  styles.themeBtn,
                  {
                    backgroundColor: theme.card,
                    borderColor: theme.glassBorder,
                  },
                ]}
                accessibilityLabel="Cambiar apariencia"
              >
                {isDark ? (
                  <Sun size={16} color={theme.textPrimary} strokeWidth={1.9} />
                ) : (
                  <Moon size={16} color={theme.textPrimary} strokeWidth={1.9} />
                )}
              </Pressable>
            </View>
          </View>

          {/* Cabecera Titanium Monochrome */}
          <View style={styles.heroSection}>
            <Text style={[styles.brandTag, { color: theme.textSecondary }]}>
              ORGANIZA OS · TITANIUM
            </Text>
            <Text style={[styles.heroTitle, { color: theme.textPrimary }]}>
              {isRegisterMode
                ? 'Crea tu cuenta personal'
                : 'Inicia sesión en tu Workspace'}
            </Text>
            <Text style={[styles.heroSubtitle, { color: theme.textSecondary }]}>
              Agenda macOS, recordatorios con avisos, hábitos con premios y notas
              estilo Notion sincronizados con Cloudflare D1.
            </Text>
          </View>

          {/* Tarjeta Principal */}
          <LiquidGlassCard style={styles.authCard} contentStyle={styles.authCardContent}>
            <View
              style={[
                styles.modeToggleContainer,
                { backgroundColor: theme.pillBg },
              ]}
            >
              <Pressable
                onPress={() => {
                  setIsRegisterMode(false);
                  setStatusMessage(null);
                }}
                style={[
                  styles.modeToggleBtn,
                  !isRegisterMode && {
                    backgroundColor: theme.accentVolt,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.modeToggleText,
                    {
                      color: !isRegisterMode
                        ? theme.accentVoltText
                        : theme.textSecondary,
                    },
                  ]}
                >
                  Iniciar Sesión
                </Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  setIsRegisterMode(true);
                  setStatusMessage(null);
                }}
                style={[
                  styles.modeToggleBtn,
                  isRegisterMode && {
                    backgroundColor: theme.accentVolt,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.modeToggleText,
                    {
                      color: isRegisterMode
                        ? theme.accentVoltText
                        : theme.textSecondary,
                    },
                  ]}
                >
                  Crear Cuenta
                </Text>
              </Pressable>
            </View>

            {isRegisterMode && (
              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>
                  Nombre
                </Text>
                <View
                  style={[
                    styles.inputWrapper,
                    {
                      backgroundColor: theme.inputBg,
                      borderColor: theme.glassBorder,
                    },
                  ]}
                >
                  <User
                    size={17}
                    color={theme.textSecondary}
                    strokeWidth={iconMetrics.strokeWidth}
                  />
                  <TextInput
                    value={name}
                    onChangeText={setName}
                    placeholder="Tu nombre"
                    placeholderTextColor={theme.textMuted}
                    style={[styles.textInput, { color: theme.textPrimary }]}
                    autoCapitalize="words"
                  />
                </View>
              </View>
            )}

            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>
                Correo Electrónico
              </Text>
              <View
                style={[
                  styles.inputWrapper,
                  {
                    backgroundColor: theme.inputBg,
                    borderColor: theme.glassBorder,
                  },
                ]}
              >
                <Mail
                  size={17}
                  color={theme.textSecondary}
                  strokeWidth={iconMetrics.strokeWidth}
                />
                <TextInput
                  value={email}
                  onChangeText={setEmail}
                  placeholder="nombre@dominio.com"
                  placeholderTextColor={theme.textMuted}
                  style={[styles.textInput, { color: theme.textPrimary }]}
                  autoCapitalize="none"
                  keyboardType="email-address"
                />
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>
                Contraseña
              </Text>
              <View
                style={[
                  styles.inputWrapper,
                  {
                    backgroundColor: theme.inputBg,
                    borderColor: theme.glassBorder,
                  },
                ]}
              >
                <Lock
                  size={17}
                  color={theme.textSecondary}
                  strokeWidth={iconMetrics.strokeWidth}
                />
                <TextInput
                  value={password}
                  onChangeText={setPassword}
                  placeholder="Mínimo 8 caracteres"
                  placeholderTextColor={theme.textMuted}
                  style={[styles.textInput, { color: theme.textPrimary }]}
                  secureTextEntry={!showPassword}
                  returnKeyType="done"
                  onSubmitEditing={() => void handleAuthSubmit()}
                />
                <Pressable
                  onPress={() => setShowPassword((prev) => !prev)}
                  hitSlop={10}
                >
                  {showPassword ? (
                    <EyeOff size={17} color={theme.textMuted} strokeWidth={1.8} />
                  ) : (
                    <Eye size={17} color={theme.textMuted} strokeWidth={1.8} />
                  )}
                </Pressable>
              </View>
            </View>

            {statusMessage && (
              <View
                style={[
                  styles.feedbackBanner,
                  { backgroundColor: theme.dangerSoft },
                ]}
              >
                <Text style={[styles.feedbackText, { color: theme.danger }]}>
                  {statusMessage}
                </Text>
              </View>
            )}

            <Pressable
              onPress={() => void handleAuthSubmit()}
              disabled={isSubmitting}
              style={({ pressed }) => [
                styles.primaryButton,
                { backgroundColor: theme.accentVolt },
                isSubmitting && { opacity: 0.6 },
                pressed && styles.buttonPressed,
              ]}
            >
              <Text
                style={[
                  styles.primaryButtonText,
                  { color: theme.accentVoltText },
                ]}
              >
                {isSubmitting
                  ? 'Conectando...'
                  : isRegisterMode
                    ? 'Crear cuenta y entrar'
                    : 'Entrar a Organiza'}
              </Text>
              <ArrowRight
                size={16}
                color={theme.accentVoltText}
                strokeWidth={2.1}
              />
            </Pressable>
          </LiquidGlassCard>

          {/* Opción secundaria discreta: Modo Local 0 ms */}
          <Pressable
            onPress={() => void handleContinueOfflineFirst()}
            style={({ pressed }) => [
              styles.offlineButton,
              {
                backgroundColor: theme.card,
                borderColor: theme.glassBorder,
              },
              pressed && styles.buttonPressed,
            ]}
          >
            <Database size={15} color={theme.textSecondary} strokeWidth={1.9} />
            <Text style={[styles.offlineButtonText, { color: theme.textSecondary }]}>
              Continuar sin cuenta (Modo Local 0 ms)
            </Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  flex: {
    flex: 1,
  },
  scrollContent: {
    width: '100%',
    maxWidth: 460,
    alignSelf: 'center',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.xxl,
    gap: spacing.xl,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  topRightRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  brandMonogram: {
    width: 44,
    height: 44,
    borderRadius: radii.squircle,
    borderCurve: 'continuous',
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandMonogramText: {
    fontSize: 19,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  healthPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: radii.pill,
    paddingHorizontal: 11,
    height: 36,
  },
  healthDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  healthText: {
    fontSize: 11,
    fontWeight: '600',
  },
  themeBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroSection: {
    gap: spacing.xs,
  },
  brandTag: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.2,
  },
  heroTitle: {
    fontSize: 26,
    fontWeight: '700',
    letterSpacing: -0.6,
    lineHeight: 32,
  },
  heroSubtitle: {
    fontSize: 14,
    lineHeight: 20,
    marginTop: 2,
  },
  authCard: {
    borderRadius: radii.xl,
  },
  authCardContent: {
    gap: spacing.md,
  },
  modeToggleContainer: {
    flexDirection: 'row',
    borderRadius: radii.md,
    padding: 4,
  },
  modeToggleBtn: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: radii.squircle,
    alignItems: 'center',
  },
  modeToggleText: {
    fontSize: 13,
    fontWeight: '700',
  },
  inputGroup: {
    gap: 6,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderWidth: 1,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    height: 48,
  },
  textInput: {
    flex: 1,
    fontSize: 15,
  },
  feedbackBanner: {
    borderRadius: radii.squircle,
    padding: spacing.md,
  },
  feedbackText: {
    fontSize: 13,
    fontWeight: '500',
  },
  primaryButton: {
    marginTop: spacing.xs,
    borderRadius: radii.md,
    height: 50,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  primaryButtonText: {
    fontSize: 15,
    fontWeight: '700',
  },
  offlineButton: {
    borderWidth: 1,
    borderRadius: radii.md,
    height: 46,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  offlineButtonText: {
    fontSize: 13,
    fontWeight: '600',
  },
  buttonPressed: {
    opacity: 0.85,
  },
});
