-- ============================================================
-- FARHA — Synchronisation du schéma (pochette IA + styles)
--
-- À exécuter UNIQUEMENT si votre projet Supabase existe déjà (schema.sql
-- a déjà été exécuté une première fois). Si vous créez le projet pour la
-- première fois, ignorez ce fichier : schema.sql contient déjà tout ce
-- qui suit, exécutez-le seul.
--
-- Écrit pour être rejouable sans risque (IF NOT EXISTS partout), et pour
-- ne RIEN toucher à ce qui existe déjà (colonnes image_path/video_* déjà
-- présentes en base réelle, triggers de comptage déjà en place — voir
-- schema.sql pour leur reconstruction documentée, à ne PAS rejouer ici
-- pour ne pas risquer d'écraser leur vrai comportement de production).
-- ============================================================

-- Nouveaux styles musicaux gérés par generate-lyrics/generate-music.
alter type music_style_t add value if not exists 'rap';
alter type music_style_t add value if not exists 'gnawa';

-- Traduction française des paroles (generate-lyrics).
alter table public.songs add column if not exists lyrics_fr text;

-- Pochette IA (voir generate-music/index.ts). Sans effet si la colonne
-- existe déjà sous ce nom (c'est le cas en prod au moment où ce fichier
-- est écrit).
alter table public.songs add column if not exists image_path text;

-- Horodatage de mise à jour des compteurs publics.
alter table public.site_stats add column if not exists updated_at timestamptz default now();

-- Le client peut désormais aussi modifier lyrics_fr en même temps que lyrics
-- (rejouer un GRANT est sans risque).
grant update (dialect, music_style, recipient_name, occasion, brief, lyrics, lyrics_fr, lyrics_validated_at)
  on public.songs to authenticated;

-- Buckets de stockage pour la pochette IA. Si vous stockez déjà des
-- images ailleurs (bucket existant pour image_path), NE PAS exécuter ce
-- bloc et adapter le nom de bucket utilisé dans generate-music/index.ts,
-- get-public-song/index.ts et share-meta/index.ts en conséquence.
insert into storage.buckets (id, name, public)
values ('song-covers', 'song-covers', false)
on conflict (id) do nothing;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname = 'Lecture de sa propre pochette'
  ) then
    create policy "Lecture de sa propre pochette"
      on storage.objects for select
      using (bucket_id = 'song-covers' and (storage.foldername(name))[1] = auth.uid()::text);
  end if;
end $$;
