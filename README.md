# Kagami

[中文版 README](./README.zh-CN.md)

## Project Philosophy

Kagami is **not a QQ group chat bot**.

Kagami is **an Agent with a life of its own**. Group chat is just one part of his life — just as a person would not define themselves as "someone who chats". Given enough capabilities, he can live like a real person: read the news, remember what has happened, and proactively do things he finds interesting.

This is a concept: **Agent as a life**.

- Group chat messages are just one of the external events he receives, on equal footing with RSS feeds, timers, and system notifications — all "inputs" that drive his life.
- He has his own memory (Story / RAG), his own interests (News polling, proactive speech), and his own rhythm (event queue, background actions during idle moments).
- The project's goal is not to polish the group chat experience to perfection, but to continuously add the capabilities that his "life" needs, so he feels more and more like a living presence.

All architecture, modules, and capabilities described below should be understood from this perspective: they exist to enrich the Agent's life, not to patch up "a chat bot".

## Repository Positioning

Kagami is a full-stack TypeScript monorepo built on `pnpm workspace`, currently containing four workspace packages:

- `apps/server`: Fastify backend service (`@kagami/server`)
- `apps/web`: React frontend admin console (`@kagami/web`)
- `packages/agent-runtime`: generic Agent Runtime kernel (`@kagami/agent-runtime`)
- `packages/shared`: schemas and utilities shared between frontend and backend (`@kagami/shared`)

The workspace definition lives at the repository root in `pnpm-workspace.yaml`, currently covering `apps/*` and `packages/*`. Backend runtime configuration is unified under `config.yaml` at the repository root.

## Repository Layout

```text
apps/
  server/   Fastify backend, NapCat integration, Kagami agent business layer
  web/      React admin console
packages/
  agent-runtime/  Generic Agent Runtime abstractions and tool catalog
  shared/         Frontend/backend shared schemas / DTOs / utils
```

## Common Commands

Run from the repository root:

```bash
pnpm build
pnpm typecheck
pnpm test
pnpm lint
pnpm lint:fix
pnpm format
pnpm format:write
pnpm app:deploy
```

Single-package commands:

```bash
pnpm --filter @kagami/server <script>
pnpm --filter @kagami/web <script>
pnpm --filter @kagami/agent-runtime <script>
pnpm --filter @kagami/shared <script>
```

Notes:

- The repository does not provide a unified root `pnpm dev` script.
- `@kagami/server` currently exposes `build`, `typecheck`, `test`, `test:watch`, and `db:*` scripts.
- `@kagami/web`, `@kagami/agent-runtime`, and `@kagami/shared` currently expose `build` and `typecheck`.
- Only `@kagami/server` declares a test script.

## Configuration

- Provide a real `config.yaml` at the repository root.
- See [config.yaml.example](./config.yaml.example) for the field structure.
- The service reads and validates `config.yaml` once at startup; changes require a restart to take effect.

Key configuration sections:

- `server.databaseUrl`, `server.port`
- `server.agent.contextCompactionTotalTokenThreshold`, `server.agent.llmRetryBackoffMs`, `server.agent.waitToolMaxWaitMs`, `server.agent.notificationBatchWindowMs`
- `server.agent.story.batchSize`, `idleFlushMs`, `memory.embedding`, `memory.retrieval`, `recall.topK`, `recall.scoreThreshold`
- `server.news.ithome.pollIntervalMs`, `recentArticleLimit`, `articleMaxChars`
- `server.napcat.wsUrl`, `server.napcat.reconnectMs`, `server.napcat.requestTimeoutMs`
- `server.napcat.listenGroupIds`, `server.napcat.startupContextRecentMessageCount`
- `server.llm.timeoutMs`, `server.llm.authUsageRefreshIntervalMs`
- `server.llm.codexAuth`, `server.llm.claudeCodeAuth`
- `server.llm.providers.deepseek`, `server.llm.providers.openai`, `server.llm.providers.openaiCodex`, `server.llm.providers.claudeCode`
- `server.llm.usages.agent`, `storyAgent`, `contextSummarizer`, `vision`, `webSearchAgent`
- `server.tavily.apiKey`
- `server.bot.qq`, `server.bot.creator`

Configuration conventions:

- Database commands uniformly read `server.databaseUrl` from `config.yaml`.
- When modifying the config schema, the following must be updated together:
  - `apps/server/src/config/config.loader.ts`
  - `config.yaml`
  - `config.yaml.example`
- `server.llm.usages` must fully provide the four attempt chains: `agent`, `contextSummarizer`, `vision`, `webSearchAgent`.

## Database Migrations

From the repository root:

```bash
pnpm db:migrate:dev -- --name <migration_name>
pnpm db:migrate:deploy
pnpm db:migrate:status
pnpm db:migrate:reset
pnpm db:migrate:resolve -- --applied <migration_id>
```

Notes:

- `db:migrate:dev` automatically appends `--create-only`, generating the migration file without altering the database directly.
- Standard flow: edit `apps/server/prisma/schema.prisma` → generate migration → commit both the schema and migration → run `db:migrate:deploy` in the target environment.

## Architecture Overview

### Backend

The backend has been reorganized into a "flat modules + in-module layering" structure. Top-level directories live directly under `apps/server/src/<module>`, with runtime assembly handled by `apps/server/src/app/server-runtime.ts`.

Main modules:

- `app/`: application wiring, health checks, startup context hydration
- `common/`: shared contracts, error handling, HTTP helpers, runtime utilities
- `config/`: configuration loading and runtime config management
- `db/`: Prisma client and database infrastructure
- `logger/`: log runtime, serializer, sink, log DAO
- `auth/`: OAuth, callback service, secret store, usage cache, usage trend, unified auth HTTP endpoints
- `llm/`: providers, chat client, embedding, playground, related DAOs
- `napcat/`: NapCat gateway, message sending, event/group message persistence and HTTP endpoints
- `news/`: IThome and other news source polling, article persistence — provides the "read the news" kind of life input for the Agent
- `metric/`: runtime metrics and visualization data endpoints
- `agent/`: Kagami-specific agent runtime and capabilities
- `ops/`: query endpoints for App Log, LLM Chat Call, Story, Agent Dashboard, NapCat history, etc.

`apps/server/src/agent` is organized into `runtime/` and `capabilities/`:

- `runtime/`: Kagami-specific runtime such as root-agent, session, context, event queue
- `capabilities/`: implementations grouped by capability, currently including `messaging`, `context-summary`, `story`, `rag`, `news`, `vision`, `web-search`

Each capability can be understood as "one more way for the Agent to live": `news` lets him read IThome, `story` lets him remember events, `rag` lets him recall, `web-search` lets him look things up online, and `vision` lets him see images. Future capabilities should be designed as "adding a new way of living for the Agent", not as "adding another feature toggle to a chat bot".

Main endpoint groups:

- `/health`
- `/auth/:provider/status`
- `/auth/:provider/login-url`
- `/auth/:provider/logout`
- `/auth/:provider/refresh`
- `/auth/:provider/usage-limits`
- `/auth/:provider/usage-trend`
- `/llm/providers`
- `/llm/playground-tools`
- `/llm/chat`
- `/napcat/group/send`
- `/app-log/query`
- `/llm-chat-call/query`
- `/napcat-event/query`
- `/napcat-group-message/query`
- `/story/query`
- `/agent-dashboard/*`
- `/metric-chart/*`

### Frontend

The frontend is a React admin console used to observe the Agent's "life state" (what he has recently been thinking, doing, and seeing). Main pages:

- `/agent-dashboard`: Agent overview home (default entry)
- `/auth/:provider`
- `/llm-playground`
- `/llm-history`
- `/app-log-history`
- `/napcat-event-history`
- `/napcat-group-message-history`
- `/story-history`
- `/metric-charts`

Notes:

- Page components are organized by business domain under `apps/web/src/pages/*`.
- The current Vite config only provides the `@ -> apps/web/src` alias and has no built-in dev proxy.

### Shared Package

- `packages/shared` holds schemas, DTOs, and utility functions shared between frontend and backend.
- `packages/shared` no longer provides a root barrel entry; prefer explicit subpath imports.
- `@kagami/shared` does not export `z`; import Zod directly from `zod` when defining schemas.

### Agent Runtime Package

- `packages/agent-runtime` only carries the generic Agent Runtime kernel, not Kagami-specific semantics.
- Core exports currently include `AgentRuntime`, `TaskAgentRuntime`, `Operation`, `ToolCatalog`, `ToolComponent`, and related abstractions.
- NapCat event models, the Kagami system prompt, and concrete capability implementations remain under `apps/server/src/agent`.

## Deployment

- The PM2 config file is [ecosystem.config.cjs](./ecosystem.config.cjs).
- The backend service `kagami-server` runs `apps/server/dist/index.js` and listens on `20003` by default.
- The frontend service `kagami-web` runs `scripts/web-server.mjs` and listens on `20004` by default.
- The frontend static server serves `apps/web/dist` and proxies `/api/*` to `http://localhost:20003/*`.
- Running `pnpm app:deploy` performs the build, Prisma migrations, PM2 reload/startOrReload, and `pm2 save`.

Prerequisites:

- The host must provide PostgreSQL.
- The host must provide Napcat.
- `config.yaml` typically accesses these external dependencies via `localhost`.
