-- =====================================================================
-- MIGRATION 0013 : Historique des paroles (itération gratuite)
-- =====================================================================
-- Les paroles sont gratuites : a chaque régénération, on empile la
-- version précédente dans lyrics_history pour pouvoir revenir en
-- arrière sans rien perdre. Ecrit uniquement par generate-lyrics
-- (service_role) ; aucune écriture client, donc aucune policy a ajouter.
--
-- Format d'une entrée :
--   { "lyrics": "...", "lyrics_fr": "...", "version": 1,
--     "saved_at": "2026-08-14T10:00:00Z" }
-- =====================================================================

ALTER TABLE public.songs ADD COLUMN IF NOT EXISTS lyrics_history jsonb NOT NULL DEFAULT '[]'::jsonb;
