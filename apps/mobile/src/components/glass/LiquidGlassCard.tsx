import React from 'react';
import {
  Platform,
  StyleSheet,
  View,
  type StyleProp,
  type ViewProps,
  type ViewStyle,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { radii, shadows, spacing } from '../../theme/tokens';
import { useTheme } from '../../theme/ThemeContext';

export interface LiquidGlassCardProps extends ViewProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
  intensity?: number;
  variant?: 'glass' | 'solid' | 'floating' | 'tonal' | 'cobalt';
  noPadding?: boolean;
}

/**
 * Superficie arquitectónica Dual "Titanium Monochrome (Dark + Apple Pro Light)":
 * - iOS / Web: `BlurView` con tint adaptativo al tema activo y reflejo especular superior.
 * - Android: Fallback translúcido de alta velocidad con sombra suave.
 * - `tonal` / `cobalt`: Superficie tonal Titanium sobria para el Mini Calendario.
 */
export const LiquidGlassCard: React.FC<LiquidGlassCardProps> = ({
  children,
  style,
  contentStyle,
  intensity = 65,
  variant = 'glass',
  noPadding = false,
  ...rest
}) => {
  const { theme } = useTheme();
  const shadowPreset = variant === 'floating' ? shadows.floatingDock : shadows.subtle;

  if (variant === 'tonal' || variant === 'cobalt') {
    return (
      <View
        style={[
          styles.outerShadow,
          shadowPreset,
          styles.surfaceBase,
          {
            backgroundColor: theme.surfaceTonal,
            borderColor: theme.glassBorderStrong,
          },
          style,
        ]}
        {...rest}
      >
        <View
          style={[
            styles.specularTopHighlight,
            { backgroundColor: theme.glassSpecularTop },
          ]}
          pointerEvents="none"
        />
        <View style={[!noPadding && styles.defaultPadding, contentStyle]}>
          {children}
        </View>
      </View>
    );
  }

  if ((Platform.OS === 'ios' || Platform.OS === 'web') && variant !== 'solid') {
    return (
      <View style={[styles.outerShadow, shadowPreset, style]} {...rest}>
        <BlurView
          tint={theme.blurTint}
          intensity={intensity}
          style={[
            styles.iosBlurContainer,
            { borderColor: theme.glassBorder },
          ]}
        >
          <View
            style={[
              styles.specularTopHighlight,
              { backgroundColor: theme.glassSpecularTop },
            ]}
            pointerEvents="none"
          />
          <View
            style={[
              { backgroundColor: theme.glassFill },
              !noPadding && styles.defaultPadding,
              contentStyle,
            ]}
          >
            {children}
          </View>
        </BlurView>
      </View>
    );
  }

  return (
    <View
      style={[
        styles.outerShadow,
        shadowPreset,
        styles.surfaceBase,
        {
          backgroundColor:
            variant === 'solid' ? theme.card : theme.glassFillAndroid,
          borderColor: theme.glassBorder,
        },
        style,
      ]}
      {...rest}
    >
      <View
        style={[
          styles.specularTopHighlight,
          { backgroundColor: theme.glassSpecularTop },
        ]}
        pointerEvents="none"
      />
      <View style={[!noPadding && styles.defaultPadding, contentStyle]}>
        {children}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  outerShadow: {
    borderRadius: radii.lg,
    borderCurve: 'continuous',
  },
  iosBlurContainer: {
    borderRadius: radii.lg,
    borderCurve: 'continuous',
    overflow: 'hidden',
    borderWidth: 1,
  },
  surfaceBase: {
    borderRadius: radii.lg,
    borderCurve: 'continuous',
    overflow: 'hidden',
    borderWidth: 1,
  },
  specularTopHighlight: {
    position: 'absolute',
    top: 0,
    left: 1,
    right: 1,
    height: 1.25,
    zIndex: 2,
  },
  defaultPadding: {
    padding: spacing.lg,
  },
});

export default LiquidGlassCard;
