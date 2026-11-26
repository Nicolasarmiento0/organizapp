import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Platform,
  Pressable,
  StyleSheet,
  View,
  type AccessibilityRole,
  type AccessibilityState,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { glassMotion, radii } from '../../theme/tokens';
import { useTheme } from '../../theme/ThemeContext';

function webStyle(styles: Record<string, unknown>): ViewStyle | undefined {
  return Platform.OS === 'web' ? (styles as unknown as ViewStyle) : undefined;
}

export interface LiquidGlassBubbleState {
  hovered: boolean;
  pressed: boolean;
}

export interface LiquidGlassBubbleProps {
  variant: 'pill' | 'cta' | 'card';
  borderRadius?: number;
  enableSpotlight?: boolean;
  spotlightSize?: number;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  surfaceStyle?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
  accessibilityRole?: AccessibilityRole;
  accessibilityState?: AccessibilityState;
  children:
    | React.ReactNode
    | ((state: LiquidGlassBubbleState) => React.ReactNode);
}

/**
 * Superficie interactiva Liquid Glass para píldoras, botones CTA y tarjetas de módulos.
 * - Anima únicamente `opacity` y `transform` dentro de `useAnimatedStyle`.
 * - Las propiedades CSS Web (`backdropFilter`, `backgroundImage`, `boxShadow`) residen
 *   en capas estáticas superpuestas con `pointerEvents="none"`.
 */
export const LiquidGlassBubble: React.FC<LiquidGlassBubbleProps> = ({
  variant,
  borderRadius,
  enableSpotlight = true,
  spotlightSize,
  onPress,
  style,
  surfaceStyle,
  contentStyle,
  accessibilityLabel,
  accessibilityRole = 'button',
  accessibilityState,
  children,
}) => {
  const { theme } = useTheme();
  const reducedMotion = useReducedMotion();
  const [hovered, setHovered] = useState(false);
  const [pressed, setPressed] = useState(false);

  const hoverProgress = useSharedValue(0);
  const pressProgress = useSharedValue(0);
  const pointerX = useSharedValue(0);
  const pointerY = useSharedValue(0);
  const spotlightOpacity = useSharedValue(0);

  const resolvedRadius =
    borderRadius ?? (variant === 'card' ? radii.md : radii.pill);
  const orbSize =
    spotlightSize ?? (variant === 'card' ? 190 : variant === 'cta' ? 110 : 120);

  const handleHoverIn = useCallback(() => {
    setHovered(true);
    hoverProgress.value = withSpring(1, glassMotion.bubbleSpring);
    if (enableSpotlight) {
      spotlightOpacity.value = withTiming(1, { duration: glassMotion.fadeMs });
    }
  }, [enableSpotlight, hoverProgress, spotlightOpacity]);

  const handleHoverOut = useCallback(() => {
    setHovered(false);
    hoverProgress.value = withSpring(0, glassMotion.bubbleSpring);
    spotlightOpacity.value = withTiming(0, { duration: glassMotion.fadeMs });
  }, [hoverProgress, spotlightOpacity]);

  const handlePressIn = useCallback(() => {
    setPressed(true);
    pressProgress.value = withSpring(1, glassMotion.pressSpring);
  }, [pressProgress]);

  const handlePressOut = useCallback(() => {
    setPressed(false);
    pressProgress.value = withSpring(0, glassMotion.pressSpring);
  }, [pressProgress]);

  const handlePointerMove = useCallback(
    (event: unknown) => {
      if (Platform.OS !== 'web' || !enableSpotlight) return;
      const webEvent = event as {
        clientX?: number;
        clientY?: number;
        currentTarget?: { getBoundingClientRect?: () => DOMRect };
        nativeEvent?: { offsetX?: number; offsetY?: number };
      };
      const rect = webEvent?.currentTarget?.getBoundingClientRect?.();
      if (
        rect &&
        typeof webEvent.clientX === 'number' &&
        typeof webEvent.clientY === 'number'
      ) {
        pointerX.value = webEvent.clientX - rect.left;
        pointerY.value = webEvent.clientY - rect.top;
      } else if (
        webEvent?.nativeEvent &&
        typeof webEvent.nativeEvent.offsetX === 'number' &&
        typeof webEvent.nativeEvent.offsetY === 'number'
      ) {
        pointerX.value = webEvent.nativeEvent.offsetX;
        pointerY.value = webEvent.nativeEvent.offsetY;
      }
    },
    [enableSpotlight, pointerX, pointerY]
  );

  const containerAnimatedStyle = useAnimatedStyle(() => {
    if (reducedMotion) {
      return {
        opacity: 1 - pressProgress.value * 0.14,
      };
    }

    const hoverScaleTarget =
      variant === 'card' ? 1.015 : variant === 'cta' ? 1.035 : 1.03;
    const hoverLiftTarget = variant === 'card' ? -2 : -1;
    const pressScaleDelta =
      variant === 'card' ? 0.03 : variant === 'cta' ? 0.08 : 0.065;

    const scale =
      1 +
      hoverProgress.value * (hoverScaleTarget - 1) -
      pressProgress.value * pressScaleDelta;
    const translateY =
      hoverProgress.value * hoverLiftTarget + pressProgress.value * 0.8;

    return {
      transform: [{ translateY }, { scale }],
    };
  }, [reducedMotion, variant]);

  const glassOverlayAnimatedStyle = useAnimatedStyle(() => {
    return {
      opacity: hoverProgress.value,
    };
  });

  const spotlightAnimatedStyle = useAnimatedStyle(() => {
    return {
      opacity: spotlightOpacity.value,
      transform: [
        { translateX: pointerX.value - orbSize / 2 },
        { translateY: pointerY.value - orbSize / 2 },
      ],
    };
  }, [orbSize]);

  // Para el botón CTA (+ Nuevo), accentVolt es claro en darkMode y oscuro en lightMode.
  const isLightCtaSurface = variant === 'cta' && theme.mode === 'dark';
  const ctaSheenColor = isLightCtaSurface
    ? 'rgba(10, 11, 13, 0.10)'
    : 'rgba(255, 255, 255, 0.28)';
  const spotlightColor =
    variant === 'cta' ? ctaSheenColor : theme.glassSpotlight;

  const hoverLayerWebStyles = webStyle(
    variant === 'cta'
      ? {
          boxShadow: `inset 0 1px 1px rgba(255,255,255,0.45), 0 8px 22px ${theme.glassBubbleGlow}, 0 0 0 1px ${theme.accentVoltBorder}`,
        }
      : {
          backdropFilter:
            variant === 'card'
              ? 'blur(12px) saturate(165%)'
              : 'blur(14px) saturate(180%)',
          WebkitBackdropFilter:
            variant === 'card'
              ? 'blur(12px) saturate(165%)'
              : 'blur(14px) saturate(180%)',
          boxShadow: `inset 0 1px 1px ${theme.glassBubbleSpecular}, 0 10px 26px ${theme.glassBubbleGlow}`,
        }
  );

  const spotlightWebStyles = webStyle({
    backgroundImage: `radial-gradient(circle, ${spotlightColor} 0%, transparent 68%)`,
  });

  const pressableWebProps =
    Platform.OS === 'web'
      ? ({
          onPointerMove: handlePointerMove,
        } as Record<string, unknown>)
      : {};

  const renderedChildren =
    typeof children === 'function' ? children({ hovered, pressed }) : children;

  return (
    <Animated.View style={[containerAnimatedStyle, style]}>
      <Pressable
        onPress={onPress}
        onHoverIn={handleHoverIn}
        onHoverOut={handleHoverOut}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        accessibilityRole={accessibilityRole}
        accessibilityLabel={accessibilityLabel}
        accessibilityState={accessibilityState}
        {...pressableWebProps}
        style={[
          styles.pressableBase,
          { borderRadius: resolvedRadius },
          surfaceStyle,
          webStyle({
            cursor: 'pointer',
            userSelect: 'none',
          }),
        ]}
      >
        {/* Capa interior recortada para vidrio, brillo especular y spotlight */}
        <View
          pointerEvents="none"
          style={[styles.clippedEffectsHost, { borderRadius: resolvedRadius }]}
        >
          <Animated.View
            style={[
              styles.glassOverlay,
              {
                borderRadius: resolvedRadius,
                borderColor:
                  variant === 'cta'
                    ? theme.accentVoltBorder
                    : theme.glassBubbleBorder,
                backgroundColor:
                  variant === 'cta'
                    ? 'transparent'
                    : variant === 'pill'
                      ? theme.glassBubbleFill
                      : theme.glassLensFill,
              },
              hoverLayerWebStyles,
              glassOverlayAnimatedStyle,
            ]}
          >
            <View
              style={[
                styles.specularRimTop,
                {
                  backgroundColor:
                    variant === 'cta'
                      ? isLightCtaSurface
                        ? 'rgba(255,255,255,0.65)'
                        : 'rgba(255,255,255,0.34)'
                      : theme.glassBubbleSpecular,
                },
              ]}
            />
          </Animated.View>

          {enableSpotlight ? (
            <Animated.View
              style={[
                styles.spotlightOrb,
                {
                  width: orbSize,
                  height: orbSize,
                  borderRadius: orbSize / 2,
                },
                spotlightWebStyles,
                spotlightAnimatedStyle,
              ]}
            />
          ) : null}
        </View>

        <View style={[styles.childrenLayer, contentStyle]}>{renderedChildren}</View>
      </Pressable>
    </Animated.View>
  );
};

export interface RailCapsuleItem {
  id: string;
  isActive?: boolean;
  backgroundColor: string;
  borderColor?: string;
  borderWidth?: number;
  accessibilityRole?: AccessibilityRole;
  accessibilityLabel: string;
  onPress: () => void;
  renderIcon: (state: { hovered: boolean; isActive: boolean }) => React.ReactNode;
}

export interface LiquidGlassRailCapsuleProps {
  items: RailCapsuleItem[];
  shadowStyle?: StyleProp<ViewStyle>;
  capsuleStyle?: StyleProp<ViewStyle>;
}

const RAIL_PADDING = 8;
const RAIL_ITEM_SIZE = 44;
const RAIL_GAP = 10;
const RAIL_STEP = RAIL_ITEM_SIZE + RAIL_GAP;

interface RailItemButtonProps {
  item: RailCapsuleItem;
  index: number;
  isHovered: boolean;
  onItemHoverIn: (index: number) => void;
  onItemHoverOut: (index: number) => void;
}

const RailItemButton: React.FC<RailItemButtonProps> = ({
  item,
  index,
  isHovered,
  onItemHoverIn,
  onItemHoverOut,
}) => {
  const { theme } = useTheme();
  const reducedMotion = useReducedMotion();
  const isPressed = useSharedValue(0);
  const iconHover = useSharedValue(0);

  useEffect(() => {
    iconHover.value = withSpring(isHovered ? 1 : 0, glassMotion.bubbleSpring);
  }, [isHovered, iconHover]);

  const iconAnimatedStyle = useAnimatedStyle(() => {
    if (reducedMotion) {
      return {
        opacity: 1 - isPressed.value * 0.16,
      };
    }
    const scale = 1 + iconHover.value * 0.08 - isPressed.value * 0.1;
    return {
      transform: [{ scale }],
    };
  }, [reducedMotion]);

  const activeGlossAnimatedStyle = useAnimatedStyle(() => {
    return {
      opacity: item.isActive ? 0.35 + iconHover.value * 0.65 : 0,
    };
  }, [item.isActive]);

  return (
    <Pressable
      onPress={item.onPress}
      onHoverIn={() => onItemHoverIn(index)}
      onHoverOut={() => onItemHoverOut(index)}
      onPressIn={() => {
        isPressed.value = withSpring(1, glassMotion.pressSpring);
      }}
      onPressOut={() => {
        isPressed.value = withSpring(0, glassMotion.pressSpring);
      }}
      accessibilityRole={item.accessibilityRole ?? 'button'}
      accessibilityLabel={item.accessibilityLabel}
      accessibilityState={
        item.accessibilityRole === 'tab'
          ? { selected: Boolean(item.isActive) }
          : undefined
      }
      style={[
        styles.railCircleBtn,
        {
          backgroundColor: item.backgroundColor,
          borderColor: item.borderColor ?? 'transparent',
          borderWidth: item.borderWidth ?? 0,
        },
        webStyle({
          cursor: 'pointer',
          userSelect: 'none',
        }),
      ]}
    >
      {item.isActive ? (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.activeCoralGlaze,
            webStyle({
              backgroundImage: `linear-gradient(160deg, rgba(255,255,255,0.42) 0%, rgba(255,255,255,0.04) 55%, transparent 100%)`,
              boxShadow: `inset 0 1px 1px rgba(255,255,255,0.48), 0 0 14px ${theme.accentPrimaryBorder}`,
            }),
            activeGlossAnimatedStyle,
          ]}
        />
      ) : null}

      <Animated.View style={[styles.railIconWrap, iconAnimatedStyle]}>
        {item.renderIcon({ hovered: isHovered, isActive: Boolean(item.isActive) })}
      </Animated.View>
    </Pressable>
  );
};

/**
 * Cápsula vertical del Rail lateral con burbuja Liquid Glass deslizante compartida.
 * Al mover el cursor entre botones, una sola burbuja translúcida se desliza con resorte
 * y micro-estiramiento elástico (`squish & stretch`) sin parpadear.
 */
export const LiquidGlassRailCapsule: React.FC<LiquidGlassRailCapsuleProps> = ({
  items,
  shadowStyle,
  capsuleStyle,
}) => {
  const { theme } = useTheme();
  const reducedMotion = useReducedMotion();
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const hoveredIndexRef = useRef<number | null>(null);
  const prevIndexRef = useRef<number | null>(null);

  const bubbleY = useSharedValue(RAIL_PADDING);
  const bubbleOpacity = useSharedValue(0);
  const bubbleScaleX = useSharedValue(0.86);
  const bubbleScaleY = useSharedValue(0.86);

  const handleItemHoverIn = useCallback(
    (index: number) => {
      const prev = prevIndexRef.current;
      hoveredIndexRef.current = index;
      setHoveredIndex(index);

      const targetY = RAIL_PADDING + index * RAIL_STEP;
      bubbleY.value =
        prev === null
          ? targetY
          : withSpring(targetY, glassMotion.glideSpring);
      bubbleOpacity.value = withTiming(1, { duration: glassMotion.fadeMs });

      if (reducedMotion) {
        bubbleScaleX.value = 1;
        bubbleScaleY.value = 1;
      } else if (prev !== null && prev !== index) {
        // Pulso líquido elástico al cambiar entre botones adyacentes
        bubbleScaleY.value = withSequence(
          withTiming(1.16, { duration: 90 }),
          withSpring(1.06, glassMotion.bubbleSpring)
        );
        bubbleScaleX.value = withSequence(
          withTiming(0.93, { duration: 90 }),
          withSpring(1.06, glassMotion.bubbleSpring)
        );
      } else {
        bubbleScaleX.value = withSpring(1.06, glassMotion.bubbleSpring);
        bubbleScaleY.value = withSpring(1.06, glassMotion.bubbleSpring);
      }

      prevIndexRef.current = index;
    },
    [bubbleOpacity, bubbleScaleX, bubbleScaleY, bubbleY, reducedMotion]
  );

  const clearHover = useCallback(() => {
    hoveredIndexRef.current = null;
    prevIndexRef.current = null;
    setHoveredIndex(null);
    bubbleOpacity.value = withTiming(0, { duration: glassMotion.fadeMs });
    if (!reducedMotion) {
      bubbleScaleX.value = withSpring(0.85, glassMotion.bubbleSpring);
      bubbleScaleY.value = withSpring(0.85, glassMotion.bubbleSpring);
    }
  }, [bubbleOpacity, bubbleScaleX, bubbleScaleY, reducedMotion]);

  const handleItemHoverOut = useCallback(
    (index: number) => {
      // En Web, `onPointerLeave` en la cápsula limpia cuando el puntero sale del rail.
      // En nativo o si no hay pointerLeave, sólo limpiamos si sigue siendo el mismo índice.
      if (Platform.OS !== 'web' && hoveredIndexRef.current === index) {
        clearHover();
      }
    },
    [clearHover]
  );

  const glidingBubbleStyle = useAnimatedStyle(() => {
    return {
      opacity: bubbleOpacity.value,
      transform: [
        { translateY: bubbleY.value },
        { scaleX: bubbleScaleX.value },
        { scaleY: bubbleScaleY.value },
      ],
    };
  });

  const capsuleWebProps =
    Platform.OS === 'web'
      ? ({
          onPointerLeave: clearHover,
        } as Record<string, unknown>)
      : {};

  return (
    <View
      {...capsuleWebProps}
      style={[
        styles.railCapsule,
        {
          backgroundColor: theme.railBg,
          borderColor: theme.glassBorder,
        },
        shadowStyle,
        capsuleStyle,
      ]}
    >
      {/* Burbuja Liquid Glass compartida */}
      <Animated.View
        pointerEvents="none"
        style={[
          styles.glidingBubble,
          {
            backgroundColor: theme.glassBubbleFillStrong,
            borderColor: theme.glassBubbleBorder,
          },
          webStyle({
            backdropFilter: 'blur(16px) saturate(190%)',
            WebkitBackdropFilter: 'blur(16px) saturate(190%)',
            backgroundImage: `radial-gradient(circle at 32% 24%, ${theme.glassBubbleSpecular} 0%, ${theme.glassBubbleFill} 48%, transparent 100%)`,
            boxShadow: `inset 0 1px 1.5px ${theme.glassBubbleSpecular}, inset 0 -1px 2px ${theme.glassBubbleGlow}, 0 6px 18px ${theme.glassBubbleGlow}`,
          }),
          glidingBubbleStyle,
        ]}
      >
        <View
          style={[
            styles.glidingBubbleArc,
            { backgroundColor: theme.glassBubbleSpecular },
          ]}
        />
      </Animated.View>

      {items.map((item, idx) => (
        <RailItemButton
          key={item.id}
          item={item}
          index={idx}
          isHovered={hoveredIndex === idx}
          onItemHoverIn={handleItemHoverIn}
          onItemHoverOut={handleItemHoverOut}
        />
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  pressableBase: {
    position: 'relative',
  },
  clippedEffectsHost: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
    zIndex: 1,
  },
  childrenLayer: {
    position: 'relative',
    zIndex: 2,
  },
  glassOverlay: {
    ...StyleSheet.absoluteFillObject,
    borderWidth: 1,
  },
  specularRimTop: {
    position: 'absolute',
    top: 0,
    left: 6,
    right: 6,
    height: 1.25,
    borderRadius: 999,
  },
  spotlightOrb: {
    position: 'absolute',
    top: 0,
    left: 0,
  },
  railCapsule: {
    position: 'relative',
    borderRadius: 999,
    borderWidth: 1,
    padding: RAIL_PADDING,
    gap: RAIL_GAP,
    alignItems: 'center',
  },
  glidingBubble: {
    position: 'absolute',
    top: 0,
    left: RAIL_PADDING,
    width: RAIL_ITEM_SIZE,
    height: RAIL_ITEM_SIZE,
    borderRadius: RAIL_ITEM_SIZE / 2,
    borderWidth: 1,
    zIndex: 1,
    overflow: 'hidden',
  },
  glidingBubbleArc: {
    position: 'absolute',
    top: 1.5,
    left: 9,
    right: 9,
    height: 1.5,
    borderRadius: 999,
    opacity: 0.75,
  },
  railCircleBtn: {
    width: RAIL_ITEM_SIZE,
    height: RAIL_ITEM_SIZE,
    borderRadius: RAIL_ITEM_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
    overflow: 'hidden',
  },
  activeCoralGlaze: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: RAIL_ITEM_SIZE / 2,
  },
  railIconWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
});

export default LiquidGlassBubble;
