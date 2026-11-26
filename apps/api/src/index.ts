import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { and, eq, gt } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/d1';
import {
  tasks,
  habits,
  habitLogs,
  habitRewards,
  workBlocks,
  notePages,
  type SyncPushRequest,
  type SyncBatchResponse,
} from '@organiza/shared/schema';
import {
  createAuth,
  type CloudflareBindings,
  type AuthenticatedUser,
  type AuthenticatedSession,
} from './auth';

interface AppVariables {
  user: AuthenticatedUser;
  session: AuthenticatedSession;
}

const app = new Hono<{
  Bindings: CloudflareBindings;
  Variables: AppVariables;
}>();

function logEvent(level: 'info' | 'warn' | 'error', event: string, details: Record<string, unknown>) {
  console.log(
    JSON.stringify({
      level,
      event,
      timestamp: new Date().toISOString(),
      ...details,
    })
  );
}

app.use(
  '/api/*',
  cors({
    origin: (origin) => origin || '*',
    allowHeaders: [
      'Content-Type',
      'Authorization',
      'Cookie',
      'expo-origin',
      'X-Requested-With',
    ],
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    exposeHeaders: ['Content-Length', 'Set-Cookie'],
    maxAge: 86400,
    credentials: true,
  })
);

app.get('/api/health', (c) => {
  return c.json({
    ok: true,
    service: 'organiza-app-api',
    runtime: 'cloudflare-workers-d1',
    timestamp: Date.now(),
  });
});

/**
 * Endpoints de Autenticación Better Auth + @better-auth/expo ($0)
 */
app.on(['GET', 'POST'], '/api/auth/*', async (c) => {
  try {
    const auth = createAuth(c.env);
    return await auth.handler(c.req.raw);
  } catch (error) {
    logEvent('error', 'auth_handler_error', {
      path: c.req.path,
      method: c.req.method,
      message: error instanceof Error ? error.message : 'Unknown auth error',
    });
    return c.json(
      {
        ok: false,
        error: 'AUTH_INTERNAL_ERROR',
        message: error instanceof Error ? error.message : 'Error interno de autenticación',
      },
      500
    );
  }
});

/**
 * Middleware de sesión para rutas protegidas de sincronización
 */
app.use('/api/sync/*', async (c, next) => {
  const auth = createAuth(c.env);
  const sessionResult = await auth.api.getSession({
    headers: c.req.raw.headers,
  });

  if (!sessionResult) {
    return c.json({ ok: false, error: 'UNAUTHORIZED' }, 401);
  }

  c.set('user', sessionResult.user);
  c.set('session', sessionResult.session);
  await next();
});

app.use('/api/sync', async (c, next) => {
  const auth = createAuth(c.env);
  const sessionResult = await auth.api.getSession({
    headers: c.req.raw.headers,
  });

  if (!sessionResult) {
    return c.json({ ok: false, error: 'UNAUTHORIZED' }, 401);
  }

  c.set('user', sessionResult.user);
  c.set('session', sessionResult.session);
  await next();
});

/**
 * Motor de Sincronización Edge Batch (Push + Pull con resolución Last-Write-Wins)
 */
app.post('/api/sync', async (c) => {
  const user = c.get('user');
  const db = drizzle(c.env.DB);

  let body: SyncPushRequest;
  try {
    body = await c.req.json<SyncPushRequest>();
  } catch {
    return c.json({ ok: false, error: 'INVALID_JSON_PAYLOAD' }, 400);
  }

  const lastSyncedAt = Number.isFinite(body.lastSyncedAt) ? Math.max(0, body.lastSyncedAt) : 0;
  const serverTimestamp = Math.max(Date.now(), lastSyncedAt + 1);
  let maxWrittenUpdatedAt = serverTimestamp;
  const incoming = body.changes ?? {};
  let acceptedCount = 0;

  try {
    // 1. Upsert Tareas / Recordatorios (Last-Write-Wins por updatedAt)
    for (const item of incoming.tasks ?? []) {
      const existing = await db
        .select({ userId: tasks.userId, updatedAt: tasks.updatedAt })
        .from(tasks)
        .where(eq(tasks.id, item.id))
        .get();

      if (existing && existing.userId !== user.id) {
        continue;
      }

      if (!existing || (item.updatedAt ?? 0) >= existing.updatedAt) {
        const canonicalUpdatedAt = Math.max(serverTimestamp, item.updatedAt || serverTimestamp);
        maxWrittenUpdatedAt = Math.max(maxWrittenUpdatedAt, canonicalUpdatedAt);
        const sanitized = {
          id: item.id,
          userId: user.id,
          title: item.title,
          notes: item.notes ?? null,
          category: item.category ?? 'today',
          priority: item.priority ?? 2,
          isCompleted: Boolean(item.isCompleted),
          completedAt: item.completedAt ?? null,
          dueDate: item.dueDate ?? null,
          reminderAt: item.reminderAt ?? null,
          notificationId: item.notificationId ?? null,
          sourcePageId: item.sourcePageId ?? null,
          sourceBlockId: item.sourceBlockId ?? null,
          isDirty: false,
          deletedAt: item.deletedAt ?? null,
          createdAt: item.createdAt || canonicalUpdatedAt,
          updatedAt: canonicalUpdatedAt,
        };
        await db
          .insert(tasks)
          .values(sanitized)
          .onConflictDoUpdate({
            target: tasks.id,
            set: sanitized,
          });
        acceptedCount += 1;
      }
    }

    // 2. Upsert Hábitos
    for (const item of incoming.habits ?? []) {
      const existing = await db
        .select({ userId: habits.userId, updatedAt: habits.updatedAt })
        .from(habits)
        .where(eq(habits.id, item.id))
        .get();

      if (existing && existing.userId !== user.id) {
        continue;
      }

      if (!existing || (item.updatedAt ?? 0) >= existing.updatedAt) {
        const canonicalUpdatedAt = Math.max(serverTimestamp, item.updatedAt || serverTimestamp);
        maxWrittenUpdatedAt = Math.max(maxWrittenUpdatedAt, canonicalUpdatedAt);
        const sanitized = {
          id: item.id,
          userId: user.id,
          title: item.title,
          icon: item.icon ?? 'Sparkles',
          habitType: item.habitType ?? 'binary',
          unit: item.unit ?? null,
          frequency: item.frequency ?? 'daily',
          scheduledDays: item.scheduledDays ?? '[0,1,2,3,4,5,6]',
          targetPerDay: item.targetPerDay ?? 1,
          weeklyGoal: item.weeklyGoal ?? null,
          streak: item.streak ?? 0,
          bestStreak: item.bestStreak ?? 0,
          isPaused: Boolean(item.isPaused),
          pausedUntil: item.pausedUntil ?? null,
          timeOfDay: item.timeOfDay ?? 'any',
          reminderTime: item.reminderTime ?? null,
          isArchived: Boolean(item.isArchived),
          isDirty: false,
          deletedAt: item.deletedAt ?? null,
          createdAt: item.createdAt || canonicalUpdatedAt,
          updatedAt: canonicalUpdatedAt,
        };
        await db
          .insert(habits)
          .values(sanitized)
          .onConflictDoUpdate({
            target: habits.id,
            set: sanitized,
          });
        acceptedCount += 1;
      }
    }

    // 3. Upsert Registros de Hábitos (Habit Logs)
    for (const item of incoming.habitLogs ?? []) {
      const existing = await db
        .select({ userId: habitLogs.userId, updatedAt: habitLogs.updatedAt })
        .from(habitLogs)
        .where(eq(habitLogs.id, item.id))
        .get();

      if (existing && existing.userId !== user.id) {
        continue;
      }

      if (!existing || (item.updatedAt ?? 0) >= existing.updatedAt) {
        const canonicalUpdatedAt = Math.max(serverTimestamp, item.updatedAt || serverTimestamp);
        maxWrittenUpdatedAt = Math.max(maxWrittenUpdatedAt, canonicalUpdatedAt);
        const sanitized = {
          id: item.id,
          habitId: item.habitId,
          userId: user.id,
          dateKey: item.dateKey,
          completedCount: item.completedCount ?? 1,
          isCompleted: Boolean(item.isCompleted),
          status: item.status ?? (item.isCompleted ? 'completed' : 'partial'),
          isDirty: false,
          deletedAt: item.deletedAt ?? null,
          updatedAt: canonicalUpdatedAt,
        };
        await db
          .insert(habitLogs)
          .values(sanitized)
          .onConflictDoUpdate({
            target: habitLogs.id,
            set: sanitized,
          });
        acceptedCount += 1;
      }
    }

    // 3b. Upsert Premios de Hábitos (Habit Rewards)
    for (const item of incoming.habitRewards ?? []) {
      const existing = await db
        .select({ userId: habitRewards.userId, updatedAt: habitRewards.updatedAt })
        .from(habitRewards)
        .where(eq(habitRewards.id, item.id))
        .get();

      if (existing && existing.userId !== user.id) {
        continue;
      }

      if (!existing || (item.updatedAt ?? 0) >= existing.updatedAt) {
        const canonicalUpdatedAt = Math.max(serverTimestamp, item.updatedAt || serverTimestamp);
        maxWrittenUpdatedAt = Math.max(maxWrittenUpdatedAt, canonicalUpdatedAt);
        const sanitized = {
          id: item.id,
          userId: user.id,
          title: item.title,
          description: item.description ?? null,
          costPoints: item.costPoints ?? 250,
          icon: item.icon ?? 'Award',
          redeemedCount: item.redeemedCount ?? 0,
          lastRedeemedAt: item.lastRedeemedAt ?? null,
          isDirty: false,
          deletedAt: item.deletedAt ?? null,
          createdAt: item.createdAt || canonicalUpdatedAt,
          updatedAt: canonicalUpdatedAt,
        };
        await db
          .insert(habitRewards)
          .values(sanitized)
          .onConflictDoUpdate({
            target: habitRewards.id,
            set: sanitized,
          });
        acceptedCount += 1;
      }
    }

    // 4. Upsert Bloques de Horario / Time-Blocking (Fase 2)
    for (const item of incoming.workBlocks ?? []) {
      const existing = await db
        .select({ userId: workBlocks.userId, updatedAt: workBlocks.updatedAt })
        .from(workBlocks)
        .where(eq(workBlocks.id, item.id))
        .get();

      if (existing && existing.userId !== user.id) {
        continue;
      }

      if (!existing || (item.updatedAt ?? 0) >= existing.updatedAt) {
        const canonicalUpdatedAt = Math.max(serverTimestamp, item.updatedAt || serverTimestamp);
        maxWrittenUpdatedAt = Math.max(maxWrittenUpdatedAt, canonicalUpdatedAt);
        const sanitized = {
          id: item.id,
          userId: user.id,
          title: item.title,
          blockType: item.blockType ?? 'deep_work',
          dateKey: item.dateKey,
          startTime: item.startTime,
          endTime: item.endTime,
          locationOrLink: item.locationOrLink ?? null,
          isRecurring: Boolean(item.isRecurring),
          recurrenceDays: item.recurrenceDays ?? null,
          isDirty: false,
          deletedAt: item.deletedAt ?? null,
          createdAt: item.createdAt || canonicalUpdatedAt,
          updatedAt: canonicalUpdatedAt,
        };
        await db
          .insert(workBlocks)
          .values(sanitized)
          .onConflictDoUpdate({
            target: workBlocks.id,
            set: sanitized,
          });
        acceptedCount += 1;
      }
    }

    // 5. Upsert Páginas de Notas / Markdown (Fase 2)
    for (const item of incoming.notePages ?? []) {
      const existing = await db
        .select({ userId: notePages.userId, updatedAt: notePages.updatedAt })
        .from(notePages)
        .where(eq(notePages.id, item.id))
        .get();

      if (existing && existing.userId !== user.id) {
        continue;
      }

      if (!existing || (item.updatedAt ?? 0) >= existing.updatedAt) {
        const canonicalUpdatedAt = Math.max(serverTimestamp, item.updatedAt || serverTimestamp);
        maxWrittenUpdatedAt = Math.max(maxWrittenUpdatedAt, canonicalUpdatedAt);
        const sanitized = {
          id: item.id,
          userId: user.id,
          parentId: item.parentId ?? null,
          title: item.title,
          icon: item.icon ?? 'FileText',
          contentMarkdown: item.contentMarkdown ?? '',
          blocksJson: item.blocksJson ?? null,
          tags: item.tags ?? '[]',
          isPinned: Boolean(item.isPinned),
          sortOrder: item.sortOrder ?? 0,
          isDirty: false,
          deletedAt: item.deletedAt ?? null,
          createdAt: item.createdAt || canonicalUpdatedAt,
          updatedAt: canonicalUpdatedAt,
        };
        await db
          .insert(notePages)
          .values(sanitized)
          .onConflictDoUpdate({
            target: notePages.id,
            set: sanitized,
          });
        acceptedCount += 1;
      }
    }

    // 6. Pull: Obtener todos los cambios modificados desde `lastSyncedAt` (o todo si lastSyncedAt === 0)
    const [
      deltaTasks,
      deltaHabits,
      deltaHabitLogs,
      deltaHabitRewards,
      deltaWorkBlocks,
      deltaNotePages,
    ] = await Promise.all([
      db
        .select()
        .from(tasks)
        .where(
          lastSyncedAt === 0
            ? eq(tasks.userId, user.id)
            : and(eq(tasks.userId, user.id), gt(tasks.updatedAt, lastSyncedAt))
        )
        .all(),
      db
        .select()
        .from(habits)
        .where(
          lastSyncedAt === 0
            ? eq(habits.userId, user.id)
            : and(eq(habits.userId, user.id), gt(habits.updatedAt, lastSyncedAt))
        )
        .all(),
      db
        .select()
        .from(habitLogs)
        .where(
          lastSyncedAt === 0
            ? eq(habitLogs.userId, user.id)
            : and(eq(habitLogs.userId, user.id), gt(habitLogs.updatedAt, lastSyncedAt))
        )
        .all(),
      db
        .select()
        .from(habitRewards)
        .where(
          lastSyncedAt === 0
            ? eq(habitRewards.userId, user.id)
            : and(eq(habitRewards.userId, user.id), gt(habitRewards.updatedAt, lastSyncedAt))
        )
        .all(),
      db
        .select()
        .from(workBlocks)
        .where(
          lastSyncedAt === 0
            ? eq(workBlocks.userId, user.id)
            : and(eq(workBlocks.userId, user.id), gt(workBlocks.updatedAt, lastSyncedAt))
        )
        .all(),
      db
        .select()
        .from(notePages)
        .where(
          lastSyncedAt === 0
            ? eq(notePages.userId, user.id)
            : and(eq(notePages.userId, user.id), gt(notePages.updatedAt, lastSyncedAt))
        )
        .all(),
    ]);

    let responseTimestamp = Math.max(serverTimestamp, maxWrittenUpdatedAt);
    for (const row of [
      ...deltaTasks,
      ...deltaHabits,
      ...deltaHabitLogs,
      ...deltaHabitRewards,
      ...deltaWorkBlocks,
      ...deltaNotePages,
    ]) {
      if (row.updatedAt > responseTimestamp) {
        responseTimestamp = row.updatedAt;
      }
    }

    logEvent('info', 'sync_batch_completed', {
      userId: user.id,
      acceptedCount,
      lastSyncedAt,
      responseTimestamp,
      pulledCount:
        deltaTasks.length +
        deltaHabits.length +
        deltaHabitLogs.length +
        deltaHabitRewards.length +
        deltaWorkBlocks.length +
        deltaNotePages.length,
    });

    const response: SyncBatchResponse = {
      ok: true,
      serverTimestamp: responseTimestamp,
      acceptedCount,
      changes: {
        tasks: deltaTasks,
        habits: deltaHabits,
        habitLogs: deltaHabitLogs,
        habitRewards: deltaHabitRewards,
        workBlocks: deltaWorkBlocks,
        notePages: deltaNotePages,
      },
    };

    return c.json(response);
  } catch (error) {
    logEvent('error', 'sync_batch_failed', {
      userId: user.id,
      message: error instanceof Error ? error.message : 'Unknown error',
    });
    return c.json({ ok: false, error: 'SYNC_INTERNAL_ERROR' }, 500);
  }
});

/**
 * Endpoint ligero solo-Pull (GET /api/sync/pull?since=...)
 */
app.get('/api/sync/pull', async (c) => {
  const user = c.get('user');
  const db = drizzle(c.env.DB);
  const sinceParam = Number(c.req.query('since') ?? '0');
  const since = Number.isFinite(sinceParam) ? Math.max(0, sinceParam) : 0;

  const [
    deltaTasks,
    deltaHabits,
    deltaHabitLogs,
    deltaHabitRewards,
    deltaWorkBlocks,
    deltaNotePages,
  ] = await Promise.all([
    db
      .select()
      .from(tasks)
      .where(
        since === 0
          ? eq(tasks.userId, user.id)
          : and(eq(tasks.userId, user.id), gt(tasks.updatedAt, since))
      )
      .all(),
    db
      .select()
      .from(habits)
      .where(
        since === 0
          ? eq(habits.userId, user.id)
          : and(eq(habits.userId, user.id), gt(habits.updatedAt, since))
      )
      .all(),
    db
      .select()
      .from(habitLogs)
      .where(
        since === 0
          ? eq(habitLogs.userId, user.id)
          : and(eq(habitLogs.userId, user.id), gt(habitLogs.updatedAt, since))
      )
      .all(),
    db
      .select()
      .from(habitRewards)
      .where(
        since === 0
          ? eq(habitRewards.userId, user.id)
          : and(eq(habitRewards.userId, user.id), gt(habitRewards.updatedAt, since))
      )
      .all(),
    db
      .select()
      .from(workBlocks)
      .where(
        since === 0
          ? eq(workBlocks.userId, user.id)
          : and(eq(workBlocks.userId, user.id), gt(workBlocks.updatedAt, since))
      )
      .all(),
    db
      .select()
      .from(notePages)
      .where(
        since === 0
          ? eq(notePages.userId, user.id)
          : and(eq(notePages.userId, user.id), gt(notePages.updatedAt, since))
      )
      .all(),
  ]);

  let serverTimestamp = Date.now();
  for (const row of [
    ...deltaTasks,
    ...deltaHabits,
    ...deltaHabitLogs,
    ...deltaHabitRewards,
    ...deltaWorkBlocks,
    ...deltaNotePages,
  ]) {
    if (row.updatedAt > serverTimestamp) {
      serverTimestamp = row.updatedAt;
    }
  }

  const response: SyncBatchResponse = {
    ok: true,
    serverTimestamp,
    acceptedCount: 0,
    changes: {
      tasks: deltaTasks,
      habits: deltaHabits,
      habitLogs: deltaHabitLogs,
      habitRewards: deltaHabitRewards,
      workBlocks: deltaWorkBlocks,
      notePages: deltaNotePages,
    },
  };

  return c.json(response);
});

const ALLOWED_IMAGE_TYPES: Record<string, string> = {
  'image/webp': 'webp',
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/gif': 'gif',
};

const MAX_IMAGE_BYTES = 2 * 1024 * 1024; // 2 MB máximo (objetivo cliente ~80 KB WebP)

function decodeBase64ToUint8Array(base64Input: string): Uint8Array {
  const clean = base64Input.replace(/^data:[^;]+;base64,/, '').replace(/\s+/g, '');
  const binary = atob(clean);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * Sube imágenes comprimidas (WebP ~80 KB) al bucket gratuito de Cloudflare R2.
 */
app.post('/api/media/upload', async (c) => {
  const auth = createAuth(c.env);
  const sessionResult = await auth.api.getSession({
    headers: c.req.raw.headers,
  });

  if (!sessionResult) {
    return c.json({ ok: false, error: 'UNAUTHORIZED' }, 401);
  }

  const bucket = c.env.MEDIA_BUCKET;
  if (!bucket) {
    return c.json(
      { ok: false, error: 'MEDIA_BUCKET_NOT_CONFIGURED' },
      503
    );
  }

  let bytes: Uint8Array;
  let contentType = 'image/webp';

  const requestContentType = c.req.header('content-type') || '';

  try {
    if (requestContentType.includes('multipart/form-data')) {
      const formData = await c.req.formData();
      const uploaded = formData.get('file');
      if (!(uploaded instanceof File)) {
        return c.json({ ok: false, error: 'MISSING_FILE' }, 400);
      }
      contentType = (uploaded.type || 'image/webp').toLowerCase();
      bytes = new Uint8Array(await uploaded.arrayBuffer());
    } else {
      const payload = await c.req.json<{
        base64?: string;
        contentType?: string;
      }>();
      if (!payload?.base64 || typeof payload.base64 !== 'string') {
        return c.json({ ok: false, error: 'MISSING_BASE64' }, 400);
      }
      const dataUrlMatch = payload.base64.match(/^data:(image\/[a-zA-Z0-9+.-]+);base64,/);
      contentType = (
        payload.contentType ||
        dataUrlMatch?.[1] ||
        'image/webp'
      ).toLowerCase();
      bytes = decodeBase64ToUint8Array(payload.base64);
    }
  } catch (error) {
    logEvent('warn', 'media_upload_parse_failed', {
      userId: sessionResult.user.id,
      message: error instanceof Error ? error.message : 'Invalid upload payload',
    });
    return c.json({ ok: false, error: 'INVALID_UPLOAD_PAYLOAD' }, 400);
  }

  const ext = ALLOWED_IMAGE_TYPES[contentType];
  if (!ext) {
    return c.json({ ok: false, error: 'UNSUPPORTED_MEDIA_TYPE' }, 415);
  }
  if (bytes.byteLength === 0 || bytes.byteLength > MAX_IMAGE_BYTES) {
    return c.json({ ok: false, error: 'IMAGE_TOO_LARGE' }, 413);
  }

  const key = `users/${sessionResult.user.id}/${Date.now()}-${crypto.randomUUID().slice(0, 8)}.${ext}`;

  await bucket.put(key, bytes, {
    httpMetadata: {
      contentType,
      cacheControl: 'public, max-age=31536000, immutable',
    },
  });

  logEvent('info', 'media_uploaded_r2', {
    userId: sessionResult.user.id,
    key,
    sizeBytes: bytes.byteLength,
    contentType,
  });

  return c.json({
    ok: true,
    key,
    url: `/api/media/${key}`,
    sizeBytes: bytes.byteLength,
    contentType,
  });
});

/**
 * Sirve imágenes almacenadas en Cloudflare R2 con caché inmutable.
 */
app.get('/api/media/*', async (c) => {
  const bucket = c.env.MEDIA_BUCKET;
  if (!bucket) {
    return c.json({ ok: false, error: 'MEDIA_BUCKET_NOT_CONFIGURED' }, 503);
  }

  const rawKey = c.req.path.replace(/^\/api\/media\//, '');
  let key: string;
  try {
    key = decodeURIComponent(rawKey);
  } catch {
    return c.json({ ok: false, error: 'INVALID_MEDIA_KEY' }, 400);
  }

  if (!key || key.includes('..') || key.startsWith('/')) {
    return c.json({ ok: false, error: 'INVALID_MEDIA_KEY' }, 400);
  }

  const object = await bucket.get(key);
  if (!object) {
    return c.json({ ok: false, error: 'MEDIA_NOT_FOUND' }, 404);
  }

  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set('ETag', object.httpEtag);
  if (!headers.get('Cache-Control')) {
    headers.set('Cache-Control', 'public, max-age=31536000, immutable');
  }

  return new Response(object.body, {
    status: 200,
    headers,
  });
});

app.all('*', async (c) => {
  if (c.env.ASSETS) {
    return c.env.ASSETS.fetch(c.req.raw);
  }
  return c.notFound();
});

export default app;
