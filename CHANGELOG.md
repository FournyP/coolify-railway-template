# Changelog

Notable changes to this template. Entries are named after the Coolify version they ship,
and the format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## Coolify 4.4.2 — 2026-10-08

Ships Coolify 4.4.2. The realtime service is gone.

### Changed

- `COOLIFY_VERSION` bumped from 4.3.23 to 4.4.2. Migrations run at boot and do not roll back.
- Realtime now runs inside the Coolify container: Laravel Reverb on `:6001` and the terminal
  server on `:6002`, as upstream does since 4.4. The `realtime/` image and the
  Coolify Realtime service are removed.
- nginx proxies `/app` and `/terminal/ws` to `127.0.0.1`. The config is a static file that
  replaces upstream's `http.conf`, so the start-time render script is gone.

### Removed

- `REALTIME_HOST`, `PUSHER_BACKEND_HOST` and `PUSHER_SCHEME` on the Coolify service.

### Before you update

- Back up the Coolify Postgres database first: migrations do not roll back.
- Remove `PUSHER_BACKEND_HOST`, `REALTIME_HOST` and `PUSHER_SCHEME` from the Coolify service
  before deploying. Left in place, the backend keeps broadcasting to the old realtime service.
- Once the new deploy is healthy, delete the Coolify Realtime service.
- Each account now links to one OAuth provider, and some applications switch to consistent
  container naming. See the [4.4.0 release notes](https://github.com/coollabsio/coolify/releases/tag/v4.4.0).

## Coolify 4.3.23 — 2026-09-25

Ships Coolify 4.3.23 and coolify-realtime 1.0.18.

### Changed

- `COOLIFY_VERSION` bumped from 4.3.17 to 4.3.23. Migrations run at boot and do not roll back.
- Realtime stays on 1.0.18. Upstream's compose ships 1.0.19, whose only change passes `PATH`
  to the browser terminal, which cannot work on Railway anyway.
- The realtime version is now tracked against upstream's `docker-compose.prod.yml` instead of
  `versions.json`, which lags behind it.

### Before you update

- Sentinel is mandatory on every server since Coolify 4.3.19, and each server stores its
  Sentinel URL when it is created. A server added before the instance FQDN was set holds
  `http://<public_ipv4>:8000`, which is unreachable here: set its Sentinel URL to
  `https://<your-domain>` in the server's settings. Until then it falls back to SSH checks
  and shows as out of sync.

## Pinned port — 2026-09-18

### Fixed

- `railway.ts` pins `PORT` to `8080` on the Coolify service. Railway injects a random `PORT` when the
  variable is unset, so a service created by hand with an explicit domain target port
  could listen on one port while the edge dialled another.

## Coolify 4.3.17 — 2026-09-06

Ships Coolify 4.3.17 and coolify-realtime 1.0.18.

### Added

- Initial release. Four resources: the Coolify control plane (nginx, php-fpm, Horizon and
  the scheduler in one service), a private `coolify-realtime` service running soketi and
  the terminal server, Postgres and Redis.
- `.railway/railway.ts`, an Infrastructure as Code definition of the project. See
  [Infrastructure as Code](README.md#-infrastructure-as-code).
- CI: `docker-build` builds both images and exercises the websocket routing,
  `iac-typecheck` typechecks `railway.ts`.

### Before you deploy

- **Never rotate `APP_KEY`.** Coolify encrypts every registered server's SSH private key
  with it; a new key locks you out of all of them.
- Generate the public domain before the final deploy. `APP_URL` resolves from
  `RAILWAY_PUBLIC_DOMAIN`, and with no domain attached every `php artisan` call fails
  with `Invalid URI`.
