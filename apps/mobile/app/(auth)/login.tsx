import React, { useCallback, useEffect, useRef, useState } from 'react';
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
  Eye,
  EyeOff,
  Lock,
  Mail,
  Moon,
  RefreshCw,
  Sun,
  User,
} from '../../src/components/icons';
import { iconMetrics, radii, spacing, typography } from '../../src/theme/tokens';
import { useTheme } from '../../src/theme/ThemeContext';
import { LiquidGlassCard } from '../../src/components/glass/LiquidGlassCard';
import { AppLogo } from '../../src/components/brand/AppLogo';
import { API_BASE_URL, authClient } from '../../src/services/authClient';
import { hydrateWorkspaceFromCloud } from '../../src/db/sync';

type ApiHealthState = 'checking' | 'online' | 'offline';

function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  code: string
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      const err = new Error(code) as Error & { code?: string };
      err.code = code;
      reject(err);
    }, ms);
  });
  return Promise.race([promise, timeoutPromise]).finally(() => {
    if (timer !== undefined) {
      clearTimeout(timer);
    }
  });
}

function isNetworkOrTimeoutError(err: {
  message?: string;
  status?: number;
  code?: string;
}): boolean {
  const msg = (err.message || '').toLowerCase();
  const code = (err.code || '').toLowerCase();
  return (
    err.status === 0 ||
    code === 'auth_timeout' ||
    msg.includes('abort') ||
    msg.includes('timeout') ||
    msg.includes('failed to fetch') ||
    msg.includes('network') ||
    msg.includes('load failed')
  );
}

function mapAuthErrorMessage(err: {
  message?: string;
  status?: number;
  code?: string;
}): string {
  const msg = (err.message || '').toLowerCase();
  const code = (err.code || '').toLowerCase();

  if (code === 'auth_timeout' || msg.includes('abort') || msg.includes('timeout')) {
    return `El servidor (${API_BASE_URL}) tardó demasiado en responder. Verifica que "npm run dev:api:cloud" o "npm run dev:api" esté activo e intenta de nuevo.`;
  }

  if (
    err.status === 0 ||
    msg.includes('failed to fetch') ||
    msg.includes('network') ||
    msg.includes('load failed')
  ) {
    return `No se pudo conectar al servidor (${API_BASE_URL}). Verifica tu conexión o que "npm run dev:api:cloud" o "npm run dev:api" esté activo.`;
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

  if (err.status && err.status >= 500) {
    return err.message
      ? `Error interno del servidor (${err.status}): ${err.message}`
      : `Error interno del servidor (${err.status}). Revisa el estado de apps/api y D1.`;
  }

  return err.message || 'No se pudo completar la autenticación.';
}

export default function LoginScreen() {
  const { theme, isDark, toggleTheme } = useTheme();
  const router = useRouter();
  const { refetch: refetchSession } = authClient.useSession();
  const isMountedRef = useRef(true);

  const [isRegisterMode, setIsRegisterMode] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [apiHealth, setApiHealth] = useState<ApiHealthState>('checking');

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const checkApiHealth = useCallback(async () => {
    setApiHealth('checking');
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 3500);
      const res = await fetch(`${API_BASE_URL}/api/health`, {
        signal: controller.signal,
      });
      clearTimeout(timeout);
      if (isMountedRef.current) {
        setApiHealth(res.ok ? 'online' : 'offline');
      }
    } catch {
      if (isMountedRef.current) {
        setApiHealth('offline');
      }
    }
  }, []);

  useEffect(() => {
    void checkApiHealth();
  }, [checkApiHealth]);

  const handleAuthSubmit = async () => {
    if (isSubmitting) return;

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
      const authPromise = isRegisterMode
        ? authClient.signUp.email({
            email: cleanEmail,
            password,
            name: name.trim() || cleanEmail.split('@')[0] || 'Usuario Organiza',
          })
        : authClient.signIn.email({
            email: cleanEmail,
            password,
          });

      const res = await withTimeout(authPromise, 10000, 'AUTH_TIMEOUT');

      if (res?.error) {
        if (isMountedRef.current) {
          setStatusMessage(mapAuthErrorMessage(res.error));
          if (isNetworkOrTimeoutError(res.error)) {
            setApiHealth('offline');
          }
        }
        return;
      }

      const authenticatedUserId = res?.data?.user?.id;
      if (!authenticatedUserId) {
        if (isMountedRef.current) {
          setStatusMessage('No se recibió sesión válida del servidor.');
        }
        return;
      }

      await withTimeout(
        Promise.resolve(refetchSession()),
        4000,
        'SESSION_REFETCH_TIMEOUT'
      ).catch(() => undefined);

      await hydrateWorkspaceFromCloud(authenticatedUserId);

      if (isMountedRef.current) {
        setApiHealth('online');
      }
      router.replace('/(tabs)');
    } catch (error) {
      const errObj =
        error && typeof error === 'object'
          ? (error as {
              message?: string;
              status?: number;
              code?: string;
              name?: string;
            })
          : { message: typeof error === 'string' ? error : undefined };

      const normalizedErr = {
        message: errObj.message || errObj.name,
        status: errObj.status,
        code: errObj.code,
      };

      if (isMountedRef.current) {
        setStatusMessage(mapAuthErrorMessage(normalizedErr));
        if (
          normalizedErr.status === undefined ||
          isNetworkOrTimeoutError(normalizedErr)
        ) {
          setApiHealth('offline');
        }
      }
    } finally {
      if (isMountedRef.current) {
        setIsSubmitting(false);
      }
    }
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
            <View style={styles.brandLockup}>
              <AppLogo size={42} />
              <Text style={[styles.brandTitle, { color: theme.textPrimary }]}>
                Organiza
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
                { backgroundColor: theme.accentPrimary },
                isSubmitting && { opacity: 0.6 },
                pressed && styles.buttonPressed,
              ]}
            >
              <Text
                style={[
                  styles.primaryButtonText,
                  { color: theme.accentPrimaryText },
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
                color={theme.accentPrimaryText}
                strokeWidth={2.1}
              />
            </Pressable>
          </LiquidGlassCard>
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
  brandLockup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  brandTitle: {
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: -0.4,
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
    lineHeight: 32,
    ...typography.docTitle,
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
  buttonPressed: {
    opacity: 0.85,
  },
});
