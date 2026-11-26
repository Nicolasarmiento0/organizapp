import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { CheckCircle2, Flame, Shield, TrendingUp, Trophy } from '../../components/icons';
import { radii, spacing, typography } from '../../theme/tokens';
import { useTheme } from '../../theme/ThemeContext';
import { LiquidGlassCard } from '../../components/glass/LiquidGlassCard';
import type { HabitConsoleAnalytics, RestShieldStats } from './streakEngine';

export interface HabitKpiGridProps {
  analytics: HabitConsoleAnalytics;
  shieldStats: RestShieldStats;
  unlockedBadges: number;
  totalBadges: number;
}

export const HabitKpiGrid: React.FC<HabitKpiGridProps> = ({
  analytics,
  shieldStats,
  unlockedBadges,
  totalBadges,
}) => {
  const { theme } = useTheme();
  const deltaPositive = analytics.weeklyDeltaPercent >= 0;
  const deltaLabel = `${deltaPositive ? '+' : ''}${analytics.weeklyDeltaPercent}% vs sem. ant.`;

  return (
    <View style={styles.grid}>
      {/* 1. Consistencia 30D */}
      <LiquidGlassCard style={styles.kpiCard} contentStyle={styles.kpiContent}>
        <View style={styles.topRow}>
          <View style={[styles.iconPill, { backgroundColor: theme.pillBg }]}>
            <TrendingUp size={15} color={theme.accentPrimaryLink} strokeWidth={2} />
          </View>
          <Text style={[styles.kpiLabel, { color: theme.textSecondary }]}>
            Consistencia 30D
          </Text>
        </View>
        <Text style={[styles.kpiValue, { color: theme.textPrimary }]}>
          {analytics.consistency30dPercent}%
        </Text>
        <Text
          style={[
            styles.kpiDelta,
            {
              color: deltaPositive ? theme.accentPrimaryLink : theme.textMuted,
            },
          ]}
        >
          {deltaLabel}
        </Text>
      </LiquidGlassCard>

      {/* 2. Días Perfectos */}
      <LiquidGlassCard style={styles.kpiCard} contentStyle={styles.kpiContent}>
        <View style={styles.topRow}>
          <View style={[styles.iconPill, { backgroundColor: theme.pillBg }]}>
            <CheckCircle2 size={15} color={theme.accentPrimaryLink} strokeWidth={2} />
          </View>
          <Text style={[styles.kpiLabel, { color: theme.textSecondary }]}>
            Días Perfectos
          </Text>
        </View>
        <Text style={[styles.kpiValue, { color: theme.textPrimary }]}>
          {analytics.perfectDays30d}d
        </Text>
        <Text style={[styles.kpiDelta, { color: theme.textSecondary }]}>
          100% cumplidos en 30d
        </Text>
      </LiquidGlassCard>

      {/* 3. Mejor Racha Histórica */}
      <LiquidGlassCard style={styles.kpiCard} contentStyle={styles.kpiContent}>
        <View style={styles.topRow}>
          <View style={[styles.iconPill, { backgroundColor: theme.pillBg }]}>
            <Flame size={15} color={theme.accentPrimaryLink} strokeWidth={2} />
          </View>
          <Text style={[styles.kpiLabel, { color: theme.textSecondary }]}>
            Mejor Racha
          </Text>
        </View>
        <Text style={[styles.kpiValue, { color: theme.textPrimary }]}>
          {analytics.bestHistoricalStreak}d
        </Text>
        <Text
          style={[styles.kpiDelta, { color: theme.textSecondary }]}
          numberOfLines={1}
        >
          {analytics.bestStreakHabitTitle}
        </Text>
      </LiquidGlassCard>

      {/* 4. Insignias & Escudos */}
      <LiquidGlassCard style={styles.kpiCard} contentStyle={styles.kpiContent}>
        <View style={styles.topRow}>
          <View style={[styles.iconPill, { backgroundColor: theme.pillBg }]}>
            <Trophy size={15} color={theme.accentPrimaryLink} strokeWidth={2} />
          </View>
          <Text style={[styles.kpiLabel, { color: theme.textSecondary }]}>
            Insignias & Escudos
          </Text>
        </View>
        <View style={styles.dualValueRow}>
          <Text style={[styles.kpiValue, { color: theme.textPrimary }]}>
            {unlockedBadges}/{totalBadges}
          </Text>
          <View
            style={[
              styles.ptsChip,
              { backgroundColor: theme.accentPrimarySoft },
            ]}
          >
            <Shield size={11} color={theme.accentPrimaryLink} strokeWidth={2} />
            <Text style={[styles.ptsChipText, { color: theme.accentPrimaryLink }]}>
              {shieldStats.available}/{shieldStats.max}
            </Text>
          </View>
        </View>
        <Text style={[styles.kpiDelta, { color: theme.textSecondary }]}>
          Nuevo escudo en {shieldStats.nextShieldInCompletions} logros
        </Text>
      </LiquidGlassCard>
    </View>
  );
};

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  kpiCard: {
    width: '48.8%',
    borderRadius: 20,
  },
  kpiContent: {
    padding: spacing.md,
    gap: 6,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  iconPill: {
    width: 28,
    height: 28,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  kpiLabel: {
    fontSize: 12,
    fontWeight: '600',
    flex: 1,
  },
  kpiValue: {
    fontSize: 24,
    fontVariant: ['tabular-nums'],
    ...typography.kpiValue,
  },
  dualValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
  },
  ptsChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radii.pill,
  },
  ptsChipText: {
    fontSize: 11,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  kpiDelta: {
    fontSize: 11,
    fontWeight: '600',
  },
});

export default HabitKpiGrid;
