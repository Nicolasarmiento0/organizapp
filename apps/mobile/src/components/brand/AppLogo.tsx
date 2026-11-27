import React from 'react';
import { Image, type ImageStyle, type StyleProp } from 'react-native';

const LOGO_SOURCE = require('../../../assets/images/logo.png');

export interface AppLogoProps {
  size?: number;
  style?: StyleProp<ImageStyle>;
  accessibilityLabel?: string;
}

/**
 * Official Organiza squircle app logo rendered with transparent corners.
 */
export const AppLogo: React.FC<AppLogoProps> = ({
  size = 40,
  style,
  accessibilityLabel = 'Logo de Organiza',
}) => {
  return (
    <Image
      source={LOGO_SOURCE}
      style={[{ width: size, height: size }, style]}
      resizeMode="contain"
      accessibilityLabel={accessibilityLabel}
    />
  );
};

export default AppLogo;
