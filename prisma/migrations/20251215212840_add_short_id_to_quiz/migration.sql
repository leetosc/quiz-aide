/*
  Warnings:

  - Added the required column `shortId` to the `Quiz` table without a default value. This is not possible if the table is not empty.

*/
-- RedefineTables
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Quiz" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shortId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "topic" TEXT,
    "timeLimit" INTEGER NOT NULL DEFAULT 20,
    "difficulty" TEXT,
    "authorId" TEXT NOT NULL,
    CONSTRAINT "Quiz_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Quiz" ("authorId", "createdAt", "description", "difficulty", "id", "name", "timeLimit", "topic", "updatedAt") SELECT "authorId", "createdAt", "description", "difficulty", "id", "name", "timeLimit", "topic", "updatedAt" FROM "Quiz";
DROP TABLE "Quiz";
ALTER TABLE "new_Quiz" RENAME TO "Quiz";
CREATE UNIQUE INDEX "Quiz_shortId_key" ON "Quiz"("shortId");
PRAGMA foreign_key_check;
PRAGMA foreign_keys=ON;
