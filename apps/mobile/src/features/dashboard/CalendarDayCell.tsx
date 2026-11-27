import React, { useCallback, useEffect, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { fontFamilies, glassMotion, typography } from '../../theme/tokens';
import { useTheme } from '../../theme/ThemeContext';

function webStyle(styles: Record<string, unknown>): ViewStyle | undefined {
  return Platform.OS === 'web' ? (styles as unknown as ViewStyle) : undefined;
}

export interface CalendarDayCellProps {
  dateKey: string;
  dayNumber: number;
  inCurrentMonth: boolean;
  isSelected: boolean;
  isToday: boolean;
  hasActivity: boolean;
  onSelectDate: (dateKey: string) => void;
}

/**
 * Celda circular de día para MiniCalendarBento con animación
 * Opción A: Lente de Cristal / Anillo Especular (Frosted Lens Ring).
 */
export const CalendarDayCell: React.FC<CalendarDayCellProps> = React.memo(
  ({
    dateKey,
    dayNumber,
    inCurrentMonth,
    isSelected,
    isToday,
    hasActivity,
    onSelectDate,
  }) => {
    const { theme } = useTheme();
    const reducedMotion = useReducedMotion();
    const [hovered, setHovered] = useState(false);

    const hoverProgress = useSharedValue(0);
    const pressProgress = useSharedValue(0);

    const handleHoverIn = useCallback(() => {
      setHovered(true);
      hoverProgress.value = withSpring(1, glassMotion.lensSpring);
    }, [hoverProgress]);

    const handleHoverOut = useCallback(() => {
      setHovered(false);
      hoverProgress.value = withSpring(0, glassMotion.lensSpring);
    }, [hoverProgress]);

    const handlePressIn = useCallback(() => {
      pressProgress.value = withSpring(1, glassMotion.pressSpring);
    }, [pressProgress]);

    const handlePressOut = useCallback(() => {
      pressProgress.value = withSpring(0, glassMotion.pressSpring);
    }, [pressProgress]);

    const cellAnimatedStyle = useAnimatedStyle(() => {
      if (reducedMotion) {
        return {
          opacity: 1 - pressProgress.value * 0.16,
        };
      }
      const targetScale = isSelected ? 1.06 : 1.1;
      const scale =
        1 + hoverProgress.value * (targetScale - 1) - pressProgress.value * 0.08;
      return {
        transform: [{ scale }],
      };
    }, [isSelected, reducedMotion]);

    const lensRingAnimatedStyle = useAnimatedStyle(() => {
      return {
        opacity: hoverProgress.value,
      };
    });

    const dotAnimatedStyle = useAnimatedStyle(() => {
      if (reducedMotion) return {};
      return {
        transform: [{ scale: 1 + hoverProgress.value * 0.35 }],
      };
    }, [reducedMotion]);

    return (
      <Animated.View
        style={[
          styles.cellOuter,
          hovered && styles.cellHoveredZ,
          cellAnimatedStyle,
        ]}
      >
        <Pressable
          onPress={() => onSelectDate(dateKey)}
          onHoverIn={handleHoverIn}
          onHoverOut={handleHoverOut}
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          accessibilityRole="button"
          accessibilityLabel={`Día ${dayNumber}`}
          accessibilityState={{ selected: isSelected }}
          style={[
            styles.dayCell,
            inCurrentMonth
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
                borderColor: theme.accentPrimary,
              },
            isSelected && {
              backgroundColor: theme.accentPrimary,
              borderWidth: 0,
            },
            webStyle({
              cursor: 'pointer',
              userSelect: 'none',
            }),
          ]}
        >
          {/* Capa Lente de Cristal / Anillo Especular */}
          <Animated.View
            pointerEvents="none"
            style={[
              styles.lensRingOverlay,
              isSelected
                ? {
                    borderWidth: 1.25,
                    borderColor: 'rgba(255, 255, 255, 0.55)',
                    backgroundColor: 'transparent',
                  }
                : {
                    borderWidth: 1.5,
                    borderColor: theme.glassLensRing,
                    backgroundColor: theme.glassLensFill,
                  },
              webStyle(
                isSelected
                  ? {
                      boxShadow: `inset 0 1px 1.5px rgba(255,255,255,0.55), 0 4px 14px ${theme.accentPrimaryBorder}`,
                    }
                  : {
                      backdropFilter: 'blur(10px) saturate(165%)',
                      WebkitBackdropFilter: 'blur(10px) saturate(165%)',
                      boxShadow: `inset 0 1px 1.5px ${theme.glassBubbleSpecular}, 0 4px 14px ${theme.glassLensShadow}`,
                    }
              ),
              lensRingAnimatedStyle,
            ]}
          >
            <View
              style={[
                styles.lensSpecularArc,
                {
                  backgroundColor: isSelected
                    ? 'rgba(255,255,255,0.65)'
                    : theme.glassBubbleSpecular,
                },
              ]}
            />
          </Animated.View>

          <Text
            style={[
              styles.dayNumber,
              {
                color: inCurrentMonth
                  ? theme.textPrimary
                  : hovered
                    ? theme.textSecondary
                    : theme.textMuted,
              },
              isSelected && {
                color: theme.accentPrimaryText,
                fontFamily: fontFamilies.bodyBold,
              },
            ]}
          >
            {dayNumber}
          </Text>

          {hasActivity && !isSelected ? (
            <Animated.View
              style={[
                styles.activityDot,
                { backgroundColor: theme.accentPrimary },
                dotAnimatedStyle,
              ]}
            />
          ) : null}
        </Pressable>
      </Animated.View>
    );
  }
);

CalendarDayCell.displayName = 'CalendarDayCell';

export interface WeekDayLensPillProps {
  dateKey: string;
  dayShort: string;
  dayNum: string;
  isSelected: boolean;
  isToday?: boolean;
  hasActivity?: boolean;
  activityDots?: {
    hasEvent?: boolean;
    hasReminder?: boolean;
    hasHabit?: boolean;
  };
  pillWidth?: number;
  onSelect: (dateKey: string) => void;
  borderRadius: number;
}

/**
 * Píldora de día semanal para la vista Calendario, usando el mismo
 * lenguaje visual Frosted Lens Ring.
 */
export const WeekDayLensPill: React.FC<WeekDayLensPillProps> = React.memo(
  ({
    dateKey,
    dayShort,
    dayNum,
    isSelected,
    isToday = false,
    hasActivity = false,
    activityDots,
    pillWidth = 58,
    onSelect,
    borderRadius,
  }) => {
    const { theme } = useTheme();
    const reducedMotion = useReducedMotion();
    const [hovered, setHovered] = useState(false);

    const hoverProgress = useSharedValue(0);
    const pressProgress = useSharedValue(0);

    useEffect(() => {
      return () => {
        setHovered(false);
      };
    }, []);

    const pillAnimatedStyle = useAnimatedStyle(() => {
      if (reducedMotion) {
        return {
          opacity: 1 - pressProgress.value * 0.14,
        };
      }
      const scale =
        1 + hoverProgress.value * 0.06 - pressProgress.value * 0.06;
      const translateY = hoverProgress.value * -2;
      return {
        transform: [{ translateY }, { scale }],
      };
    }, [reducedMotion]);

    const lensOverlayStyle = useAnimatedStyle(() => {
      return {
        opacity: hoverProgress.value,
      };
    });

    return (
      <Animated.View
        style={[hovered && styles.cellHoveredZ, pillAnimatedStyle]}
      >
        <Pressable
          onPress={() => onSelect(dateKey)}
          onHoverIn={() => {
            setHovered(true);
            hoverProgress.value = withSpring(1, glassMotion.lensSpring);
          }}
          onHoverOut={() => {
            setHovered(false);
            hoverProgress.value = withSpring(0, glassMotion.lensSpring);
          }}
          onPressIn={() => {
            pressProgress.value = withSpring(1, glassMotion.pressSpring);
          }}
          onPressOut={() => {
            pressProgress.value = withSpring(0, glassMotion.pressSpring);
          }}
          accessibilityRole="button"
          accessibilityLabel={`${dayShort} ${dayNum}`}
          accessibilityState={{ selected: isSelected }}
          style={[
            styles.weekPill,
            styles.weekPillShadow,
            {
              width: pillWidth,
              borderRadius,
              backgroundColor: isSelected ? theme.accentPrimary : theme.card,
              borderColor: isSelected
                ? theme.accentPrimary
                : isToday
                  ? theme.accentPrimaryBorder
                  : theme.glassBorder,
            },
            isToday && !isSelected && { borderWidth: 1.5 },
            isSelected && styles.weekPillSelectedGlow,
            webStyle({
              cursor: 'pointer',
              userSelect: 'none',
              boxShadow: isSelected
                ? '0 8px 18px rgba(250, 107, 107, 0.34), 0 2px 6px rgba(0, 0, 0, 0.22)'
                : '0 4px 12px rgba(0, 0, 0, 0.18)',
            }),
          ]}
        >
          <Animated.View
            pointerEvents="none"
            style={[
              styles.weekLensOverlay,
              {
                borderRadius,
                borderColor: isSelected
                  ? 'rgba(255, 255, 255, 0.52)'
                  : theme.glassLensRing,
                backgroundColor: isSelected
                  ? 'transparent'
                  : theme.glassLensFill,
              },
              webStyle(
                isSelected
                  ? {
                      boxShadow: `inset 0 1px 1.5px rgba(255,255,255,0.5), 0 6px 16px ${theme.accentPrimaryBorder}`,
                    }
                  : {
                      backdropFilter: 'blur(12px) saturate(170%)',
                      WebkitBackdropFilter: 'blur(12px) saturate(170%)',
                      boxShadow: `inset 0 1px 1.5px ${theme.glassBubbleSpecular}, 0 6px 16px ${theme.glassLensShadow}`,
                    }
              ),
              lensOverlayStyle,
            ]}
          >
            <View
              style={[
                styles.weekLensArc,
                {
                  backgroundColor: isSelected
                    ? 'rgba(255,255,255,0.65)'
                    : theme.glassBubbleSpecular,
                },
              ]}
            />
          </Animated.View>

          <Text
            style={[
              styles.weekDayShortText,
              {
                color: isSelected
                  ? 'rgba(255,255,255,0.85)'
                  : theme.textSecondary,
              },
            ]}
          >
            {dayShort}
          </Text>
          <Text
            style={[
              styles.weekDayNumText,
              { color: isSelected ? '#FFFFFF' : theme.textPrimary },
            ]}
          >
            {dayNum}
          </Text>

          {activityDots &&
          (activityDots.hasEvent ||
            activityDots.hasReminder ||
            activityDots.hasHabit) ? (
            <View style={styles.weekDotsRow}>
              {activityDots.hasEvent ? (
                <View
                  style={[
                    styles.weekMultiDot,
                    {
                      backgroundColor: isSelected
                        ? 'rgba(255,255,255,0.9)'
                        : '#8E95A3',
                    },
                  ]}
                />
              ) : null}
              {activityDots.hasReminder ? (
                <View
                  style={[
                    styles.weekMultiDot,
                    {
                      backgroundColor: isSelected ? '#FFFFFF' : '#FA6B6B',
                    },
                  ]}
                />
              ) : null}
              {activityDots.hasHabit ? (
                <View
                  style={[
                    styles.weekMultiDot,
                    {
                      backgroundColor: isSelected ? '#A7F3D0' : '#059669',
                    },
                  ]}
                />
              ) : null}
            </View>
          ) : hasActivity && !isSelected ? (
            <View
              style={[
                styles.weekActivityDot,
                { backgroundColor: theme.accentPrimary },
              ]}
            />
          ) : null}
        </Pressable>
      </Animated.View>
    );
  }
);

WeekDayLensPill.displayName = 'WeekDayLensPill';

const styles = StyleSheet.create({
  cellOuter: {
    flex: 1,
    aspectRatio: 1,
    maxHeight: 38,
    position: 'relative',
  },
  cellHoveredZ: {
    zIndex: 10,
  },
  dayCell: {
    flex: 1,
    width: '100%',
    height: '100%',
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  lensRingOverlay: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 999,
    overflow: 'hidden',
    zIndex: 1,
  },
  lensSpecularArc: {
    position: 'absolute',
    top: 1.5,
    left: 8,
    right: 8,
    height: 1.25,
    borderRadius: 999,
    opacity: 0.8,
  },
  dayNumber: {
    fontSize: 12,
    fontVariant: ['tabular-nums'],
    zIndex: 2,
    ...typography.bodySemiBold,
  },
  activityDot: {
    position: 'absolute',
    bottom: 4,
    width: 4,
    height: 4,
    borderRadius: 2,
    zIndex: 2,
  },
  weekPill: {
    width: 58,
    height: 68,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    position: 'relative',
  },
  weekPillShadow: Platform.select<ViewStyle>({
    ios: {
      shadowColor: '#000000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.14,
      shadowRadius: 8,
    },
    android: {
      elevation: 3,
    },
    default: {},
  })!,
  weekPillSelectedGlow: Platform.select<ViewStyle>({
    ios: {
      shadowColor: '#FA6B6B',
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.34,
      shadowRadius: 12,
    },
    android: {
      elevation: 6,
    },
    default: {},
  })!,
  weekLensOverlay: {
    ...StyleSheet.absoluteFillObject,
    borderWidth: 1.5,
    overflow: 'hidden',
    zIndex: 1,
  },
  weekLensArc: {
    position: 'absolute',
    top: 1.5,
    left: 10,
    right: 10,
    height: 1.25,
    borderRadius: 999,
    opacity: 0.78,
  },
  weekDayShortText: {
    fontSize: 12,
    zIndex: 2,
    ...typography.bodyMedium,
  },
  weekDayNumText: {
    fontSize: 17,
    zIndex: 2,
    ...typography.bodyBold,
  },
  weekActivityDot: {
    position: 'absolute',
    bottom: 5,
    width: 4,
    height: 4,
    borderRadius: 2,
    zIndex: 2,
  },
  weekDotsRow: {
    position: 'absolute',
    bottom: 5,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    zIndex: 2,
  },
  weekMultiDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
  },
});

export default CalendarDayCell;
