import React from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import * as Haptics from 'expo-haptics';
import {
  Check,
  Flame,
  Minus,
  PauseCircle,
  Pencil,
  Plus,
  Shield,
  Target,
} from '../../components/icons';
import { iconMetrics, radii, spacing } from '../../theme/tokens';
import { useTheme } from '../../theme/ThemeContext';
import { LiquidGlassCard } from '../../components/glass/LiquidGlassCard';
import { resolveHabitIcon } from './habitIcons';
import { TeslaBatteryMeter } from './TeslaBatteryMeter';
import type { EnrichedHabitItem } from './useHabitsManager';

export interface HabitCardProps {
  habit: EnrichedHabitItem;
  availableShields: number;
  onToggleBinary: (habitId: string) => void;
  onAdjustQuant: (habitId: string, delta: 1 | -1) => void;
  onToggleShield: (habitId: string) => void;
  onEdit: (habit: EnrichedHabitItem) => void;
}

function triggerLightHaptic() {
  if (Platform.OS === 'web') return;
  try {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  } catch {
    // Ignorar en dispositivos sin soporte háptico
  }
}

export const HabitCard: React.FC<HabitCardProps> = ({
  habit,
  availableShields,
  onToggleBinary,
  onAdjustQuant,
  onToggleShield,
  onEdit,
}) => {
  const { theme } = useTheme();
  const IconComp = resolveHabitIcon(habit.icon);
  const isQuant = habit.habitType === 'quantitative';
  const isDone = habit.completedOnActiveDate;
  const isShielded = habit.shieldedOnActiveDate;
  const isPaused = habit.isPausedOnActiveDate;
  const isRestDay = !habit.isScheduledOnActiveDate && !isPaused;
  const target = Math.max(1, habit.targetPerDay);

  const ringSize = 38;
  const ringStroke = 3.2;
  const ringRadius = (ringSize - ringStroke) / 2;
  const ringCirc = 2 * Math.PI * ringRadius;
  const quantRatio = Math.min(1, Math.max(0, habit.activeCount / target));
  const ringDashoffset = ringCirc - quantRatio * ringCirc;

  const canUseShield =
    !isPaused &&
    habit.isScheduledOnActiveDate &&
    !isDone &&
    (isShielded || availableShields > 0);

  const handlePrimaryTap = () => {
    triggerLightHaptic();
    if (isQuant) onAdjustQuant(habit.id, 1);
    else onToggleBinary(habit.id);
  };

  return (
    <LiquidGlassCard
      noPadding
      style={styles.card}
      contentStyle={[
        styles.row,
        (isPaused || isRestDay) && !isDone && { opacity: 0.72 },
      ]}
    >
      {/* Control Izquierdo: Checkbox Binario o Anillo Tesla Cuantitativo */}
      {isQuant ? (
        <Pressable
          onPress={handlePrimaryTap}
          style={styles.ringBtn}
          accessibilityLabel={`Sumar +1 a ${habit.title}`}
        >
          <Svg width={ringSize} height={ringSize}>
            <Circle
              cx={ringSize / 2}
              cy={ringSize / 2}
              r={ringRadius}
              stroke={theme.pillBg}
              strokeWidth={ringStroke}
              fill="none"
            />
            <Circle
              cx={ringSize / 2}
              cy={ringSize / 2}
              r={ringRadius}
              stroke={theme.accentPrimary}
              strokeWidth={ringStroke}
              strokeDasharray={`${ringCirc} ${ringCirc}`}
              strokeDashoffset={ringDashoffset}
              strokeLinecap="round"
              fill="none"
              rotation="-90"
              origin={`${ringSize / 2}, ${ringSize / 2}`}
            />
          </Svg>
          <View style={styles.ringIconOverlay} pointerEvents="none">
            <IconComp
              size={15}
              color={isDone ? theme.accentPrimaryLink : theme.textPrimary}
              strokeWidth={iconMetrics.strokeWidth}
            />
          </View>
        </Pressable>
      ) : (
        <Pressable
          onPress={handlePrimaryTap}
          style={[
            styles.checkSquare,
            {
              borderColor: isDone
                ? theme.accentPrimary
                : isShielded
                  ? theme.accentPrimaryBorder
                  : theme.textSecondary,
              backgroundColor: isDone
                ? theme.accentPrimary
                : isShielded
                  ? theme.accentPrimarySoft
                  : theme.inputBg,
            },
          ]}
          accessibilityLabel={`Marcar ${habit.title}`}
        >
          {isDone ? (
            <Check size={15} color={theme.accentPrimaryText} strokeWidth={2.6} />
          ) : isShielded ? (
            <Shield size={13} color={theme.accentPrimaryLink} strokeWidth={2.2} />
          ) : null}
        </Pressable>
      )}

      {/* Centro: Título + Racha discreta + Batería Tesla / Estado */}
      <Pressable onPress={handlePrimaryTap} style={styles.body}>
        <View style={styles.titleLine}>
          <Text
            style={[
              styles.title,
              { color: theme.textPrimary },
              isDone &&
                !isQuant && {
                  textDecorationLine: 'line-through',
                  color: theme.textMuted,
                },
            ]}
            numberOfLines={1}
          >
            {habit.title}
          </Text>

          <View style={[styles.streakPill, { backgroundColor: theme.pillBg }]}>
            <Flame size={11} color={theme.accentPrimaryLink} strokeWidth={2.1} />
            <Text style={[styles.streakText, { color: theme.textSecondary }]}>
              {habit.computedStreak}d · Récord {habit.computedBestStreak}d
            </Text>
          </View>

          {habit.weeklyProgress.weeklyGoal ? (
            <View
              style={[
                styles.streakPill,
                {
                  backgroundColor: habit.weeklyProgress.goalMet
                    ? theme.accentPrimarySoft
                    : theme.pillBg,
                },
              ]}
            >
              <Target
                size={11}
                color={
                  habit.weeklyProgress.goalMet
                    ? theme.accentPrimaryLink
                    : theme.textSecondary
                }
                strokeWidth={2}
              />
              <Text
                style={[
                  styles.streakText,
                  {
                    color: habit.weeklyProgress.goalMet
                      ? theme.accentPrimaryLink
                      : theme.textSecondary,
                  },
                ]}
              >
                Sem {habit.weeklyProgress.completedThisWeek}/
                {habit.weeklyProgress.weeklyGoal} · {habit.weeklyProgress.weekPoints} pts
              </Text>
            </View>
          ) : null}
        </View>

        {isShielded ? (
          <View style={styles.statusRow}>
            <View
              style={[
                styles.statusBadge,
                {
                  backgroundColor: theme.accentPrimarySoft,
                  borderColor: theme.accentPrimaryBorder,
                },
              ]}
            >
              <Shield size={11} color={theme.accentPrimaryLink} strokeWidth={2.1} />
              <Text style={[styles.statusBadgeText, { color: theme.accentPrimaryLink }]}>
                Escudo de Descanso activo (racha protegida)
              </Text>
            </View>
          </View>
        ) : isPaused ? (
          <View style={styles.statusRow}>
            <View
              style={[
                styles.statusBadge,
                {
                  backgroundColor: theme.warningSoft,
                  borderColor: theme.glassBorder,
                },
              ]}
            >
              <PauseCircle size={11} color={theme.warning} strokeWidth={2} />
              <Text style={[styles.statusBadgeText, { color: theme.warning }]}>
                En pausa {habit.pausedUntil ? `hasta ${habit.pausedUntil}` : ''}
              </Text>
            </View>
          </View>
        ) : isRestDay ? (
          <Text style={[styles.metaText, { color: theme.textMuted }]}>
            Día libre programado · racha intacta
          </Text>
        ) : isQuant ? (
          <TeslaBatteryMeter
            current={habit.activeCount}
            target={target}
            unit={habit.unit}
            isComplete={isDone}
          />
        ) : habit.reminderTime ? (
          <View style={styles.binaryMetaRow}>
            <IconComp size={12} color={theme.textMuted} strokeWidth={1.8} />
            <Text style={[styles.metaText, { color: theme.textSecondary }]}>
              Sugerido {habit.reminderTime}
            </Text>
          </View>
        ) : null}
      </Pressable>

      {/* Controles Derechos: -/+1, Escudo de Descanso y Editar */}
      <View style={styles.rightControls}>
        {isQuant && !isPaused && !isShielded ? (
          <View style={styles.quantSteps}>
            <Pressable
              onPress={() => {
                triggerLightHaptic();
                onAdjustQuant(habit.id, -1);
              }}
              style={[
                styles.stepBtn,
                {
                  backgroundColor: theme.pillBg,
                  borderColor: theme.glassBorder,
                },
              ]}
              accessibilityLabel={`Restar 1 a ${habit.title}`}
            >
              <Minus size={13} color={theme.textSecondary} strokeWidth={2.2} />
            </Pressable>
            <Pressable
              onPress={() => {
                triggerLightHaptic();
                onAdjustQuant(habit.id, 1);
              }}
              style={[
                styles.stepPlusBtn,
                {
                  backgroundColor: theme.accentPrimarySoft,
                  borderColor: theme.accentPrimaryBorder,
                },
              ]}
              accessibilityLabel={`Sumar 1 a ${habit.title}`}
            >
              <Plus size={12} color={theme.accentPrimaryLink} strokeWidth={2.3} />
              <Text style={[styles.stepPlusText, { color: theme.accentPrimaryLink }]}>
                1
              </Text>
            </Pressable>
          </View>
        ) : null}

        {(canUseShield || isShielded) && (
          <Pressable
            onPress={() => {
              triggerLightHaptic();
              onToggleShield(habit.id);
            }}
            style={[
              styles.iconActionBtn,
              {
                backgroundColor: isShielded
                  ? theme.accentPrimary
                  : theme.pillBg,
                borderColor: isShielded
                  ? theme.accentPrimary
                  : theme.glassBorder,
              },
            ]}
            accessibilityLabel={
              isShielded ? 'Quitar Escudo de Descanso' : 'Usar Escudo de Descanso'
            }
          >
            <Shield
              size={14}
              color={isShielded ? theme.accentPrimaryText : theme.textSecondary}
              strokeWidth={2}
            />
          </Pressable>
        )}

        <Pressable
          onPress={() => onEdit(habit)}
          hitSlop={8}
          style={[
            styles.iconActionBtn,
            {
              backgroundColor: theme.pillBg,
              borderColor: 'transparent',
            },
          ]}
          accessibilityLabel={`Editar ${habit.title}`}
        >
          <Pencil size={14} color={theme.textSecondary} strokeWidth={1.9} />
        </Pressable>
      </View>
    </LiquidGlassCard>
  );
};

const styles = StyleSheet.create({
  card: {
    borderRadius: radii.md,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: 13,
    gap: spacing.md,
  },
  checkSquare: {
    width: 28,
    height: 28,
    borderRadius: 9,
    borderWidth: 1.8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringBtn: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringIconOverlay: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: {
    flex: 1,
    gap: 4,
  },
  titleLine: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: spacing.xs,
  },
  title: {
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  streakPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 2.5,
    borderRadius: radii.pill,
  },
  streakText: {
    fontSize: 11,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderRadius: radii.pill,
    paddingHorizontal: 8,
    paddingVertical: 2.5,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  binaryMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  metaText: {
    fontSize: 12,
    fontWeight: '500',
  },
  rightControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  quantSteps: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  stepBtn: {
    width: 28,
    height: 28,
    borderRadius: 9,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepPlusBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 1,
    height: 28,
    paddingHorizontal: 8,
    borderRadius: 9,
    borderWidth: 1,
  },
  stepPlusText: {
    fontSize: 12,
    fontWeight: '700',
  },
  iconActionBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default HabitCard;
