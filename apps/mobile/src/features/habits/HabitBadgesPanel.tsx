import React, { useMemo, useState } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import {
  Award,
  Calendar,
  CheckCircle2,
  Crown,
  Flame,
  Shield,
  Sparkles,
  Star,
  Target,
  TrendingUp,
  Trophy,
  Zap,
  type AppIcon,
} from '../../components/icons';
import { iconMetrics, radii, spacing, typography } from '../../theme/tokens';
import { useTheme } from '../../theme/ThemeContext';
import { LiquidGlassCard } from '../../components/glass/LiquidGlassCard';
import type {
  BadgesSummary,
  HabitBadgeCategory,
  HabitBadgeIconName,
  HabitBadgeProgress,
} from './badgesEngine';

const BADGE_ICON_MAP: Record<HabitBadgeIconName, AppIcon> = {
  Sparkles,
  CheckCircle2,
  Flame,
  Zap,
  Trophy,
  Target,
  TrendingUp,
  Shield,
  Award,
  Crown,
  Star,
  Calendar,
};

export function resolveBadgeIcon(name: HabitBadgeIconName): AppIcon {
  return BADGE_ICON_MAP[name] ?? Trophy;
}

type BadgeFilterTab = 'all' | HabitBadgeCategory;

export interface HabitBadgesPanelProps {
  summary: BadgesSummary;
}

export const HabitBadgesPanel: React.FC<HabitBadgesPanelProps> = ({
  summary,
}) => {
  const { width } = useWindowDimensions();
  const isWide = width >= 640;
  const { theme } = useTheme();
  const [filterTab, setFilterTab] = useState<BadgeFilterTab>('all');
  const [expanded, setExpanded] = useState(false);
  const [selectedBadgeId, setSelectedBadgeId] = useState<string | null>(
    () => summary.nextBadge?.id ?? summary.badges[0]?.id ?? null
  );

  const filteredBadges = useMemo(() => {
    const pool =
      filterTab === 'all'
        ? summary.badges
        : summary.badges.filter((b) => b.category === filterTab);

    return [...pool].sort((a, b) => {
      if (a.unlocked !== b.unlocked) return a.unlocked ? -1 : 1;
      if (!a.unlocked && b.progressPercent !== a.progressPercent) {
        return b.progressPercent - a.progressPercent;
      }
      return a.target - b.target;
    });
  }, [summary.badges, filterTab]);

  const visibleBadges = useMemo(() => {
    if (expanded || filteredBadges.length <= 8) return filteredBadges;
    return filteredBadges.slice(0, 8);
  }, [expanded, filteredBadges]);

  const inspectedBadge = useMemo<HabitBadgeProgress | null>(() => {
    return (
      summary.badges.find((b) => b.id === selectedBadgeId) ??
      summary.nextBadge ??
      summary.badges[0] ??
      null
    );
  }, [summary, selectedBadgeId]);

  return (
    <LiquidGlassCard style={styles.card} contentStyle={styles.content}>
      {/* Header */}
      <View style={styles.headerRow}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.title, { color: theme.textPrimary }]}>
            Insignias de Cumplimiento
          </Text>
          <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
            {summary.totalAchievementScore} pts acumulados
            {summary.currentWeekMaxScore > 0
              ? ` · Semana: ${summary.currentWeekScore}/${summary.currentWeekMaxScore} pts`
              : ''}
          </Text>
        </View>

        <View
          style={[
            styles.counterPill,
            {
              backgroundColor: theme.accentPrimarySoft,
              borderColor: theme.accentPrimaryBorder,
            },
          ]}
        >
          <Trophy size={12} color={theme.accentPrimaryLink} strokeWidth={2.1} />
          <Text style={[styles.counterText, { color: theme.accentPrimaryLink }]}>
            {summary.unlockedCount}/{summary.totalCount}
          </Text>
        </View>
      </View>

      {/* Filtros de categoría */}
      <View style={styles.tabsRow}>
        {(
          [
            { key: 'all' as const, label: `Todas (${summary.badges.length})` },
            {
              key: 'streaks' as const,
              label: `Rachas (${summary.badges.filter((b) => b.category === 'streaks').length})`,
            },
            {
              key: 'milestones' as const,
              label: `Logros (${summary.badges.filter((b) => b.category === 'milestones').length})`,
            },
          ]
        ).map((tab) => {
          const active = filterTab === tab.key;
          return (
            <Pressable
              key={tab.key}
              onPress={() => {
                setFilterTab(tab.key);
                setExpanded(false);
              }}
              style={[
                styles.tabChip,
                {
                  backgroundColor: active
                    ? theme.accentPrimarySoft
                    : theme.pillBg,
                  borderColor: active
                    ? theme.accentPrimaryBorder
                    : theme.glassBorder,
                },
              ]}
            >
              <Text
                style={[
                  styles.tabChipText,
                  {
                    color: active
                      ? theme.accentPrimaryLink
                      : theme.textSecondary,
                  },
                ]}
              >
                {tab.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* Grilla de Insignias */}
      <View style={styles.grid}>
        {visibleBadges.map((badge) => {
          const IconComp = resolveBadgeIcon(badge.icon);
          const isSelected = inspectedBadge?.id === badge.id;

          return (
            <Pressable
              key={badge.id}
              onPress={() => setSelectedBadgeId(badge.id)}
              style={[
                styles.badgeTile,
                {
                  width: isWide ? '23.4%' : '48.6%',
                  backgroundColor: theme.cardElevated,
                  borderColor: isSelected
                    ? theme.accentPrimary
                    : badge.unlocked
                      ? theme.accentPrimaryBorder
                      : theme.glassBorder,
                },
              ]}
            >
              <View
                style={[
                  styles.medallion,
                  {
                    backgroundColor: badge.unlocked
                      ? theme.accentPrimarySoft
                      : theme.pillBg,
                    borderColor: badge.unlocked
                      ? theme.accentPrimaryBorder
                      : theme.glassBorder,
                  },
                ]}
              >
                <IconComp
                  size={18}
                  color={
                    badge.unlocked ? theme.accentPrimaryLink : theme.textMuted
                  }
                  strokeWidth={iconMetrics.strokeWidth}
                />
              </View>

              <Text
                style={[
                  styles.badgeTitle,
                  {
                    color: badge.unlocked
                      ? theme.textPrimary
                      : theme.textSecondary,
                  },
                ]}
                numberOfLines={1}
              >
                {badge.title}
              </Text>

              {badge.unlocked ? (
                <Text
                  style={[
                    styles.unlockedTag,
                    { color: theme.accentPrimaryLink },
                  ]}
                >
                  Lograda
                </Text>
              ) : (
                <View style={styles.miniProgressWrap}>
                  <View
                    style={[
                      styles.miniProgressTrack,
                      { backgroundColor: theme.pillBg },
                    ]}
                  >
                    <View
                      style={[
                        styles.miniProgressFill,
                        {
                          width: `${Math.max(6, badge.progressPercent)}%`,
                          backgroundColor: theme.accentPrimary,
                        },
                      ]}
                    />
                  </View>
                  <Text
                    style={[styles.progressMiniLabel, { color: theme.textMuted }]}
                    numberOfLines={1}
                  >
                    {badge.progressLabel}
                  </Text>
                </View>
              )}
            </Pressable>
          );
        })}
      </View>

      {/* Expandir / Colapsar */}
      {filteredBadges.length > 8 ? (
        <Pressable
          onPress={() => setExpanded((prev) => !prev)}
          style={[
            styles.expandBtn,
            {
              backgroundColor: theme.pillBg,
              borderColor: theme.glassBorder,
            },
          ]}
        >
          <Text style={[styles.expandBtnText, { color: theme.textPrimary }]}>
            {expanded
              ? 'Ver menos'
              : `Ver todas (${filteredBadges.length} insignias)`}
          </Text>
        </Pressable>
      ) : null}

      {/* Strip de detalle */}
      {inspectedBadge ? (
        <View
          style={[
            styles.detailStrip,
            {
              backgroundColor: theme.cardElevated,
              borderColor: theme.glassBorder,
            },
          ]}
        >
          <View style={styles.detailTextCol}>
            <Text style={[styles.detailTitle, { color: theme.textPrimary }]}>
              {inspectedBadge.title}
            </Text>
            <Text style={[styles.detailDesc, { color: theme.textSecondary }]}>
              {inspectedBadge.description}
            </Text>
          </View>
          <View
            style={[
              styles.detailBadge,
              {
                backgroundColor: inspectedBadge.unlocked
                  ? theme.accentPrimarySoft
                  : theme.pillBg,
              },
            ]}
          >
            <Text
              style={[
                styles.detailBadgeText,
                {
                  color: inspectedBadge.unlocked
                    ? theme.accentPrimaryLink
                    : theme.textPrimary,
                },
              ]}
            >
              {inspectedBadge.unlocked ? 'Desbloqueada' : inspectedBadge.progressLabel}
            </Text>
          </View>
        </View>
      ) : null}
    </LiquidGlassCard>
  );
};

const styles = StyleSheet.create({
  card: {
    borderRadius: 24,
  },
  content: {
    gap: spacing.md,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  title: {
    fontSize: 17,
    ...typography.cardTitle,
  },
  subtitle: {
    fontSize: 12,
    marginTop: 1,
  },
  counterPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radii.pill,
    borderWidth: 1,
  },
  counterText: {
    fontSize: 12,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  tabsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  tabChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radii.pill,
    borderWidth: 1,
  },
  tabChipText: {
    fontSize: 11,
    fontWeight: '600',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  badgeTile: {
    borderWidth: 1,
    borderRadius: radii.md,
    padding: spacing.sm,
    alignItems: 'center',
    gap: 6,
  },
  medallion: {
    width: 38,
    height: 38,
    borderRadius: radii.squircle,
    borderCurve: 'continuous',
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeTitle: {
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
  },
  unlockedTag: {
    fontSize: 11,
    fontWeight: '700',
  },
  miniProgressWrap: {
    width: '100%',
    alignItems: 'center',
    gap: 3,
  },
  miniProgressTrack: {
    width: '100%',
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
  },
  miniProgressFill: {
    height: '100%',
    borderRadius: 2,
  },
  progressMiniLabel: {
    fontSize: 10,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  expandBtn: {
    borderWidth: 1,
    borderRadius: radii.pill,
    paddingVertical: 8,
    alignItems: 'center',
  },
  expandBtnText: {
    fontSize: 12,
    fontWeight: '600',
  },
  detailStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    borderWidth: 1,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
  },
  detailTextCol: {
    flex: 1,
    gap: 2,
  },
  detailTitle: {
    fontSize: 13,
    fontWeight: '700',
  },
  detailDesc: {
    fontSize: 11,
    lineHeight: 16,
  },
  detailBadge: {
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: radii.pill,
  },
  detailBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
});

export default HabitBadgesPanel;
