import React, { useEffect, useMemo, useRef } from 'react';
import {
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
  withSpring,
} from 'react-native-reanimated';
import type { TaskRecord, WorkBlockRecord } from '@organiza/shared/schema';
import { Flag, Layers, Plus, X } from '../../components/icons';
import { LiquidGlassCard } from '../../components/glass/LiquidGlassCard';
import { iconMetrics, radii, shadows, spacing, typography } from '../../theme/tokens';
import { useTheme } from '../../theme/ThemeContext';
import {
  CALENDAR_COLORS,
  findNextFreeSlot,
  minutesToTime,
  triggerCalendarHaptic,
} from './calendarUtils';

export interface UnscheduledTraySheetProps {
  visible: boolean;
  tasks: TaskRecord[];
  blocksOnDate: WorkBlockRecord[];
  nowMinutes: number;
  bottomOffset: number;
  onClose: () => void;
  onQuickScheduleTask: (task: TaskRecord, startMinutes: number) => void;
  onDragStart: (task: TaskRecord, absX: number, absY: number) => void;
  onDragMove: (absX: number, absY: number) => void;
  onDragEnd: (task: TaskRecord, absX: number, absY: number) => void;
}

const TRAY_SPRING = { damping: 20, stiffness: 260, mass: 0.72 };

interface DraggableTrayCardProps {
  task: TaskRecord;
  nextSlotLabel: string;
  nextSlotMinutes: number;
  onQuickSchedule: (task: TaskRecord, startMinutes: number) => void;
  onDragStart: (task: TaskRecord, absX: number, absY: number) => void;
  onDragMove: (absX: number, absY: number) => void;
  onDragEnd: (task: TaskRecord, absX: number, absY: number) => void;
}

const DraggableTrayCard: React.FC<DraggableTrayCardProps> = React.memo(
  ({
    task,
    nextSlotLabel,
    nextSlotMinutes,
    onQuickSchedule,
    onDragStart,
    onDragMove,
    onDragEnd,
  }) => {
    const { theme } = useTheme();
    const activeRef = useRef(false);

    const panGesture = useMemo(
      () =>
        Gesture.Pan()
          .activeOffsetY([-10, 10])
          .failOffsetX([-20, 20])
          .onStart((e) => {
            activeRef.current = true;
            runOnJS(triggerCalendarHaptic)('medium');
            runOnJS(onDragStart)(task, e.absoluteX, e.absoluteY);
          })
          .onUpdate((e) => {
            if (activeRef.current) {
              runOnJS(onDragMove)(e.absoluteX, e.absoluteY);
            }
          })
          .onFinalize((e) => {
            if (activeRef.current) {
              activeRef.current = false;
              runOnJS(onDragEnd)(task, e.absoluteX, e.absoluteY);
            }
          }),
      [onDragEnd, onDragMove, onDragStart, task]
    );

    const priorityColor =
      task.priority === 3
        ? CALENDAR_COLORS.reminderCoral
        : task.priority === 2
          ? CALENDAR_COLORS.coral
          : theme.textMuted;

    return (
      <GestureDetector gesture={panGesture}>
        <View
          style={[
            styles.taskCard,
            {
              backgroundColor: theme.cardElevated,
              borderColor: theme.glassBorderStrong,
            },
          ]}
        >
          <View style={styles.taskCardTop}>
            <View
              style={[styles.priorityDot, { backgroundColor: priorityColor }]}
            />
            <Text
              style={[styles.taskTitle, { color: theme.textPrimary }]}
              numberOfLines={2}
            >
              {task.title}
            </Text>
            {task.isFlagged ? (
              <Flag
                size={11}
                color={CALENDAR_COLORS.reminderCoral}
                strokeWidth={2}
              />
            ) : null}
          </View>

          <View style={styles.taskCardBottom}>
            <Text style={[styles.dragHintText, { color: theme.textMuted }]}>
              Arrastra arriba
            </Text>
            <Pressable
              onPress={() => onQuickSchedule(task, nextSlotMinutes)}
              style={[
                styles.quickSlotBtn,
                {
                  backgroundColor: CALENDAR_COLORS.coralSoft,
                  borderColor: CALENDAR_COLORS.coralBorder,
                },
              ]}
            >
              <Plus
                size={11}
                color={CALENDAR_COLORS.coral}
                strokeWidth={2.5}
              />
              <Text
                style={[
                  styles.quickSlotText,
                  { color: CALENDAR_COLORS.coral },
                ]}
              >
                {nextSlotLabel}
              </Text>
            </Pressable>
          </View>
        </View>
      </GestureDetector>
    );
  }
);

DraggableTrayCard.displayName = 'DraggableTrayCard';

export const UnscheduledTraySheet: React.FC<UnscheduledTraySheetProps> = ({
  visible,
  tasks,
  blocksOnDate,
  nowMinutes,
  bottomOffset,
  onClose,
  onQuickScheduleTask,
  onDragStart,
  onDragMove,
  onDragEnd,
}) => {
  const { theme } = useTheme();
  const openProgress = useSharedValue(visible ? 1 : 0);

  useEffect(() => {
    openProgress.value = withSpring(visible ? 1 : 0, TRAY_SPRING);
  }, [visible, openProgress]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: openProgress.value,
    transform: [{ translateY: (1 - openProgress.value) * 190 }],
  }));

  const nextSlot = useMemo(
    () => findNextFreeSlot(blocksOnDate, nowMinutes, 60),
    [blocksOnDate, nowMinutes]
  );
  const nextSlotLabel = minutesToTime(nextSlot.startMinutes);

  if (!visible && tasks.length === 0) {
    return null;
  }

  return (
    <Animated.View
      pointerEvents={visible ? 'box-none' : 'none'}
      style={[
        styles.wrapper,
        { bottom: bottomOffset },
        animatedStyle,
      ]}
    >
      <LiquidGlassCard
        variant="floating"
        intensity={86}
        noPadding
        style={styles.trayCard}
        contentStyle={styles.trayContent}
      >
        <View style={styles.headerRow}>
          <View style={styles.headerLeft}>
            <Layers
              size={15}
              color={CALENDAR_COLORS.reminderCoral}
              strokeWidth={2}
            />
            <View>
              <Text style={[styles.title, { color: theme.textPrimary }]}>
                Sin Programar · {tasks.length}
              </Text>
              <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
                Arrastra al calendario o agenda en 1 toque
              </Text>
            </View>
          </View>

          <Pressable
            onPress={onClose}
            hitSlop={8}
            style={[styles.closeBtn, { backgroundColor: theme.pillBg }]}
            accessibilityLabel="Cerrar bandeja sin programar"
          >
            <X
              size={14}
              color={theme.textSecondary}
              strokeWidth={iconMetrics.strokeWidth}
            />
          </Pressable>
        </View>

        {tasks.length === 0 ? (
          <View style={styles.emptyBox}>
            <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
              Todas tus tareas de hoy ya tienen un bloque asignado.
            </Text>
          </View>
        ) : (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.cardsScroll}
          >
            {tasks.map((task) => (
              <DraggableTrayCard
                key={task.id}
                task={task}
                nextSlotLabel={nextSlotLabel}
                nextSlotMinutes={nextSlot.startMinutes}
                onQuickSchedule={onQuickScheduleTask}
                onDragStart={onDragStart}
                onDragMove={onDragMove}
                onDragEnd={onDragEnd}
              />
            ))}
          </ScrollView>
        )}
      </LiquidGlassCard>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    left: spacing.md,
    right: spacing.md,
    maxWidth: 928,
    alignSelf: 'center',
    zIndex: 60,
  },
  trayCard: {
    borderRadius: radii.lg,
    ...shadows.floatingDock,
  },
  trayContent: {
    padding: spacing.md,
    gap: 10,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    fontSize: 14,
    ...typography.cardTitle,
  },
  subtitle: {
    fontSize: 11,
  },
  closeBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyBox: {
    paddingVertical: 10,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 12,
  },
  cardsScroll: {
    gap: 8,
    paddingBottom: 2,
  },
  taskCard: {
    width: 184,
    padding: 10,
    borderRadius: radii.md,
    borderWidth: 1,
    justifyContent: 'space-between',
    gap: 10,
  },
  taskCardTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
  },
  priorityDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    marginTop: 5,
  },
  taskTitle: {
    flex: 1,
    fontSize: 13,
    lineHeight: 17,
    ...typography.bodySemiBold,
  },
  taskCardBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 4,
  },
  dragHintText: {
    fontSize: 10,
  },
  quickSlotBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radii.pill,
    borderWidth: 1,
  },
  quickSlotText: {
    fontSize: 11,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
});

export default UnscheduledTraySheet;
