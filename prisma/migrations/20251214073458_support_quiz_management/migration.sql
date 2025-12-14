/*
  Warnings:

  - You are about to drop the column `quizId` on the `Question` table. All the data in the column will be lost.

*/
-- CreateTable
CREATE TABLE "QuizQuestion" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "quizId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "QuizQuestion_quizId_fkey" FOREIGN KEY ("quizId") REFERENCES "Quiz" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "QuizQuestion_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Question" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "questionText" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "isStarred" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "Question_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Question" ("authorId", "createdAt", "id", "isStarred", "questionText", "subject", "updatedAt") SELECT "authorId", "createdAt", "id", "isStarred", "questionText", "subject", "updatedAt" FROM "Question";
DROP TABLE "Question";
ALTER TABLE "new_Question" RENAME TO "Question";
CREATE TABLE "new_Quiz" (
    "id" TEXT NOT NULL PRIMARY KEY,
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
INSERT INTO "new_Quiz" ("authorId", "createdAt", "description", "id", "name", "updatedAt") SELECT "authorId", "createdAt", "description", "id", "name", "updatedAt" FROM "Quiz";
DROP TABLE "Quiz";
ALTER TABLE "new_Quiz" RENAME TO "Quiz";
PRAGMA foreign_key_check;
PRAGMA foreign_keys=ON;

-- CreateIndex
CREATE UNIQUE INDEX "QuizQuestion_quizId_questionId_key" ON "QuizQuestion"("quizId", "questionId");
