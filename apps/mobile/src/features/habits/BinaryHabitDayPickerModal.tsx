import React, { useMemo } from 'react';
import {
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Calendar, Check, Target, X } from '../../components/icons';
import { iconMetrics, radii, shadows, spacing, typography } from '../../theme/tokens';
import { useTheme } from '../../theme/ThemeContext';
import { LiquidGlassCard } from '../../components/glass/LiquidGlassCard';
import { shiftDateKey } from './streakEngine';
import type { EnrichedHabitItem } from './useHabitsManager';

const SHORT_WEEK_LABELS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'] as const;

export interface BinaryHabitDayPickerModalProps {
  visible: boolean;
  habit: EnrichedHabitItem | null;
  todayKey: string;
  onClose: () => void;
  onToggleDate: (habitId: string, dateKey: string) => void;
}

export const BinaryHabitDayPickerModal: React.FC<BinaryHabitDayPickerModalProps> = ({
  visible,
  habit,
  todayKey,
  onClose,
  onToggleDate,
}) => {
  const { theme, isDark } = useTheme();
  const yesterdayKey = useMemo(() => shiftDateKey(todayKey, -1), [todayKey]);

  if (!habit) return null;

  const { weeklyProgress } = habit;
  const completedSet = new Set(weeklyProgress.completedDateKeys);
  const isTodayCompleted = completedSet.has(todayKey);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View
        style={[
          styles.backdrop,
          {
            backgroundColor: isDark
              ? 'rgba(5, 7, 10, 0.76)'
              : 'rgba(15, 17, 21, 0.30)',
          },
        ]}
      >
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />

        <LiquidGlassCard
          variant="floating"
          intensity={85}
          style={styles.sheetContainer}
          contentStyle={styles.sheetContent}
        >
          {/* Header */}
          <View style={styles.headerRow}>
            <View style={styles.headerLeft}>
              <View
                style={[
                  styles.iconBox,
                  {
                    backgroundColor: theme.accentPrimarySoft,
                    borderColor: theme.accentPrimaryBorder,
                  },
                ]}
              >
                <Calendar
                  size={18}
                  color={theme.accentPrimaryLink}
                  strokeWidth={iconMetrics.strokeWidth}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.title, { color: theme.textPrimary }]}>
                  ¿Qué día realizaste este hábito?
                </Text>
                <Text
                  style={[styles.subtitle, { color: theme.textSecondary }]}
                  numberOfLines={1}
                >
                  {habit.title}
                </Text>
              </View>
            </View>

            <Pressable
              onPress={onClose}
              style={[styles.closeBtn, { backgroundColor: theme.pillBg }]}
              hitSlop={10}
            >
              <X size={17} color={theme.textSecondary} strokeWidth={2} />
            </Pressable>
          </View>

          {/* Píldora de Objetivo Semanal si existe */}
          {weeklyProgress.weeklyGoal ? (
            <View
              style={[
                styles.goalBanner,
                {
                  backgroundColor: theme.accentPrimarySoft,
                  borderColor: theme.accentPrimaryBorder,
                },
              ]}
            >
              <Target size={14} color={theme.accentPrimaryLink} strokeWidth={2.1} />
              <Text style={[styles.goalBannerText, { color: theme.accentPrimaryLink }]}>
                Objetivo semanal: {weeklyProgress.completedThisWeek}/
                {weeklyProgress.weeklyGoal} · {weeklyProgress.weekPoints}/100 pts
              </Text>
            </View>
          ) : null}

          {/* Días de la semana en curso (Lunes a Domingo) */}
          <View style={styles.daysRow}>
            {weeklyProgress.weekDateKeys.map((dateKey, idx) => {
              const isFuture = dateKey > todayKey;
              const isChecked = completedSet.has(dateKey);
              const isToday = dateKey === todayKey;
              const isYesterday = dateKey === yesterdayKey;
              const dayNumber = dateKey.split('-')[2] ?? '';

              return (
                <Pressable
                  key={dateKey}
                  disabled={isFuture}
                  onPress={() => onToggleDate(habit.id, dateKey)}
                  style={[
                    styles.dayButton,
                    {
                      backgroundColor: isChecked
                        ? theme.accentPrimary
                        : theme.cardElevated,
                      borderColor: isChecked
                        ? theme.accentPrimary
                        : isToday
                          ? theme.accentPrimaryBorder
                          : theme.glassBorder,
                      opacity: isFuture ? 0.36 : 1,
                    },
                  ]}
                  accessibilityLabel={`${SHORT_WEEK_LABELS[idx]} ${dayNumber}`}
                >
                  <Text
                    style={[
                      styles.dayShort,
                      {
                        color: isChecked
                          ? theme.accentPrimaryText
                          : theme.textSecondary,
                      },
                    ]}
                  >
                    {SHORT_WEEK_LABELS[idx]}
                  </Text>
                  <Text
                    style={[
                      styles.dayNum,
                      {
                        color: isChecked
                          ? theme.accentPrimaryText
                          : theme.textPrimary,
                      },
                    ]}
                  >
                    {dayNumber}
                  </Text>

                  <View style={styles.dayStatusSlot}>
                    {isChecked ? (
                      <Check
                        size={12}
                        color={theme.accentPrimaryText}
                        strokeWidth={2.8}
                      />
                    ) : isToday ? (
                      <Text
                        style={[
                          styles.dayHint,
                          { color: theme.accentPrimaryLink },
                        ]}
                      >
                        Hoy
                      </Text>
                    ) : isYesterday ? (
                      <Text style={[styles.dayHint, { color: theme.textMuted }]}>
                        Ayer
                      </Text>
                    ) : null}
                  </View>
                </Pressable>
              );
            })}
          </View>

          {/* Footer Acciones */}
          <View style={styles.footerRow}>
            {!isTodayCompleted ? (
              <Pressable
                onPress={() => {
                  onToggleDate(habit.id, todayKey);
                  onClose();
                }}
                style={({ pressed }) => [
                  styles.primaryBtn,
                  { backgroundColor: theme.accentPrimary },
                  pressed && { opacity: 0.88 },
                ]}
              >
                <Check size={16} color={theme.accentPrimaryText} strokeWidth={2.4} />
                <Text
                  style={[
                    styles.primaryBtnText,
                    { color: theme.accentPrimaryText },
                  ]}
                >
                  Marcar Hoy y cerrar
                </Text>
              </Pressable>
            ) : null}

            <Pressable
              onPress={onClose}
              style={[
                styles.secondaryBtn,
                {
                  backgroundColor: theme.pillBg,
                  borderColor: theme.glassBorder,
                  flex: isTodayCompleted ? 1 : undefined,
                },
              ]}
            >
              <Text style={[styles.secondaryBtnText, { color: theme.textPrimary }]}>
                Listo
              </Text>
            </Pressable>
          </View>
        </LiquidGlassCard>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: Platform.OS === 'web' ? 'center' : 'flex-end',
    paddingHorizontal: spacing.md,
    paddingBottom: Platform.OS === 'ios' ? spacing.xxl : spacing.lg,
  },
  sheetContainer: {
    width: '100%',
    maxWidth: 480,
    alignSelf: 'center',
    borderRadius: radii.xl,
    ...shadows.modal,
  },
  sheetContent: {
    padding: spacing.xl,
    gap: spacing.md,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  headerLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  iconBox: {
    width: 38,
    height: 38,
    borderRadius: radii.squircle,
    borderCurve: 'continuous',
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 16,
    ...typography.cardTitle,
  },
  subtitle: {
    fontSize: 13,
    marginTop: 2,
    fontWeight: '500',
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  goalBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    borderWidth: 1,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 9,
  },
  goalBannerText: {
    fontSize: 12,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  daysRow: {
    flexDirection: 'row',
    gap: 6,
  },
  dayButton: {
    flex: 1,
    borderWidth: 1,
    borderRadius: radii.md,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 4,
    minHeight: 74,
  },
  dayShort: {
    fontSize: 11,
    fontWeight: '600',
  },
  dayNum: {
    fontSize: 16,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  dayStatusSlot: {
    height: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayHint: {
    fontSize: 10,
    fontWeight: '700',
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: 2,
  },
  primaryBtn: {
    flex: 1,
    height: 44,
    borderRadius: radii.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  primaryBtnText: {
    fontSize: 14,
    fontWeight: '700',
  },
  secondaryBtn: {
    height: 44,
    paddingHorizontal: 18,
    borderRadius: radii.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryBtnText: {
    fontSize: 14,
    fontWeight: '600',
  },
});

export default BinaryHabitDayPickerModal;
