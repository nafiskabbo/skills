---
name: vps-komodo
description: Operate a VPS and Komodo Docker stacks for multi-app hosting. SSH, stack env, Postgres, GoTrue, nginx, Compose rebuilds, health checks. Use when the user mentions VPS, Komodo, stack env, migrate, certbot, or production env on the host.
---

# VPS and Komodo

Run the project's VPS scripts. Do not paste secret values into chat, commits, or shell history. Do not rotate vault keys unless they were committed or the user asks.

Read [reference.md](reference.md) for the host map and worked examples (sanitized `example.com` placeholders — replace with the project's real hosts).

## Scripts (required)

From the monorepo root (adjust paths to the project's scripts):

```bash
bun scripts/vps.mjs status
bun scripts/vps.mjs health
bun scripts/vps.mjs env-keys api-stack    # key names only
bun scripts/vps.mjs sql --query 'SELECT id FROM organizations'
bun scripts/vps.mjs migrate
bun scripts/vps.mjs logs admin
bun scripts/vps.mjs rebuild web-a         # Next: NEXT_PUBLIC_* are build args
bun scripts/vps.mjs nginx-test
bun run env:sync --vps                    # write stack .env from laptop vault
```

`--dry-run` prints the remote command and does not SSH.

Do not `cat` stack `.env` files, `printenv`, or `docker inspect` env. Use `env-keys` for names and `env:sync --vps` for values.

## Connect

- Komodo UI: `https://komodo.example.com`. Login JSON lives in the project's local secrets vault. Use it to watch stacks and trigger a redeploy after git sync. Do not type the password into chat.
- SSH: `ubuntu@vps.example.com`. Scripts should read credentials from a gitignored vault via `sshpass` (or SSH keys). Do not put the password on the command line.
- GitHub PAT for private clone: Komodo **Settings → Providers** (`github.com` + username + token from the vault).

## Update env

1. Change keys in the laptop vault (or via `bun run env:sync`).
2. `bun run env:sync --vps` merges into `/etc/komodo/stacks/<stack>/.env`.
3. Confirm names: `bun scripts/vps.mjs env-keys api-stack` (and each frontend stack).
4. Restart API: `bun run env:sync --vps --restart` or rebuild any stack that baked `NEXT_PUBLIC_*`.

Changing `GOTRUE_JWT_SECRET` also means reminting the anon JWT and rebuilding all Next stacks that embed public auth config.

## Update database

```bash
bun scripts/vps.mjs migrate
bun scripts/vps.mjs sql --query 'SELECT id, display_name FROM organizations'
```

SQL via the CLI should stay read-only (SELECT / WITH / EXPLAIN / SHOW). Schema changes go through migrations, then `migrate`.

## Admin hosts (shared container pattern)

One Next process can serve multiple admin hostnames; hostname picks the org:

| Host | Org |
|------|-----|
| `https://admin.a.example.com` | org-a |
| `https://admin.b.example.com` | org-b |
| `localhost:3003` | cookie / `NEXT_PUBLIC_ORGANIZATION_ID` (org switcher) |

Staff without a membership for that host are signed out. DNS A records are the operator's job. After a new A record exists: copy nginx, certbot, reload. See [reference.md](reference.md).

## Safety

- Bind Docker published ports to `127.0.0.1` only. Do not collide with unrelated host apps.
- Do not edit nginx for unrelated sites on the same VPS.
- Do not install a second reverse proxy fighting for 80/443.
- Commit and push only when the user asks.
- Do not paste secrets.

## After a host change

```bash
bun scripts/vps.mjs health
# Confirm unrelated sites on the same VPS still return 200
```
