import React, { useEffect, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { ArrowUp, Bell, Plus, X } from '../../components/icons';
import { LiquidGlassCard } from '../../components/glass/LiquidGlassCard';
import { iconMetrics, radii, spacing, typography } from '../../theme/tokens';
import { useTheme } from '../../theme/ThemeContext';
import { isIosBrowser, isPwaStandalone } from '../../services/webPush';

const DISMISS_KEY = 'organiza_ios_pwa_banner_dismissed';

export interface IosPwaInstallBannerProps {
  forceVisible?: boolean;
  onDismiss?: () => void;
}

export const IosPwaInstallBanner: React.FC<IosPwaInstallBannerProps> = ({
  forceVisible = false,
  onDismiss,
}) => {
  const { theme } = useTheme();
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;
    try {
      setDismissed(window.localStorage.getItem(DISMISS_KEY) === '1');
    } catch {
      setDismissed(false);
    }
  }, []);

  if (Platform.OS !== 'web') return null;
  if (!forceVisible && (!isIosBrowser() || isPwaStandalone() || dismissed)) {
    return null;
  }

  const handleDismiss = () => {
    setDismissed(true);
    try {
      window.localStorage.setItem(DISMISS_KEY, '1');
    } catch {
      // Ignorar modo privado
    }
    onDismiss?.();
  };

  return (
    <LiquidGlassCard
      noPadding
      intensity={75}
      style={[
        styles.card,
        { borderColor: theme.accentPrimaryBorder },
      ]}
      contentStyle={[
        styles.content,
        { backgroundColor: theme.accentPrimarySoft },
      ]}
    >
      <View
        style={[
          styles.iconBadge,
          { backgroundColor: theme.accentPrimary },
        ]}
      >
        <Bell
          size={16}
          color={theme.accentPrimaryText}
          strokeWidth={iconMetrics.strokeWidth}
        />
      </View>

      <View style={styles.textWrap}>
        <Text style={[styles.title, { color: theme.textPrimary }]}>
          Activa alertas Push en tu iPhone
        </Text>
        <View style={styles.stepsRow}>
          <Text style={[styles.body, { color: theme.textSecondary }]}>
            En Safari toca{' '}
          </Text>
          <View
            style={[
              styles.inlineChip,
              {
                backgroundColor: theme.card,
                borderColor: theme.glassBorder,
              },
            ]}
          >
            <ArrowUp
              size={11}
              color={theme.accentPrimaryLink}
              strokeWidth={2.2}
            />
            <Text style={[styles.inlineChipText, { color: theme.textPrimary }]}>
              Compartir
            </Text>
          </View>
          <Text style={[styles.body, { color: theme.textSecondary }]}>
            {' → '}
          </Text>
          <View
            style={[
              styles.inlineChip,
              {
                backgroundColor: theme.card,
                borderColor: theme.glassBorder,
              },
            ]}
          >
            <Plus
              size={11}
              color={theme.accentPrimaryLink}
              strokeWidth={2.2}
            />
            <Text style={[styles.inlineChipText, { color: theme.textPrimary }]}>
              Agregar a inicio
            </Text>
          </View>
        </View>
        <Text style={[styles.subHint, { color: theme.textMuted }]}>
          Luego abre Organiza desde el ícono de tu pantalla de inicio.
        </Text>
      </View>

      <Pressable
        onPress={handleDismiss}
        hitSlop={10}
        style={[styles.closeBtn, { backgroundColor: theme.pillBg }]}
      >
        <X size={15} color={theme.textSecondary} strokeWidth={2} />
      </Pressable>
    </LiquidGlassCard>
  );
};

const styles = StyleSheet.create({
  card: {
    borderRadius: radii.lg,
    borderWidth: 1,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: spacing.md,
    gap: spacing.md,
  },
  iconBadge: {
    width: 34,
    height: 34,
    borderRadius: radii.squircle,
    borderCurve: 'continuous',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  textWrap: {
    flex: 1,
    gap: 5,
  },
  title: {
    fontSize: 13,
    ...typography.cardTitle,
  },
  stepsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 4,
  },
  body: {
    fontSize: 12,
    ...typography.body,
  },
  inlineChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: radii.pill,
    borderWidth: 1,
  },
  inlineChipText: {
    fontSize: 11,
    ...typography.bodySemiBold,
  },
  subHint: {
    fontSize: 11,
    ...typography.caption,
  },
  closeBtn: {
    width: 28,
    height: 28,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default IosPwaInstallBanner;
