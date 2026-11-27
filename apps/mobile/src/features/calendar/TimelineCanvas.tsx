import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import type { TaskRecord, WorkBlockRecord } from '@organiza/shared/schema';
import {
  AlarmSleep,
  Bell,
  Briefcase,
  Check,
  Circle,
  Flag,
  Flame,
  MapPin,
  Minus,
  Plus,
  Zap,
} from '../../components/icons';
import { LiquidGlassCard } from '../../components/glass/LiquidGlassCard';
import { iconMetrics, radii, spacing, typography } from '../../theme/tokens';
import { useTheme } from '../../theme/ThemeContext';
import { resolveHabitIcon } from '../habits/habitIcons';
import { formatReminderClock } from '../reminders';
import {
  BLOCK_TYPE_META,
  CALENDAR_COLORS,
  clampMinutes,
  formatDurationShort,
  hexWithAlpha,
  layoutOverlappingIntervals,
  minutesToTime,
  snapMinutes,
  triggerCalendarHaptic,
} from './calendarUtils';
import type {
  AnchoredHabitItem,
  EnrichedWorkBlock,
  LiveNextUpInfo,
} from './useCalendarSchedule';

const HOURS = Array.from({ length: 24 }, (_, idx) => idx);
const TIMELINE_TOP_PADDING = 14;
const TIME_AXIS_WIDTH = 50;
const MIN_HOUR_HEIGHT = 52;
const MAX_HOUR_HEIGHT = 116;
const DEFAULT_HOUR_HEIGHT = 74;

export interface TimelineCanvasHandle {
  resolveDropMinute: (absoluteX: number, absoluteY: number) => number | null;
  scrollToMinutes: (minutes: number) => void;
}

export interface ExternalDragPreview {
  title: string;
  startMinutes: number;
  durationMinutes: number;
}

export interface TimelineCanvasProps {
  selectedDateKey: string;
  todayKey: string;
  nowMinutes: number;
  liveNextUp: LiveNextUpInfo;
  allDayBlocks: EnrichedWorkBlock[];
  timedBlocks: EnrichedWorkBlock[];
  timedReminders: TaskRecord[];
  overdueReminders: TaskRecord[];
  anchoredHabits: AnchoredHabitItem[];
  externalDropPreview: ExternalDragPreview | null;
  bottomContentPadding?: number;
  onPressBlock: (block: WorkBlockRecord) => void;
  onMoveBlock: (blockId: string, newStartTime: string, newEndTime: string) => void;
  onResizeBlock: (blockId: string, newEndTime: string) => void;
  onLongPressEmptySlot: (startMinutes: number) => void;
  onToggleReminderComplete: (taskId: string) => void;
  onMoveReminder: (taskId: string, newStartMinutes: number) => void;
  onBringOverdueToNow: (taskId: string) => void;
  onOpenSnooze: (task: TaskRecord) => void;
  onToggleHabit: (habitId: string) => void;
}

interface PositionedBlockProps {
  block: EnrichedWorkBlock;
  hourHeight: number;
  columnIndex: number;
  columnCount: number;
  onInteractionChange: (interacting: boolean) => void;
  onPressBlock: (block: WorkBlockRecord) => void;
  onMoveBlock: (blockId: string, newStartTime: string, newEndTime: string) => void;
  onResizeBlock: (blockId: string, newEndTime: string) => void;
  onToggleLinkedTask: (taskId: string) => void;
}

const TimelineBlockItem: React.FC<PositionedBlockProps> = React.memo(
  ({
    block,
    hourHeight,
    columnIndex,
    columnCount,
    onInteractionChange,
    onPressBlock,
    onMoveBlock,
    onResizeBlock,
    onToggleLinkedTask,
  }) => {
    const { theme } = useTheme();
    const [dragDeltaMins, setDragDeltaMins] = useState(0);
    const [resizeDeltaMins, setResizeDeltaMins] = useState(0);
    const [isDragging, setIsDragging] = useState(false);
    const [isResizing, setIsResizing] = useState(false);

    const lastDragStepRef = useRef(0);
    const lastResizeStepRef = useRef(0);

    const baseStart = block.startMinutes;
    const baseDuration = Math.max(15, block.endMinutes - block.startMinutes);

    const effectiveStart = clampMinutes(
      baseStart + dragDeltaMins,
      0,
      24 * 60 - baseDuration
    );
    const effectiveDuration = Math.max(
      15,
      Math.min(24 * 60 - effectiveStart, baseDuration + resizeDeltaMins)
    );
    const effectiveEnd = effectiveStart + effectiveDuration;

    const topPx = TIMELINE_TOP_PADDING + (effectiveStart / 60) * hourHeight;
    const heightPx = Math.max(28, (effectiveDuration / 60) * hourHeight - 2);

    const widthPercent = 100 / Math.max(1, columnCount);
    const leftPercent = columnIndex * widthPercent;

    const handleDragStart = useCallback(() => {
      lastDragStepRef.current = 0;
      setIsDragging(true);
      onInteractionChange(true);
      triggerCalendarHaptic('medium');
    }, [onInteractionChange]);

    const handleDragUpdate = useCallback(
      (translationY: number) => {
        const rawDelta = (translationY / hourHeight) * 60;
        const snapped = snapMinutes(rawDelta, 15);
        const clampedStart = clampMinutes(
          baseStart + snapped,
          0,
          24 * 60 - baseDuration
        );
        const clampedDelta = clampedStart - baseStart;
        if (clampedDelta !== lastDragStepRef.current) {
          lastDragStepRef.current = clampedDelta;
          setDragDeltaMins(clampedDelta);
          triggerCalendarHaptic('selection');
        }
      },
      [baseStart, baseDuration, hourHeight]
    );

    const handleDragEnd = useCallback(() => {
      const delta = lastDragStepRef.current;
      if (delta !== 0) {
        const nextStart = clampMinutes(
          baseStart + delta,
          0,
          24 * 60 - baseDuration
        );
        const nextEnd = nextStart + baseDuration;
        onMoveBlock(block.id, minutesToTime(nextStart), minutesToTime(nextEnd));
        triggerCalendarHaptic('light');
      }
      lastDragStepRef.current = 0;
      setDragDeltaMins(0);
      setIsDragging(false);
      onInteractionChange(false);
    }, [baseStart, baseDuration, block.id, onMoveBlock, onInteractionChange]);

    const moveGesture = useMemo(
      () =>
        Gesture.Pan()
          .activateAfterLongPress(210)
          .onStart(() => {
            runOnJS(handleDragStart)();
          })
          .onUpdate((e) => {
            runOnJS(handleDragUpdate)(e.translationY);
          })
          .onFinalize(() => {
            runOnJS(handleDragEnd)();
          }),
      [handleDragStart, handleDragUpdate, handleDragEnd]
    );

    const handleResizeStart = useCallback(() => {
      lastResizeStepRef.current = 0;
      setIsResizing(true);
      onInteractionChange(true);
      triggerCalendarHaptic('light');
    }, [onInteractionChange]);

    const handleResizeUpdate = useCallback(
      (translationY: number) => {
        const rawDelta = (translationY / hourHeight) * 60;
        const snapped = snapMinutes(rawDelta, 15);
        const nextDuration = Math.max(
          15,
          Math.min(24 * 60 - baseStart, baseDuration + snapped)
        );
        const clampedDelta = nextDuration - baseDuration;
        if (clampedDelta !== lastResizeStepRef.current) {
          lastResizeStepRef.current = clampedDelta;
          setResizeDeltaMins(clampedDelta);
          triggerCalendarHaptic('selection');
        }
      },
      [baseStart, baseDuration, hourHeight]
    );

    const handleResizeEnd = useCallback(() => {
      const delta = lastResizeStepRef.current;
      if (delta !== 0) {
        const nextDuration = Math.max(
          15,
          Math.min(24 * 60 - baseStart, baseDuration + delta)
        );
        onResizeBlock(block.id, minutesToTime(baseStart + nextDuration));
        triggerCalendarHaptic('light');
      }
      lastResizeStepRef.current = 0;
      setResizeDeltaMins(0);
      setIsResizing(false);
      onInteractionChange(false);
    }, [baseStart, baseDuration, block.id, onResizeBlock, onInteractionChange]);

    const resizeGesture = useMemo(
      () =>
        Gesture.Pan()
          .minDistance(2)
          .onStart(() => {
            runOnJS(handleResizeStart)();
          })
          .onUpdate((e) => {
            runOnJS(handleResizeUpdate)(e.translationY);
          })
          .onFinalize(() => {
            runOnJS(handleResizeEnd)();
          }),
      [handleResizeStart, handleResizeUpdate, handleResizeEnd]
    );

    const accent = block.accentColor;
    const isLinkedCompleted = Boolean(block.linkedTask?.isCompleted);
    const isCompact = heightPx < 48;
    const typeLabel =
      BLOCK_TYPE_META[block.blockType]?.label ?? 'EVENTO';

    return (
      <View
        style={[
          styles.positionedSlot,
          {
            top: topPx,
            height: heightPx,
            left: `${leftPercent}%` as unknown as number,
            width: `${widthPercent}%` as unknown as number,
            zIndex: isDragging || isResizing ? 40 : 10,
          },
        ]}
      >
        <GestureDetector gesture={moveGesture}>
          <Pressable
            onPress={() => onPressBlock(block)}
            style={[
              styles.blockGlassCard,
              {
                backgroundColor: hexWithAlpha(
                  accent,
                  isDragging || isResizing ? 0.24 : 0.14
                ),
                borderColor:
                  isDragging || isResizing
                    ? accent
                    : hexWithAlpha(accent, 0.34),
              },
              (isDragging || isResizing) && styles.activeLiftShadow,
            ]}
          >
            {/* Barra lateral de color (Liquid Glass) */}
            <View style={[styles.blockAccentBar, { backgroundColor: accent }]} />

            <View style={styles.blockInner}>
              <View style={styles.blockTopLine}>
                {block.linkedTaskId ? (
                  <Pressable
                    onPress={() => onToggleLinkedTask(block.linkedTaskId!)}
                    hitSlop={8}
                    style={styles.inlineCheckBtn}
                  >
                    {isLinkedCompleted ? (
                      <View
                        style={[
                          styles.inlineCheckedCircle,
                          { backgroundColor: accent },
                        ]}
                      >
                        <Check size={10} color="#FFFFFF" strokeWidth={2.6} />
                      </View>
                    ) : (
                      <Circle size={15} color={accent} strokeWidth={2.1} />
                    )}
                  </Pressable>
                ) : block.blockType === 'work_shift' ? (
                  <Briefcase size={12} color={accent} strokeWidth={2.1} />
                ) : (
                  <Zap size={12} color={accent} strokeWidth={2.1} />
                )}

                <Text
                  style={[
                    styles.blockTitle,
                    { color: theme.textPrimary },
                    isLinkedCompleted && {
                      textDecorationLine: 'line-through',
                      color: theme.textMuted,
                    },
                  ]}
                  numberOfLines={1}
                >
                  {block.title}
                </Text>

                {block.alertMinutesBefore !== null &&
                block.alertMinutesBefore !== undefined ? (
                  <Bell size={11} color={accent} strokeWidth={2} />
                ) : null}

                <Text style={[styles.blockTimeMeta, { color: accent }]}>
                  {isDragging || isResizing
                    ? `${minutesToTime(effectiveStart)}–${minutesToTime(effectiveEnd)}`
                    : block.isOvernightStart
                      ? `${block.startTime}–${block.endTime} (+1d)`
                      : block.isOvernightContinuation
                        ? `00:00–${block.endTime} · Cont.`
                        : `${block.startTime}–${block.endTime}`}
                </Text>
              </View>

              {!isCompact ? (
                <View style={styles.blockSubLine}>
                  <Text
                    style={[styles.blockCategoryPill, { color: accent }]}
                    numberOfLines={1}
                  >
                    {typeLabel} · {formatDurationShort(effectiveDuration)}
                  </Text>
                  {block.locationOrLink ? (
                    <View style={styles.blockLocationMini}>
                      <MapPin
                        size={10}
                        color={theme.textSecondary}
                        strokeWidth={1.8}
                      />
                      <Text
                        style={[
                          styles.blockLocationText,
                          { color: theme.textSecondary },
                        ]}
                        numberOfLines={1}
                      >
                        {block.locationOrLink}
                      </Text>
                    </View>
                  ) : null}
                </View>
              ) : null}
            </View>

            {/* Badge flotante al arrastrar / redimensionar */}
            {isDragging || isResizing ? (
              <View style={[styles.liveBadge, { backgroundColor: accent }]}>
                <Text style={styles.liveBadgeText}>
                  {isResizing
                    ? `${formatDurationShort(effectiveDuration)} (${minutesToTime(effectiveEnd)})`
                    : `${minutesToTime(effectiveStart)} – ${minutesToTime(effectiveEnd)}`}
                </Text>
              </View>
            ) : null}

            {/* Grip inferior para estirar la duración */}
            <GestureDetector gesture={resizeGesture}>
              <View style={styles.resizeGripArea}>
                <View
                  style={[
                    styles.resizeGripPill,
                    { backgroundColor: hexWithAlpha(accent, 0.55) },
                  ]}
                />
              </View>
            </GestureDetector>
          </Pressable>
        </GestureDetector>
      </View>
    );
  }
);

TimelineBlockItem.displayName = 'TimelineBlockItem';

interface PositionedReminderProps {
  task: TaskRecord;
  startMinutes: number;
  hourHeight: number;
  columnIndex: number;
  columnCount: number;
  onInteractionChange: (interacting: boolean) => void;
  onToggleComplete: (taskId: string) => void;
  onMoveReminder: (taskId: string, newStartMinutes: number) => void;
  onOpenSnooze: (task: TaskRecord) => void;
}

const TimelineReminderItem: React.FC<PositionedReminderProps> = React.memo(
  ({
    task,
    startMinutes,
    hourHeight,
    columnIndex,
    columnCount,
    onInteractionChange,
    onToggleComplete,
    onMoveReminder,
    onOpenSnooze,
  }) => {
    const { theme } = useTheme();
    const [dragDeltaMins, setDragDeltaMins] = useState(0);
    const [isDragging, setIsDragging] = useState(false);
    const lastStepRef = useRef(0);

    const effectiveStart = clampMinutes(
      startMinutes + dragDeltaMins,
      0,
      23 * 60 + 45
    );
    const topPx = TIMELINE_TOP_PADDING + (effectiveStart / 60) * hourHeight;
    const widthPercent = 100 / Math.max(1, columnCount);
    const leftPercent = columnIndex * widthPercent;

    const handleStart = useCallback(() => {
      lastStepRef.current = 0;
      setIsDragging(true);
      onInteractionChange(true);
      triggerCalendarHaptic('medium');
    }, [onInteractionChange]);

    const handleUpdate = useCallback(
      (translationY: number) => {
        const snapped = snapMinutes((translationY / hourHeight) * 60, 15);
        const clamped =
          clampMinutes(startMinutes + snapped, 0, 23 * 60 + 45) - startMinutes;
        if (clamped !== lastStepRef.current) {
          lastStepRef.current = clamped;
          setDragDeltaMins(clamped);
          triggerCalendarHaptic('selection');
        }
      },
      [hourHeight, startMinutes]
    );

    const handleEnd = useCallback(() => {
      const delta = lastStepRef.current;
      if (delta !== 0) {
        onMoveReminder(
          task.id,
          clampMinutes(startMinutes + delta, 0, 23 * 60 + 45)
        );
        triggerCalendarHaptic('light');
      }
      lastStepRef.current = 0;
      setDragDeltaMins(0);
      setIsDragging(false);
      onInteractionChange(false);
    }, [onInteractionChange, onMoveReminder, startMinutes, task.id]);

    const dragGesture = useMemo(
      () =>
        Gesture.Pan()
          .activateAfterLongPress(210)
          .onStart(() => runOnJS(handleStart)())
          .onUpdate((e) => runOnJS(handleUpdate)(e.translationY))
          .onFinalize(() => runOnJS(handleEnd)()),
      [handleStart, handleUpdate, handleEnd]
    );

    const coral = CALENDAR_COLORS.reminderCoral;

    return (
      <View
        style={[
          styles.positionedSlot,
          {
            top: topPx,
            height: 40,
            left: `${leftPercent}%` as unknown as number,
            width: `${widthPercent}%` as unknown as number,
            zIndex: isDragging ? 40 : 12,
          },
        ]}
      >
        <GestureDetector gesture={dragGesture}>
          <View
            style={[
              styles.compactReminderCard,
              {
                backgroundColor: task.isCompleted
                  ? theme.cardMuted
                  : CALENDAR_COLORS.reminderCoralSoft,
                borderColor: task.isCompleted
                  ? theme.glassBorder
                  : isDragging
                    ? coral
                    : CALENDAR_COLORS.reminderCoralBorder,
              },
              isDragging && styles.activeLiftShadow,
            ]}
          >
            <Pressable
              onPress={() => {
                triggerCalendarHaptic('success');
                onToggleComplete(task.id);
              }}
              hitSlop={10}
              style={styles.reminderCheckBtn}
            >
              {task.isCompleted ? (
                <View
                  style={[styles.reminderCheckedDot, { backgroundColor: coral }]}
                >
                  <Check size={10} color="#FFFFFF" strokeWidth={2.6} />
                </View>
              ) : (
                <Circle size={17} color={coral} strokeWidth={2.2} />
              )}
            </Pressable>

            <View style={styles.compactTextCol}>
              <Text
                style={[
                  styles.compactTitle,
                  { color: theme.textPrimary },
                  task.isCompleted && {
                    textDecorationLine: 'line-through',
                    color: theme.textMuted,
                  },
                ]}
                numberOfLines={1}
              >
                {task.title}
              </Text>
              <Text style={[styles.compactSub, { color: coral }]}>
                Recordatorio · {minutesToTime(effectiveStart)}
              </Text>
            </View>

            {task.isFlagged ? (
              <Flag size={11} color={coral} strokeWidth={2} />
            ) : null}

            {!task.isCompleted ? (
              <Pressable
                onPress={() => onOpenSnooze(task)}
                hitSlop={8}
                style={[
                  styles.miniSnoozeBtn,
                  {
                    backgroundColor: theme.card,
                    borderColor: CALENDAR_COLORS.reminderCoralBorder,
                  },
                ]}
              >
                <AlarmSleep size={12} color={coral} strokeWidth={2} />
              </Pressable>
            ) : null}
          </View>
        </GestureDetector>
      </View>
    );
  }
);

TimelineReminderItem.displayName = 'TimelineReminderItem';

interface PositionedHabitProps {
  item: AnchoredHabitItem;
  hourHeight: number;
  columnIndex: number;
  columnCount: number;
  onToggleHabit: (habitId: string) => void;
}

const TimelineHabitItem: React.FC<PositionedHabitProps> = React.memo(
  ({ item, hourHeight, columnIndex, columnCount, onToggleHabit }) => {
    const { theme } = useTheme();
    const { habit } = item;
    const HabitIcon = resolveHabitIcon(habit.icon);
    const emerald = CALENDAR_COLORS.habitEmerald;

    const topPx = TIMELINE_TOP_PADDING + (item.startMinutes / 60) * hourHeight;
    const widthPercent = 100 / Math.max(1, columnCount);
    const leftPercent = columnIndex * widthPercent;

    return (
      <View
        style={[
          styles.positionedSlot,
          {
            top: topPx,
            height: 42,
            left: `${leftPercent}%` as unknown as number,
            width: `${widthPercent}%` as unknown as number,
            zIndex: 11,
          },
        ]}
      >
        <Pressable
          onPress={() => onToggleHabit(habit.id)}
          style={[
            styles.compactHabitCard,
            {
              backgroundColor: item.completedOnDate
                ? hexWithAlpha(emerald, 0.2)
                : CALENDAR_COLORS.habitEmeraldSoft,
              borderColor: item.completedOnDate
                ? emerald
                : CALENDAR_COLORS.habitEmeraldBorder,
            },
          ]}
        >
          {/* Badge squircle verde esmeralda (#059669) */}
          <View
            style={[
              styles.habitSquircleBadge,
              { backgroundColor: emerald },
            ]}
          >
            <HabitIcon size={14} color="#FFFFFF" strokeWidth={2} />
          </View>

          <View style={styles.compactTextCol}>
            <Text
              style={[
                styles.compactTitle,
                { color: theme.textPrimary },
                item.completedOnDate && {
                  textDecorationLine: 'line-through',
                  color: theme.textSecondary,
                },
              ]}
              numberOfLines={1}
            >
              {habit.title}
            </Text>
            <View style={styles.habitMetaRow}>
              <Text style={[styles.compactSub, { color: emerald }]}>
                {item.anchorTime}
                {habit.habitType === 'quantitative'
                  ? ` · ${item.activeCount}/${habit.targetPerDay}`
                  : ''}
              </Text>
              {item.computedStreak > 0 ? (
                <View style={styles.habitStreakPill}>
                  <Flame size={10} color={emerald} strokeWidth={2} />
                  <Text style={[styles.habitStreakText, { color: emerald }]}>
                    {item.computedStreak}
                  </Text>
                </View>
              ) : null}
            </View>
          </View>

          <View
            style={[
              styles.habitCheckPill,
              item.completedOnDate
                ? { backgroundColor: emerald }
                : {
                    borderWidth: 1.5,
                    borderColor: emerald,
                    backgroundColor: theme.card,
                  },
            ]}
          >
            <Check
              size={12}
              color={item.completedOnDate ? '#FFFFFF' : emerald}
              strokeWidth={2.5}
            />
          </View>
        </Pressable>
      </View>
    );
  }
);

TimelineHabitItem.displayName = 'TimelineHabitItem';

export const TimelineCanvas = forwardRef<TimelineCanvasHandle, TimelineCanvasProps>(
  (
    {
      selectedDateKey,
      todayKey,
      nowMinutes,
      liveNextUp,
      allDayBlocks,
      timedBlocks,
      timedReminders,
      overdueReminders,
      anchoredHabits,
      externalDropPreview,
      bottomContentPadding = 120,
      onPressBlock,
      onMoveBlock,
      onResizeBlock,
      onLongPressEmptySlot,
      onToggleReminderComplete,
      onMoveReminder,
      onBringOverdueToNow,
      onOpenSnooze,
      onToggleHabit,
    },
    ref
  ) => {
    const { theme } = useTheme();
    const scrollViewRef = useRef<ScrollView>(null);
    const viewportRef = useRef<View>(null);
    const scrollOffsetRef = useRef(0);
    const hasAutoScrolledRef = useRef(false);

    const [hourHeight, setHourHeight] = useState(DEFAULT_HOUR_HEIGHT);
    const [isScrollEnabled, setIsScrollEnabled] = useState(true);

    const hourHeightSV = useSharedValue(DEFAULT_HOUR_HEIGHT);
    const pinchStartHeightSV = useSharedValue(DEFAULT_HOUR_HEIGHT);

    // Pulso luminoso del punto "Ahora"
    const pulseOpacity = useSharedValue(0.32);
    useEffect(() => {
      pulseOpacity.value = withRepeat(
        withSequence(
          withTiming(0.72, { duration: 1100 }),
          withTiming(0.24, { duration: 1100 })
        ),
        -1,
        false
      );
    }, [pulseOpacity]);

    const nowHaloStyle = useAnimatedStyle(() => ({
      opacity: pulseOpacity.value,
    }));

    const scrollToMinutes = useCallback(
      (minutes: number) => {
        const targetY = Math.max(
          0,
          (minutes / 60) * hourHeight - 140
        );
        scrollViewRef.current?.scrollTo({ y: targetY, animated: true });
      },
      [hourHeight]
    );

    useEffect(() => {
      if (hasAutoScrolledRef.current) return;
      hasAutoScrolledRef.current = true;
      const targetMin =
        selectedDateKey === todayKey ? Math.max(0, nowMinutes - 90) : 7 * 60 + 30;
      const timer = setTimeout(() => {
        scrollViewRef.current?.scrollTo({
          y: Math.max(0, (targetMin / 60) * DEFAULT_HOUR_HEIGHT),
          animated: false,
        });
      }, 60);
      return () => clearTimeout(timer);
    }, [nowMinutes, selectedDateKey, todayKey]);

    const viewportRectRef = useRef<{
      x: number;
      y: number;
      width: number;
      height: number;
    } | null>(null);

    const refreshViewportMeasure = useCallback(() => {
      viewportRef.current?.measureInWindow((x, y, width, height) => {
        if (width > 0 && height > 0) {
          viewportRectRef.current = { x, y, width, height };
        }
      });
    }, []);

    useImperativeHandle(
      ref,
      () => ({
        resolveDropMinute: (absX: number, absY: number) => {
          refreshViewportMeasure();
          const rect = viewportRectRef.current;
          if (!rect) return null;
          if (
            absX < rect.x ||
            absX > rect.x + rect.width ||
            absY < rect.y ||
            absY > rect.y + rect.height
          ) {
            return null;
          }
          const localYInGrid =
            absY - rect.y + scrollOffsetRef.current - TIMELINE_TOP_PADDING;
          const rawMins = (localYInGrid / hourHeight) * 60;
          return clampMinutes(snapMinutes(rawMins, 15), 0, 23 * 60 + 45);
        },
        scrollToMinutes,
      }),
      [hourHeight, refreshViewportMeasure, scrollToMinutes]
    );

    const applyZoomDelta = useCallback((delta: number) => {
      triggerCalendarHaptic('light');
      setHourHeight((prev) => {
        const next = Math.max(
          MIN_HOUR_HEIGHT,
          Math.min(MAX_HOUR_HEIGHT, prev + delta)
        );
        hourHeightSV.value = next;
        return next;
      });
    }, [hourHeightSV]);

    const pinchGesture = useMemo(
      () =>
        Gesture.Pinch()
          .onStart(() => {
            pinchStartHeightSV.value = hourHeightSV.value;
          })
          .onUpdate((e) => {
            const next = Math.round(
              Math.max(
                MIN_HOUR_HEIGHT,
                Math.min(MAX_HOUR_HEIGHT, pinchStartHeightSV.value * e.scale)
              )
            );
            if (next !== hourHeightSV.value) {
              hourHeightSV.value = next;
              runOnJS(setHourHeight)(next);
            }
          }),
      [hourHeightSV, pinchStartHeightSV]
    );

    const handleEmptySlotLongPress = useCallback(
      (localY: number) => {
        const rawMinutes =
          ((localY - TIMELINE_TOP_PADDING) / hourHeight) * 60;
        const snapped = clampMinutes(snapMinutes(rawMinutes, 15), 0, 23 * 60 + 30);
        triggerCalendarHaptic('medium');
        onLongPressEmptySlot(snapped);
      },
      [hourHeight, onLongPressEmptySlot]
    );

    const emptyLongPressGesture = useMemo(
      () =>
        Gesture.LongPress()
          .minDuration(350)
          .maxDistance(16)
          .onStart((e) => {
            runOnJS(handleEmptySlotLongPress)(e.y);
          }),
      [handleEmptySlotLongPress]
    );

    // Calcular layout de colisión unificado entre bloques, recordatorios y hábitos
    const unifiedLayout = useMemo(() => {
      const intervals: Array<{ id: string; startMin: number; endMin: number }> =
        [];

      for (const b of timedBlocks) {
        intervals.push({
          id: `block:${b.id}`,
          startMin: b.startMinutes,
          endMin: Math.max(b.startMinutes + 20, b.endMinutes),
        });
      }
      for (const r of timedReminders) {
        if (!r.reminderAt) continue;
        const d = new Date(r.reminderAt);
        const startMin = d.getHours() * 60 + d.getMinutes();
        intervals.push({
          id: `rem:${r.id}`,
          startMin,
          endMin: startMin + 32,
        });
      }
      for (const h of anchoredHabits) {
        intervals.push({
          id: `hab:${h.habit.id}`,
          startMin: h.startMinutes,
          endMin: h.startMinutes + 34,
        });
      }

      return layoutOverlappingIntervals(intervals);
    }, [timedBlocks, timedReminders, anchoredHabits]);

    const showNowLine = selectedDateKey === todayKey;
    const nowTopPx = TIMELINE_TOP_PADDING + (nowMinutes / 60) * hourHeight;
    const gridTotalHeight = TIMELINE_TOP_PADDING + 24 * hourHeight + 24;

    return (
      <View style={styles.container}>
        {/* Barra en Vivo: Próximo bloque / En curso + Controles Zoom */}
        <LiquidGlassCard
          variant="glass"
          intensity={64}
          noPadding
          style={styles.liveBarCard}
          contentStyle={styles.liveBarContent}
        >
          <View style={styles.liveBarLeft}>
            <View
              style={[
                styles.liveDot,
                { backgroundColor: liveNextUp.accentColor },
              ]}
            />
            <Text
              style={[styles.liveBarTitle, { color: theme.textPrimary }]}
              numberOfLines={1}
            >
              {liveNextUp.title}
            </Text>
            <Text
              style={[
                styles.liveBarMeta,
                { color: liveNextUp.accentColor },
              ]}
              numberOfLines={1}
            >
              · {liveNextUp.label}
            </Text>
          </View>

          <View style={styles.zoomControls}>
            <Pressable
              onPress={() => applyZoomDelta(-12)}
              style={[
                styles.zoomBtn,
                {
                  backgroundColor: theme.pillBg,
                  borderColor: theme.glassBorder,
                },
              ]}
              accessibilityLabel="Reducir escala horaria"
            >
              <Minus size={12} color={theme.textSecondary} strokeWidth={2.2} />
            </Pressable>
            <Pressable
              onPress={() => applyZoomDelta(12)}
              style={[
                styles.zoomBtn,
                {
                  backgroundColor: theme.pillBg,
                  borderColor: theme.glassBorder,
                },
              ]}
              accessibilityLabel="Ampliar escala horaria"
            >
              <Plus size={12} color={theme.textSecondary} strokeWidth={2.2} />
            </Pressable>
          </View>
        </LiquidGlassCard>

        {/* Franja Eventos Todo el Día */}
        {allDayBlocks.length > 0 ? (
          <View style={styles.allDayStrip}>
            <Text style={[styles.allDayLabel, { color: theme.textMuted }]}>
              TODO EL DÍA
            </Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.allDayPillsRow}
            >
              {allDayBlocks.map((b) => (
                <Pressable
                  key={b.id}
                  onPress={() => onPressBlock(b)}
                  style={[
                    styles.allDayPill,
                    {
                      backgroundColor: hexWithAlpha(b.accentColor, 0.16),
                      borderColor: hexWithAlpha(b.accentColor, 0.36),
                    },
                  ]}
                >
                  <View
                    style={[
                      styles.allDayDot,
                      { backgroundColor: b.accentColor },
                    ]}
                  />
                  <Text
                    style={[styles.allDayTitle, { color: theme.textPrimary }]}
                    numberOfLines={1}
                  >
                    {b.title}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        ) : null}

        {/* Franja Atrasados (Recordatorios vencidos para no perderlos) */}
        {overdueReminders.length > 0 ? (
          <LiquidGlassCard
            variant="glass"
            intensity={70}
            noPadding
            style={[
              styles.overdueCard,
              { borderColor: CALENDAR_COLORS.reminderCoralBorder },
            ]}
            contentStyle={styles.overdueContent}
          >
            <View style={styles.overdueHeader}>
              <Text
                style={[
                  styles.overdueHeading,
                  { color: CALENDAR_COLORS.reminderCoral },
                ]}
              >
                ATRASADOS · {overdueReminders.length}
              </Text>
              <Text style={[styles.overdueHint, { color: theme.textMuted }]}>
                Toca "Ahora" para moverlo al bloque actual
              </Text>
            </View>

            {overdueReminders.slice(0, 3).map((task) => (
              <View key={task.id} style={styles.overdueRow}>
                <Pressable
                  onPress={() => {
                    triggerCalendarHaptic('success');
                    onToggleReminderComplete(task.id);
                  }}
                  hitSlop={8}
                >
                  <Circle
                    size={17}
                    color={CALENDAR_COLORS.reminderCoral}
                    strokeWidth={2.1}
                  />
                </Pressable>
                <Text
                  style={[styles.overdueTitle, { color: theme.textPrimary }]}
                  numberOfLines={1}
                >
                  {task.title}
                </Text>
                <Text
                  style={[
                    styles.overdueTime,
                    { color: CALENDAR_COLORS.reminderCoral },
                  ]}
                >
                  {formatReminderClock(task.reminderAt) ?? ''}
                </Text>
                <Pressable
                  onPress={() => onBringOverdueToNow(task.id)}
                  style={[
                    styles.bringNowBtn,
                    {
                      backgroundColor: CALENDAR_COLORS.coralSoft,
                      borderColor: CALENDAR_COLORS.coralBorder,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.bringNowText,
                      { color: CALENDAR_COLORS.coral },
                    ]}
                  >
                    Ahora
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => onOpenSnooze(task)}
                  hitSlop={6}
                  style={[
                    styles.miniSnoozeBtn,
                    {
                      backgroundColor: theme.card,
                      borderColor: theme.glassBorder,
                    },
                  ]}
                >
                  <AlarmSleep
                    size={12}
                    color={CALENDAR_COLORS.reminderCoral}
                    strokeWidth={2}
                  />
                </Pressable>
              </View>
            ))}
          </LiquidGlassCard>
        ) : null}

        {/* Lienzo Principal 24h */}
        <View
          ref={viewportRef}
          onLayout={refreshViewportMeasure}
          style={styles.timelineViewport}
        >
          <GestureDetector gesture={pinchGesture}>
            <ScrollView
              ref={scrollViewRef}
              scrollEnabled={isScrollEnabled}
              onScroll={(e) => {
                scrollOffsetRef.current = e.nativeEvent.contentOffset.y;
              }}
              scrollEventThrottle={16}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{
                paddingBottom: bottomContentPadding,
              }}
            >
              <View
                style={[styles.timelineGrid, { height: gridTotalHeight }]}
              >
                {/* Fondo de horas + Toque largo en hueco vacío */}
                <GestureDetector gesture={emptyLongPressGesture}>
                  <View
                    style={[
                      styles.hoursBackgroundLayer,
                      { height: gridTotalHeight },
                    ]}
                    // @ts-expect-error -- soporte doble clic en Web para crear evento en la hora
                    onDoubleClick={
                      Platform.OS === 'web'
                        ? (ev: { nativeEvent?: { offsetY?: number } }) => {
                            const offsetY = ev?.nativeEvent?.offsetY;
                            if (typeof offsetY === 'number') {
                              handleEmptySlotLongPress(offsetY);
                            }
                          }
                        : undefined
                    }
                  >
                    {HOURS.map((hour) => {
                      const top = TIMELINE_TOP_PADDING + hour * hourHeight;
                      return (
                        <View
                          key={hour}
                          style={[
                            styles.hourRow,
                            { top, height: hourHeight },
                          ]}
                        >
                          <Text
                            style={[
                              styles.hourLabel,
                              { color: theme.textMuted },
                            ]}
                          >
                            {String(hour).padStart(2, '0')}:00
                          </Text>
                          <View
                            style={[
                              styles.hourDividerLine,
                              { backgroundColor: theme.divider },
                            ]}
                          />
                          <View
                            style={[
                              styles.halfHourLine,
                              {
                                top: hourHeight / 2,
                                backgroundColor: theme.divider,
                              },
                            ]}
                          />
                        </View>
                      );
                    })}
                  </View>
                </GestureDetector>

                {/* Área de tarjetas (Bloques + Recordatorios + Hábitos) */}
                <View style={styles.eventsColumn} pointerEvents="box-none">
                  {/* Capa 1: Bloques de Eventos y Turnos */}
                  {timedBlocks.map((block) => {
                    const pos = unifiedLayout.get(`block:${block.id}`) ?? {
                      columnIndex: 0,
                      columnCount: 1,
                    };
                    return (
                      <TimelineBlockItem
                        key={
                          block.isOvernightContinuation
                            ? `${block.id}-cont`
                            : block.id
                        }
                        block={block}
                        hourHeight={hourHeight}
                        columnIndex={pos.columnIndex}
                        columnCount={pos.columnCount}
                        onInteractionChange={(interacting) =>
                          setIsScrollEnabled(!interacting)
                        }
                        onPressBlock={onPressBlock}
                        onMoveBlock={onMoveBlock}
                        onResizeBlock={onResizeBlock}
                        onToggleLinkedTask={onToggleReminderComplete}
                      />
                    );
                  })}

                  {/* Capa 2: Recordatorios proyectados en su hora exacta */}
                  {timedReminders.map((task) => {
                    if (!task.reminderAt) return null;
                    const d = new Date(task.reminderAt);
                    const startMinutes = d.getHours() * 60 + d.getMinutes();
                    const pos = unifiedLayout.get(`rem:${task.id}`) ?? {
                      columnIndex: 0,
                      columnCount: 1,
                    };
                    return (
                      <TimelineReminderItem
                        key={`rem-${task.id}`}
                        task={task}
                        startMinutes={startMinutes}
                        hourHeight={hourHeight}
                        columnIndex={pos.columnIndex}
                        columnCount={pos.columnCount}
                        onInteractionChange={(interacting) =>
                          setIsScrollEnabled(!interacting)
                        }
                        onToggleComplete={onToggleReminderComplete}
                        onMoveReminder={onMoveReminder}
                        onOpenSnooze={onOpenSnooze}
                      />
                    );
                  })}

                  {/* Capa 3: Hábitos anclados en su franja horaria */}
                  {anchoredHabits.map((item) => {
                    const pos = unifiedLayout.get(`hab:${item.habit.id}`) ?? {
                      columnIndex: 0,
                      columnCount: 1,
                    };
                    return (
                      <TimelineHabitItem
                        key={`hab-${item.habit.id}`}
                        item={item}
                        hourHeight={hourHeight}
                        columnIndex={pos.columnIndex}
                        columnCount={pos.columnCount}
                        onToggleHabit={onToggleHabit}
                      />
                    );
                  })}

                  {/* Preview de Drop desde la bandeja "Sin Programar" */}
                  {externalDropPreview ? (
                    <View
                      pointerEvents="none"
                      style={[
                        styles.dropPreviewBox,
                        {
                          top:
                            TIMELINE_TOP_PADDING +
                            (externalDropPreview.startMinutes / 60) * hourHeight,
                          height: Math.max(
                            40,
                            (externalDropPreview.durationMinutes / 60) *
                              hourHeight
                          ),
                          backgroundColor: CALENDAR_COLORS.coralSoft,
                          borderColor: CALENDAR_COLORS.coral,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.dropPreviewTitle,
                          { color: CALENDAR_COLORS.coral },
                        ]}
                        numberOfLines={1}
                      >
                        {minutesToTime(externalDropPreview.startMinutes)} ·{' '}
                        {externalDropPreview.title}
                      </Text>
                    </View>
                  ) : null}
                </View>

                {/* Indicador "Ahora" en Vivo */}
                {showNowLine ? (
                  <View
                    pointerEvents="none"
                    style={[styles.nowIndicatorRow, { top: nowTopPx - 8 }]}
                  >
                    <View
                      style={[
                        styles.nowTimeChip,
                        { backgroundColor: CALENDAR_COLORS.coral },
                      ]}
                    >
                      <Text style={styles.nowTimeText}>
                        {minutesToTime(nowMinutes)}
                      </Text>
                    </View>
                    <View style={styles.nowDotWrapper}>
                      <Animated.View
                        style={[
                          styles.nowDotHalo,
                          { backgroundColor: CALENDAR_COLORS.coral },
                          nowHaloStyle,
                        ]}
                      />
                      <View
                        style={[
                          styles.nowDotCore,
                          { backgroundColor: CALENDAR_COLORS.coral },
                        ]}
                      />
                    </View>
                    <View
                      style={[
                        styles.nowHorizontalLine,
                        { backgroundColor: CALENDAR_COLORS.coral },
                      ]}
                    />
                  </View>
                ) : null}
              </View>
            </ScrollView>
          </GestureDetector>
        </View>
      </View>
    );
  }
);

TimelineCanvas.displayName = 'TimelineCanvas';

const styles = StyleSheet.create({
  container: {
    flex: 1,
    gap: 8,
  },
  liveBarCard: {
    borderRadius: radii.md,
  },
  liveBarContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    gap: 8,
  },
  liveBarLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  liveBarTitle: {
    fontSize: 13,
    fontWeight: '700',
    flexShrink: 1,
  },
  liveBarMeta: {
    fontSize: 12,
    fontWeight: '600',
  },
  zoomControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  zoomBtn: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  allDayStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 2,
  },
  allDayLabel: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.7,
  },
  allDayPillsRow: {
    gap: 6,
  },
  allDayPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radii.pill,
    borderWidth: 1,
  },
  allDayDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  allDayTitle: {
    fontSize: 12,
    fontWeight: '600',
    maxWidth: 180,
  },
  overdueCard: {
    borderRadius: radii.md,
  },
  overdueContent: {
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    gap: 6,
  },
  overdueHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  overdueHeading: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.7,
  },
  overdueHint: {
    fontSize: 10,
  },
  overdueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  overdueTitle: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
  },
  overdueTime: {
    fontSize: 11,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  bringNowBtn: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radii.pill,
    borderWidth: 1,
  },
  bringNowText: {
    fontSize: 11,
    fontWeight: '700',
  },
  timelineViewport: {
    flex: 1,
    minHeight: 320,
  },
  timelineGrid: {
    position: 'relative',
    width: '100%',
  },
  hoursBackgroundLayer: {
    position: 'relative',
    width: '100%',
  },
  hourRow: {
    position: 'absolute',
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  hourLabel: {
    width: TIME_AXIS_WIDTH,
    paddingRight: 8,
    textAlign: 'right',
    fontSize: 11,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
    marginTop: -6,
  },
  hourDividerLine: {
    flex: 1,
    height: 1,
  },
  halfHourLine: {
    position: 'absolute',
    left: TIME_AXIS_WIDTH,
    right: 0,
    height: 1,
    opacity: 0.4,
  },
  eventsColumn: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: TIME_AXIS_WIDTH + 4,
    right: 4,
  },
  positionedSlot: {
    position: 'absolute',
    paddingHorizontal: 2,
  },
  blockGlassCard: {
    flex: 1,
    borderRadius: radii.squircle,
    borderWidth: 1,
    flexDirection: 'row',
    overflow: 'hidden',
    position: 'relative',
  },
  activeLiftShadow: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 8,
  },
  blockAccentBar: {
    width: 4,
    height: '100%',
  },
  blockInner: {
    flex: 1,
    paddingHorizontal: 8,
    paddingVertical: 5,
    gap: 2,
  },
  blockTopLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  inlineCheckBtn: {
    marginRight: 2,
  },
  inlineCheckedCircle: {
    width: 15,
    height: 15,
    borderRadius: 7.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  blockTitle: {
    flex: 1,
    fontSize: 13,
    ...typography.bodySemiBold,
  },
  blockTimeMeta: {
    fontSize: 10,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  blockSubLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  blockCategoryPill: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  blockLocationMini: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    flex: 1,
  },
  blockLocationText: {
    fontSize: 10,
  },
  liveBadge: {
    position: 'absolute',
    top: 4,
    right: 6,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: radii.pill,
  },
  liveBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  resizeGripArea: {
    position: 'absolute',
    left: 6,
    right: 6,
    bottom: 0,
    height: 14,
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingBottom: 3,
  },
  resizeGripPill: {
    width: 28,
    height: 3,
    borderRadius: 1.5,
  },
  compactReminderCard: {
    flex: 1,
    borderRadius: radii.squircle,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    gap: 7,
  },
  reminderCheckBtn: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  reminderCheckedDot: {
    width: 17,
    height: 17,
    borderRadius: 8.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  compactTextCol: {
    flex: 1,
    gap: 1,
  },
  compactTitle: {
    fontSize: 12,
    ...typography.bodySemiBold,
  },
  compactSub: {
    fontSize: 10,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  miniSnoozeBtn: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  compactHabitCard: {
    flex: 1,
    borderRadius: radii.squircle,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 7,
    gap: 7,
  },
  habitSquircleBadge: {
    width: 26,
    height: 26,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  habitMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  habitStreakPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  habitStreakText: {
    fontSize: 10,
    fontWeight: '700',
  },
  habitCheckPill: {
    width: 22,
    height: 22,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dropPreviewBox: {
    position: 'absolute',
    left: 2,
    right: 2,
    borderRadius: radii.squircle,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    paddingHorizontal: 10,
    justifyContent: 'center',
    zIndex: 50,
  },
  dropPreviewTitle: {
    fontSize: 12,
    fontWeight: '700',
  },
  nowIndicatorRow: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 16,
    flexDirection: 'row',
    alignItems: 'center',
    zIndex: 30,
  },
  nowTimeChip: {
    width: TIME_AXIS_WIDTH - 4,
    marginRight: 2,
    paddingVertical: 2,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nowTimeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  nowDotWrapper: {
    width: 14,
    height: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: -5,
  },
  nowDotHalo: {
    position: 'absolute',
    width: 16,
    height: 16,
    borderRadius: 8,
  },
  nowDotCore: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  nowHorizontalLine: {
    flex: 1,
    height: 2,
    marginLeft: -2,
  },
});

export default TimelineCanvas;
