import React, { useMemo } from 'react';
import {
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  type ViewStyle,
} from 'react-native';
import type { TaskRecord, WorkBlockRecord } from '@organiza/shared/schema';
import {
  ArrowRight,
  Calendar,
  ChevronLeft,
  ChevronRight,
} from '../../components/icons';
import { radii, spacing, typography } from '../../theme/tokens';
import { useTheme } from '../../theme/ThemeContext';
import { LiquidGlassCard } from '../../components/glass/LiquidGlassCard';
import { getTaskEffectiveDateKey } from '../reminders/reminderUtils';
import {
  CALENDAR_COLORS,
  MONTH_SHORT_ES,
  hexWithAlpha,
  shiftDateKeyLocal,
} from '../calendar/calendarUtils';
import type { CalendarMonthRef } from './useDashboardData';

const WEEKDAY_HEADERS = [
  'lun',
  'mar',
  'mié',
  'jue',
  'vie',
  'sáb',
  'dom',
] as const;

const MONTH_NAMES = [
  'Enero',
  'Febrero',
  'Marzo',
  'Abril',
  'Mayo',
  'Junio',
  'Julio',
  'Agosto',
  'Septiembre',
  'Octubre',
  'Noviembre',
  'Diciembre',
] as const;

interface MonthCellItem {
  dateKey: string;
  dayNumber: number;
  monthIndex: number;
  inCurrentMonth: boolean;
}

interface PrimarySpanInfo {
  key: string;
  label: string;
  color: string;
  kind: 'shift' | 'rest';
}

interface WeekSpanSegment {
  key: string;
  label: string;
  color: string;
  kind: 'shift' | 'rest';
  startCol: number;
  span: number;
  continuesLeft: boolean;
  continuesRight: boolean;
}

interface CellSecondaryItem {
  id: string;
  title: string;
  color: string;
}

function buildMonthGrid42(year: number, month: number): MonthCellItem[] {
  const firstDay = new Date(year, month, 1);
  const startOffset = (firstDay.getDay() + 6) % 7;
  const gridStart = new Date(year, month, 1 - startOffset);

  const cells: MonthCellItem[] = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(gridStart);
    d.setDate(gridStart.getDate() + i);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    cells.push({
      dateKey: `${y}-${m}-${day}`,
      dayNumber: d.getDate(),
      monthIndex: d.getMonth(),
      inCurrentMonth: d.getMonth() === month && d.getFullYear() === year,
    });
  }
  return cells;
}

function cleanShiftLabel(rawTitle: string): string {
  const stripped = rawTitle.replace(/^Turno\s+/i, '').trim();
  return stripped || rawTitle;
}

function resolvePrimarySpanForDate(
  blocksOnDate: WorkBlockRecord[]
): PrimarySpanInfo | null {
  const shift = blocksOnDate.find((b) => b.blockType === 'work_shift');
  if (shift) {
    const color = shift.color || CALENDAR_COLORS.shiftPurple;
    const label = cleanShiftLabel(shift.title);
    return {
      key: `shift:${label}:${color}`,
      label,
      color,
      kind: 'shift',
    };
  }

  const rest = blocksOnDate.find((b) => b.blockType === 'break');
  if (rest) {
    const color = rest.color || CALENDAR_COLORS.habitEmerald;
    return {
      key: `rest:${color}`,
      label: 'Libre',
      color,
      kind: 'rest',
    };
  }

  return null;
}

function buildWeekSpanSegments(
  rowCells: MonthCellItem[],
  blocksByDate: Map<string, WorkBlockRecord[]>
): WeekSpanSegment[] {
  const primaryPerCol = rowCells.map((cell) =>
    resolvePrimarySpanForDate(blocksByDate.get(cell.dateKey) ?? [])
  );

  const segments: WeekSpanSegment[] = [];
  let col = 0;

  while (col < 7) {
    const info = primaryPerCol[col];
    if (!info) {
      col += 1;
      continue;
    }

    let endCol = col;
    while (
      endCol + 1 < 7 &&
      primaryPerCol[endCol + 1]?.key === info.key
    ) {
      endCol += 1;
    }

    const prevKey = shiftDateKeyLocal(rowCells[col]!.dateKey, -1);
    const nextKey = shiftDateKeyLocal(rowCells[endCol]!.dateKey, 1);
    const prevInfo = resolvePrimarySpanForDate(blocksByDate.get(prevKey) ?? []);
    const nextInfo = resolvePrimarySpanForDate(blocksByDate.get(nextKey) ?? []);

    segments.push({
      key: `${info.key}:${rowCells[col]!.dateKey}`,
      label: info.label,
      color: info.color,
      kind: info.kind,
      startCol: col,
      span: endCol - col + 1,
      continuesLeft: prevInfo?.key === info.key,
      continuesRight: nextInfo?.key === info.key,
    });

    col = endCol + 1;
  }

  return segments;
}

function webCursor(): ViewStyle | undefined {
  return Platform.OS === 'web'
    ? ({ cursor: 'pointer', userSelect: 'none' } as unknown as ViewStyle)
    : undefined;
}

export interface MiniCalendarBentoProps {
  calendarMonth: CalendarMonthRef;
  selectedDateKey: string;
  todayKey: string;
  activeDaysInMonth: Set<string>;
  allWorkBlocks?: WorkBlockRecord[];
  tasks?: TaskRecord[];
  onSelectDate: (dateKey: string) => void;
  onPrevMonth: () => void;
  onNextMonth: () => void;
  onGoToday: () => void;
  onOpenFullCalendar: () => void;
}

export const MiniCalendarBento: React.FC<MiniCalendarBentoProps> = ({
  calendarMonth,
  selectedDateKey,
  todayKey,
  allWorkBlocks = [],
  tasks = [],
  onSelectDate,
  onPrevMonth,
  onNextMonth,
  onGoToday,
  onOpenFullCalendar,
}) => {
  const { theme, isDark } = useTheme();

  const cells = useMemo(
    () => buildMonthGrid42(calendarMonth.year, calendarMonth.month),
    [calendarMonth.year, calendarMonth.month]
  );

  const rows = useMemo(() => {
    const grouped: MonthCellItem[][] = [];
    for (let i = 0; i < cells.length; i += 7) {
      grouped.push(cells.slice(i, i + 7));
    }
    return grouped;
  }, [cells]);

  const { blocksByDate, secondaryByDate } = useMemo(() => {
    const bMap = new Map<string, WorkBlockRecord[]>();
    const secMap = new Map<string, CellSecondaryItem[]>();

    for (const blk of allWorkBlocks) {
      if (blk.deletedAt) continue;
      const list = bMap.get(blk.dateKey);
      if (list) list.push(blk);
      else bMap.set(blk.dateKey, [blk]);

      if (blk.blockType !== 'work_shift' && blk.blockType !== 'break') {
        const secList = secMap.get(blk.dateKey) ?? [];
        secList.push({
          id: `blk-${blk.id}`,
          title: blk.title,
          color:
            blk.color ||
            (blk.blockType === 'meeting'
              ? '#F59E0B'
              : CALENDAR_COLORS.coral),
        });
        secMap.set(blk.dateKey, secList);
      }
    }

    for (const t of tasks) {
      if (t.deletedAt || t.isCompleted) continue;
      const effectiveKey = getTaskEffectiveDateKey(t);
      if (!effectiveKey) continue;
      const secList = secMap.get(effectiveKey) ?? [];
      secList.push({
        id: `task-${t.id}`,
        title: t.title,
        color:
          t.priority === 3 || t.isFlagged
            ? CALENDAR_COLORS.coral
            : '#0EA5E9',
      });
      secMap.set(effectiveKey, secList);
    }

    return { blocksByDate: bMap, secondaryByDate: secMap };
  }, [allWorkBlocks, tasks]);

  return (
    <LiquidGlassCard
      variant="tonal"
      fillHeight
      style={styles.card}
      contentStyle={styles.content}
    >
      {/* Header estilo macOS Calendar */}
      <View style={styles.headerRow}>
        <Text style={[styles.monthHeadline, { color: theme.textPrimary }]}>
          {MONTH_NAMES[calendarMonth.month]} de {calendarMonth.year}
        </Text>

        <View style={styles.controlsRow}>
          <View
            style={[
              styles.segmentedNav,
              {
                backgroundColor: theme.card,
                borderColor: theme.glassBorder,
              },
            ]}
          >
            <Pressable
              onPress={onPrevMonth}
              style={styles.segArrowBtn}
              accessibilityLabel="Mes anterior"
            >
              <ChevronLeft
                size={14}
                color={theme.textPrimary}
                strokeWidth={2.2}
              />
            </Pressable>
            <Pressable onPress={onGoToday} style={styles.segTodayBtn}>
              <Text style={[styles.segTodayText, { color: theme.textPrimary }]}>
                Hoy
              </Text>
            </Pressable>
            <Pressable
              onPress={onNextMonth}
              style={styles.segArrowBtn}
              accessibilityLabel="Mes siguiente"
            >
              <ChevronRight
                size={14}
                color={theme.textPrimary}
                strokeWidth={2.2}
              />
            </Pressable>
          </View>

          <Pressable
            onPress={onOpenFullCalendar}
            style={[
              styles.openBtn,
              {
                backgroundColor: CALENDAR_COLORS.coralSoft,
                borderColor: CALENDAR_COLORS.coralBorder,
              },
            ]}
          >
            <Text style={[styles.openBtnText, { color: CALENDAR_COLORS.coral }]}>
              Agenda
            </Text>
            <ArrowRight size={13} color={CALENDAR_COLORS.coral} strokeWidth={2.3} />
          </Pressable>
        </View>
      </View>

      {/* Cabecera días lun..dom */}
      <View style={[styles.weekHeaderRow, { borderColor: theme.divider }]}>
        {WEEKDAY_HEADERS.map((label, idx) => (
          <Text
            key={label}
            style={[
              styles.weekHeaderLabel,
              {
                color: idx >= 5 ? theme.textMuted : theme.textSecondary,
              },
            ]}
          >
            {label}
          </Text>
        ))}
      </View>

      {/* Grilla mensual amplia estilo Apple Calendar (6x7) */}
      <View
        style={[
          styles.monthTable,
          { borderColor: theme.divider, backgroundColor: theme.card },
        ]}
      >
        {rows.map((row, rowIdx) => {
          const spanSegments = buildWeekSpanSegments(row, blocksByDate);

          return (
            <View
              key={rowIdx}
              style={[
                styles.weekRow,
                rowIdx < rows.length - 1 && {
                  borderBottomWidth: 1,
                  borderBottomColor: theme.divider,
                },
              ]}
            >
              {/* Celdas individuales */}
              {row.map((cell, colIdx) => {
                const isSelected = cell.dateKey === selectedDateKey;
                const isToday = cell.dateKey === todayKey;
                const secItems = secondaryByDate.get(cell.dateKey) ?? [];
                const dayLabel =
                  cell.dayNumber === 1
                    ? `${cell.dayNumber} ${MONTH_SHORT_ES[cell.monthIndex] ?? ''}.`
                    : String(cell.dayNumber);

                return (
                  <Pressable
                    key={cell.dateKey}
                    onPress={() => onSelectDate(cell.dateKey)}
                    style={[
                      styles.dayCell,
                      colIdx < 6 && {
                        borderRightWidth: 1,
                        borderRightColor: theme.divider,
                      },
                      colIdx >= 5 && {
                        backgroundColor: isDark
                          ? 'rgba(255,255,255,0.015)'
                          : 'rgba(15,17,21,0.015)',
                      },
                      isSelected &&
                        !isToday && {
                          backgroundColor: CALENDAR_COLORS.coralSoft,
                        },
                      webCursor(),
                    ]}
                    accessibilityRole="button"
                    accessibilityLabel={`Día ${cell.dateKey}`}
                    accessibilityState={{ selected: isSelected }}
                  >
                    <View style={styles.cellTopRow}>
                      <View
                        style={[
                          styles.dayNumBadge,
                          isToday && {
                            backgroundColor: CALENDAR_COLORS.coral,
                          },
                          isSelected &&
                            !isToday && {
                              borderWidth: 1.5,
                              borderColor: CALENDAR_COLORS.coral,
                            },
                        ]}
                      >
                        <Text
                          style={[
                            styles.dayNumText,
                            {
                              color: isToday
                                ? '#FFFFFF'
                                : cell.inCurrentMonth
                                  ? theme.textPrimary
                                  : theme.textMuted,
                            },
                          ]}
                          numberOfLines={1}
                        >
                          {dayLabel}
                        </Text>
                      </View>
                    </View>

                    {/* Carril reservado para barras continuas + eventos secundarios */}
                    <View style={styles.cellEventsStack}>
                      {secItems.slice(0, 2).map((ev) => (
                        <View
                          key={ev.id}
                          style={[
                            styles.secondaryPill,
                            {
                              backgroundColor: hexWithAlpha(
                                ev.color,
                                isDark ? 0.24 : 0.14
                              ),
                            },
                          ]}
                        >
                          <View
                            style={[
                              styles.secondaryDot,
                              { backgroundColor: ev.color },
                            ]}
                          />
                          <Text
                            style={[
                              styles.secondaryText,
                              {
                                color: isDark ? theme.textPrimary : ev.color,
                              },
                            ]}
                            numberOfLines={1}
                          >
                            {ev.title}
                          </Text>
                        </View>
                      ))}
                      {secItems.length > 2 ? (
                        <Text
                          style={[styles.moreLabel, { color: theme.textMuted }]}
                        >
                          +{secItems.length - 2}
                        </Text>
                      ) : null}
                    </View>
                  </Pressable>
                );
              })}

              {/* Barras continuas multi-día de Turnos y Días Libres */}
              <View pointerEvents="none" style={styles.spanOverlayLayer}>
                {spanSegments.map((seg) => {
                  const leftPct = (seg.startCol / 7) * 100;
                  const widthPct = (seg.span / 7) * 100;
                  const bg = hexWithAlpha(seg.color, isDark ? 0.28 : 0.16);

                  return (
                    <View
                      key={seg.key}
                      style={[
                        styles.spanBarOuter,
                        {
                          left: `${leftPct}%` as unknown as number,
                          width: `${widthPct}%` as unknown as number,
                          paddingLeft: seg.continuesLeft ? 0 : 2,
                          paddingRight: seg.continuesRight ? 0 : 2,
                        },
                      ]}
                    >
                      <View
                        style={[
                          styles.spanBarPill,
                          {
                            backgroundColor: bg,
                            borderTopLeftRadius: seg.continuesLeft ? 0 : 5,
                            borderBottomLeftRadius: seg.continuesLeft ? 0 : 5,
                            borderTopRightRadius: seg.continuesRight ? 0 : 5,
                            borderBottomRightRadius: seg.continuesRight
                              ? 0
                              : 5,
                          },
                        ]}
                      >
                        <View
                          style={[
                            styles.spanIconBadge,
                            { backgroundColor: seg.color },
                          ]}
                        >
                          <Calendar size={8} color="#FFFFFF" strokeWidth={2.4} />
                        </View>
                        <Text
                          style={[
                            styles.spanBarText,
                            {
                              color: isDark ? '#F5F7FA' : seg.color,
                            },
                          ]}
                          numberOfLines={1}
                        >
                          {seg.label}
                        </Text>
                      </View>
                    </View>
                  );
                })}
              </View>
            </View>
          );
        })}
      </View>
    </LiquidGlassCard>
  );
};

const styles = StyleSheet.create({
  card: {
    borderRadius: 24,
  },
  content: {
    flex: 1,
    gap: spacing.sm,
    padding: spacing.md,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 8,
  },
  monthHeadline: {
    fontSize: 20,
    ...typography.screenTitle,
  },
  controlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  segmentedNav: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radii.pill,
    borderWidth: 1,
    height: 30,
    paddingHorizontal: 3,
  },
  segArrowBtn: {
    width: 26,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segTodayBtn: {
    paddingHorizontal: 8,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segTodayText: {
    fontSize: 11,
    ...typography.bodySemiBold,
  },
  openBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    height: 30,
    paddingHorizontal: 10,
    borderRadius: radii.pill,
    borderWidth: 1,
  },
  openBtnText: {
    fontSize: 11,
    ...typography.bodyBold,
  },
  weekHeaderRow: {
    flexDirection: 'row',
    paddingBottom: 4,
  },
  weekHeaderLabel: {
    flex: 1,
    textAlign: 'right',
    paddingRight: 6,
    fontSize: 11,
    fontWeight: '600',
  },
  monthTable: {
    flex: 1,
    borderRadius: radii.md,
    borderWidth: 1,
    overflow: 'hidden',
  },
  weekRow: {
    flex: 1,
    minHeight: 74,
    flexDirection: 'row',
    position: 'relative',
  },
  dayCell: {
    flex: 1,
    paddingHorizontal: 3,
    paddingTop: 4,
    paddingBottom: 4,
    justifyContent: 'space-between',
  },
  cellTopRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  dayNumBadge: {
    minWidth: 20,
    height: 20,
    paddingHorizontal: 4,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayNumText: {
    fontSize: 11,
    fontVariant: ['tabular-nums'],
    ...typography.bodySemiBold,
  },
  cellEventsStack: {
    marginTop: 22,
    gap: 2,
  },
  secondaryPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    height: 15,
    paddingHorizontal: 4,
    borderRadius: 4,
  },
  secondaryDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
  },
  secondaryText: {
    flex: 1,
    fontSize: 9.5,
    fontWeight: '600',
  },
  moreLabel: {
    fontSize: 9,
    fontWeight: '700',
    paddingLeft: 3,
  },
  spanOverlayLayer: {
    position: 'absolute',
    top: 26,
    left: 0,
    right: 0,
    height: 17,
  },
  spanBarOuter: {
    position: 'absolute',
    top: 0,
    height: 17,
  },
  spanBarPill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 4,
  },
  spanIconBadge: {
    width: 12,
    height: 12,
    borderRadius: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  spanBarText: {
    flex: 1,
    fontSize: 10,
    fontWeight: '700',
  },
});

export default MiniCalendarBento;
