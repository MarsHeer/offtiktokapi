/*
  Warnings:

  - You are about to drop the column `hlsURL` on the `Video` table. All the data in the column will be lost.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Video" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "mp4URL" TEXT NOT NULL,
    "thumbnail" TEXT,
    "postId" INTEGER,
    CONSTRAINT "Video_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Video" ("id", "mp4URL", "postId", "thumbnail") SELECT "id", "mp4URL", "postId", "thumbnail" FROM "Video";
DROP TABLE "Video";
ALTER TABLE "new_Video" RENAME TO "Video";
CREATE UNIQUE INDEX "Video_postId_key" ON "Video"("postId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
