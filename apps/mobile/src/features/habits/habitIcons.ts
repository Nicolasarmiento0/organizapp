import {
  Activity,
  BookOpen,
  Brain,
  Coffee,
  Droplets,
  Dumbbell,
  Flame,
  Heart,
  Moon,
  Sparkles,
  Target,
  Zap,
  type AppIcon,
} from '../../components/icons';

export interface HabitIconOption {
  name: string;
  label: string;
  icon: AppIcon;
}

export const HABIT_ICON_OPTIONS: readonly HabitIconOption[] = [
  { name: 'Flame', label: 'Fuego', icon: Flame },
  { name: 'Zap', label: 'Energía', icon: Zap },
  { name: 'Droplets', label: 'Agua', icon: Droplets },
  { name: 'BookOpen', label: 'Lectura', icon: BookOpen },
  { name: 'Activity', label: 'Cardio', icon: Activity },
  { name: 'Dumbbell', label: 'Fuerza', icon: Dumbbell },
  { name: 'Moon', label: 'Sueño', icon: Moon },
  { name: 'Brain', label: 'Mente', icon: Brain },
  { name: 'Heart', label: 'Salud', icon: Heart },
  { name: 'Coffee', label: 'Rutina', icon: Coffee },
  { name: 'Sparkles', label: 'Enfoque', icon: Sparkles },
  { name: 'Target', label: 'Meta', icon: Target },
];

const ICON_MAP = new Map<string, AppIcon>(
  HABIT_ICON_OPTIONS.map((opt) => [opt.name, opt.icon])
);

export function resolveHabitIcon(name?: string | null): AppIcon {
  if (!name) return Sparkles;
  return ICON_MAP.get(name) ?? Sparkles;
}
