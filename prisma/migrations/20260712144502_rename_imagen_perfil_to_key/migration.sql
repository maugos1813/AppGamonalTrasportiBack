-- RenameColumn
ALTER TABLE "users" RENAME COLUMN "imagenPerfil" TO "imagenPerfilKey";

-- The old column stored a plain URL; the new one stores an internal R2 object key,
-- so any pre-existing value is not a valid key and must be cleared.
UPDATE "users" SET "imagenPerfilKey" = NULL WHERE "imagenPerfilKey" IS NOT NULL;
