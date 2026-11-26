import React, { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ArrowRight, ChevronLeft, ChevronRight } from 'lucide-react-native';
import { radii, spacing } from '../../theme/tokens';
import { useTheme } from '../../theme/ThemeContext';
import { LiquidGlassCard } from '../../components/glass/LiquidGlassCard';
import type { CalendarMonthRef } from './useDashboardData';

const WEEKDAY_HEADERS = ['LUN', 'MAR', 'MIÉ', 'JUE', 'VIE', 'SÁB', 'DOM'] as const;
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

interface CalendarDayCell {
  dateKey: string;
  dayNumber: number;
  inCurrentMonth: boolean;
}

function buildMonthGrid(year: number, month: number): CalendarDayCell[] {
  const firstDay = new Date(year, month, 1);
  const startOffset = (firstDay.getDay() + 6) % 7;
  const gridStart = new Date(year, month, 1 - startOffset);

  const cells: CalendarDayCell[] = [];
  for (let i = 0; i < 35; i++) {
    const d = new Date(gridStart);
    d.setDate(gridStart.getDate() + i);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    cells.push({
      dateKey: `${y}-${m}-${day}`,
      dayNumber: d.getDate(),
      inCurrentMonth: d.getMonth() === month && d.getFullYear() === year,
    });
  }
  return cells;
}

export interface MiniCalendarBentoProps {
  calendarMonth: CalendarMonthRef;
  selectedDateKey: string;
  todayKey: string;
  activeDaysInMonth: Set<string>;
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
  activeDaysInMonth,
  onSelectDate,
  onPrevMonth,
  onNextMonth,
  onGoToday,
  onOpenFullCalendar,
}) => {
  const { theme } = useTheme();
  const cells = useMemo(
    () => buildMonthGrid(calendarMonth.year, calendarMonth.month),
    [calendarMonth.year, calendarMonth.month]
  );

  const now = new Date();
  const isCurrentMonth =
    calendarMonth.year === now.getFullYear() &&
    calendarMonth.month === now.getMonth();

  const rows = useMemo(() => {
    const grouped: CalendarDayCell[][] = [];
    for (let i = 0; i < cells.length; i += 7) {
      grouped.push(cells.slice(i, i + 7));
    }
    return grouped;
  }, [cells]);

  return (
    <LiquidGlassCard
      variant="tonal"
      style={styles.card}
      contentStyle={styles.content}
    >
      {/* Header */}
      <View style={styles.headerRow}>
        <View>
          <Text style={[styles.title, { color: theme.textPrimary }]}>
            Días Activos
          </Text>
          <Text style={[styles.monthText, { color: theme.textSecondary }]}>
            {MONTH_NAMES[calendarMonth.month]} {calendarMonth.year}
          </Text>
        </View>

        <View style={styles.controlsRow}>
          {!isCurrentMonth ? (
            <Pressable
              onPress={onGoToday}
              style={[styles.todayChip, { backgroundColor: theme.pillBg }]}
            >
              <Text style={[styles.todayChipText, { color: theme.textPrimary }]}>
                Hoy
              </Text>
            </Pressable>
          ) : null}
          <Pressable
            onPress={onPrevMonth}
            style={[
              styles.navIconBtn,
              {
                backgroundColor: theme.card,
                borderColor: theme.glassBorder,
              },
            ]}
            accessibilityLabel="Mes anterior"
          >
            <ChevronLeft size={16} color={theme.textPrimary} strokeWidth={2.2} />
          </Pressable>
          <Pressable
            onPress={onNextMonth}
            style={[
              styles.navIconBtn,
              {
                backgroundColor: theme.card,
                borderColor: theme.glassBorder,
              },
            ]}
            accessibilityLabel="Mes siguiente"
          >
            <ChevronRight size={16} color={theme.textPrimary} strokeWidth={2.2} />
          </Pressable>
        </View>
      </View>

      {/* Cabecera días */}
      <View style={styles.weekHeaderRow}>
        {WEEKDAY_HEADERS.map((label) => (
          <Text
            key={label}
            style={[styles.weekHeaderLabel, { color: theme.textMuted }]}
          >
            {label}
          </Text>
        ))}
      </View>

      {/* Grilla de días circulares */}
      <View style={styles.grid}>
        {rows.map((row, rowIdx) => (
          <View key={rowIdx} style={styles.gridRow}>
            {row.map((cell) => {
              const isSelected = cell.dateKey === selectedDateKey;
              const isToday = cell.dateKey === todayKey;
              const hasActivity = activeDaysInMonth.has(cell.dateKey);

              return (
                <Pressable
                  key={cell.dateKey}
                  onPress={() => onSelectDate(cell.dateKey)}
                  style={[
                    styles.dayCell,
                    cell.inCurrentMonth
                      ? {
                          backgroundColor: theme.card,
                          borderWidth: 1,
                          borderColor: theme.glassBorder,
                        }
                      : {
                          backgroundColor: 'transparent',
                          borderWidth: 1,
                          borderStyle: 'dashed',
                          borderColor: theme.divider,
                        },
                    isToday &&
                      !isSelected && {
                        borderWidth: 1.5,
                        borderColor: theme.textPrimary,
                      },
                    isSelected && {
                      backgroundColor: theme.accentVolt,
                      borderWidth: 0,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.dayNumber,
                      {
                        color: cell.inCurrentMonth
                          ? theme.textPrimary
                          : theme.textMuted,
                      },
                      isSelected && {
                        color: theme.accentVoltText,
                        fontWeight: '800',
                      },
                    ]}
                  >
                    {cell.dayNumber}
                  </Text>
                  {hasActivity && !isSelected ? (
                    <View
                      style={[
                        styles.activityDot,
                        { backgroundColor: theme.accentCobaltBright },
                      ]}
                    />
                  ) : null}
                </Pressable>
              );
            })}
          </View>
        ))}
      </View>

      {/* Footer link */}
      <Pressable onPress={onOpenFullCalendar} style={styles.footerLink}>
        <Text style={[styles.footerLinkText, { color: theme.accentCobaltBright }]}>
          Abrir Calendario macOS
        </Text>
        <ArrowRight size={14} color={theme.accentCobaltBright} strokeWidth={2.2} />
      </Pressable>
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
  },
  title: {
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  monthText: {
    fontSize: 12,
    fontWeight: '500',
    marginTop: 2,
  },
  controlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  todayChip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radii.pill,
  },
  todayChipText: {
    fontSize: 11,
    fontWeight: '700',
  },
  navIconBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  weekHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  weekHeaderLabel: {
    flex: 1,
    textAlign: 'center',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.6,
  },
  grid: {
    gap: 6,
  },
  gridRow: {
    flexDirection: 'row',
    gap: 6,
  },
  dayCell: {
    flex: 1,
    aspectRatio: 1,
    maxHeight: 38,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayNumber: {
    fontSize: 12,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  activityDot: {
    position: 'absolute',
    bottom: 4,
    width: 4,
    height: 4,
    borderRadius: 2,
  },
  footerLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 5,
    paddingTop: 2,
  },
  footerLinkText: {
    fontSize: 12,
    fontWeight: '600',
  },
});

export default MiniCalendarBento;
