-- =====================================================================
-- MIGRATION 0019 : 1re regeneration musique gratuite + mode de reference
-- =====================================================================
-- - music_regen_count : nb de regenerations de la musique deja faites.
--   La 1ere est GRATUITE, les suivantes coutent 1 credit.
-- - style_ref_mode : 'inspire' (s'inspirer du style) ou 'cover'
--   (reprendre le morceau au plus proche).
-- =====================================================================

ALTER TABLE public.songs ADD COLUMN IF NOT EXISTS music_regen_count integer NOT NULL DEFAULT 0;
ALTER TABLE public.songs ADD COLUMN IF NOT EXISTS style_ref_mode text;
