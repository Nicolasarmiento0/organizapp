import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { expo } from '@better-auth/expo';
import { drizzle } from 'drizzle-orm/d1';
import * as schema from '@organiza/shared/schema';

export interface CloudflareBindings {
  DB: D1Database;
  MEDIA_BUCKET?: R2Bucket;
  BETTER_AUTH_SECRET: string;
  BETTER_AUTH_URL: string;
  TRUSTED_ORIGINS?: string;
}

/**
 * Instancia Better Auth por request en Cloudflare Workers (sin estado mutable global)
 * conectada al binding nativo `env.DB` (Cloudflare D1) y soporte nativo para Expo.
 */
export function createAuth(env: CloudflareBindings) {
  const db = drizzle(env.DB, { schema });

  const extraOrigins = env.TRUSTED_ORIGINS
    ? env.TRUSTED_ORIGINS.split(',').map((origin) => origin.trim()).filter(Boolean)
    : [];

  return betterAuth({
    database: drizzleAdapter(db, {
      provider: 'sqlite',
      schema: {
        user: schema.users,
        session: schema.sessions,
        account: schema.accounts,
        verification: schema.verifications,
      },
    }),
    secret: env.BETTER_AUTH_SECRET,
    baseURL: env.BETTER_AUTH_URL,
    emailAndPassword: {
      enabled: true,
      autoSignIn: true,
      minPasswordLength: 8,
    },
    plugins: [expo()],
    trustedOrigins: (request) => {
      const requestOrigin = request?.headers.get('origin')?.trim();
      const dynamicOrigins =
        requestOrigin &&
        (requestOrigin.startsWith('http://localhost:') ||
          requestOrigin.startsWith('http://127.0.0.1:'))
          ? [requestOrigin]
          : [];

      return [
        'organizaapp://',
        'organizaapp://*',
        'exp://',
        'exp://*',
        'http://localhost:8081',
        'http://localhost:8082',
        'http://localhost:19006',
        'http://127.0.0.1:8081',
        'http://localhost:8787',
        'http://127.0.0.1:8787',
        ...dynamicOrigins,
        ...extraOrigins,
      ];
    },
  });
}

export type AuthInstance = ReturnType<typeof createAuth>;
export type AuthSessionData = NonNullable<Awaited<ReturnType<AuthInstance['api']['getSession']>>>;
export type AuthenticatedUser = AuthSessionData['user'];
export type AuthenticatedSession = AuthSessionData['session'];
