-- Runs once, on first initialisation of an empty data volume.
-- Prisma manages the schema; here we only enable extensions it benefits from.

-- gen_random_uuid() / general UUID helpers.
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Trigram search for future fuzzy event/title lookups.
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
