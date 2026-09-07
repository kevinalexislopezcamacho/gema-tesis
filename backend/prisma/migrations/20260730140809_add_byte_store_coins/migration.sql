-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_StudentProgress" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "completedTopics" TEXT NOT NULL DEFAULT '',
    "currentTopic" TEXT,
    "totalXP" INTEGER NOT NULL DEFAULT 0,
    "level" INTEGER NOT NULL DEFAULT 1,
    "streak" INTEGER NOT NULL DEFAULT 0,
    "videosWatched" INTEGER NOT NULL DEFAULT 0,
    "chatbotSessions" INTEGER NOT NULL DEFAULT 0,
    "learningMode" TEXT NOT NULL DEFAULT 'video',
    "coins" INTEGER NOT NULL DEFAULT 0,
    "byteName" TEXT NOT NULL DEFAULT 'Byte',
    "byteColor" TEXT NOT NULL DEFAULT 'azul',
    "byteOutfit" TEXT NOT NULL DEFAULT 'ninguno',
    "byteStyle" TEXT NOT NULL DEFAULT 'feliz',
    "ownedColors" TEXT NOT NULL DEFAULT '["azul"]',
    "ownedOutfits" TEXT NOT NULL DEFAULT '["ninguno"]',
    "ownedStyles" TEXT NOT NULL DEFAULT '["feliz"]',
    "claimedAchievements" TEXT NOT NULL DEFAULT '[]',
    "lastActivityAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "StudentProgress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_StudentProgress" ("chatbotSessions", "completedTopics", "createdAt", "currentTopic", "id", "lastActivityAt", "learningMode", "level", "streak", "totalXP", "updatedAt", "userId", "videosWatched") SELECT "chatbotSessions", "completedTopics", "createdAt", "currentTopic", "id", "lastActivityAt", "learningMode", "level", "streak", "totalXP", "updatedAt", "userId", "videosWatched" FROM "StudentProgress";
DROP TABLE "StudentProgress";
ALTER TABLE "new_StudentProgress" RENAME TO "StudentProgress";
CREATE UNIQUE INDEX "StudentProgress_userId_key" ON "StudentProgress"("userId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
