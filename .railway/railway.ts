// Railway Infrastructure as Code: railway config plan | apply
//
// Secrets stay out of this file. Export them once for the first apply; later
// runs omit them and preserve() keeps what Railway holds.
//
//   export APP_KEY="base64:$(openssl rand -base64 32)"
//   export PUSHER_APP_ID=$(openssl rand -hex 16)
//   export PUSHER_APP_KEY=$(openssl rand -hex 16)
//   export PUSHER_APP_SECRET=$(openssl rand -hex 16)
//   export ROOT_USERNAME="Your Name" ROOT_USER_EMAIL="you@resolvable.tld" ROOT_USER_PASSWORD='...'
//
// Never rotate APP_KEY: it encrypts every registered server's SSH key.

import {
  defineRailway,
  github,
  postgres,
  preserve,
  project,
  redis,
  service,
} from "railway/iac";

const REPO = "FournyP/coolify-railway-template";

// IaC matches resources by name. A mismatch is planned as delete + recreate of
// a live service, not as a rename, so keep these identical to Railway.
const COOLIFY_SERVICE = "Coolify";
const REALTIME_SERVICE = "Coolify Realtime";

// Literal, not realtime.env.RAILWAY_PRIVATE_DOMAIN: a cross-service reference
// whose target name contains a space does not round-trip, leaving every plan
// permanently dirty. The private domain is a slug of the name at creation and
// survives renames, so the literal is the stabler of the two.
const REALTIME_PRIVATE_DOMAIN = "coolify-realtime.railway.internal";

/** Push the value from the local environment if present, else keep Railway's. */
const fromEnvOrPreserve = (name: string) => process.env[name] ?? preserve();

export default defineRailway(() => {
  const db = postgres("postgres");
  const cache = redis("redis");

  const realtime = service(REALTIME_SERVICE, {
    // One build context per service: at the repository root the builder would
    // look for ./Dockerfile and the COPY paths would not resolve.
    source: github(REPO, { branch: "main", rootDirectory: "realtime" }),
    build: { builder: "DOCKERFILE", dockerfilePath: "Dockerfile" },
    deploy: { numReplicas: 1 },
    env: {
      APP_NAME: "Coolify",
      SOKETI_DEBUG: "false",
      SOKETI_DEFAULT_APP_ID: fromEnvOrPreserve("PUSHER_APP_ID"),
      SOKETI_DEFAULT_APP_KEY: fromEnvOrPreserve("PUSHER_APP_KEY"),
      SOKETI_DEFAULT_APP_SECRET: fromEnvOrPreserve("PUSHER_APP_SECRET"),
    },
  });

  const coolify = service(COOLIFY_SERVICE, {
    source: github(REPO, { branch: "main", rootDirectory: "coolify" }),
    build: { builder: "DOCKERFILE", dockerfilePath: "Dockerfile" },
    deploy: {
      healthcheckPath: "/api/health",
      // Horizon and the scheduler must keep running, and a second replica would
      // run every scheduled job twice. Leave app sleeping off in the dashboard
      // for the same reason: the CLI does not round-trip sleepApplication or
      // restartPolicyType, so declaring them makes every plan dirty.
      numReplicas: 1,
    },
    env: {
      APP_ENV: "production",
      APP_DEBUG: "false",
      APP_NAME: "Coolify",
      APP_KEY: fromEnvOrPreserve("APP_KEY"),
      APP_URL: "https://${{RAILWAY_PUBLIC_DOMAIN}}",

      ROOT_USERNAME: fromEnvOrPreserve("ROOT_USERNAME"),
      ROOT_USER_EMAIL: fromEnvOrPreserve("ROOT_USER_EMAIL"),
      ROOT_USER_PASSWORD: fromEnvOrPreserve("ROOT_USER_PASSWORD"),

      DB_HOST: db.env.PGHOST,
      DB_PORT: db.env.PGPORT,
      DB_DATABASE: db.env.PGDATABASE,
      DB_USERNAME: db.env.PGUSER,
      DB_PASSWORD: db.env.PGPASSWORD,

      // Not REDIS_URL: Laravel prefers it and would ignore these.
      REDIS_HOST: cache.env.REDISHOST,
      REDIS_PORT: cache.env.REDISPORT,
      REDIS_PASSWORD: cache.env.REDIS_PASSWORD,

      PUSHER_APP_ID: fromEnvOrPreserve("PUSHER_APP_ID"),
      PUSHER_APP_KEY: fromEnvOrPreserve("PUSHER_APP_KEY"),
      PUSHER_APP_SECRET: fromEnvOrPreserve("PUSHER_APP_SECRET"),

      // Backend broadcast target. Not PUSHER_HOST, which is browser-facing and
      // must stay unset.
      PUSHER_BACKEND_HOST: REALTIME_PRIVATE_DOMAIN,
      PUSHER_BACKEND_PORT: "6001",
      PUSHER_SCHEME: "http",

      // Upstream for the nginx websocket locations.
      REALTIME_HOST: REALTIME_PRIVATE_DOMAIN,

      PHP_MEMORY_LIMIT: "512M",
    },
  });

  return project("Coolify", { resources: [db, cache, realtime, coolify] });
});
