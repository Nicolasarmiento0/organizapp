import * as Crypto from 'expo-crypto';
import type {
  TaskRecord,
  HabitRecord,
  HabitLogRecord,
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
  getHabitLogById(id: string): HabitLogRecord | undefined;
  upsertHabitLog(record: HabitLogRecord): void;

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

export function buildInitialSeedDataset(userId: string): SyncChangeset {
  const now = Date.now();
  const todayKey = getTodayDateKey();
  const oneHourFromNow = now + 60 * 60 * 1000;

  const habitDeepWorkId = createLocalId();
  const habitTrainingId = createLocalId();
  const habitReadingId = createLocalId();

  return {
    habits: [
      {
        id: habitDeepWorkId,
        userId,
        title: 'Bloque de Deep Work (90 min sin distracciones)',
        icon: 'Zap',
        frequency: 'daily',
        targetPerDay: 1,
        streak: 6,
        reminderTime: '08:30',
        isArchived: false,
        isDirty: true,
        deletedAt: null,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: habitTrainingId,
        userId,
        title: 'Entrenamiento físico & movilidad (45 min)',
        icon: 'Activity',
        frequency: 'daily',
        targetPerDay: 1,
        streak: 12,
        reminderTime: '18:00',
        isArchived: false,
        isDirty: true,
        deletedAt: null,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: habitReadingId,
        userId,
        title: 'Lectura técnica / Revisión de arquitectura (20 págs)',
        icon: 'BookOpen',
        frequency: 'daily',
        targetPerDay: 1,
        streak: 4,
        reminderTime: '21:30',
        isArchived: false,
        isDirty: true,
        deletedAt: null,
        createdAt: now,
        updatedAt: now,
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
        isDirty: true,
        deletedAt: null,
        updatedAt: now,
      },
    ],
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
        contentMarkdown: `# Ideas & Backlog\n\n- [x] Motor SQLite local con modo WAL en iOS/Android y persistencia Web en 0 ms\n- [x] Diseño Tesla White + Liquid Glass\n- [ ] Automatizar revisión semanal de domingos`,
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
