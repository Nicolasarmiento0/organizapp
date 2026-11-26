import {
  Bookmark,
  Briefcase,
  Calendar,
  Code,
  Compass,
  FileText,
  Flame,
  Folder,
  Inbox,
  Layers,
  Lightbulb,
  Notebook,
  Notes,
  Rocket,
  Sparkles,
  Target,
  type AppIcon,
} from '../../components/icons';

export interface NoteIconOption {
  name: string;
  label: string;
  icon: AppIcon;
}

export const NOTE_ICON_OPTIONS: readonly NoteIconOption[] = [
  { name: 'FileText', label: 'Documento', icon: FileText },
  { name: 'Notebook', label: 'Cuaderno', icon: Notebook },
  { name: 'Notes', label: 'Notas', icon: Notes },
  { name: 'Folder', label: 'Carpeta', icon: Folder },
  { name: 'Layers', label: 'Sistema', icon: Layers },
  { name: 'Compass', label: 'Brújula', icon: Compass },
  { name: 'Lightbulb', label: 'Idea', icon: Lightbulb },
  { name: 'Sparkles', label: 'Enfoque', icon: Sparkles },
  { name: 'Rocket', label: 'Proyecto', icon: Rocket },
  { name: 'Code', label: 'Código', icon: Code },
  { name: 'Bookmark', label: 'Referencia', icon: Bookmark },
  { name: 'Target', label: 'Meta', icon: Target },
  { name: 'Briefcase', label: 'Trabajo', icon: Briefcase },
  { name: 'Inbox', label: 'Inbox', icon: Inbox },
  { name: 'Calendar', label: 'Agenda', icon: Calendar },
  { name: 'Flame', label: 'Prioridad', icon: Flame },
];

const NOTE_ICON_MAP = new Map<string, AppIcon>(
  NOTE_ICON_OPTIONS.map((opt) => [opt.name, opt.icon])
);

export function resolveNoteIcon(name?: string | null): AppIcon {
  if (!name) return FileText;
  return NOTE_ICON_MAP.get(name) ?? FileText;
}
