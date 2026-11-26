import React, { useEffect, useMemo, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import type { HabitLogRecord, HabitRecord } from '@organiza/shared/schema';
import { Shield } from '../../components/icons';
import { radii, spacing } from '../../theme/tokens';
import { useTheme } from '../../theme/ThemeContext';
import { LiquidGlassCard } from '../../components/glass/LiquidGlassCard';
import {
  buildHeatmapCells,
  getDayOfWeekFromDateKey,
  type HeatmapCellData,
  type HeatmapRangeDays,
} from './streakEngine';

export interface HabitHeatmapConsoleProps {
  habits: HabitRecord[];
  allLogs: HabitLogRecord[];
  todayKey: string;
}

const CORAL_LEVEL_FILLS: Record<1 | 2 | 3 | 4, string> = {
  1: 'rgba(250, 107, 107, 0.22)',
  2: 'rgba(250, 107, 107, 0.45)',
  3: 'rgba(250, 107, 107, 0.72)',
  4: '#FA6B6B',
};

const RANGE_OPTIONS: readonly HeatmapRangeDays[] = [30, 90, 180, 365];

const SHORT_MONTHS = [
  'Ene',
  'Feb',
  'Mar',
  'Abr',
  'May',
  'Jun',
  'Jul',
  'Ago',
  'Sep',
  'Oct',
  'Nov',
  'Dic',
] as const;

const WEEK_RAIL_LABELS = ['L', '', 'X', '', 'V', '', 'D'] as const;

interface WeekMatrixColumn {
  monthLabel: string | null;
  slots: Array<HeatmapCellData | null>; // 7 slots (0 = Lun .. 6 = Dom)
}

function buildWeeklyMatrix(cells: HeatmapCellData[]): WeekMatrixColumn[] {
  if (cells.length === 0) return [];
  const columns: WeekMatrixColumn[] = [];
  let currentSlots: Array<HeatmapCellData | null> = Array(7).fill(null);
  let lastLabeledMonth = -1;

  const pushColumn = () => {
    const firstReal = currentSlots.find((c) => c !== null) ?? null;
    let monthLabel: string | null = null;
    if (firstReal) {
      const monthIdx = Number(firstReal.dateKey.split('-')[1]) - 1;
      if (Number.isFinite(monthIdx) && monthIdx !== lastLabeledMonth) {
        monthLabel = SHORT_MONTHS[monthIdx] ?? null;
        lastLabeledMonth = monthIdx;
      }
    }
    columns.push({ monthLabel, slots: currentSlots });
    currentSlots = Array(7).fill(null);
  };

  for (const cell of cells) {
    const mondayRow = (getDayOfWeekFromDateKey(cell.dateKey) + 6) % 7;
    if (mondayRow === 0 && currentSlots.some((s) => s !== null)) {
      pushColumn();
    }
    currentSlots[mondayRow] = cell;
  }

  if (currentSlots.some((s) => s !== null)) {
    pushColumn();
  }

  return columns;
}

function formatShortDateLabel(dateKey: string): string {
  const [yStr, mStr, dStr] = dateKey.split('-');
  const y = Number(yStr);
  const m = Number(mStr);
  const d = Number(dStr);
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) {
    return dateKey;
  }
  try {
    const raw = new Intl.DateTimeFormat('es-ES', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
    }).format(new Date(y, m - 1, d));
    return raw.charAt(0).toUpperCase() + raw.slice(1);
  } catch {
    return dateKey;
  }
}

export const HabitHeatmapConsole: React.FC<HabitHeatmapConsoleProps> = ({
  habits,
  allLogs,
  todayKey,
}) => {
  const { width } = useWindowDimensions();
  const { theme } = useTheme();
  const [rangeDays, setRangeDays] = useState<HeatmapRangeDays>(30);
  const [filterHabitId, setFilterHabitId] = useState<string | null>(null);
  const [inspectedDateKey, setInspectedDateKey] = useState<string>(todayKey);

  useEffect(() => {
    if (filterHabitId && !habits.some((h) => h.id === filterHabitId)) {
      setFilterHabitId(null);
    }
  }, [habits, filterHabitId]);

  const cells = useMemo(
    () => buildHeatmapCells(habits, allLogs, rangeDays, todayKey, filterHabitId),
    [habits, allLogs, rangeDays, todayKey, filterHabitId]
  );

  const isCompactGrid = rangeDays === 30 || rangeDays === 90;
  const columnsCount = rangeDays === 30 ? 10 : width >= 640 ? 15 : 10;

  const compactRows = useMemo(() => {
    if (!isCompactGrid) return [];
    const grouped: HeatmapCellData[][] = [];
    for (let i = 0; i < cells.length; i += columnsCount) {
      grouped.push(cells.slice(i, i + columnsCount));
    }
    return grouped;
  }, [isCompactGrid, cells, columnsCount]);

  const weeklyMatrix = useMemo(
    () => (isCompactGrid ? [] : buildWeeklyMatrix(cells)),
    [isCompactGrid, cells]
  );

  const inspectedCell = useMemo(() => {
    return (
      cells.find((c) => c.dateKey === inspectedDateKey) ??
      cells[cells.length - 1] ??
      null
    );
  }, [cells, inspectedDateKey]);

  const activeFilterName = useMemo(() => {
    if (!filterHabitId) return 'Todos los hábitos activos';
    return habits.find((h) => h.id === filterHabitId)?.title ?? 'Hábito';
  }, [filterHabitId, habits]);

  const matrixCellSize = rangeDays === 180 ? 13 : 11;
  const matrixGap = rangeDays === 180 ? 3.5 : 3;

  return (
    <LiquidGlassCard style={styles.card} contentStyle={styles.content}>
      {/* Header Consola */}
      <View style={styles.headerRow}>
        <View style={styles.titleBlock}>
          <Text style={[styles.title, { color: theme.textPrimary }]}>
            Consola de Consistencia
          </Text>
          <Text
            style={[styles.subtitle, { color: theme.textSecondary }]}
            numberOfLines={1}
          >
            {activeFilterName} · Últimos {rangeDays} días
          </Text>
        </View>

        <View style={[styles.rangeBox, { backgroundColor: theme.pillBg }]}>
          {RANGE_OPTIONS.map((daysOpt) => {
            const active = rangeDays === daysOpt;
            return (
              <Pressable
                key={daysOpt}
                onPress={() => setRangeDays(daysOpt)}
                style={[
                  styles.rangeBtn,
                  active && { backgroundColor: theme.accentPrimary },
                ]}
              >
                <Text
                  style={[
                    styles.rangeBtnText,
                    {
                      color: active
                        ? theme.accentPrimaryText
                        : theme.textSecondary,
                    },
                    active && { fontWeight: '700' },
                  ]}
                >
                  {daysOpt}D
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      {/* Filtro rápido por hábito */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterStrip}
      >
        <Pressable
          onPress={() => setFilterHabitId(null)}
          style={[
            styles.filterChip,
            {
              backgroundColor:
                filterHabitId === null ? theme.accentPrimarySoft : theme.pillBg,
              borderColor:
                filterHabitId === null
                  ? theme.accentPrimaryBorder
                  : theme.glassBorder,
            },
          ]}
        >
          <Text
            style={[
              styles.filterChipText,
              {
                color:
                  filterHabitId === null
                    ? theme.accentPrimaryLink
                    : theme.textSecondary,
              },
            ]}
          >
            Global
          </Text>
        </Pressable>

        {habits.map((habit) => {
          const active = filterHabitId === habit.id;
          return (
            <Pressable
              key={habit.id}
              onPress={() => setFilterHabitId(habit.id)}
              style={[
                styles.filterChip,
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
                  styles.filterChipText,
                  {
                    color: active
                      ? theme.accentPrimaryLink
                      : theme.textSecondary,
                  },
                ]}
                numberOfLines={1}
              >
                {habit.title}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {/* Cuadrícula Heatmap */}
      {isCompactGrid ? (
        <View style={styles.grid}>
          {compactRows.map((row, rowIdx) => (
            <View key={rowIdx} style={styles.gridRow}>
              {row.map((cell) => {
                const isSelected = inspectedCell?.dateKey === cell.dateKey;
                const fillColor =
                  cell.level === 0
                    ? theme.cardElevated
                    : CORAL_LEVEL_FILLS[cell.level];

                return (
                  <Pressable
                    key={cell.dateKey}
                    onPress={() => setInspectedDateKey(cell.dateKey)}
                    style={[
                      styles.cell,
                      {
                        height: rangeDays === 30 ? 28 : 18,
                        borderRadius: rangeDays === 30 ? 7 : 5,
                        backgroundColor: fillColor,
                        borderWidth: isSelected
                          ? 1.8
                          : cell.hasShield
                            ? 1.4
                            : 1,
                        borderColor: isSelected
                          ? theme.textPrimary
                          : cell.hasShield
                            ? theme.accentPrimary
                            : theme.glassBorder,
                      },
                    ]}
                    accessibilityLabel={`${cell.dateKey}: ${cell.completedCount}/${cell.scheduledCount}`}
                  >
                    {cell.hasShield ? (
                      <View
                        style={[
                          styles.shieldMicroDot,
                          { backgroundColor: theme.accentPrimary },
                        ]}
                      />
                    ) : null}
                  </Pressable>
                );
              })}
            </View>
          ))}
        </View>
      ) : (
        /* Matriz Semanal Estilo GitHub para 180D / 365D */
        <View style={styles.matrixContainer}>
          {/* Rail izquierdo días L X V D */}
          <View style={[styles.weekRailCol, { paddingTop: 18, gap: matrixGap }]}>
            {WEEK_RAIL_LABELS.map((lbl, idx) => (
              <View
                key={idx}
                style={{
                  height: matrixCellSize,
                  justifyContent: 'center',
                }}
              >
                <Text style={[styles.weekRailText, { color: theme.textMuted }]}>
                  {lbl}
                </Text>
              </View>
            ))}
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: matrixGap }}
          >
            {weeklyMatrix.map((col, colIdx) => (
              <View key={colIdx} style={{ gap: matrixGap }}>
                <View style={styles.monthLabelSlot}>
                  {col.monthLabel ? (
                    <Text
                      style={[styles.monthLabelText, { color: theme.textMuted }]}
                      numberOfLines={1}
                    >
                      {col.monthLabel}
                    </Text>
                  ) : null}
                </View>

                {col.slots.map((cell, rowIdx) => {
                  if (!cell) {
                    return (
                      <View
                        key={rowIdx}
                        style={{
                          width: matrixCellSize,
                          height: matrixCellSize,
                        }}
                      />
                    );
                  }

                  const isSelected = inspectedCell?.dateKey === cell.dateKey;
                  const fillColor =
                    cell.level === 0
                      ? theme.cardElevated
                      : CORAL_LEVEL_FILLS[cell.level];

                  return (
                    <Pressable
                      key={cell.dateKey}
                      onPress={() => setInspectedDateKey(cell.dateKey)}
                      style={[
                        styles.matrixCell,
                        {
                          width: matrixCellSize,
                          height: matrixCellSize,
                          borderRadius: rangeDays === 180 ? 3.5 : 3,
                          backgroundColor: fillColor,
                          borderWidth: isSelected
                            ? 1.5
                            : cell.hasShield
                              ? 1.2
                              : 0.75,
                          borderColor: isSelected
                            ? theme.textPrimary
                            : cell.hasShield
                              ? theme.accentPrimary
                              : theme.glassBorder,
                        },
                      ]}
                      accessibilityLabel={`${cell.dateKey}: ${cell.completedCount}/${cell.scheduledCount}`}
                    >
                      {cell.hasShield ? (
                        <View
                          style={[
                            styles.shieldMicroDotSmall,
                            { backgroundColor: theme.accentPrimary },
                          ]}
                        />
                      ) : null}
                    </Pressable>
                  );
                })}
              </View>
            ))}
          </ScrollView>
        </View>
      )}

      {/* Inspector del día + Leyenda */}
      <View style={styles.footerRow}>
        {inspectedCell ? (
          <View style={styles.inspectorLeft}>
            <Text style={[styles.inspectorDate, { color: theme.textPrimary }]}>
              {formatShortDateLabel(inspectedCell.dateKey)}
            </Text>
            <Text style={[styles.inspectorStat, { color: theme.textSecondary }]}>
              {inspectedCell.isAllPaused
                ? 'En pausa'
                : `${inspectedCell.completedCount}/${inspectedCell.scheduledCount} (${Math.round(inspectedCell.ratio * 100)}%)`}
            </Text>
            {inspectedCell.hasShield ? (
              <View style={styles.inspectorShieldChip}>
                <Shield size={11} color={theme.accentPrimaryLink} strokeWidth={2.1} />
                <Text style={[styles.inspectorStat, { color: theme.accentPrimaryLink }]}>
                  {inspectedCell.shieldCount}
                </Text>
              </View>
            ) : null}
          </View>
        ) : (
          <View />
        )}

        <View style={styles.legendRow}>
          <Text style={[styles.legendLabel, { color: theme.textMuted }]}>
            Menos
          </Text>
          {([0, 1, 2, 3, 4] as const).map((lvl) => (
            <View
              key={lvl}
              style={[
                styles.legendBox,
                {
                  backgroundColor:
                    lvl === 0 ? theme.cardElevated : CORAL_LEVEL_FILLS[lvl],
                  borderColor: theme.glassBorder,
                },
              ]}
            />
          ))}
          <Text style={[styles.legendLabel, { color: theme.textMuted }]}>
            Más
          </Text>
        </View>
      </View>
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
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  titleBlock: {
    flex: 1,
    minWidth: 160,
    gap: 2,
  },
  title: {
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 12,
    fontWeight: '500',
  },
  rangeBox: {
    flexDirection: 'row',
    borderRadius: radii.pill,
    padding: 3,
    gap: 2,
  },
  rangeBtn: {
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: radii.pill,
  },
  rangeBtnText: {
    fontSize: 11,
    fontWeight: '600',
  },
  filterStrip: {
    gap: 6,
    paddingVertical: 2,
  },
  filterChip: {
    maxWidth: 160,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radii.pill,
    borderWidth: 1,
  },
  filterChipText: {
    fontSize: 11,
    fontWeight: '600',
  },
  grid: {
    gap: 5,
  },
  gridRow: {
    flexDirection: 'row',
    gap: 5,
  },
  cell: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shieldMicroDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
  },
  matrixContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
  },
  weekRailCol: {
    width: 12,
    alignItems: 'center',
  },
  weekRailText: {
    fontSize: 9,
    fontWeight: '700',
  },
  monthLabelSlot: {
    height: 14,
    justifyContent: 'center',
    overflow: 'visible',
  },
  monthLabelText: {
    fontSize: 9,
    fontWeight: '700',
    width: 28,
  },
  matrixCell: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  shieldMicroDotSmall: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
  },
  footerRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    paddingTop: 2,
  },
  inspectorLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  inspectorDate: {
    fontSize: 12,
    fontWeight: '700',
  },
  inspectorStat: {
    fontSize: 12,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  inspectorShieldChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  legendLabel: {
    fontSize: 10,
    fontWeight: '600',
  },
  legendBox: {
    width: 11,
    height: 11,
    borderRadius: 3,
    borderWidth: 0.75,
  },
});

export default HabitHeatmapConsole;
