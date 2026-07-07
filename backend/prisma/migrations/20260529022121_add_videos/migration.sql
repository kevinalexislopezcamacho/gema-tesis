-- CreateTable
CREATE TABLE "Video" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "titulo" TEXT NOT NULL,
    "tema" TEXT NOT NULL,
    "subtema" TEXT NOT NULL,
    "nivel" TEXT NOT NULL DEFAULT 'medio',
    "duracionEstimada" TEXT NOT NULL DEFAULT '2-4 minutos',
    "filename" TEXT NOT NULL,
    "videoUrl" TEXT NOT NULL,
    "slides" INTEGER NOT NULL DEFAULT 5,
    "status" TEXT NOT NULL DEFAULT 'ready',
    "createdBy" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
