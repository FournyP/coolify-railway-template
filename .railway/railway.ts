// Railway Infrastructure as Code: railway config plan | apply
//
// Secrets stay out of this file. Export them once for the first apply; later
// runs omit them and preserve() keeps what Railway holds.
//
//   export APP_KEY="base64:$(openssl rand -base64 32)"
//   export PUSHER_APP_ID=$(openssl rand -hex 16)
//   export PUSHER_APP_KEY=$(openssl rand -hex 16)
//   export PUSHER_APP_SECRET=$(openssl rand -hex 16)
//
// Never rotate APP_KEY: it encrypts every registered server's SSH key.
//
// The root account is created through the register page on first visit, not
// from variables, so none are declared for it.

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

// Matched by name, so keep it identical to Railway: a mismatch is a delete
// and recreate, not a rename.
const COOLIFY_SERVICE = "Coolify";

/** Push the value from the local environment if present, else keep Railway's. */
const fromEnvOrPreserve = (name: string) => process.env[name] ?? preserve();

export default defineRailway(() => {
  const db = postgres("postgres");
  const cache = redis("redis");

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
      // nginx inside the image listens on 8080. Pinned so Railway's healthcheck
      // and the domain's target port cannot land on a different port.
      PORT: "8080",

      APP_ENV: "production",
      APP_DEBUG: "false",
      APP_NAME: "Coolify",
      APP_KEY: fromEnvOrPreserve("APP_KEY"),
      APP_URL: "https://${{RAILWAY_PUBLIC_DOMAIN}}",

      DB_HOST: db.env.PGHOST,
      DB_PORT: db.env.PGPORT,
      DB_DATABASE: db.env.PGDATABASE,
      DB_USERNAME: db.env.PGUSER,
      DB_PASSWORD: db.env.PGPASSWORD,

      // Not REDIS_URL: Laravel prefers it and would ignore these.
      REDIS_HOST: cache.env.REDISHOST,
      REDIS_PORT: cache.env.REDISPORT,
      REDIS_PASSWORD: cache.env.REDIS_PASSWORD,

      // Reverb runs in this container and reads the same credentials. The
      // backend broadcasts to 127.0.0.1:6001 when PUSHER_BACKEND_HOST is unset.
      PUSHER_APP_ID: fromEnvOrPreserve("PUSHER_APP_ID"),
      PUSHER_APP_KEY: fromEnvOrPreserve("PUSHER_APP_KEY"),
      PUSHER_APP_SECRET: fromEnvOrPreserve("PUSHER_APP_SECRET"),

      PHP_MEMORY_LIMIT: "512M",
    },
  });

  return project("Coolify", { resources: [db, cache, coolify] });
});
