-- =====================================================================
-- MIGRATION 0020 : Instrumental (jingle / musique sans paroles)
-- =====================================================================
-- L'utilisateur decrit librement l'instrumental voulu (type, ambiance,
-- instruments, usage). Pas de paroles, pas de voix, pas de dialecte.
-- generate-music compose un morceau instrumental.
-- =====================================================================

ALTER TABLE public.songs ADD COLUMN IF NOT EXISTS instrumental boolean NOT NULL DEFAULT false;
