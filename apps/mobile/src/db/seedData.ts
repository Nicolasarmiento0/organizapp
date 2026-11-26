import * as Crypto from 'expo-crypto';
import type {
  TaskRecord,
  HabitRecord,
  HabitLogRecord,
  HabitRewardRecord,
  WorkBlockRecord,
  NotePageRecord,
  SyncChangeset,
  SyncBatchResponse,
} from '@organiza/shared/schema';

export function createLocalId(): string {
  try {
    return Crypto.randomUUID();
  } catch {
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  }
}

export function getTodayDateKey(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

type DbListener = () => void;
const listeners = new Set<DbListener>();

export function subscribeDatabaseChanges(listener: DbListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function notifyDatabaseChanged(): void {
  for (const listener of listeners) {
    listener();
  }
}

export interface LocalDatabaseEngine {
  getTasks(): TaskRecord[];
  getTaskById(id: string): TaskRecord | undefined;
  upsertTask(record: TaskRecord): void;
  updateTask(id: string, patch: Partial<TaskRecord>): void;

  getHabits(): HabitRecord[];
  getHabitById(id: string): HabitRecord | undefined;
  upsertHabit(record: HabitRecord): void;
  updateHabit(id: string, patch: Partial<HabitRecord>): void;

  getHabitLogsForDate(dateKey: string): HabitLogRecord[];
  getHabitLogsInRange(startDateKey: string, endDateKey: string): HabitLogRecord[];
  getAllHabitLogs(): HabitLogRecord[];
  getHabitLogById(id: string): HabitLogRecord | undefined;
  upsertHabitLog(record: HabitLogRecord): void;

  getHabitRewards(): HabitRewardRecord[];
  getHabitRewardById(id: string): HabitRewardRecord | undefined;
  upsertHabitReward(record: HabitRewardRecord): void;
  updateHabitReward(id: string, patch: Partial<HabitRewardRecord>): void;

  getWorkBlocksForDate(dateKey: string): WorkBlockRecord[];
  getWorkBlockById(id: string): WorkBlockRecord | undefined;
  upsertWorkBlock(record: WorkBlockRecord): void;
  updateWorkBlock(id: string, patch: Partial<WorkBlockRecord>): void;

  getNotePages(): NotePageRecord[];
  getNotePageById(id: string): NotePageRecord | undefined;
  upsertNotePage(record: NotePageRecord): void;
  updateNotePage(id: string, patch: Partial<NotePageRecord>): void;

  getSyncMeta(key: string): string | null;
  setSyncMeta(key: string, value: string): void;

  getDirtyChangeset(): SyncChangeset;
  countDirtyRecords(): number;
  applySyncBatchResponse(sent: SyncChangeset, response: SyncBatchResponse): void;
  claimLocalRecordsForUser(authenticatedUserId: string): void;
}

export function buildDefaultRewardsSeed(userId: string): HabitRewardRecord[] {
  const now = Date.now();
  return [
    {
      id: createLocalId(),
      userId,
      title: 'Café de especialidad + pausa sin pantallas',
      description: 'Recompensa rápida tras mantener tu checklist al día',
      costPoints: 250,
      icon: 'Coffee',
      redeemedCount: 0,
      lastRedeemedAt: null,
      isDirty: true,
      deletedAt: null,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: createLocalId(),
      userId,
      title: 'Cena especial / Tarde libre',
      description: 'Meta semanal por constancia sostenida',
      costPoints: 500,
      icon: 'Award',
      redeemedCount: 0,
      lastRedeemedAt: null,
      isDirty: true,
      deletedAt: null,
      createdAt: now - 1000,
      updatedAt: now - 1000,
    },
    {
      id: createLocalId(),
      userId,
      title: 'Escudo de Descanso extra',
      description: 'Protege un hábito en días de turno pesado',
      costPoints: 150,
      icon: 'Shield',
      redeemedCount: 0,
      lastRedeemedAt: null,
      isDirty: true,
      deletedAt: null,
      createdAt: now - 2000,
      updatedAt: now - 2000,
    },
  ];
}

export function buildInitialSeedDataset(userId: string): SyncChangeset {
  const now = Date.now();
  const todayKey = getTodayDateKey();
  const oneHourFromNow = now + 60 * 60 * 1000;

  const habitDeepWorkId = createLocalId();
  const habitWaterId = createLocalId();
  const habitTrainingId = createLocalId();
  const habitReadingId = createLocalId();

  return {
    habits: [
      {
        id: habitDeepWorkId,
        userId,
        title: 'Bloque de Deep Work (90 min)',
        icon: 'Zap',
        habitType: 'binary',
        unit: null,
        frequency: 'weekdays',
        scheduledDays: '[1,2,3,4,5]',
        targetPerDay: 1,
        weeklyGoal: 5,
        streak: 6,
        bestStreak: 14,
        isPaused: false,
        pausedUntil: null,
        timeOfDay: 'morning',
        reminderTime: '08:30',
        isArchived: false,
        isDirty: true,
        deletedAt: null,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: habitWaterId,
        userId,
        title: 'Beber agua durante la jornada',
        icon: 'Droplets',
        habitType: 'quantitative',
        unit: 'vasos',
        frequency: 'daily',
        scheduledDays: '[0,1,2,3,4,5,6]',
        targetPerDay: 8,
        weeklyGoal: null,
        streak: 5,
        bestStreak: 9,
        isPaused: false,
        pausedUntil: null,
        timeOfDay: 'any',
        reminderTime: '11:00',
        isArchived: false,
        isDirty: true,
        deletedAt: null,
        createdAt: now - 100,
        updatedAt: now - 100,
      },
      {
        id: habitTrainingId,
        userId,
        title: 'Entrenamiento físico & movilidad',
        icon: 'Activity',
        habitType: 'binary',
        unit: null,
        frequency: 'daily',
        scheduledDays: '[0,1,2,3,4,5,6]',
        targetPerDay: 1,
        weeklyGoal: 3,
        streak: 12,
        bestStreak: 18,
        isPaused: false,
        pausedUntil: null,
        timeOfDay: 'evening',
        reminderTime: '18:00',
        isArchived: false,
        isDirty: true,
        deletedAt: null,
        createdAt: now - 200,
        updatedAt: now - 200,
      },
      {
        id: habitReadingId,
        userId,
        title: 'Lectura técnica (páginas)',
        icon: 'BookOpen',
        habitType: 'quantitative',
        unit: 'págs',
        frequency: 'daily',
        scheduledDays: '[0,1,2,3,4,5,6]',
        targetPerDay: 20,
        weeklyGoal: null,
        streak: 4,
        bestStreak: 11,
        isPaused: false,
        pausedUntil: null,
        timeOfDay: 'evening',
        reminderTime: '21:30',
        isArchived: false,
        isDirty: true,
        deletedAt: null,
        createdAt: now - 300,
        updatedAt: now - 300,
      },
    ],
    habitLogs: [
      {
        id: `${habitTrainingId}_${todayKey}`,
        habitId: habitTrainingId,
        userId,
        dateKey: todayKey,
        completedCount: 1,
        isCompleted: true,
        status: 'completed',
        isDirty: true,
        deletedAt: null,
        updatedAt: now,
      },
      {
        id: `${habitWaterId}_${todayKey}`,
        habitId: habitWaterId,
        userId,
        dateKey: todayKey,
        completedCount: 4,
        isCompleted: false,
        status: 'partial',
        isDirty: true,
        deletedAt: null,
        updatedAt: now,
      },
    ],
    habitRewards: buildDefaultRewardsSeed(userId),
    tasks: [
      {
        id: createLocalId(),
        userId,
        title: 'Revisar métricas de latencia y sincronización con Cloudflare D1',
        notes: 'Verificar que el batch push/pull mantenga 0 ms en Web, iOS y Android',
        category: 'today',
        priority: 3,
        isCompleted: false,
        completedAt: null,
        dueDate: todayKey,
        reminderAt: oneHourFromNow,
        notificationId: null,
        isDirty: true,
        deletedAt: null,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: createLocalId(),
        userId,
        title: 'Planificar prioridades clave de la semana en Cockpit',
        notes: 'Definir las 3 entregas de mayor impacto',
        category: 'reminder',
        priority: 2,
        isCompleted: false,
        completedAt: null,
        dueDate: todayKey,
        reminderAt: null,
        notificationId: null,
        isDirty: true,
        deletedAt: null,
        createdAt: now - 120000,
        updatedAt: now - 120000,
      },
      {
        id: createLocalId(),
        userId,
        title: 'Configurar motor Offline-First multiplataforma (Web, iOS, Android)',
        notes: 'Completado a 120 FPS',
        category: 'today',
        priority: 3,
        isCompleted: true,
        completedAt: now - 3600000,
        dueDate: todayKey,
        reminderAt: null,
        notificationId: null,
        isDirty: true,
        deletedAt: null,
        createdAt: now - 7200000,
        updatedAt: now - 3600000,
      },
    ],
    workBlocks: [
      {
        id: createLocalId(),
        userId,
        title: 'Deep Work: Arquitectura & Código Principal',
        blockType: 'deep_work',
        dateKey: todayKey,
        startTime: '09:00',
        endTime: '11:30',
        locationOrLink: 'Modo Enfoque • Sin notificaciones',
        isRecurring: true,
        recurrenceDays: '[1,2,3,4,5]',
        isDirty: true,
        deletedAt: null,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: createLocalId(),
        userId,
        title: 'Turno Operativo / Sincronización de Proyectos',
        blockType: 'work_shift',
        dateKey: todayKey,
        startTime: '12:00',
        endTime: '16:00',
        locationOrLink: 'Workspace Principal',
        isRecurring: true,
        recurrenceDays: '[1,2,3,4,5]',
        isDirty: true,
        deletedAt: null,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: createLocalId(),
        userId,
        title: 'Cierre de Inbox & Planificación del Día Siguiente',
        blockType: 'personal',
        dateKey: todayKey,
        startTime: '17:30',
        endTime: '18:15',
        locationOrLink: 'Cockpit Hoy',
        isRecurring: true,
        recurrenceDays: '[1,2,3,4,5]',
        isDirty: true,
        deletedAt: null,
        createdAt: now,
        updatedAt: now,
      },
    ],
    notePages: [
      {
        id: createLocalId(),
        userId,
        parentId: null,
        title: 'Manifiesto de Productividad & Sistema Operativo Personal',
        icon: 'Compass',
        contentMarkdown: `# Sistema Operativo Personal\n\nBienvenido a **Organiza-App** (Web, iOS y Android). Todo lo que escribes aquí se guarda en \`0 ms\` de forma local.\n\n## Principios Clave\n- **Offline-First Estricto:** Cero spinners de red.\n- **Multiplataforma:** Funciona en Web, iOS y Android con la misma base de código.\n- **Sincronización Transparente:** Respaldo automático en Cloudflare D1.`,
        tags: JSON.stringify(['Sistema', 'Arquitectura']),
        isPinned: true,
        isDirty: true,
        deletedAt: null,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: createLocalId(),
        userId,
        parentId: null,
        title: 'Bitácora de Ideas & Proyectos Q4',
        icon: 'Sparkles',
        contentMarkdown: `# Ideas & Backlog\n\n- [x] Motor SQLite local con modo WAL en iOS/Android y persistencia Web en 0 ms\n- [x] Diseño Titanium Monochrome\n- [ ] Automatizar revisión semanal de domingos`,
        tags: JSON.stringify(['Roadmap', 'Notas']),
        isPinned: false,
        isDirty: true,
        deletedAt: null,
        createdAt: now - 60000,
        updatedAt: now - 60000,
      },
    ],
  };
}
