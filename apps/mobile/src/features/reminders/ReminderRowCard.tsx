import React, { useRef } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';
import type { TaskRecord } from '@organiza/shared/schema';
import {
  AlarmSleep,
  Bell,
  Check,
  Circle,
  Clock,
  FileText,
  Flag,
  Trash2,
} from '../../components/icons';
import { LiquidGlassCard } from '../../components/glass/LiquidGlassCard';
import { localStore } from '../../db/client';
import { iconMetrics, radii, spacing, typography } from '../../theme/tokens';
import { useTheme } from '../../theme/ThemeContext';
import { getNoteDisplayTitle } from '../notes';
import {
  formatReminderScheduleBadge,
  getPriorityLabel,
  type SnoozePreset,
} from './reminderUtils';

export interface ReminderRowCardProps {
  task: TaskRecord;
  todayKey: string;
  nowMs: number;
  onToggleComplete: (taskId: string) => void;
  onPressEdit: (task: TaskRecord) => void;
  onOpenSnoozeMenu: (task: TaskRecord) => void;
  onQuickSnooze: (taskId: string, preset: SnoozePreset) => void;
  onToggleFlag: (taskId: string) => void;
  onDelete: (taskId: string) => void;
  onOpenSourceNote?: (pageId: string) => void;
}

export const ReminderRowCard: React.FC<ReminderRowCardProps> = ({
  task,
  todayKey,
  nowMs,
  onToggleComplete,
  onPressEdit,
  onOpenSnoozeMenu,
  onQuickSnooze,
  onToggleFlag,
  onDelete,
  onOpenSourceNote,
}) => {
  const { theme } = useTheme();
  const swipeableRef = useRef<Swipeable | null>(null);

  const scheduleBadge = formatReminderScheduleBadge(task, todayKey, nowMs);
  const sourcePage = task.sourcePageId
    ? localStore.getNotePageById(task.sourcePageId)
    : undefined;

  const isUrgent = Boolean(task.isFlagged) || task.priority === 3;
  const ringColor =
    isUrgent || scheduleBadge?.isOverdue
      ? theme.accentPrimaryLink
      : task.priority === 2
        ? theme.textSecondary
        : theme.textMuted;

  const closeSwipe = () => {
    swipeableRef.current?.close();
  };

  const renderRightActions = () => (
    <View style={styles.swipeActionsWrap}>
      <Pressable
        onPress={() => {
          closeSwipe();
          onQuickSnooze(task.id, '1h');
        }}
        style={[
          styles.swipeActionBtn,
          { backgroundColor: theme.accentPrimary },
        ]}
      >
        <AlarmSleep
          size={16}
          color={theme.accentPrimaryText}
          strokeWidth={iconMetrics.strokeWidth}
        />
        <Text
          style={[
            styles.swipeActionLabel,
            { color: theme.accentPrimaryText },
          ]}
        >
          +1h
        </Text>
      </Pressable>

      <Pressable
        onPress={() => {
          closeSwipe();
          onOpenSnoozeMenu(task);
        }}
        style={[
          styles.swipeActionBtn,
          {
            backgroundColor: theme.cardElevated,
            borderColor: theme.accentPrimaryBorder,
            borderWidth: 1,
          },
        ]}
      >
        <Clock
          size={16}
          color={theme.accentPrimaryLink}
          strokeWidth={iconMetrics.strokeWidth}
        />
        <Text
          style={[
            styles.swipeActionLabel,
            { color: theme.accentPrimaryLink },
          ]}
        >
          Posponer
        </Text>
      </Pressable>

      <Pressable
        onPress={() => {
          closeSwipe();
          onToggleFlag(task.id);
        }}
        style={[
          styles.swipeActionBtn,
          {
            backgroundColor: theme.accentPrimarySoft,
            borderColor: theme.accentPrimaryBorder,
            borderWidth: 1,
          },
        ]}
      >
        <Flag
          size={16}
          color={theme.accentPrimaryLink}
          strokeWidth={iconMetrics.strokeWidth}
        />
        <Text
          style={[
            styles.swipeActionLabel,
            { color: theme.accentPrimaryLink },
          ]}
        >
          {task.isFlagged ? 'Quitar' : 'Bandera'}
        </Text>
      </Pressable>
    </View>
  );

  return (
    <Swipeable
      ref={swipeableRef}
      renderRightActions={renderRightActions}
      overshootRight={false}
      friction={2}
      rightThreshold={36}
      containerStyle={styles.swipeContainer}
    >
      <LiquidGlassCard
        noPadding
        style={styles.itemCard}
        contentStyle={styles.itemRow}
      >
        <Pressable onPress={() => onToggleComplete(task.id)} hitSlop={10}>
          {task.isCompleted ? (
            <View
              style={[
                styles.checkedCircle,
                { backgroundColor: theme.accentPrimary },
              ]}
            >
              <Check
                size={14}
                color={theme.accentPrimaryText}
                strokeWidth={2.5}
              />
            </View>
          ) : (
            <Circle size={22} color={ringColor} strokeWidth={2} />
          )}
        </Pressable>

        <Pressable onPress={() => onPressEdit(task)} style={styles.itemBody}>
          <Text
            style={[
              styles.itemTitle,
              { color: theme.textPrimary },
              task.isCompleted && {
                textDecorationLine: 'line-through',
                color: theme.textMuted,
              },
            ]}
          >
            {task.title}
          </Text>

          {task.notes ? (
            <Text
              style={[styles.itemNotes, { color: theme.textSecondary }]}
              numberOfLines={2}
            >
              {task.notes}
            </Text>
          ) : null}

          <View style={styles.chipsRow}>
            {scheduleBadge ? (
              <View
                style={[
                  styles.clockChip,
                  {
                    backgroundColor:
                      scheduleBadge.isOverdue || scheduleBadge.isToday
                        ? theme.accentPrimarySoft
                        : theme.pillBg,
                    borderColor:
                      scheduleBadge.isOverdue || scheduleBadge.isToday
                        ? theme.accentPrimaryBorder
                        : theme.glassBorder,
                  },
                ]}
              >
                <Bell
                  size={11}
                  color={
                    scheduleBadge.isOverdue || scheduleBadge.isToday
                      ? theme.accentPrimaryLink
                      : theme.textSecondary
                  }
                  strokeWidth={2}
                />
                <Text
                  style={[
                    styles.clockChipText,
                    {
                      color:
                        scheduleBadge.isOverdue || scheduleBadge.isToday
                          ? theme.accentPrimaryLink
                          : theme.textSecondary,
                    },
                  ]}
                >
                  {scheduleBadge.label}
                </Text>
              </View>
            ) : null}

            <View
              style={[
                styles.metaChip,
                {
                  borderColor:
                    task.priority === 3
                      ? theme.accentPrimaryBorder
                      : theme.glassBorder,
                  backgroundColor:
                    task.priority === 3
                      ? theme.accentPrimarySoft
                      : 'transparent',
                },
              ]}
            >
              <Text
                style={[
                  styles.metaChipText,
                  {
                    color:
                      task.priority === 3
                        ? theme.accentPrimaryLink
                        : theme.textSecondary,
                  },
                ]}
              >
                {getPriorityLabel(task.priority)}
              </Text>
            </View>

            {sourcePage && !sourcePage.deletedAt && onOpenSourceNote ? (
              <Pressable
                onPress={() => onOpenSourceNote(sourcePage.id)}
                style={[
                  styles.noteOriginChip,
                  {
                    backgroundColor: theme.pillBg,
                    borderColor: theme.glassBorder,
                  },
                ]}
              >
                <FileText size={11} color={theme.accentPrimaryLink} />
                <Text
                  style={[
                    styles.noteOriginText,
                    { color: theme.textSecondary },
                  ]}
                  numberOfLines={1}
                >
                  {getNoteDisplayTitle(sourcePage)}
                </Text>
              </Pressable>
            ) : null}
          </View>
        </Pressable>

        <View style={styles.rowActions}>
          {!task.isCompleted ? (
            <Pressable
              onPress={() => onOpenSnoozeMenu(task)}
              hitSlop={8}
              style={[
                styles.rowIconButton,
                { backgroundColor: theme.accentPrimarySoft },
              ]}
            >
              <AlarmSleep
                size={15}
                color={theme.accentPrimaryLink}
                strokeWidth={iconMetrics.strokeWidth}
              />
            </Pressable>
          ) : null}

          <Pressable
            onPress={() => onToggleFlag(task.id)}
            hitSlop={8}
            style={[
              styles.rowIconButton,
              task.isFlagged && { backgroundColor: theme.accentPrimarySoft },
            ]}
          >
            <Flag
              size={15}
              color={
                task.isFlagged ? theme.accentPrimaryLink : theme.textMuted
              }
              strokeWidth={iconMetrics.strokeWidth}
            />
          </Pressable>

          <Pressable
            onPress={() => onDelete(task.id)}
            hitSlop={8}
            style={styles.rowIconButton}
          >
            <Trash2
              size={15}
              color={theme.textMuted}
              strokeWidth={iconMetrics.strokeWidth}
            />
          </Pressable>
        </View>
      </LiquidGlassCard>
    </Swipeable>
  );
};

const styles = StyleSheet.create({
  swipeContainer: {
    overflow: 'visible',
  },
  swipeActionsWrap: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 6,
    paddingLeft: spacing.sm,
  },
  swipeActionBtn: {
    width: 64,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingHorizontal: 6,
  },
  swipeActionLabel: {
    fontSize: 10,
    ...typography.bodySemiBold,
  },
  itemCard: {
    borderRadius: radii.md,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: 13,
    gap: spacing.md,
  },
  checkedCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemBody: {
    flex: 1,
    gap: 4,
  },
  itemTitle: {
    fontSize: 15,
    ...typography.cardTitle,
  },
  itemNotes: {
    fontSize: 13,
    ...typography.body,
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: 2,
  },
  metaChip: {
    borderWidth: 1,
    borderRadius: radii.pill,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  metaChipText: {
    fontSize: 11,
    ...typography.bodySemiBold,
  },
  clockChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: radii.pill,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  clockChipText: {
    fontSize: 11,
    ...typography.bodySemiBold,
  },
  noteOriginChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: radii.pill,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 2,
    maxWidth: 180,
  },
  noteOriginText: {
    fontSize: 11,
    ...typography.label,
  },
  rowActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  rowIconButton: {
    width: 30,
    height: 30,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default ReminderRowCard;
