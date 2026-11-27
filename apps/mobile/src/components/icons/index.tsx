import React from 'react';
import type { Icon as SolarIcon } from '@solar-icons/react-native/lib/types';

// Solar BoldDuotone — módulos, hábitos, insignias y navegación
import { Widget2Icon } from '@solar-icons/react-native/bold-duotone/widget-2';
import { CalendarIcon } from '@solar-icons/react-native/bold-duotone/calendar';
import { CalendarDateIcon } from '@solar-icons/react-native/bold-duotone/calendar-date';
import { BellIcon } from '@solar-icons/react-native/bold-duotone/bell';
import { ChecklistMinimalisticIcon } from '@solar-icons/react-native/bold-duotone/checklist-minimalistic';
import { DocumentTextIcon } from '@solar-icons/react-native/bold-duotone/document-text';
import { UserRoundedIcon } from '@solar-icons/react-native/bold-duotone/user-rounded';
import { Sun2Icon } from '@solar-icons/react-native/bold-duotone/sun-2';
import { MoonStarsIcon } from '@solar-icons/react-native/bold-duotone/moon-stars';
import { FireIcon } from '@solar-icons/react-native/bold-duotone/fire';
import { CupStarIcon } from '@solar-icons/react-native/bold-duotone/cup-star';
import { MedalRibbonsStarIcon } from '@solar-icons/react-native/bold-duotone/medal-ribbons-star';
import { CrownIcon } from '@solar-icons/react-native/bold-duotone/crown';
import { StarIcon } from '@solar-icons/react-native/bold-duotone/star';
import { StarsMinimalisticIcon } from '@solar-icons/react-native/bold-duotone/stars-minimalistic';
import { ShieldCheckIcon } from '@solar-icons/react-native/bold-duotone/shield-check';
import { TargetIcon } from '@solar-icons/react-native/bold-duotone/target';
import { GraphUpIcon } from '@solar-icons/react-native/bold-duotone/graph-up';
import { CheckCircleIcon } from '@solar-icons/react-native/bold-duotone/check-circle';
import { PauseCircleIcon } from '@solar-icons/react-native/bold-duotone/pause-circle';
import { HeartPulse2Icon } from '@solar-icons/react-native/bold-duotone/heart-pulse-2';
import { BookBookmarkIcon } from '@solar-icons/react-native/bold-duotone/book-bookmark';
import { BrainIcon } from '@solar-icons/react-native/bold-duotone/brain';
import { CupHotIcon } from '@solar-icons/react-native/bold-duotone/cup-hot';
import { WaterdropsIcon } from '@solar-icons/react-native/bold-duotone/waterdrops';
import { DumbbellLargeMinimalisticIcon } from '@solar-icons/react-native/bold-duotone/dumbbell-large-minimalistic';
import { HeartIcon } from '@solar-icons/react-native/bold-duotone/heart';
import { BoltIcon } from '@solar-icons/react-native/bold-duotone/bolt';
import { CaseMinimalisticIcon } from '@solar-icons/react-native/bold-duotone/case-minimalistic';
import { MapPointIcon } from '@solar-icons/react-native/bold-duotone/map-point';
import { ClockCircleIcon } from '@solar-icons/react-native/bold-duotone/clock-circle';
import { PinIcon } from '@solar-icons/react-native/bold-duotone/pin';
import { Pen2Icon } from '@solar-icons/react-native/bold-duotone/pen-2';
import { TrashBinMinimalisticIcon } from '@solar-icons/react-native/bold-duotone/trash-bin-minimalistic';
import { CloudIcon } from '@solar-icons/react-native/bold-duotone/cloud';
import { DatabaseIcon } from '@solar-icons/react-native/bold-duotone/database';
import { LockKeyholeIcon } from '@solar-icons/react-native/bold-duotone/lock-keyhole';
import { LetterIcon } from '@solar-icons/react-native/bold-duotone/letter';
import { EyeIcon } from '@solar-icons/react-native/bold-duotone/eye';
import { EyeClosedIcon } from '@solar-icons/react-native/bold-duotone/eye-closed';
import { Login2Icon } from '@solar-icons/react-native/bold-duotone/login-2';
import { Logout2Icon } from '@solar-icons/react-native/bold-duotone/logout-2';
import { Folder2Icon } from '@solar-icons/react-native/bold-duotone/folder-2';
import { FolderOpenIcon } from '@solar-icons/react-native/bold-duotone/folder-open';
import { FolderWithFilesIcon } from '@solar-icons/react-native/bold-duotone/folder-with-files';
import { DocumentAddIcon } from '@solar-icons/react-native/bold-duotone/document-add';
import { CopyIcon } from '@solar-icons/react-native/bold-duotone/copy';
import { CompassIcon } from '@solar-icons/react-native/bold-duotone/compass';
import { BookmarkIcon } from '@solar-icons/react-native/bold-duotone/bookmark';
import { CodeIcon } from '@solar-icons/react-native/bold-duotone/code';
import { LayersIcon } from '@solar-icons/react-native/bold-duotone/layers';
import { LightbulbBoltIcon } from '@solar-icons/react-native/bold-duotone/lightbulb-bolt';
import { NotebookMinimalisticIcon } from '@solar-icons/react-native/bold-duotone/notebook-minimalistic';
import { NotesMinimalisticIcon } from '@solar-icons/react-native/bold-duotone/notes-minimalistic';
import { Rocket2Icon } from '@solar-icons/react-native/bold-duotone/rocket-2';
import { InboxIcon } from '@solar-icons/react-native/bold-duotone/inbox';
import { ListCheckIcon } from '@solar-icons/react-native/bold-duotone/list-check';
import { InfoCircleIcon } from '@solar-icons/react-native/bold-duotone/info-circle';
import { DangerTriangleIcon } from '@solar-icons/react-native/bold-duotone/danger-triangle';
import { ChecklistIcon } from '@solar-icons/react-native/bold-duotone/checklist';
import { GalleryIcon } from '@solar-icons/react-native/bold-duotone/gallery';
import { GalleryAddIcon } from '@solar-icons/react-native/bold-duotone/gallery-add';
import { CameraIcon } from '@solar-icons/react-native/bold-duotone/camera';
import { CloudUploadIcon } from '@solar-icons/react-native/bold-duotone/cloud-upload';
import { FlagIcon } from '@solar-icons/react-native/bold-duotone/flag';
import { AlarmSleepIcon } from '@solar-icons/react-native/bold-duotone/alarm-sleep';
import { CalendarMarkIcon } from '@solar-icons/react-native/bold-duotone/calendar-mark';

// Solar Linear — controles direccionales, micro-acciones y utilidades ligeras
import { MagnifierIcon } from '@solar-icons/react-native/linear/magnifier';
import { RefreshIcon } from '@solar-icons/react-native/linear/refresh';
import { HashtagIcon } from '@solar-icons/react-native/linear/hashtag';
import { ArrowRightIcon } from '@solar-icons/react-native/linear/arrow-right';
import { ArrowRightUpIcon } from '@solar-icons/react-native/linear/arrow-right-up';
import { ArrowUpIcon } from '@solar-icons/react-native/linear/arrow-up';
import { ArrowDownIcon } from '@solar-icons/react-native/linear/arrow-down';
import { AltArrowLeftIcon } from '@solar-icons/react-native/linear/alt-arrow-left';
import { AltArrowRightIcon } from '@solar-icons/react-native/linear/alt-arrow-right';
import { AltArrowDownIcon } from '@solar-icons/react-native/linear/alt-arrow-down';
import { UnreadIcon } from '@solar-icons/react-native/linear/unread';
import { AddIcon } from '@solar-icons/react-native/linear/add';
import { MinusIcon } from '@solar-icons/react-native/linear/minus';
import { CloseIcon } from '@solar-icons/react-native/linear/close';
import { CircleIcon } from '@solar-icons/react-native/linear/circle';
import { RestartIcon } from '@solar-icons/react-native/linear/restart';
import { SidebarMinimalisticIcon } from '@solar-icons/react-native/linear/sidebar-minimalistic';
import { MaximizeIcon } from '@solar-icons/react-native/linear/maximize';
import { MinimizeIcon } from '@solar-icons/react-native/linear/minimize';
import { Forward2Icon } from '@solar-icons/react-native/linear/forward-2';
import { LinkIcon } from '@solar-icons/react-native/linear/link';

export interface AppIconProps {
  size?: number;
  color?: string;
  strokeWidth?: number;
}

export type AppIcon = React.ComponentType<AppIconProps>;

function createDuotoneIcon(
  Component: SolarIcon,
  secondaryOpacity = 0.42
): AppIcon {
  const Wrapped: AppIcon = ({ size = 20, color }) => (
    <Component
      size={size}
      color={color}
      secondaryColor={color}
      secondaryOpacity={secondaryOpacity}
    />
  );
  Wrapped.displayName = Component.displayName ?? 'SolarDuotoneIcon';
  return Wrapped;
}

function createLinearIcon(Component: SolarIcon): AppIcon {
  const Wrapped: AppIcon = ({ size = 20, color, strokeWidth = 1.75 }) => (
    <Component size={size} color={color} strokeWidth={strokeWidth} />
  );
  Wrapped.displayName = Component.displayName ?? 'SolarLinearIcon';
  return Wrapped;
}

// Navegación & Módulos
export const LayoutGrid = createDuotoneIcon(Widget2Icon, 0.45);
export const Calendar = createDuotoneIcon(CalendarIcon, 0.42);
export const CalendarClock = createDuotoneIcon(CalendarDateIcon, 0.42);
export const Bell = createDuotoneIcon(BellIcon, 0.42);
export const CheckSquare = createDuotoneIcon(ChecklistMinimalisticIcon, 0.42);
export const FileText = createDuotoneIcon(DocumentTextIcon, 0.42);
export const User = createDuotoneIcon(UserRoundedIcon, 0.42);
export const Sun = createDuotoneIcon(Sun2Icon, 0.45);
export const Moon = createDuotoneIcon(MoonStarsIcon, 0.45);

// Hábitos, Rachas & Insignias
export const Flame = createDuotoneIcon(FireIcon, 0.44);
export const Trophy = createDuotoneIcon(CupStarIcon, 0.45);
export const Award = createDuotoneIcon(MedalRibbonsStarIcon, 0.45);
export const Crown = createDuotoneIcon(CrownIcon, 0.45);
export const Star = createDuotoneIcon(StarIcon, 0.45);
export const Sparkles = createDuotoneIcon(StarsMinimalisticIcon, 0.45);
export const Shield = createDuotoneIcon(ShieldCheckIcon, 0.42);
export const Target = createDuotoneIcon(TargetIcon, 0.42);
export const TrendingUp = createDuotoneIcon(GraphUpIcon, 0.42);
export const CheckCircle2 = createDuotoneIcon(CheckCircleIcon, 0.42);
export const PauseCircle = createDuotoneIcon(PauseCircleIcon, 0.42);
export const Activity = createDuotoneIcon(HeartPulse2Icon, 0.44);
export const BookOpen = createDuotoneIcon(BookBookmarkIcon, 0.42);
export const Brain = createDuotoneIcon(BrainIcon, 0.42);
export const Coffee = createDuotoneIcon(CupHotIcon, 0.44);
export const Droplets = createDuotoneIcon(WaterdropsIcon, 0.44);
export const Dumbbell = createDuotoneIcon(DumbbellLargeMinimalisticIcon, 0.44);
export const Heart = createDuotoneIcon(HeartIcon, 0.44);
export const Zap = createDuotoneIcon(BoltIcon, 0.45);

// Workspace & Autenticación
export const Briefcase = createDuotoneIcon(CaseMinimalisticIcon, 0.42);
export const MapPin = createDuotoneIcon(MapPointIcon, 0.42);
export const Clock = createDuotoneIcon(ClockCircleIcon, 0.42);
export const Pin = createDuotoneIcon(PinIcon, 0.44);
export const Pencil = createDuotoneIcon(Pen2Icon, 0.42);
export const Trash2 = createDuotoneIcon(TrashBinMinimalisticIcon, 0.42);
export const Cloud = createDuotoneIcon(CloudIcon, 0.45);
export const Database = createDuotoneIcon(DatabaseIcon, 0.42);
export const Lock = createDuotoneIcon(LockKeyholeIcon, 0.42);
export const Mail = createDuotoneIcon(LetterIcon, 0.42);
export const Eye = createDuotoneIcon(EyeIcon, 0.42);
export const EyeOff = createDuotoneIcon(EyeClosedIcon, 0.42);
export const LogIn = createDuotoneIcon(Login2Icon, 0.42);
export const LogOut = createDuotoneIcon(Logout2Icon, 0.42);
export const Folder = createDuotoneIcon(Folder2Icon, 0.42);
export const FolderOpen = createDuotoneIcon(FolderOpenIcon, 0.42);
export const FolderWithFiles = createDuotoneIcon(FolderWithFilesIcon, 0.42);
export const DocumentAdd = createDuotoneIcon(DocumentAddIcon, 0.42);
export const Copy = createDuotoneIcon(CopyIcon, 0.42);
export const Compass = createDuotoneIcon(CompassIcon, 0.42);
export const Bookmark = createDuotoneIcon(BookmarkIcon, 0.42);
export const Code = createDuotoneIcon(CodeIcon, 0.42);
export const Layers = createDuotoneIcon(LayersIcon, 0.42);
export const Lightbulb = createDuotoneIcon(LightbulbBoltIcon, 0.44);
export const Notebook = createDuotoneIcon(NotebookMinimalisticIcon, 0.42);
export const Notes = createDuotoneIcon(NotesMinimalisticIcon, 0.42);
export const Rocket = createDuotoneIcon(Rocket2Icon, 0.44);
export const Inbox = createDuotoneIcon(InboxIcon, 0.42);
export const ListCheck = createDuotoneIcon(ListCheckIcon, 0.42);
export const InfoCircle = createDuotoneIcon(InfoCircleIcon, 0.42);
export const DangerTriangle = createDuotoneIcon(DangerTriangleIcon, 0.44);
export const Checklist = createDuotoneIcon(ChecklistIcon, 0.42);
export const Gallery = createDuotoneIcon(GalleryIcon, 0.42);
export const GalleryAdd = createDuotoneIcon(GalleryAddIcon, 0.42);
export const Camera = createDuotoneIcon(CameraIcon, 0.42);
export const CloudUpload = createDuotoneIcon(CloudUploadIcon, 0.44);
export const Flag = createDuotoneIcon(FlagIcon, 0.45);
export const AlarmSleep = createDuotoneIcon(AlarmSleepIcon, 0.44);
export const CalendarMark = createDuotoneIcon(CalendarMarkIcon, 0.44);

// Controles direccionales y micro-acciones (Linear)
export const Search = createLinearIcon(MagnifierIcon);
export const RefreshCw = createLinearIcon(RefreshIcon);
export const Hash = createLinearIcon(HashtagIcon);
export const ArrowRight = createLinearIcon(ArrowRightIcon);
export const ArrowUpRight = createLinearIcon(ArrowRightUpIcon);
export const ArrowUp = createLinearIcon(ArrowUpIcon);
export const ArrowDown = createLinearIcon(ArrowDownIcon);
export const ChevronLeft = createLinearIcon(AltArrowLeftIcon);
export const ChevronRight = createLinearIcon(AltArrowRightIcon);
export const ChevronDown = createLinearIcon(AltArrowDownIcon);
export const Check = createLinearIcon(UnreadIcon);
export const Plus = createLinearIcon(AddIcon);
export const Minus = createLinearIcon(MinusIcon);
export const X = createLinearIcon(CloseIcon);
export const Circle = createLinearIcon(CircleIcon);
export const RotateCcw = createLinearIcon(RestartIcon);
export const PanelLeft = createLinearIcon(SidebarMinimalisticIcon);
export const Maximize2 = createLinearIcon(MaximizeIcon);
export const Minimize2 = createLinearIcon(MinimizeIcon);
export const MoveRight = createLinearIcon(Forward2Icon);
export const Link = createLinearIcon(LinkIcon);
