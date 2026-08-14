-- =====================================================================
-- MIGRATION 0017 : Mode libre (chanson decrite librement par le client)
-- =====================================================================
-- Marque les chansons creees en "mode libre" (aucun preset impose).
-- Sert uniquement a l'affichage coherent (badge "Sur mesure" au lieu
-- du dialecte/style par defaut). Ecrit best-effort par generate-lyrics.
-- =====================================================================

ALTER TABLE public.songs ADD COLUMN IF NOT EXISTS free_mode boolean NOT NULL DEFAULT false;
