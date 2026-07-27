-- AlterTable
ALTER TABLE "events" ADD COLUMN     "reminderLeadMinutes" INTEGER DEFAULT 120,
ADD COLUMN     "reminderSentAt" TIMESTAMP(3);
