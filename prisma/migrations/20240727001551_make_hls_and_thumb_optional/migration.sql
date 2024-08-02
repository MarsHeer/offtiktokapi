-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Video" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "mp4URL" TEXT NOT NULL,
    "hlsURL" TEXT,
    "thumbnail" TEXT,
    "postId" INTEGER,
    CONSTRAINT "Video_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Video" ("hlsURL", "id", "mp4URL", "postId", "thumbnail") SELECT "hlsURL", "id", "mp4URL", "postId", "thumbnail" FROM "Video";
DROP TABLE "Video";
ALTER TABLE "new_Video" RENAME TO "Video";
CREATE UNIQUE INDEX "Video_postId_key" ON "Video"("postId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
