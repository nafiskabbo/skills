---
name: next-js-expert
description: Build and maintain production full-stack applications with Next.js App Router, React, Tailwind CSS, Route Handlers, Server Actions, authentication, databases, caching, and deployment-safe configuration. Use when changing routes, UI, server-side data access, APIs, mutations, proxy, middleware, environment variables, or project architecture.
---

# Next.js Expert

Build on the repository's installed Next.js version and existing conventions. Inspect the current structure, dependencies, and configuration before choosing an implementation. Reuse existing patterns before adding libraries or abstractions.

For TypeScript style, types, and modeling, apply `typescript-best-practices`. For TypeScript major-version upgrades, use `typescript-migration`. For Postgres schema, RLS, or query work, apply `supabase-postgres-best-practices`. For a NestJS backend, apply `nestjs-expert`. For visual direction of public pages, apply `taste-skill` / `frontend-design`. Do not restate those rules here.

## Version

Read `next` from `package.json` and `next.config.*` before writing.

- **15:** `cookies`, `headers`, `draftMode`, `params`, and `searchParams` are async. Await them. Temporary sync access warns and is removed in 16.
- **16:** sync access is gone. `middleware` is renamed to `proxy` (`proxy.ts`, named export `proxy`). Turbopack is the default for `next dev` and `next build`. `next lint` is removed — use the project's ESLint or Biome command. Cache Components (`cacheComponents`) replaces experimental PPR / `dynamicIO`.
- Prefer generated helpers from `next typegen` (`PageProps`, `LayoutProps`, `RouteContext`) when present.

Do not add APIs from a newer major than the installed version. Do not migrate 15 → 16 unless asked.

## Architecture

- Use App Router only. Do not add Pages Router files or `getServerSideProps`.
- Prefer Server Components. Add `"use client"` only for browser state, effects, event handlers, or client-only libraries.
- Keep route-specific components, loading states, errors, and metadata near their route. Put genuinely shared UI and domain logic outside `app/`.
- Separate presentation, domain logic, and infrastructure. Components must not contain database or external-service implementation details.
- Use `server-only` in modules that handle credentials, privileged SDKs, or direct database access.
- Do not introduce a second pattern for routing, validation, data access, or mutations when the project already has one.

## Server-Side Data And APIs

- Always `await` request-time APIs: `cookies()`, `headers()`, `draftMode()`, `params`, and `searchParams`.
- Fetch initial data in Server Components and pass only serializable, minimal props to Client Components.
- Keep database queries and external API calls in focused server-side modules. Reuse the project's repository or service layer if one exists.
- `fetch` in Server Components is not cached by default. Cache with `'use cache'` (and `cacheLife`) when the project uses Cache Components, or follow the project's existing cache helpers.
- Use Route Handlers for public HTTP APIs, webhooks, callbacks, streaming, or endpoints consumed outside the Next.js application.
- Use Server Functions / Server Actions for application-owned form mutations when they simplify the flow. Authenticate and authorize inside every function; never trust hidden fields or client state. They are reachable via POST, not only through the UI.
- Validate all untrusted input at the server boundary with the project's existing schema validator. Return structured, typed errors without leaking internals.
- Avoid request waterfalls: start independent work concurrently and compose data at the nearest common Server Component. Stream slow segments with `loading.tsx` or `<Suspense>`.

## Mutations, Caching, And Runtime

- After a mutation, revalidate the smallest affected path or cache tag (`revalidatePath` / `revalidateTag`). Call `refresh()` from `next/cache` only when the client router should refetch the current page; it does not revalidate tagged data. Redirect only after the mutation succeeds (`revalidate*` before `redirect`).
- Choose caching deliberately. User-specific or permission-sensitive data must not enter a shared cache.
- Cache Components (Next 16, or 15 with the experimental flag): enable with `cacheComponents: true` (and `partialPrefetching: true` on current 16). Mark async functions/components with `'use cache'`. Read `cookies` / `headers` / `searchParams` **outside** a cached scope and pass values in. Wrap request-data UI in `<Suspense>` so the rest of the page can prerender.
- Use `after()` from `next/server` for logging, analytics, and other work that must not block the response. It does not make a route dynamic. In Server Components, read request data before `after` and close over the values — do not call `cookies()` / `headers()` inside the callback.
- Keep Node-only packages out of Edge code. Next 16 `proxy` is Node.js only and cannot be set to Edge; keep `middleware.ts` only when the project must stay on Edge.
- Make webhook and retryable operations idempotent. Use database transactions for multi-write invariants.
- Treat durable background work as platform-dependent: enqueue jobs instead of relying on work continuing after a response. `after()` is for short post-response side effects, not job queues.

## Proxy

- Next 16: put network-boundary logic in `proxy.ts` (project root or `src/`), same level as `app/`. One file per project; import helpers into it.
- Use it for rewrites, redirects, and header changes that need the request. Prefer `redirects` / `rewrites` in `next.config` for static rules.
- Proxy is not session management or authorization. Optimistic checks only; enforce auth in server data access, Route Handlers, and Server Functions.
- Fetch cache options (`cache`, `next.revalidate`, `next.tags`) have no effect in proxy.
- Next 15 projects keep `middleware.ts` until upgraded.

## Authentication And Security

- Use the existing authentication provider and session helpers. Enforce authorization in server-side data access, Route Handlers, and Server Functions — not only in layouts, proxy, or UI.
- Never expose secrets through `NEXT_PUBLIC_*`, serialized props, logs, or error responses.
- Verify webhook signatures against the raw request body. Apply rate limits and origin/CSRF protections where appropriate.
- Use parameterized ORM/query APIs. Escape or sanitize user-controlled rich content before rendering; avoid `dangerouslySetInnerHTML`.
- Keep environment-variable access centralized and validated at startup or first use. Document required variables in an example env file without real values.
- Next 16: `next/image` local `src` values with query strings need `images.localPatterns`.

## Code Style

- Use named exports by default.
- Use kebab-case folders.
- Keep files focused and split unrelated responsibilities. Prefer existing components, utilities, hooks, and server modules.
- Do not create pass-through abstractions that have only one caller and no policy, transformation, or test seam.

## UI, Forms, And Accessibility

- Use Tailwind utilities for styling.
- Use `next/image` for raster images and `next/font` for managed fonts.
- Write semantic HTML with keyboard-accessible controls and navigation.
- Prefer native form actions and progressive enhancement. Represent pending, success, empty, and failure states explicitly (`useActionState` when the UI needs pending/error).
- Provide route-level `loading.tsx`, `error.tsx`, and `not-found.tsx` where those states materially improve the experience.
- Keep metadata server-side and use the Metadata API for static or data-driven SEO.

## Verification

- Run the repository's type-check, lint, test, and production build commands after relevant changes. On Next 16 do not run `next lint`; use ESLint or Biome as the project already does.
- Test server code at trust boundaries and domain logic directly. Add browser tests for critical user journeys when the project has an end-to-end setup.
- Check both authenticated and unauthorized behavior for protected operations.
- Confirm environment, runtime, caching, and deployment assumptions against the target hosting platform.
