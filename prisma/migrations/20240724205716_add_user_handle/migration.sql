-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Author" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "tiktokId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "handle" TEXT NOT NULL DEFAULT '',
    "image" TEXT NOT NULL
);
INSERT INTO "new_Author" ("id", "image", "name", "tiktokId") SELECT "id", "image", "name", "tiktokId" FROM "Author";
DROP TABLE "Author";
ALTER TABLE "new_Author" RENAME TO "Author";
CREATE UNIQUE INDEX "Author_tiktokId_key" ON "Author"("tiktokId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
