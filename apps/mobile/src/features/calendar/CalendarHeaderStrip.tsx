import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import {
  Briefcase,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Layers,
  Plus,
} from '../../components/icons';
import { LiquidGlassCard } from '../../components/glass/LiquidGlassCard';
import { WeekDayLensPill } from '../dashboard/CalendarDayCell';
import {
  iconMetrics,
  radii,
  shadows,
  spacing,
  typography,
} from '../../theme/tokens';
import { useTheme } from '../../theme/ThemeContext';
import {
  CALENDAR_COLORS,
  WEEKDAY_LETTERS,
  buildMonthMatrix,
  buildScrollableRibbonDays,
  dateKeyToLocalDate,
  formatDateHeadlineEs,
  formatMonthYearEs,
  shiftDateKeyLocal,
  triggerCalendarHaptic,
} from './calendarUtils';
import type { DayActivityDots } from './useCalendarSchedule';

export interface CalendarHeaderStripProps {
  selectedDateKey: string;
  todayKey: string;
  isMonthExpanded: boolean;
  onToggleMonthExpanded: (next?: boolean) => void;
  onSelectDate: (dateKey: string) => void;
  getDayActivityDots: (dateKey: string) => DayActivityDots;
  unscheduledCount: number;
  isTrayOpen: boolean;
  onToggleTray: () => void;
  onOpenShiftPainter: () => void;
  onOpenNewEvent: () => void;
}

const MONTH_SPRING = { damping: 19, stiffness: 230, mass: 0.78 };

export const CalendarHeaderStrip: React.FC<CalendarHeaderStripProps> = ({
  selectedDateKey,
  todayKey,
  isMonthExpanded,
  onToggleMonthExpanded,
  onSelectDate,
  getDayActivityDots,
  unscheduledCount,
  isTrayOpen,
  onToggleTray,
  onOpenShiftPainter,
  onOpenNewEvent,
}) => {
  const { theme } = useTheme();
  const { width: windowWidth } = useWindowDimensions();

  const selectedDateObj = useMemo(
    () => dateKeyToLocalDate(selectedDateKey),
    [selectedDateKey]
  );
  const [visibleMonth, setVisibleMonth] = useState<{
    year: number;
    month: number;
  }>(() => ({
    year: selectedDateObj.getFullYear(),
    month: selectedDateObj.getMonth(),
  }));

  useEffect(() => {
    setVisibleMonth({
      year: selectedDateObj.getFullYear(),
      month: selectedDateObj.getMonth(),
    });
  }, [selectedDateObj]);

  // Ancla de la cinta horizontal de 63 días (solo se re-ancla si el usuario sale del rango)
  const [ribbonAnchorKey, setRibbonAnchorKey] = useState<string>(selectedDateKey);

  const ribbonDays = useMemo(
    () => buildScrollableRibbonDays(ribbonAnchorKey, todayKey),
    [ribbonAnchorKey, todayKey]
  );

  useEffect(() => {
    const exists = ribbonDays.some((d) => d.dateKey === selectedDateKey);
    if (!exists) {
      setRibbonAnchorKey(selectedDateKey);
    }
  }, [ribbonDays, selectedDateKey]);

  // Cálculo responsivo: 7 días al centro + peek de días anteriores y próximos con sombra lateral
  const { pillWidth, pillGap, peekPerSide, ribbonViewportWidth } = useMemo(() => {
    const maxCardWidth = Math.min(windowWidth - spacing.md * 2, 928);
    const arrowReserve = 52;
    const available = Math.max(260, maxCardWidth - arrowReserve - spacing.md * 2);
    const gap = windowWidth < 430 ? 5 : 8;
    // Reservamos espacio equivalente a ~8.3 píldoras (7 centrales + 0.65 peek a cada lado)
    const computedPill = Math.max(
      34,
      Math.min(58, Math.floor((available - gap * 7) / 8.3))
    );
    const sevenWidth = computedPill * 7 + gap * 6;
    const peek = Math.max(
      14,
      Math.min(Math.round(computedPill * 0.68), Math.floor((available - sevenWidth) / 2))
    );
    return {
      pillWidth: computedPill,
      pillGap: gap,
      peekPerSide: peek,
      ribbonViewportWidth: sevenWidth + peek * 2,
    };
  }, [windowWidth]);

  const stepWidth = pillWidth + pillGap;
  const ribbonScrollRef = useRef<ScrollView>(null);
  const scrollOffsetXRef = useRef(0);
  const hasInitializedScrollRef = useRef(false);

  const scrollToCenterDate = useCallback(
    (targetDateKey: string, animated: boolean) => {
      const idx = ribbonDays.findIndex((d) => d.dateKey === targetDateKey);
      if (idx < 0) return;
      const maxScroll = Math.max(
        0,
        ribbonDays.length * stepWidth - pillGap + peekPerSide * 2 - ribbonViewportWidth
      );
      const targetOffset = Math.max(
        0,
        Math.min(maxScroll, (idx - 3) * stepWidth)
      );
      scrollOffsetXRef.current = targetOffset;
      ribbonScrollRef.current?.scrollTo({ x: targetOffset, animated });
    },
    [ribbonDays, stepWidth, pillGap, peekPerSide, ribbonViewportWidth]
  );

  useEffect(() => {
    if (isMonthExpanded) return;
    const idx = ribbonDays.findIndex((d) => d.dateKey === selectedDateKey);
    if (idx < 0) return;

    if (!hasInitializedScrollRef.current) {
      hasInitializedScrollRef.current = true;
      const timer = setTimeout(() => {
        scrollToCenterDate(selectedDateKey, false);
      }, 40);
      return () => clearTimeout(timer);
    }

    // Si el día seleccionado queda en los bordes de peek, centrar animadamente la ventana de 7 días
    const itemLeft = peekPerSide + idx * stepWidth;
    const itemRight = itemLeft + pillWidth;
    const viewLeft = scrollOffsetXRef.current + peekPerSide;
    const viewRight =
      scrollOffsetXRef.current + ribbonViewportWidth - peekPerSide;
    if (itemLeft < viewLeft + 2 || itemRight > viewRight - 2) {
      scrollToCenterDate(selectedDateKey, true);
    }
  }, [
    isMonthExpanded,
    peekPerSide,
    pillWidth,
    ribbonDays,
    ribbonViewportWidth,
    scrollToCenterDate,
    selectedDateKey,
    stepWidth,
  ]);

  const monthCells = useMemo(
    () => buildMonthMatrix(visibleMonth.year, visibleMonth.month, todayKey),
    [visibleMonth.year, visibleMonth.month, todayKey]
  );

  const monthRows = useMemo(() => {
    const rows: typeof monthCells[] = [];
    for (let i = 0; i < monthCells.length; i += 7) {
      rows.push(monthCells.slice(i, i + 7));
    }
    return rows;
  }, [monthCells]);

  // Animación spring para vista mensual colapsable
  const expandProgress = useSharedValue(isMonthExpanded ? 1 : 0);

  useEffect(() => {
    expandProgress.value = withSpring(isMonthExpanded ? 1 : 0, MONTH_SPRING);
  }, [isMonthExpanded, expandProgress]);

  const monthAnimatedStyle = useAnimatedStyle(() => ({
    maxHeight: expandProgress.value * 340,
    opacity: expandProgress.value,
    transform: [{ translateY: (1 - expandProgress.value) * -8 }],
  }));

  const chevronAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${expandProgress.value * 180}deg` }],
  }));

  const shiftWeek = (deltaWeeks: number) => {
    triggerCalendarHaptic('light');
    const nextDate = shiftDateKeyLocal(selectedDateKey, deltaWeeks * 7);
    onSelectDate(nextDate);
    scrollToCenterDate(nextDate, true);
  };

  const shiftMonth = (deltaMonths: number) => {
    triggerCalendarHaptic('light');
    setVisibleMonth((prev) => {
      const next = new Date(prev.year, prev.month + deltaMonths, 1);
      return { year: next.getFullYear(), month: next.getMonth() };
    });
  };

  const handleJumpToday = () => {
    triggerCalendarHaptic('selection');
    onSelectDate(todayKey);
    setTimeout(() => {
      scrollToCenterDate(todayKey, true);
    }, 30);
  };

  // Gesto deslizar hacia abajo sobre el encabezado para desplegar / colapsar el mes
  const headerPullGesture = useMemo(
    () =>
      Gesture.Pan()
        .activeOffsetY([-12, 12])
        .failOffsetX([-20, 20])
        .onEnd((e) => {
          if (e.translationY > 24 || e.velocityY > 260) {
            runOnJS(triggerCalendarHaptic)('light');
            runOnJS(onToggleMonthExpanded)(true);
          } else if (e.translationY < -24 || e.velocityY < -260) {
            runOnJS(triggerCalendarHaptic)('light');
            runOnJS(onToggleMonthExpanded)(false);
          }
        }),
    [onToggleMonthExpanded]
  );

  return (
    <LiquidGlassCard
      variant="glass"
      intensity={76}
      noPadding
      style={styles.card}
      contentStyle={styles.cardContent}
    >
      {/* Zona superior con gesto de arrastre vertical */}
      <GestureDetector gesture={headerPullGesture}>
        <View style={styles.topSection}>
          <View style={styles.topRow}>
            <Pressable
              onPress={() => {
                triggerCalendarHaptic('light');
                onToggleMonthExpanded();
              }}
              style={styles.monthTrigger}
              hitSlop={8}
            >
              <View>
                <View style={styles.monthTitleRow}>
                  <Text style={[styles.monthTitle, { color: theme.textPrimary }]}>
                    {formatMonthYearEs(visibleMonth.year, visibleMonth.month)}
                  </Text>
                  <Animated.View style={chevronAnimatedStyle}>
                    <ChevronDown
                      size={16}
                      color={theme.textSecondary}
                      strokeWidth={2.2}
                    />
                  </Animated.View>
                </View>
                <Text style={[styles.dateSubTitle, { color: theme.textSecondary }]}>
                  {formatDateHeadlineEs(selectedDateKey, todayKey)}
                </Text>
              </View>
            </Pressable>

            <View style={styles.actionsRow}>
              {selectedDateKey !== todayKey ? (
                <Pressable
                  onPress={handleJumpToday}
                  style={[
                    styles.pillBtn,
                    {
                      backgroundColor: CALENDAR_COLORS.coralSoft,
                      borderColor: CALENDAR_COLORS.coralBorder,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.pillBtnText,
                      { color: CALENDAR_COLORS.coral },
                    ]}
                  >
                    Hoy
                  </Text>
                </Pressable>
              ) : null}

              <Pressable
                onPress={onOpenShiftPainter}
                style={[
                  styles.pillBtn,
                  {
                    backgroundColor: CALENDAR_COLORS.shiftPurpleSoft,
                    borderColor: CALENDAR_COLORS.shiftPurpleBorder,
                  },
                ]}
                accessibilityLabel="Bloque de trabajo 6x4 y plantillas"
              >
                <Briefcase
                  size={13}
                  color={CALENDAR_COLORS.shiftPurple}
                  strokeWidth={2}
                />
                <Text
                  style={[
                    styles.pillBtnText,
                    { color: CALENDAR_COLORS.shiftPurple },
                  ]}
                >
                  Bloque 6×4
                </Text>
              </Pressable>

              <Pressable
                onPress={() => {
                  triggerCalendarHaptic('light');
                  onToggleTray();
                }}
                style={[
                  styles.pillBtn,
                  {
                    backgroundColor: isTrayOpen
                      ? CALENDAR_COLORS.reminderCoralSoft
                      : theme.pillBg,
                    borderColor: isTrayOpen
                      ? CALENDAR_COLORS.reminderCoralBorder
                      : theme.glassBorder,
                  },
                ]}
                accessibilityLabel="Pendientes sin programar"
              >
                <Layers
                  size={13}
                  color={
                    isTrayOpen || unscheduledCount > 0
                      ? CALENDAR_COLORS.reminderCoral
                      : theme.textSecondary
                  }
                  strokeWidth={2}
                />
                <Text
                  style={[
                    styles.pillBtnText,
                    {
                      color: isTrayOpen
                        ? CALENDAR_COLORS.reminderCoral
                        : theme.textPrimary,
                    },
                  ]}
                >
                  Pendientes · {unscheduledCount}
                </Text>
              </Pressable>

              <Pressable
                onPress={onOpenNewEvent}
                style={[
                  styles.addFabBtn,
                  { backgroundColor: CALENDAR_COLORS.coral },
                ]}
                accessibilityLabel="Nuevo evento o bloque"
              >
                <Plus size={17} color="#FFFFFF" strokeWidth={2.4} />
              </Pressable>
            </View>
          </View>
        </View>
      </GestureDetector>

      {/* Barra Deslizable Horizontal con 7 días al centro (WeekDayLensPill animado) */}
      {!isMonthExpanded ? (
        <View style={styles.centeredRibbonOuter}>
          <Pressable
            onPress={() => shiftWeek(-1)}
            hitSlop={8}
            style={styles.weekArrowBtn}
            accessibilityLabel="Semana anterior"
          >
            <ChevronLeft
              size={16}
              color={theme.textMuted}
              strokeWidth={iconMetrics.strokeWidth}
            />
          </Pressable>

          <View
            style={[
              styles.ribbonViewportBox,
              { width: ribbonViewportWidth },
            ]}
          >
            <ScrollView
              ref={ribbonScrollRef}
              horizontal
              showsHorizontalScrollIndicator={false}
              decelerationRate="fast"
              snapToInterval={stepWidth}
              snapToAlignment="start"
              onLayout={() => {
                if (!hasInitializedScrollRef.current) {
                  hasInitializedScrollRef.current = true;
                  scrollToCenterDate(selectedDateKey, false);
                }
              }}
              onScroll={(e) => {
                scrollOffsetXRef.current = e.nativeEvent.contentOffset.x;
              }}
              scrollEventThrottle={16}
              contentContainerStyle={[
                styles.weekRibbonContent,
                { gap: pillGap, paddingHorizontal: peekPerSide },
              ]}
            >
              {ribbonDays.map((day) => {
                const isSelected = day.dateKey === selectedDateKey;
                const dots = getDayActivityDots(day.dateKey);

                return (
                  <WeekDayLensPill
                    key={day.dateKey}
                    dateKey={day.dateKey}
                    dayShort={day.dayShort}
                    dayNum={day.dayNum}
                    isSelected={isSelected}
                    isToday={day.isToday}
                    activityDots={dots}
                    pillWidth={pillWidth}
                    onSelect={(dateKey) => {
                      triggerCalendarHaptic('selection');
                      onSelectDate(dateKey);
                    }}
                    borderRadius={radii.md}
                  />
                );
              })}
            </ScrollView>

            {/* Sombras de degradado lateral para previsualizar días anteriores y próximos */}
            <View
              pointerEvents="none"
              style={[styles.edgeFadeLeft, { width: peekPerSide + 6 }]}
            >
              <Svg width="100%" height="100%">
                <Defs>
                  <LinearGradient id="ribbonFadeLeft" x1="0" y1="0" x2="1" y2="0">
                    <Stop offset="0" stopColor={theme.card} stopOpacity="0.96" />
                    <Stop offset="0.55" stopColor={theme.card} stopOpacity="0.52" />
                    <Stop offset="1" stopColor={theme.card} stopOpacity="0" />
                  </LinearGradient>
                </Defs>
                <Rect
                  x="0"
                  y="0"
                  width="100%"
                  height="100%"
                  fill="url(#ribbonFadeLeft)"
                />
              </Svg>
            </View>

            <View
              pointerEvents="none"
              style={[styles.edgeFadeRight, { width: peekPerSide + 6 }]}
            >
              <Svg width="100%" height="100%">
                <Defs>
                  <LinearGradient id="ribbonFadeRight" x1="0" y1="0" x2="1" y2="0">
                    <Stop offset="0" stopColor={theme.card} stopOpacity="0" />
                    <Stop offset="0.45" stopColor={theme.card} stopOpacity="0.52" />
                    <Stop offset="1" stopColor={theme.card} stopOpacity="0.96" />
                  </LinearGradient>
                </Defs>
                <Rect
                  x="0"
                  y="0"
                  width="100%"
                  height="100%"
                  fill="url(#ribbonFadeRight)"
                />
              </Svg>
            </View>
          </View>

          <Pressable
            onPress={() => shiftWeek(1)}
            hitSlop={8}
            style={styles.weekArrowBtn}
            accessibilityLabel="Semana siguiente"
          >
            <ChevronRight
              size={16}
              color={theme.textMuted}
              strokeWidth={iconMetrics.strokeWidth}
            />
          </Pressable>
        </View>
      ) : null}

      {/* Vista Mensual Colapsable con Spring Physics */}
      <Animated.View
        style={[styles.monthCollapsible, monthAnimatedStyle]}
        pointerEvents={isMonthExpanded ? 'auto' : 'none'}
      >
        <View style={styles.monthNavRow}>
          <View style={styles.monthLegendRow}>
            <View style={styles.legendItem}>
              <View
                style={[styles.dot, { backgroundColor: CALENDAR_COLORS.eventDotGray }]}
              />
              <Text style={[styles.legendLabel, { color: theme.textMuted }]}>
                Eventos
              </Text>
            </View>
            <View style={styles.legendItem}>
              <View
                style={[styles.dot, { backgroundColor: CALENDAR_COLORS.reminderCoral }]}
              />
              <Text style={[styles.legendLabel, { color: theme.textMuted }]}>
                Avisos
              </Text>
            </View>
            <View style={styles.legendItem}>
              <View
                style={[styles.dot, { backgroundColor: CALENDAR_COLORS.habitEmerald }]}
              />
              <Text style={[styles.legendLabel, { color: theme.textMuted }]}>
                Hábitos / Libre
              </Text>
            </View>
          </View>

          <View style={styles.monthArrowsRow}>
            <Pressable
              onPress={() => shiftMonth(-1)}
              style={[
                styles.monthNavBtn,
                { backgroundColor: theme.pillBg, borderColor: theme.glassBorder },
              ]}
              accessibilityLabel="Mes anterior"
            >
              <ChevronLeft size={14} color={theme.textPrimary} strokeWidth={2.1} />
            </Pressable>
            <Pressable
              onPress={() => shiftMonth(1)}
              style={[
                styles.monthNavBtn,
                { backgroundColor: theme.pillBg, borderColor: theme.glassBorder },
              ]}
              accessibilityLabel="Mes siguiente"
            >
              <ChevronRight size={14} color={theme.textPrimary} strokeWidth={2.1} />
            </Pressable>
          </View>
        </View>

        <View style={styles.monthWeekdayHeader}>
          {WEEKDAY_LETTERS.map((letter, idx) => (
            <Text
              key={`${letter}-${idx}`}
              style={[styles.monthWeekdayText, { color: theme.textMuted }]}
            >
              {letter}
            </Text>
          ))}
        </View>

        <View style={styles.monthGrid}>
          {monthRows.map((row, rowIdx) => (
            <View key={rowIdx} style={styles.monthGridRow}>
              {row.map((cell) => {
                const isSelected = cell.dateKey === selectedDateKey;
                const dots = getDayActivityDots(cell.dateKey);

                return (
                  <Pressable
                    key={cell.dateKey}
                    onPress={() => {
                      triggerCalendarHaptic('selection');
                      onSelectDate(cell.dateKey);
                      setTimeout(() => {
                        scrollToCenterDate(cell.dateKey, true);
                      }, 40);
                    }}
                    style={styles.monthDayCell}
                    accessibilityRole="button"
                    accessibilityLabel={`Día ${cell.dayNumber}`}
                    accessibilityState={{ selected: isSelected }}
                  >
                    <View
                      style={[
                        styles.monthDayCircle,
                        !isSelected &&
                          dots.isRestDay && {
                            backgroundColor: CALENDAR_COLORS.habitEmeraldSoft,
                          },
                        isSelected && {
                          backgroundColor: theme.accentPrimary,
                        },
                        !isSelected &&
                          cell.isToday && {
                            borderWidth: 1.5,
                            borderColor: theme.accentPrimary,
                          },
                      ]}
                    >
                      <Text
                        style={[
                          styles.monthDayNumber,
                          {
                            color: isSelected
                              ? '#FFFFFF'
                              : cell.isToday
                                ? theme.accentPrimary
                                : cell.inCurrentMonth
                                  ? theme.textPrimary
                                  : theme.textMuted,
                          },
                        ]}
                      >
                        {cell.dayNumber}
                      </Text>
                    </View>

                    {dots.hasEvent || dots.hasReminder || dots.hasHabit ? (
                      <View style={styles.dotsRow}>
                        {dots.hasEvent ? (
                          <View
                            style={[
                              styles.dot,
                              { backgroundColor: CALENDAR_COLORS.eventDotGray },
                            ]}
                          />
                        ) : null}
                        {dots.hasReminder ? (
                          <View
                            style={[
                              styles.dot,
                              { backgroundColor: CALENDAR_COLORS.reminderCoral },
                            ]}
                          />
                        ) : null}
                        {dots.hasHabit ? (
                          <View
                            style={[
                              styles.dot,
                              { backgroundColor: CALENDAR_COLORS.habitEmerald },
                            ]}
                          />
                        ) : null}
                      </View>
                    ) : (
                      <View style={styles.dotsRowPlaceholder} />
                    )}
                  </Pressable>
                );
              })}
            </View>
          ))}
        </View>
      </Animated.View>

      {/* Tirador táctil para deslizar / alternar vista mensual */}
      <GestureDetector gesture={headerPullGesture}>
        <Pressable
          onPress={() => {
            triggerCalendarHaptic('light');
            onToggleMonthExpanded();
          }}
          style={styles.grabberHitArea}
          accessibilityLabel={
            isMonthExpanded ? 'Colapsar mes' : 'Desplegar mes completo'
          }
        >
          <View
            style={[
              styles.grabberBar,
              { backgroundColor: theme.glassBorderStrong },
            ]}
          />
        </Pressable>
      </GestureDetector>
    </LiquidGlassCard>
  );
};

const styles = StyleSheet.create({
  card: {
    borderRadius: radii.lg,
    ...shadows.floatingDock,
  },
  cardContent: {
    paddingTop: spacing.md,
    paddingHorizontal: spacing.md,
    paddingBottom: 6,
    gap: 8,
  },
  topSection: {
    gap: 4,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    flexWrap: 'wrap',
  },
  monthTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  monthTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  monthTitle: {
    fontSize: 19,
    ...typography.screenTitle,
  },
  dateSubTitle: {
    fontSize: 12,
    marginTop: 1,
    ...typography.bodyMedium,
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  pillBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    height: 30,
    borderRadius: radii.pill,
    borderWidth: 1,
  },
  pillBtnText: {
    fontSize: 11,
    ...typography.bodySemiBold,
  },
  addFabBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  centeredRibbonOuter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    paddingVertical: 2,
    gap: 2,
  },
  weekArrowBtn: {
    width: 24,
    height: 68,
    alignItems: 'center',
    justifyContent: 'center',
  },
  weekRibbonContent: {
    paddingVertical: 8,
    overflow: 'visible',
  },
  ribbonViewportBox: {
    position: 'relative',
    overflow: 'hidden',
  },
  edgeFadeLeft: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    zIndex: 10,
  },
  edgeFadeRight: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    zIndex: 10,
  },
  dotsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    height: 6,
  },
  dotsRowPlaceholder: {
    height: 6,
  },
  dot: {
    width: 4.5,
    height: 4.5,
    borderRadius: 2.25,
  },
  monthCollapsible: {
    overflow: 'hidden',
    gap: 6,
  },
  monthNavRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
  },
  monthLegendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  legendLabel: {
    fontSize: 10,
    ...typography.bodyMedium,
  },
  monthArrowsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  monthNavBtn: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  monthWeekdayHeader: {
    flexDirection: 'row',
    paddingHorizontal: 2,
  },
  monthWeekdayText: {
    flex: 1,
    textAlign: 'center',
    fontSize: 10,
    fontWeight: '700',
  },
  monthGrid: {
    gap: 2,
  },
  monthGridRow: {
    flexDirection: 'row',
  },
  monthDayCell: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 2,
    gap: 2,
  },
  monthDayCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  monthDayNumber: {
    fontSize: 12,
    fontVariant: ['tabular-nums'],
    ...typography.bodySemiBold,
  },
  grabberHitArea: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 2,
    paddingBottom: 4,
  },
  grabberBar: {
    width: 36,
    height: 4,
    borderRadius: 2,
  },
});

export default CalendarHeaderStrip;
