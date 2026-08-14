-- =====================================================================
-- MIGRATION 0015 : Variantes liées (lignée v1/v2/v3)
-- =====================================================================
-- Une "nouvelle version" d'une chanson = une NOUVELLE ligne songs qui
-- garde l'originale intacte, reliée par filiation :
--   - parent_song_id : la chanson dont on est directement issu
--   - root_song_id   : la racine de la lignée (partagée par toutes les
--                      versions d'une meme famille) -> sert au regroupement
--   - version_number : rang dans la lignée (1, 2, 3, ...)
--
-- Ecrit par l'Edge Function create-variant (service_role) et par les
-- insertions client existantes (RLS insert "auth.uid() = user_id").
-- =====================================================================

ALTER TABLE public.songs ADD COLUMN IF NOT EXISTS parent_song_id uuid REFERENCES public.songs(id) ON DELETE SET NULL;
ALTER TABLE public.songs ADD COLUMN IF NOT EXISTS root_song_id uuid REFERENCES public.songs(id) ON DELETE SET NULL;
ALTER TABLE public.songs ADD COLUMN IF NOT EXISTS version_number integer NOT NULL DEFAULT 1;

-- Backfill : chaque chanson existante devient la racine de sa propre
-- lignée (v1), pour que la vue "Versions" fonctionne des le depart.
UPDATE public.songs SET root_song_id = id WHERE root_song_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_songs_root_song_id ON public.songs(root_song_id);
CREATE INDEX IF NOT EXISTS idx_songs_parent_song_id ON public.songs(parent_song_id);
