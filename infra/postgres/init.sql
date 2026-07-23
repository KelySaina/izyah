-- Runs once, on first initialisation of an empty data volume.
-- Prisma manages the schema; here we only enable extensions it benefits from.

-- gen_random_uuid() / general UUID helpers.
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Trigram search for future fuzzy event/title lookups.
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- Dedicated database for the Logto OIDC provider (auth). Runs only on first
-- init of an empty volume; on an existing volume create it once by hand:
--   docker compose exec postgres createdb -U izyah logto
SELECT 'CREATE DATABASE logto'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'logto')\gexec
