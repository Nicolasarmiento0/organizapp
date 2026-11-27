import React from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import {
  CalendarClock,
  CalendarMark,
  Flag,
  Inbox,
  type AppIcon,
} from '../../components/icons';
import { LiquidGlassCard } from '../../components/glass/LiquidGlassCard';
import { iconMetrics, radii, spacing, typography } from '../../theme/tokens';
import { useTheme } from '../../theme/ThemeContext';
import type { ReminderSmartCounts, SmartListKey } from './reminderUtils';

export interface SmartListsGridProps {
  activeList: SmartListKey;
  onSelectList: (key: SmartListKey) => void;
  counts: ReminderSmartCounts;
}

interface SmartListCardConfig {
  key: SmartListKey;
  label: string;
  subtitle: string;
  count: number;
  icon: AppIcon;
  coralHighlightWhenInactive: boolean;
}

export const SmartListsGrid: React.FC<SmartListsGridProps> = ({
  activeList,
  onSelectList,
  counts,
}) => {
  const { theme } = useTheme();
  const { width } = useWindowDimensions();
  const isWide = width >= 720;

  const cards: SmartListCardConfig[] = [
    {
      key: 'today',
      label: 'Hoy',
      subtitle:
        counts.overdue > 0 ? `${counts.overdue} vencidos` : 'Vencen hoy',
      count: counts.today,
      icon: CalendarMark,
      coralHighlightWhenInactive: counts.today > 0,
    },
    {
      key: 'scheduled',
      label: 'Programados',
      subtitle: 'Días y semanas',
      count: counts.scheduled,
      icon: CalendarClock,
      coralHighlightWhenInactive: false,
    },
    {
      key: 'all',
      label: 'Todos',
      subtitle: 'Vista maestra',
      count: counts.allPending,
      icon: Inbox,
      coralHighlightWhenInactive: false,
    },
    {
      key: 'flagged',
      label: 'Urgentes',
      subtitle: 'Bandera y P3',
      count: counts.flagged,
      icon: Flag,
      coralHighlightWhenInactive: counts.flagged > 0,
    },
  ];

  return (
    <View style={styles.grid}>
      {cards.map((card) => {
        const isActive = activeList === card.key;
        const IconComp = card.icon;

        const badgeBg = isActive
          ? theme.accentPrimary
          : card.coralHighlightWhenInactive
            ? theme.accentPrimarySoft
            : theme.pillBg;
        const badgeIconColor = isActive
          ? theme.accentPrimaryText
          : card.coralHighlightWhenInactive
            ? theme.accentPrimaryLink
            : theme.textPrimary;

        return (
          <Pressable
            key={card.key}
            onPress={() => onSelectList(card.key)}
            style={({ pressed }) => [
              isWide ? styles.cardWrapperWide : styles.cardWrapperCompact,
              pressed && styles.cardPressed,
            ]}
          >
            <LiquidGlassCard
              noPadding
              intensity={isActive ? 78 : 65}
              style={[
                styles.cardSurface,
                isActive && {
                  borderColor: theme.accentPrimaryBorder,
                  borderWidth: 1.5,
                },
              ]}
              contentStyle={[
                styles.cardContent,
                isActive && { backgroundColor: theme.accentPrimarySoft },
              ]}
            >
              <View style={styles.topRow}>
                <View style={[styles.iconBadge, { backgroundColor: badgeBg }]}>
                  <IconComp
                    size={17}
                    color={badgeIconColor}
                    strokeWidth={iconMetrics.strokeWidth}
                  />
                </View>

                <Text
                  style={[
                    styles.countText,
                    {
                      color: isActive
                        ? theme.accentPrimaryLink
                        : theme.textPrimary,
                    },
                  ]}
                >
                  {card.count}
                </Text>
              </View>

              <View style={styles.bottomRow}>
                <View style={styles.labelsWrap}>
                  <Text
                    style={[styles.cardTitle, { color: theme.textPrimary }]}
                    numberOfLines={1}
                  >
                    {card.label}
                  </Text>
                  <Text
                    style={[
                      styles.cardSubtitle,
                      {
                        color:
                          card.key === 'today' && counts.overdue > 0
                            ? theme.accentPrimaryLink
                            : theme.textSecondary,
                      },
                    ]}
                    numberOfLines={1}
                  >
                    {card.subtitle}
                  </Text>
                </View>

                {isActive ? (
                  <View
                    style={[
                      styles.activeDot,
                      { backgroundColor: theme.accentPrimary },
                    ]}
                  />
                ) : null}
              </View>
            </LiquidGlassCard>
          </Pressable>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  cardWrapperCompact: {
    width: '48.7%',
    flexGrow: 1,
  },
  cardWrapperWide: {
    width: '24%',
    flexGrow: 1,
  },
  cardPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.985 }],
  },
  cardSurface: {
    borderRadius: 20,
  },
  cardContent: {
    padding: spacing.md,
    gap: spacing.sm,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  iconBadge: {
    width: 34,
    height: 34,
    borderRadius: radii.squircle,
    borderCurve: 'continuous',
    alignItems: 'center',
    justifyContent: 'center',
  },
  countText: {
    fontSize: 25,
    fontVariant: ['tabular-nums'],
    ...typography.kpiValue,
  },
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: spacing.xs,
  },
  labelsWrap: {
    flex: 1,
    gap: 1,
  },
  cardTitle: {
    fontSize: 14,
    ...typography.cardTitle,
  },
  cardSubtitle: {
    fontSize: 11,
    ...typography.caption,
  },
  activeDot: {
    width: 7,
    height: 7,
    borderRadius: radii.pill,
    marginBottom: 4,
  },
});

export default SmartListsGrid;
