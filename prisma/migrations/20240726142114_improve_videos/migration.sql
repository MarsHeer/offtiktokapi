/*
  Warnings:

  - You are about to drop the column `url` on the `Video` table. All the data in the column will be lost.
  - Added the required column `hlsURL` to the `Video` table without a default value. This is not possible if the table is not empty.
  - Added the required column `mp4URL` to the `Video` table without a default value. This is not possible if the table is not empty.
  - Added the required column `thumbnail` to the `Video` table without a default value. This is not possible if the table is not empty.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Video" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "mp4URL" TEXT NOT NULL,
    "hlsURL" TEXT NOT NULL,
    "thumbnail" TEXT NOT NULL,
    "postId" INTEGER,
    CONSTRAINT "Video_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Video" ("id", "postId") SELECT "id", "postId" FROM "Video";
DROP TABLE "Video";
ALTER TABLE "new_Video" RENAME TO "Video";
CREATE UNIQUE INDEX "Video_postId_key" ON "Video"("postId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
