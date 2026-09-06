# Changelog

Notable changes to this template. Entries are named after the Coolify version they ship,
and the format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

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
