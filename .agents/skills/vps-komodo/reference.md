# VPS host map (placeholders)

Replace `example.com` hosts and `vps.example.com` with the project's real values. Never commit real passwords, PATs, or JWT secrets.

VPS SSH: `ubuntu@vps.example.com`. Pin Komodo image versions deliberately.

## Public URLs

| Service | URL | Upstream |
|---------|-----|----------|
| Nest API | `https://api.example.com/booking` | `127.0.0.1:3001` |
| GoTrue | `https://api.example.com/auth/v1` | `127.0.0.1:9999` |
| Web A | `https://www.a.example.com` | `127.0.0.1:3010` |
| Web B | `https://www.b.example.com` | `127.0.0.1:3012` |
| Admin A | `https://admin.a.example.com` | `127.0.0.1:3013` |
| Admin B | `https://admin.b.example.com` | `127.0.0.1:3013` (same container) |
| Komodo | `https://komodo.example.com` | `127.0.0.1:9120` |

## Disk

| Path | What |
|------|------|
| `/home/ubuntu/komodo/` | Komodo compose + `compose.env` |
| `/etc/komodo/stacks/api-stack/` | Postgres + GoTrue + Nest + `.env` |
| `/etc/komodo/stacks/web-a/` | Next site A |
| `/etc/komodo/stacks/web-b/` | Next site B |
| `/etc/komodo/stacks/admin/` | Shared admin Next |
| `/etc/nginx/sites-available/` | vhosts (templates live in the deploy repo) |

Laptop vault: gitignored local secrets. Apply with `bun run env:sync`.

## Example 1: connect and check health

```bash
bun scripts/vps.mjs status
bun scripts/vps.mjs health
```

Expect Postgres, GoTrue, Nest, Next, and Komodo listening on `127.0.0.1` only.

```bash
bun run env:sync --vps --restart
bun scripts/vps.mjs env-keys api-stack   # names only
bun scripts/vps.mjs health
```

CORS / GoTrue allow lists must include every admin origin, e.g. `https://admin.a.example.com` and `https://admin.b.example.com`.

## Example 2: rebuild Next after `NEXT_PUBLIC_*` change

```bash
bun run env:sync --vps
bun scripts/vps.mjs rebuild admin
bun scripts/vps.mjs rebuild web-a
bun scripts/vps.mjs rebuild web-b
bun scripts/vps.mjs health
```

After adding a new admin hostname: set DNS A → copy nginx site → `nginx -t` → certbot → reload. Confirm unrelated sites on the VPS still return 200.
