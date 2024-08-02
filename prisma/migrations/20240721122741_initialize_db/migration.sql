-- CreateTable
CREATE TABLE "Carousel" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "images" TEXT NOT NULL,
    "audio" TEXT NOT NULL,
    "postId" INTEGER,
    CONSTRAINT "Carousel_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Video" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "url" TEXT NOT NULL,
    "postId" INTEGER,
    CONSTRAINT "Video_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Post" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "author" TEXT NOT NULL,
    "authorImage" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "tiktokId" TEXT NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "Carousel_postId_key" ON "Carousel"("postId");

-- CreateIndex
CREATE UNIQUE INDEX "Video_postId_key" ON "Video"("postId");

-- CreateIndex
CREATE UNIQUE INDEX "Post_tiktokId_key" ON "Post"("tiktokId");
