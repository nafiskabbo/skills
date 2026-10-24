---
name: nestjs-expert
description: Build and maintain production NestJS applications — modules, DI, controllers, guards, interceptors, pipes, validation, config, databases, auth, and tests. Use when changing Nest modules, providers, controllers, DTOs, guards, Passport/JWT, @nestjs/authentication, TypeORM, Prisma, Mongoose, Drizzle, ConfigModule, or Nest architecture.
---

# NestJS Expert

Build on the repository's installed NestJS version and existing conventions. Inspect `package.json`, `nest-cli.json`, `tsconfig.json`, `src/app.module.ts`, and the current module layout before choosing an implementation. Reuse existing patterns before adding libraries or abstractions.

For TypeScript style, types, and modeling, apply `typescript-best-practices`. For TypeScript major-version upgrades, use `typescript-migration`. For Postgres schema, RLS, or query work, apply `supabase-postgres-best-practices`. For a Next.js frontend, apply `next-js-expert`. Do not restate those rules here.

If the task is only TypeScript style, a TypeScript major upgrade, a Next.js UI, or isolated SQL — switch to that skill and stop.

## Version And Stack

Detect before writing:

- `@nestjs/core` major: 11 vs 12. Nest 12 packages are ESM; CommonJS apps can still consume them via `require(esm)` on Node 20.19+ or 22.12+. Do not convert the app to ESM unless asked. Nest 12 CLI generators need Node 22.22.3+ (or 24.15+ / 26+).
- HTTP adapter: Express (default) vs Fastify (`FastifyAdapter`).
- Data layer: Prisma, TypeORM, Mongoose, or Drizzle — use the one already in the repo. Never add a second ORM.
- Validation: `class-validator` + `ValidationPipe`, or Standard Schema (Zod / Valibot / ArkType) + `StandardSchemaValidationPipe` (Nest 12).
- Auth: `@nestjs/authentication`, or `@nestjs/passport` + `@nestjs/jwt`. Do not mix two auth stacks.
- Tests: keep Jest or Vitest as already configured. Nest 12 ESM scaffolds default to Vitest; Jest loading Nest 12 ESM packages needs Node 24.9+.

New Nest 12 code: Zod (or another Standard Schema library) for env and DTOs. Existing Nest 11 / class-validator / Joi / Jest apps stay on that stack unless the user asks to migrate. Use `nest upgrade` (not ad-hoc package bumps) when moving 11 → 12 so every `@nestjs/*` package stays on the same major.

## Architecture

- Feature modules with clear domain boundaries. Export the **service** (or injection token), not the module, from `exports`.
- Prefer constructor injection. Use `Symbol` tokens, not string tokens.
- Avoid circular imports. Extract shared logic to a third module. Use `forwardRef()` on both sides only as a last resort.
- Controllers stay thin: validate input, call a service, return the result. Domain logic lives in providers.
- Request lifecycle: Middleware → Guards → Interceptors (before) → Pipes → handler → Interceptors (after) → Exception filters.
- Call `app.enableShutdownHooks()` and close DB clients, queues, and other I/O in `onModuleDestroy`.
- Match existing naming, folder layout, and `nest generate` output.

## Config And Validation

- Load env through `ConfigModule.forRoot({ isGlobal: true })`. Fail boot on missing required variables.
- Nest 12: `validationSchema` accepts any Standard Schema library (Zod recommended). Joi still works if it implements Standard Schema (v18+); library-specific options go under `validationOptions.libraryOptions`.
- Nest 11: keep working Joi schemas or a custom `validate` function. Do not rewrite them to Zod unasked.
- Prefer `ConfigService.getOrThrow()` for required keys. Inject namespaced config with `registerAs` + `ConfigType` when the project already does that.
- Validate untrusted input at the HTTP boundary.
  - Schema-first (Nest 12): attach `{ schema }` on `@Body()`, `@Query()`, `@Param()`, `@RawBody()` and register `StandardSchemaValidationPipe` globally. Infer DTO types with `z.infer`.
  - Class-first: `ValidationPipe` with `whitelist: true` (and `forbidNonWhitelisted` / `transform` if the project already uses them).
- Nest 12 can shape responses with `StandardSchemaSerializerInterceptor` + `@SerializeOptions({ schema })`. Keep `ClassSerializerInterceptor` when the project already uses class-transformer.

## Data Access

- Keep queries in a dedicated provider (`PrismaService`, TypeORM repository, etc.). Controllers never talk to the database directly.
- Prisma: no official Nest Prisma package. Wrap `PrismaClient` in an injectable, connect in `onModuleInit`, disconnect in `onModuleDestroy`. Prisma 7 needs a driver adapter (`@prisma/adapter-pg`, and so on). Pin `prisma` and `@prisma/client` to the same major — do not install unpinned `latest` if it is a Prisma 8 pre-release.
- TypeORM: register entities with `forFeature()`, inject with `@InjectRepository()`, use named connections for multiple databases. Entity decorator mistakes often surface as "unable to connect".
- Use transactions for multi-write invariants. Parameterized queries only.
- For SQL schema, indexes, RLS, or query plans, follow `supabase-postgres-best-practices`.

## Auth And Security

- Use the existing auth module. Enforce authorization in guards (and in services for resource ownership), not only in controllers.
- `@nestjs/authentication` is the current official sign-in module (sessions, tokens, OIDC, API keys) with a store you implement. Passport (`@nestjs/passport`, `passport-jwt`) remains valid when already in the project.
- Never log secrets or return them in errors. JWT secrets come from env via `ConfigService`, never hardcoded.
- Rate-limit auth endpoints. Verify webhook signatures against the raw body (`@RawBody()`).

## Testing

- Unit: `Test.createTestingModule` from `@nestjs/testing`. Mock only external I/O. `useMocker()` for noisy dependency graphs.
- Override providers with `.overrideProvider().useValue()`. For TypeORM, mock `getRepositoryToken(Entity)`.
- E2E: Supertest against `app.getHttpServer()`, or Fastify `.inject()` after `app.getHttpAdapter().getInstance().ready()`.
- Close the app in `afterAll`. Do not hit a real database in unit tests.

## Diagnostics

`Nest can't resolve dependencies of X (?)` — the `?` is the constructor argument Nest cannot provide. Check `@Injectable()`, `providers`, and that cross-module services are **exported** and the consumer module **imports** that module.

## Verification

Run the repo's typecheck, then unit tests, then e2e. Prefer `nest build` / the project's `test` and `test:e2e` scripts. Do not start `start:dev` to validate.

## Docs

- [NestJS docs](https://docs.nestjs.com)
- [11 → 12 migration](https://docs.nestjs.com/migration-guide)
- [Prisma](https://docs.nestjs.com/data/prisma)
- [Validation](https://docs.nestjs.com/application/validation)
- [Configuration](https://docs.nestjs.com/techniques/configuration)
- [Authentication](https://docs.nestjs.com/security/authentication)
- [Testing](https://docs.nestjs.com/fundamentals/testing)
