# Coolify Railway Template

Run the [Coolify](https://coolify.io) control plane on Railway: the full web UI, driving deployments on **your own remote servers** over SSH.

[![Deploy on Railway](https://railway.com/button.svg)](https://railway.com/deploy/coolify-1?referralCode=C3Uv6n&utm_medium=integration&utm_source=template&utm_campaign=generic)

## 🏗️ Architecture

```mermaid
flowchart LR
    browser["Browser"]

    subgraph railway["Railway project"]
        subgraph coolifysvc["coolify · public · target port 8080"]
            nginx["nginx"]
            php["php-fpm + horizon + scheduler"]
            realtime["reverb :6001<br/>terminal :6002"]
            nginx -- "everything else" --> php
            nginx -- "/app, /terminal/ws" --> realtime
            php -- "broadcast" --> realtime
        end
        pg[("Postgres")]
        rd[("Redis")]
    end

    subgraph yours["Your own servers"]
        helper["docker + coolify-helper<br/>git clone · docker build · run"]
    end

    browser -- "https" --> nginx
    browser -. "wss /app<br/>wss /terminal/ws" .-> nginx
    php --> pg
    php --> rd
    php == "ssh :22" ==> helper
```

- **coolify** — nginx, php-fpm, Horizon, the scheduler, Reverb and the terminal server in one container under s6-overlay. The only public service.
- **Postgres** — all durable state. **Redis** — queues and cache.

### 🐳 No Docker-in-Docker needed

Coolify never builds an image. It generates shell and pipes it over SSH — `SshMultiplexingHelper::generateSshCommand()` ends in `ssh <opts> user@host 'bash -se' << DELIM`. The `git clone` and `docker build` run on the **target server**, inside a `coollabsio/coolify-helper` container. Upstream's `docker-compose.prod.yml` mounts no Docker socket, and the production image ships `openssh-client` and `git` but no Docker client.

Strings like `docker run -v /var/run/docker.sock:/var/run/docker.sock ...` in the source are the *text of commands sent over SSH*. That socket is your server's.

## ✨ Features

- The complete Coolify UI, API, backups and notifications.
- Live deployment logs, on a single public domain.
- Stateless — no volume. SSH keys are re-materialised from Postgres on every boot.
- Pinned image (`coolify:4.4.2`).

## 💁‍♀️ How to use

1. Click **Deploy on Railway**.
2. Deploy. First boot runs migrations and seeders; a couple of restarts while Postgres and Redis come up is normal.
3. Open the public domain and create the root account. **Do this as soon as the deploy goes live** — registration is open until the first account exists, and that account owns the instance.
4. Set the instance FQDN in **Settings** to your Railway domain, before adding any server. Each server stores its Sentinel URL when it is created, and Sentinel is mandatory since Coolify 4.3.19; a server added earlier needs its Sentinel URL set to `https://<your-domain>` in its settings.
5. **Keys & Tokens** → add your SSH key, **Servers** → add the server, validate it.
6. Deploy a project. The build runs on your server, not on Railway.

## 🧱 Infrastructure as Code

`.railway/railway.ts` defines the whole project — both databases, both services, every variable.

```bash
railway link
npm install

# First apply only; later runs omit these and preserve() keeps the values.
export APP_KEY="base64:$(openssl rand -base64 32)"
export PUSHER_APP_ID=$(openssl rand -hex 16)
export PUSHER_APP_KEY=$(openssl rand -hex 16)
export PUSHER_APP_SECRET=$(openssl rand -hex 16)

npm run plan     # read the diff before applying
npm run apply
railway domain --service Coolify
```

**Generate the domain before the final deploy.** `APP_URL` is `https://${{RAILWAY_PUBLIC_DOMAIN}}`; with no domain attached it resolves to a bare `https://` and every `php artisan` call dies with `Invalid URI`.

Three things `railway.ts` deliberately leaves alone, all because the CLI does not round-trip them and every plan would show the same pending change forever:

- `deploy.restartPolicyType` and `deploy.sleepApplication` — Railway's defaults are already `ON_FAILURE` and sleeping off.
- Cross-service variable references when the target service name contains a space. The private domain is used as a literal instead.
- Generated `*.up.railway.app` domains, which are out of IaC scope by design.

**Service names in `railway.ts` must match Railway exactly.** IaC matches by name, and a mismatch is planned as delete + recreate of a live service, not as a rename.

## 🔧 Variables

### Coolify service

| Variable | Required | Description |
| --- | --- | --- |
| `APP_KEY` | yes | `base64:$(openssl rand -base64 32)`. **Never change it** — it encrypts every registered server's SSH key. |
| `APP_URL` | yes | `https://${{RAILWAY_PUBLIC_DOMAIN}}`. |
| `DB_*` | yes | `${{Postgres.PGHOST}}` etc. The defaults point at upstream's compose hostnames. |
| `REDIS_HOST` / `_PORT` / `_PASSWORD` | yes | Reference the Redis service. Do **not** also set `REDIS_URL`. |
| `PUSHER_APP_ID` / `_KEY` / `_SECRET` | yes | Random strings. Reverb, in the same container, reads the same values. |
| `PHP_MEMORY_LIMIT` | no | `256M` default; `512M` is easier with Horizon. |

**Leave unset:** `PUSHER_BACKEND_HOST` — unset, the backend broadcasts to Reverb on `127.0.0.1`. `PUSHER_HOST`, `PUSHER_PORT`, `TERMINAL_PROTOCOL`, `TERMINAL_HOST`, `TERMINAL_PORT` override the browser-side websocket URL. Unset, the frontend falls back to this host with no port — exactly `wss://<domain>/app` and `wss://<domain>/terminal/ws`, which nginx proxies. `SELF_HOSTED` must stay unset too.

**Not variables at all:** `AUTOUPDATE` is defaulted to `false` in `coolify/Dockerfile` — `UpdateCoolify::update()` SSHes into `Server::find(0)` to run `upgrade.sh`, a server that does not exist here, so it fails into Horizon on every cron tick rather than no-opping. `NIGHTWATCH_ENABLED` is read by nothing; the s6 service gates on a `.env` file this container does not have.

### Service settings

| | coolify |
| --- | --- |
| Root directory | `coolify` |
| Builder | `DOCKERFILE` |
| Target port | `8080` |
| Healthcheck | `/api/health` |
| Replicas | `1` |

Replicas stay at 1 and app sleeping stays off: Horizon and the scheduler must keep running, and a second replica would run every scheduled job twice.

## 🔌 Why the websockets go through nginx

Upstream fronts Coolify with Traefik and routes `PathPrefix(/app)` to `:6001` and `PathPrefix(/terminal/ws)` to `:6002` on the dashboard's own host. Railway gives one public port per service, so that routing moves into the nginx already inside the image — same paths, same host, so the frontend's fallbacks produce the right URLs with no code change.

`coolify/etc/nginx/site-opts.d/http.conf` replaces upstream's file of the same name: upstream's config verbatim plus the two websocket locations, both proxying to `127.0.0.1`.

## 🖥️ The in-browser terminal

Before Coolify 4.4 the terminal server ran in a separate realtime service that could not see the SSH keys, so the terminal never opened on Railway. It now runs in the coolify container, next to the keys Coolify writes from Postgres on every boot.

## ⚠️ The `localhost` server is permanently unreachable

`ProductionSeeder` always creates server id 0 pointing at `host.docker.internal`, and Coolify will not let you delete it. It shows red, and the `StartProxy` / `CheckAndStartSentinel` jobs against it fail on every boot. Cosmetic — ignore it, never attach a resource to it.

Cloud mode (`SELF_HOSTED=false`) skips creating it but makes `DecideWhatToDoWithUser` require a verified email that `RootUserSeeder` never sets. Leave it alone.

## 🔐 Security

This instance holds the SSH keys to every server you register, behind one password on a public domain.

- Long unique root password, 2FA on immediately.
- Disable the API in **Settings**, or restrict `allowed_ips`.
- Back up Postgres — it is the only copy of your keys and settings.
- Losing `APP_KEY` makes every stored private key undecryptable.

## ⬆️ Upgrading

Railway template updates are opt-in — an existing deployment keeps running until you apply the update. See the [changelog](CHANGELOG.md) for what each update contains.

To move to a newer Coolify, bump `COOLIFY_VERSION` in `coolify/Dockerfile` and redeploy. Migrations run at boot. Only released versions get a bare semver tag on Docker Hub.

## 🧪 Run locally

```bash
docker build -t coolify-railway coolify/
```

Run it with a Postgres and a Redis, then:

```bash
curl -fsS localhost:8080/api/health
docker exec <coolify> nginx -T | grep -A3 'location /app'
```

The second should show `proxy_pass http://127.0.0.1:6001;`. Test websockets with `curl --http1.1` — over HTTP/2 the upgrade headers are illegal and you get a misleading 502.

## 📝 Notes

- Nothing is built on Railway. Every build runs on the server you deploy to; configure a dedicated build server in Coolify if yours are small.
- No volume: `PopulateSshKeysDirectorySeeder` rewrites `storage/app/ssh` from Postgres on every boot.
- Railway bills egress at $0.05/GB; deployment log streaming counts.
- Source repo: https://github.com/FournyP/coolify-railway-template
- Docs: https://coolify.io/docs

## ⚖️ License

[MIT](LICENSE)
