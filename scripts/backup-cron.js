#!/usr/bin/env node
// ============================================================================
// Izy'Ah — periodic backup scheduler (replaces an OS crontab entry).
//
// Runs scripts/backup.sh on a cron schedule, forever, inside the
// "backup" service defined in docker-compose.yml — see infra/backup/Dockerfile
// for how that container gets bash/docker-cli alongside Node.
//
// Configure via env (docker-compose.yml / .env):
//   BACKUP_SCHEDULE   cron expression, default weekly (Sun 03:30 UTC)
//   BACKUP_KEEP        passed straight through to backup.sh's own retention
//
// noOverlap means a slow backup (a big MinIO archive) can never overlap the
// next tick — the overlapping run is skipped, not queued.
// ============================================================================
const cron = require('node-cron');
const { execSync } = require('node:child_process');
const path = require('node:path');

const REPO_DIR = path.resolve(__dirname, '..');
const SCHEDULE = process.env.BACKUP_SCHEDULE || '30 3 * * 0';

if (!cron.validate(SCHEDULE)) {
  console.error(`izyah backup-cron: invalid BACKUP_SCHEDULE "${SCHEDULE}"`);
  process.exit(1);
}

function runBackup() {
  const startedAt = new Date().toISOString();
  console.log(`[${startedAt}] Starting backup...`);
  try {
    execSync('bash scripts/backup.sh', { cwd: REPO_DIR, stdio: 'inherit' });
    console.log(`[${new Date().toISOString()}] Backup finished OK`);
  } catch (err) {
    console.error(`[${new Date().toISOString()}] Backup FAILED: ${err.message}`);
  }
}

console.log(`izyah backup-cron: schedule "${SCHEDULE}" (UTC) — override with BACKUP_SCHEDULE`);

const task = cron.schedule(SCHEDULE, runBackup, {
  name: 'izyah-backup',
  timezone: 'UTC',
  noOverlap: true,
});

task.on('execution:overlap', () => {
  console.warn(`[${new Date().toISOString()}] Skipped: previous backup was still running`);
});
