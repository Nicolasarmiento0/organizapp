import React, { useState } from 'react';
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
  Cloud,
  Database,
  Lock,
  Mail,
  ShieldCheck,
  User,
} from 'lucide-react-native';
import { iconMetrics, radii, spacing } from '../../src/theme/tokens';
import { useTheme } from '../../src/theme/ThemeContext';
import { LiquidGlassCard } from '../../src/components/glass/LiquidGlassCard';
import { MacIconBadge } from '../../src/components/glass/MacIconBadge';
import {
  authClient,
  setOfflineGuestPreference,
} from '../../src/services/authClient';
import { syncWithCloudflareD1 } from '../../src/db/sync';

export default function LoginScreen() {
  const { theme } = useTheme();
  const router = useRouter();
  const [isRegisterMode, setIsRegisterMode] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleAuthSubmit = async () => {
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || password.length < 8) {
      setStatusMessage('Ingresa un email válido y contraseña de mínimo 8 caracteres.');
      return;
    }

    setIsSubmitting(true);
    setStatusMessage(null);

    try {
      if (isRegisterMode) {
        const res = await authClient.signUp.email({
          email: cleanEmail,
          password,
          name: name.trim() || 'Usuario Organiza',
        });

        if (res.error) {
          setStatusMessage(res.error.message || 'No se pudo completar el registro.');
          setIsSubmitting(false);
          return;
        }
      } else {
        const res = await authClient.signIn.email({
          email: cleanEmail,
          password,
        });

        if (res.error) {
          setStatusMessage(res.error.message || 'Credenciales inválidas.');
          setIsSubmitting(false);
          return;
        }
      }

      await setOfflineGuestPreference(false);
      void syncWithCloudflareD1();
      setIsSubmitting(false);
      router.replace('/(tabs)');
    } catch {
      setStatusMessage(
        'Servidor Cloudflare Edge no disponible aún. Puedes continuar en Modo Local 0 ms.'
      );
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
          {/* Cabecera Arquitectónica */}
          <View style={styles.heroSection}>
            <MacIconBadge
              icon={ShieldCheck}
              module="dashboard"
              containerSize={52}
              size={26}
            />
            <Text style={[styles.brandTag, { color: theme.accentCobaltBright }]}>
              ORGANIZA · EDGE OS
            </Text>
            <Text style={[styles.heroTitle, { color: theme.textPrimary }]}>
              Productividad Local-First con Sincronización en Cloudflare D1
            </Text>
            <Text style={[styles.heroSubtitle, { color: theme.textSecondary }]}>
              Tus hábitos, recordatorios, horarios y notas viven en SQLite local (0 ms)
              y se respaldan en segundo plano con Better Auth ($0 USD).
            </Text>
          </View>

          {/* Tarjeta Principal Liquid Glass */}
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
                  !isRegisterMode && { backgroundColor: theme.cardElevated },
                ]}
              >
                <Text
                  style={[
                    styles.modeToggleText,
                    {
                      color: !isRegisterMode
                        ? theme.textPrimary
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
                  isRegisterMode && { backgroundColor: theme.cardElevated },
                ]}
              >
                <Text
                  style={[
                    styles.modeToggleText,
                    {
                      color: isRegisterMode
                        ? theme.textPrimary
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
                  secureTextEntry
                />
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
              onPress={handleAuthSubmit}
              disabled={isSubmitting}
              style={({ pressed }) => [
                styles.primaryButton,
                { backgroundColor: theme.accentCobalt },
                pressed && styles.buttonPressed,
              ]}
            >
              <Cloud size={17} color="#FFFFFF" strokeWidth={2} />
              <Text style={styles.primaryButtonText}>
                {isSubmitting
                  ? 'Conectando con Edge...'
                  : isRegisterMode
                    ? 'Registrar y Sincronizar con D1'
                    : 'Conectar Cuenta Cloud'}
              </Text>
              <ArrowRight size={16} color="#FFFFFF" strokeWidth={2} />
            </Pressable>
          </LiquidGlassCard>

          {/* Acceso Directo Offline-First */}
          <LiquidGlassCard variant="solid" style={styles.offlineCard}>
            <View style={styles.offlineRow}>
              <MacIconBadge
                icon={Database}
                module="habits"
                containerSize={38}
                size={19}
              />
              <View style={styles.offlineTextCol}>
                <Text style={[styles.offlineTitle, { color: theme.textPrimary }]}>
                  Modo Local Offline-First (0 ms)
                </Text>
                <Text style={[styles.offlineDescription, { color: theme.textSecondary }]}>
                  Usa toda la app sin conexión ni cuenta. Tus datos se guardan en
                  SQLite local y se sincronizarán cuando decidas iniciar sesión.
                </Text>
              </View>
            </View>

            <Pressable
              onPress={handleContinueOfflineFirst}
              style={({ pressed }) => [
                styles.secondaryButton,
                {
                  backgroundColor: theme.inputBg,
                  borderColor: theme.glassBorder,
                },
                pressed && styles.buttonPressed,
              ]}
            >
              <Text style={[styles.secondaryButtonText, { color: theme.textPrimary }]}>
                Entrar al Dashboard Local Ahora
              </Text>
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
    maxWidth: 520,
    alignSelf: 'center',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.xxl,
    gap: spacing.xl,
  },
  heroSection: {
    gap: spacing.sm,
  },
  brandTag: {
    marginTop: spacing.xs,
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
    fontWeight: '600',
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
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
  offlineCard: {
    gap: spacing.md,
  },
  offlineRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  offlineTextCol: {
    flex: 1,
    gap: 3,
  },
  offlineTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  offlineDescription: {
    fontSize: 13,
    lineHeight: 18,
  },
  secondaryButton: {
    marginTop: spacing.md,
    borderWidth: 1,
    borderRadius: radii.md,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  buttonPressed: {
    opacity: 0.85,
  },
});
