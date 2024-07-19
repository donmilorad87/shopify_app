/*
  Warnings:

  - You are about to drop the column `swAdress` on the `Settings` table. All the data in the column will be lost.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Settings" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tag" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL,
    "swAddress" TEXT
);
INSERT INTO "new_Settings" ("active", "id", "tag") SELECT "active", "id", "tag" FROM "Settings";
DROP TABLE "Settings";
ALTER TABLE "new_Settings" RENAME TO "Settings";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
