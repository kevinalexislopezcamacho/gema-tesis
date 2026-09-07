-- AlterTable
ALTER TABLE "StudentTopicSkill" ADD COLUMN "examPassed" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "StudentTopicSkill" ADD COLUMN "examBestScore" REAL;
ALTER TABLE "StudentTopicSkill" ADD COLUMN "examAttempts" INTEGER NOT NULL DEFAULT 0;
