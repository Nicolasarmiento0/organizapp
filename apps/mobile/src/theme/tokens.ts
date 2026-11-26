import { Platform, type ViewStyle } from 'react-native';

/**
 * SISTEMA DE DISEÑO DUAL: "TITANIUM MONOCHROME + CORAL RED (#FA6B6B)"
 * Filosofía: Minimalismo arquitectónico estilo Tesla UI / Apple Pro con rojo coral hegemónico en Dark & Light.
 */

export type ThemeMode = 'dark' | 'light';

export type MacModuleType =
  | 'dashboard'
  | 'today'
  | 'calendar'
  | 'reminders'
  | 'habits'
  | 'notes';

export interface MacModulePalette {
  background: string;
  icon: string;
  border: string;
  label: string;
}

export interface ThemePalette {
  mode: ThemeMode;
  canvas: string;
  shell: string;
  card: string;
  cardElevated: string;
  cardMuted: string;
  surfaceTonal: string;
  railBg: string;

  glassFill: string;
  glassFillAndroid: string;
  glassBorder: string;
  glassBorderStrong: string;
  glassSpecularTop: string;
  divider: string;

  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  textInverse: string;

  accentPrimary: string;
  accentPrimaryText: string;
  accentPrimaryLink: string;
  accentPrimarySoft: string;
  accentPrimaryBorder: string;

  accentCobalt: string;
  accentCobaltBright: string;
  accentCobaltSoft: string;
  accentCobaltBorder: string;

  accentVolt: string;
  accentVoltText: string;
  accentVoltSoft: string;
  accentVoltBorder: string;

  inputBg: string;
  pillBg: string;
  hoverBg: string;

  danger: string;
  dangerSoft: string;
  success: string;
  successSoft: string;
  warning: string;
  warningSoft: string;

  statusBarStyle: 'light' | 'dark';
  blurTint: 'systemChromeMaterialDark' | 'systemChromeMaterialLight';
  modules: Record<MacModuleType, MacModulePalette>;
}

export const darkTheme: ThemePalette = {
  mode: 'dark',
  canvas: '#0A0B0D',
  shell: '#101216',
  card: '#14161A',
  cardElevated: '#1C1F25',
  cardMuted: '#101216',
  surfaceTonal: '#181B21',
  railBg: 'rgba(20, 22, 26, 0.92)',

  glassFill: 'rgba(20, 22, 26, 0.84)',
  glassFillAndroid: 'rgba(20, 22, 26, 0.96)',
  glassBorder: 'rgba(255, 255, 255, 0.08)',
  glassBorderStrong: 'rgba(255, 255, 255, 0.15)',
  glassSpecularTop: 'rgba(255, 255, 255, 0.11)',
  divider: 'rgba(255, 255, 255, 0.07)',

  textPrimary: '#F5F7FA',
  textSecondary: '#949AA6',
  textMuted: '#606673',
  textInverse: '#0A0B0D',

  accentPrimary: '#FA6B6B',
  accentPrimaryText: '#FFFFFF',
  accentPrimaryLink: '#FA6B6B',
  accentPrimarySoft: 'rgba(250, 107, 107, 0.14)',
  accentPrimaryBorder: 'rgba(250, 107, 107, 0.30)',

  accentCobalt: '#FA6B6B',
  accentCobaltBright: '#FA6B6B',
  accentCobaltSoft: 'rgba(250, 107, 107, 0.14)',
  accentCobaltBorder: 'rgba(250, 107, 107, 0.30)',

  accentVolt: '#F5F7FA',
  accentVoltText: '#0A0B0D',
  accentVoltSoft: 'rgba(245, 247, 250, 0.10)',
  accentVoltBorder: 'rgba(245, 247, 250, 0.22)',

  inputBg: '#0E1014',
  pillBg: 'rgba(255, 255, 255, 0.06)',
  hoverBg: 'rgba(255, 255, 255, 0.10)',

  danger: '#FA6B6B',
  dangerSoft: 'rgba(250, 107, 107, 0.14)',
  success: '#3FB984',
  successSoft: 'rgba(63, 185, 132, 0.14)',
  warning: '#D4A054',
  warningSoft: 'rgba(212, 160, 84, 0.14)',

  statusBarStyle: 'light',
  blurTint: 'systemChromeMaterialDark',
  modules: {
    dashboard: {
      background: 'rgba(255, 255, 255, 0.06)',
      icon: '#E4E7EC',
      border: 'rgba(255, 255, 255, 0.10)',
      label: 'Dashboard',
    },
    today: {
      background: 'rgba(255, 255, 255, 0.06)',
      icon: '#E4E7EC',
      border: 'rgba(255, 255, 255, 0.10)',
      label: 'Dashboard',
    },
    calendar: {
      background: 'rgba(255, 255, 255, 0.06)',
      icon: '#E4E7EC',
      border: 'rgba(255, 255, 255, 0.10)',
      label: 'Calendario',
    },
    reminders: {
      background: 'rgba(255, 255, 255, 0.06)',
      icon: '#E4E7EC',
      border: 'rgba(255, 255, 255, 0.10)',
      label: 'Recordatorios',
    },
    habits: {
      background: 'rgba(255, 255, 255, 0.06)',
      icon: '#E4E7EC',
      border: 'rgba(255, 255, 255, 0.10)',
      label: 'Hábitos',
    },
    notes: {
      background: 'rgba(255, 255, 255, 0.06)',
      icon: '#E4E7EC',
      border: 'rgba(255, 255, 255, 0.10)',
      label: 'Notas',
    },
  },
};

export const lightTheme: ThemePalette = {
  mode: 'light',
  canvas: '#F5F5F7',
  shell: '#FFFFFF',
  card: '#FFFFFF',
  cardElevated: '#FAFAFC',
  cardMuted: '#EFEFF3',
  surfaceTonal: '#EFEFF4',
  railBg: 'rgba(255, 255, 255, 0.92)',

  glassFill: 'rgba(255, 255, 255, 0.85)',
  glassFillAndroid: 'rgba(255, 255, 255, 0.97)',
  glassBorder: 'rgba(15, 17, 21, 0.08)',
  glassBorderStrong: 'rgba(15, 17, 21, 0.15)',
  glassSpecularTop: 'rgba(255, 255, 255, 0.98)',
  divider: 'rgba(15, 17, 21, 0.07)',

  textPrimary: '#111318',
  textSecondary: '#616773',
  textMuted: '#989EA9',
  textInverse: '#FFFFFF',

  accentPrimary: '#FA6B6B',
  accentPrimaryText: '#FFFFFF',
  accentPrimaryLink: '#DF4F4F',
  accentPrimarySoft: 'rgba(250, 107, 107, 0.12)',
  accentPrimaryBorder: 'rgba(250, 107, 107, 0.28)',

  accentCobalt: '#FA6B6B',
  accentCobaltBright: '#DF4F4F',
  accentCobaltSoft: 'rgba(250, 107, 107, 0.12)',
  accentCobaltBorder: 'rgba(250, 107, 107, 0.28)',

  accentVolt: '#111318',
  accentVoltText: '#FFFFFF',
  accentVoltSoft: 'rgba(17, 19, 24, 0.07)',
  accentVoltBorder: 'rgba(17, 19, 24, 0.16)',

  inputBg: '#F7F8FA',
  pillBg: 'rgba(15, 17, 21, 0.05)',
  hoverBg: 'rgba(15, 17, 21, 0.08)',

  danger: '#DF4F4F',
  dangerSoft: 'rgba(250, 107, 107, 0.12)',
  success: '#15803D',
  successSoft: '#F0FDF4',
  warning: '#B45309',
  warningSoft: '#FFFBEB',

  statusBarStyle: 'dark',
  blurTint: 'systemChromeMaterialLight',
  modules: {
    dashboard: {
      background: '#F0F1F4',
      icon: '#1C1E22',
      border: 'rgba(15, 17, 21, 0.08)',
      label: 'Dashboard',
    },
    today: {
      background: '#F0F1F4',
      icon: '#1C1E22',
      border: 'rgba(15, 17, 21, 0.08)',
      label: 'Dashboard',
    },
    calendar: {
      background: '#F0F1F4',
      icon: '#1C1E22',
      border: 'rgba(15, 17, 21, 0.08)',
      label: 'Calendario',
    },
    reminders: {
      background: '#F0F1F4',
      icon: '#1C1E22',
      border: 'rgba(15, 17, 21, 0.08)',
      label: 'Recordatorios',
    },
    habits: {
      background: '#F0F1F4',
      icon: '#1C1E22',
      border: 'rgba(15, 17, 21, 0.08)',
      label: 'Hábitos',
    },
    notes: {
      background: '#F0F1F4',
      icon: '#1C1E22',
      border: 'rgba(15, 17, 21, 0.08)',
      label: 'Notas',
    },
  },
};

export function getThemePalette(mode: ThemeMode): ThemePalette {
  return mode === 'light' ? lightTheme : darkTheme;
}

/**
 * Exportaciones legacy para compatibilidad con componentes en transición.
 */
export const colors = {
  canvas: '#F5F5F7',
  pureWhite: '#FFFFFF',
  glassFill: 'rgba(255, 255, 255, 0.85)',
  glassFillAndroid: 'rgba(255, 255, 255, 0.97)',
  glassElevated: 'rgba(255, 255, 255, 0.92)',
  glassSpecularTop: 'rgba(255, 255, 255, 0.98)',
  glassBorder: 'rgba(15, 17, 21, 0.08)',
  divider: 'rgba(15, 17, 21, 0.07)',
  textPrimary: '#111318',
  textSecondary: '#616773',
  textMuted: '#989EA9',
  teslaBlue: '#FA6B6B',
  teslaBlueSoft: 'rgba(250, 107, 107, 0.12)',
  teslaBlueBorder: 'rgba(250, 107, 107, 0.28)',
  danger: '#DF4F4F',
  dangerSoft: 'rgba(250, 107, 107, 0.12)',
  success: '#15803D',
  successSoft: '#F0FDF4',
  warning: '#B45309',
  warningSoft: '#FFFBEB',
} as const;

export const macModuleColors: Record<MacModuleType, MacModulePalette> = lightTheme.modules;

export const radii = {
  xs: 8,
  squircle: 12, // Contenedor de iconos macOS
  md: 16,
  lg: 22,
  xl: 28,
  pill: 9999,
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 28,
  xxxl: 40,
} as const;

export const iconMetrics = {
  strokeWidth: 1.75,
  defaultSize: 20,
  squircleSize: 38,
  squircleRadius: 12,
} as const;

export const shadows: Record<'subtle' | 'floatingDock' | 'modal', ViewStyle> = {
  subtle: Platform.select<ViewStyle>({
    ios: {
      shadowColor: '#000000',
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.08,
      shadowRadius: 14,
    },
    android: {
      elevation: 2,
    },
    default: {
      shadowColor: '#000000',
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.08,
      shadowRadius: 14,
    },
  })!,
  floatingDock: Platform.select<ViewStyle>({
    ios: {
      shadowColor: '#000000',
      shadowOffset: { width: 0, height: 12 },
      shadowOpacity: 0.16,
      shadowRadius: 24,
    },
    android: {
      elevation: 6,
    },
    default: {
      shadowColor: '#000000',
      shadowOffset: { width: 0, height: 12 },
      shadowOpacity: 0.16,
      shadowRadius: 24,
    },
  })!,
  modal: Platform.select<ViewStyle>({
    ios: {
      shadowColor: '#000000',
      shadowOffset: { width: 0, height: -8 },
      shadowOpacity: 0.22,
      shadowRadius: 28,
    },
    android: {
      elevation: 12,
    },
    default: {
      shadowColor: '#000000',
      shadowOffset: { width: 0, height: -8 },
      shadowOpacity: 0.22,
      shadowRadius: 28,
    },
  })!,
};

export const tokens = {
  colors,
  darkTheme,
  lightTheme,
  macModuleColors,
  radii,
  spacing,
  iconMetrics,
  shadows,
} as const;

export default tokens;
