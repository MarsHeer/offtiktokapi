-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Post" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "authorId" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "tiktokId" TEXT NOT NULL,
    "postDescription" TEXT,
    "originalURL" TEXT NOT NULL DEFAULT '',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "Post_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "Author" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Post" ("authorId", "createdAt", "id", "originalURL", "postDescription", "tiktokId", "type") SELECT "authorId", "createdAt", "id", "originalURL", "postDescription", "tiktokId", "type" FROM "Post";
DROP TABLE "Post";
ALTER TABLE "new_Post" RENAME TO "Post";
CREATE UNIQUE INDEX "Post_tiktokId_key" ON "Post"("tiktokId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
