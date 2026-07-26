-- Enforce one vote per user per POLL, not just per option: the old
-- (optionId, userId) unique constraint let a single transient race (two
-- concurrent vote requests for the same poll, different options) leave a
-- user with two ballots in the same poll. `pollId` is denormalized onto
-- poll_votes so the constraint can cover the whole poll directly.

-- AlterTable: add the column nullable first so it can be backfilled.
ALTER TABLE "poll_votes" ADD COLUMN "pollId" UUID;

-- Backfill from each vote's option.
UPDATE "poll_votes" pv
SET "pollId" = po."pollId"
FROM "poll_options" po
WHERE po."id" = pv."optionId";

ALTER TABLE "poll_votes" ALTER COLUMN "pollId" SET NOT NULL;

-- DropIndex (superseded by the pollId-based unique index below)
DROP INDEX "poll_votes_optionId_userId_key";

-- CreateIndex
CREATE UNIQUE INDEX "poll_votes_pollId_userId_key" ON "poll_votes"("pollId", "userId");

-- CreateIndex
CREATE INDEX "poll_votes_optionId_idx" ON "poll_votes"("optionId");
