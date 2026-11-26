# Organiza-App — Personal Productivity OS (Offline-First + Cloudflare Edge)

Arquitectura **Local-First (0 ms)** con **Expo SQLite (WAL)**, sincronización en segundo plano hacia **Cloudflare Workers + D1**, autenticación **Better Auth ($0 USD)** y sistema de diseño **Tesla White + Liquid Glass + Iconos macOS**.

## Estructura del Monorepo

```text
organiza-app/
├── package.json                     # Workspaces: ["apps/*", "packages/*"]
├── packages/
│   └── shared/
│       ├── package.json
│       └── src/
│           └── schema.ts            # Esquema Drizzle ORM único para Expo SQLite y Cloudflare D1
├── apps/
│   ├── api/                         # Backend Cloudflare Workers + Hono + D1 + Better Auth ($0)
│   │   ├── wrangler.toml
│   │   ├── drizzle.config.ts
│   │   └── src/
│   │       ├── auth.ts              # Configuración Better Auth + @better-auth/expo
│   │       └── index.ts             # API Hono: /api/auth/* y /api/sync (Push/Pull Batch)
│   └── mobile/                      # App React Native Expo (Expo Router)
│       ├── app/
│       │   ├── _layout.tsx          # Providers (GestureHandler, SQLite init, Auth guard)
│       │   ├── (auth)/
│       │   │   └── login.tsx        # Pantalla minimalista Tesla White Login/Registro
│       │   └── (tabs)/
│       │       ├── _layout.tsx      # Dock flotante Liquid Glass + Botón Quick Capture (+)
│       │       ├── index.tsx        # FASE 1: Vista "Hoy" (Cockpit: Hábitos + Tareas/Recordatorios)
│       │       ├── calendar.tsx     # FASE 2: Calendario visual + Horarios de trabajo
│       │       └── notes.tsx        # FASE 2: Workspace tipo Notion + Bloc Markdown
│       └── src/
│           ├── theme/tokens.ts
│           ├── components/
│           │   ├── glass/LiquidGlassCard.tsx
│           │   ├── glass/MacIconBadge.tsx
│           │   └── glass/QuickCaptureSheet.tsx
│           ├── db/
│           │   ├── client.ts        # Conexión expo-sqlite + Drizzle ORM + migración auto
│           │   └── sync.ts          # Motor Sync Offline-First (envía isDirty=true a Cloudflare)
│           ├── services/
│           │   ├── authClient.ts    # Cliente @better-auth/expo con expo-secure-store
│           │   └── notifications.ts # Recordatorios locales gratuitos (expo-notifications)
│           └── features/
│               ├── today/           # Hooks y lógica de Tareas, Recordatorios y Hábitos (Fase 1)
│               ├── calendar/        # Estructura preparada para Horarios y Time-Blocking (Fase 2)
│               └── notes/           # Estructura preparada para Páginas Notion y Markdown (Fase 2)
```

## Inicio Rápido ($0 USD)

1. **Instalar dependencias en el monorepo:**
   ```bash
   npm install
   ```

2. **Iniciar el Backend Edge (Cloudflare Workers + D1 en local):**
   ```bash
   npm run db:migrate:local
   npm run dev:api
   ```

3. **Iniciar la App Móvil (Expo Router + SQLite Offline-First):**
   ```bash
   npm run dev:mobile
   ```
