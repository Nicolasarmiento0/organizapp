import React from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import type { LucideIcon } from 'lucide-react-native';
import { iconMetrics, type MacModuleType } from '../../theme/tokens';
import { useTheme } from '../../theme/ThemeContext';

export interface MacIconBadgeProps {
  icon: LucideIcon;
  module: MacModuleType;
  size?: number;
  containerSize?: number;
  shape?: 'squircle' | 'circle';
  style?: StyleProp<ViewStyle>;
}

/**
 * Contenedor de icono híbrido:
 * - `squircle` (default): estilo macOS (`borderRadius: 12`, `borderCurve: 'continuous'`)
 * - `circle`: cápsula circular minimalista para el Rail lateral
 */
export const MacIconBadge: React.FC<MacIconBadgeProps> = ({
  icon: IconComponent,
  module,
  size = iconMetrics.defaultSize,
  containerSize = iconMetrics.squircleSize,
  shape = 'squircle',
  style,
}) => {
  const { theme } = useTheme();
  const palette = theme.modules[module];
  const radius =
    shape === 'circle' ? containerSize / 2 : iconMetrics.squircleRadius;

  return (
    <View
      style={[
        styles.container,
        {
          width: containerSize,
          height: containerSize,
          borderRadius: radius,
          backgroundColor: palette.background,
          borderColor: palette.border,
        },
        style,
      ]}
    >
      <IconComponent
        size={size}
        color={palette.icon}
        strokeWidth={iconMetrics.strokeWidth}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    borderCurve: 'continuous',
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default MacIconBadge;
