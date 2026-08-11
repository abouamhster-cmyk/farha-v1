-- ============================================================
-- FARHA — Index pour le garde-fou de marge (generate-music)
-- Rejouable sans risque.
-- ============================================================

create index if not exists songs_user_id_created_at_idx on public.songs (user_id, created_at);
