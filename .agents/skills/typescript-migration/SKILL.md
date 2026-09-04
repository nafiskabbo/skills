---
name: typescript-migration
description: Migrate a repo across TypeScript major versions (5.x→6.0 and 6.x→7.0). Use when upgrading typescript, fixing TS6 deprecations, tsconfig default changes, baseUrl/rootDir/types breakage, ignoreDeprecations, or adopting the Go-native TypeScript 7 compiler. Not for day-to-day TypeScript style — use typescript-best-practices for that.
---

# TypeScript migration

Upgrade TypeScript majors with the reference guides below. Day-to-day typing rules stay in `typescript-best-practices`; this skill only covers version migration.

## Which guide

| From → to | Read |
|-----------|------|
| 5.x → 6.0 | [references/v5-to-v6.md](references/v5-to-v6.md) |
| 6.x → 7.0 | [references/v7.md](references/v7.md) |

Prefer **5 → 6 first**, clear every deprecation, then **6 → 7**. `ignoreDeprecations: "6.0"` is a temporary 6.0 escape hatch and does **not** work in 7.0.

## Agent workflow

1. Detect installed `typescript` version and every `tsconfig*.json` (including `extends` bases).
2. Open the matching reference and follow its checklist end-to-end.
3. For 5→6: run or recommend [`ts5to6`](https://github.com/andrewbranch/ts5to6) for `baseUrl` / `rootDir` when helpful; set explicit `types` and `rootDir` as the guide requires.
4. For 6→7: delete incompatible `*.tsbuildinfo`, install 7.x, keep a `@typescript/typescript6` alias only if tooling still imports the compiler API, then fix hard errors from former deprecations.
5. Diff `tsc --noEmit` against a pre-upgrade baseline. Fix real errors; do not silently disable `strict` unless the user asks.
6. Summarize every tsconfig change and every new diagnostic fixed; flag unknowns instead of guessing.

## Do not

- Duplicate or override `typescript-best-practices` (unions, branding, `any`, casts, etc.).
- Treat this skill as general TypeScript tutoring — only major-version upgrades.
- Leave `ignoreDeprecations` in place as a permanent “fix” when targeting 7.0.
