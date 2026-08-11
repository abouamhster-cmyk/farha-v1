-- ============================================================
-- FARHA — Variations multiples par génération (2 versions au choix)
--
-- Rejouable sans risque (IF NOT EXISTS). Aucun GRANT client nécessaire :
-- cette colonne n'est écrite que par generate-music et select-song-variation
-- (service_role), jamais depuis le navigateur.
-- ============================================================

alter table public.songs add column if not exists variations jsonb;
