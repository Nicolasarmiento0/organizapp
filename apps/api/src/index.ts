import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { and, eq, gt } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/d1';
import {
  tasks,
  habits,
  habitLogs,
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
    allowHeaders: ['Content-Type', 'Authorization', 'Cookie', 'expo-origin'],
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
  const serverTimestamp = Date.now();

  let body: SyncPushRequest;
  try {
    body = await c.req.json<SyncPushRequest>();
  } catch {
    return c.json({ ok: false, error: 'INVALID_JSON_PAYLOAD' }, 400);
  }

  const lastSyncedAt = Number.isFinite(body.lastSyncedAt) ? Math.max(0, body.lastSyncedAt) : 0;
  const incoming = body.changes ?? {};
  let acceptedCount = 0;

  try {
    // 1. Upsert Tareas / Recordatorios (Last-Write-Wins por updatedAt)
    for (const item of incoming.tasks ?? []) {
      const existing = await db
        .select({ updatedAt: tasks.updatedAt })
        .from(tasks)
        .where(and(eq(tasks.id, item.id), eq(tasks.userId, user.id)))
        .get();

      if (!existing || item.updatedAt >= existing.updatedAt) {
        const sanitized = {
          ...item,
          userId: user.id,
          isDirty: false,
          updatedAt: item.updatedAt || serverTimestamp,
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
        .select({ updatedAt: habits.updatedAt })
        .from(habits)
        .where(and(eq(habits.id, item.id), eq(habits.userId, user.id)))
        .get();

      if (!existing || item.updatedAt >= existing.updatedAt) {
        const sanitized = {
          ...item,
          userId: user.id,
          isDirty: false,
          updatedAt: item.updatedAt || serverTimestamp,
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
        .select({ updatedAt: habitLogs.updatedAt })
        .from(habitLogs)
        .where(and(eq(habitLogs.id, item.id), eq(habitLogs.userId, user.id)))
        .get();

      if (!existing || item.updatedAt >= existing.updatedAt) {
        const sanitized = {
          ...item,
          userId: user.id,
          isDirty: false,
          updatedAt: item.updatedAt || serverTimestamp,
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

    // 4. Upsert Bloques de Horario / Time-Blocking (Fase 2)
    for (const item of incoming.workBlocks ?? []) {
      const existing = await db
        .select({ updatedAt: workBlocks.updatedAt })
        .from(workBlocks)
        .where(and(eq(workBlocks.id, item.id), eq(workBlocks.userId, user.id)))
        .get();

      if (!existing || item.updatedAt >= existing.updatedAt) {
        const sanitized = {
          ...item,
          userId: user.id,
          isDirty: false,
          updatedAt: item.updatedAt || serverTimestamp,
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
        .select({ updatedAt: notePages.updatedAt })
        .from(notePages)
        .where(and(eq(notePages.id, item.id), eq(notePages.userId, user.id)))
        .get();

      if (!existing || item.updatedAt >= existing.updatedAt) {
        const sanitized = {
          ...item,
          userId: user.id,
          isDirty: false,
          updatedAt: item.updatedAt || serverTimestamp,
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

    // 6. Pull: Obtener todos los cambios modificados desde `lastSyncedAt`
    const [
      deltaTasks,
      deltaHabits,
      deltaHabitLogs,
      deltaWorkBlocks,
      deltaNotePages,
    ] = await Promise.all([
      db
        .select()
        .from(tasks)
        .where(and(eq(tasks.userId, user.id), gt(tasks.updatedAt, lastSyncedAt)))
        .all(),
      db
        .select()
        .from(habits)
        .where(and(eq(habits.userId, user.id), gt(habits.updatedAt, lastSyncedAt)))
        .all(),
      db
        .select()
        .from(habitLogs)
        .where(and(eq(habitLogs.userId, user.id), gt(habitLogs.updatedAt, lastSyncedAt)))
        .all(),
      db
        .select()
        .from(workBlocks)
        .where(and(eq(workBlocks.userId, user.id), gt(workBlocks.updatedAt, lastSyncedAt)))
        .all(),
      db
        .select()
        .from(notePages)
        .where(and(eq(notePages.userId, user.id), gt(notePages.updatedAt, lastSyncedAt)))
        .all(),
    ]);

    logEvent('info', 'sync_batch_completed', {
      userId: user.id,
      acceptedCount,
      lastSyncedAt,
      pulledCount:
        deltaTasks.length +
        deltaHabits.length +
        deltaHabitLogs.length +
        deltaWorkBlocks.length +
        deltaNotePages.length,
    });

    const response: SyncBatchResponse = {
      ok: true,
      serverTimestamp,
      acceptedCount,
      changes: {
        tasks: deltaTasks,
        habits: deltaHabits,
        habitLogs: deltaHabitLogs,
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

  const [deltaTasks, deltaHabits, deltaHabitLogs, deltaWorkBlocks, deltaNotePages] =
    await Promise.all([
      db
        .select()
        .from(tasks)
        .where(and(eq(tasks.userId, user.id), gt(tasks.updatedAt, since)))
        .all(),
      db
        .select()
        .from(habits)
        .where(and(eq(habits.userId, user.id), gt(habits.updatedAt, since)))
        .all(),
      db
        .select()
        .from(habitLogs)
        .where(and(eq(habitLogs.userId, user.id), gt(habitLogs.updatedAt, since)))
        .all(),
      db
        .select()
        .from(workBlocks)
        .where(and(eq(workBlocks.userId, user.id), gt(workBlocks.updatedAt, since)))
        .all(),
      db
        .select()
        .from(notePages)
        .where(and(eq(notePages.userId, user.id), gt(notePages.updatedAt, since)))
        .all(),
    ]);

  const response: SyncBatchResponse = {
    ok: true,
    serverTimestamp: Date.now(),
    acceptedCount: 0,
    changes: {
      tasks: deltaTasks,
      habits: deltaHabits,
      habitLogs: deltaHabitLogs,
      workBlocks: deltaWorkBlocks,
      notePages: deltaNotePages,
    },
  };

  return c.json(response);
});

export default app;
