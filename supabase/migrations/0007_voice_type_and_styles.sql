-- ============================================================
-- FARHA — Styles musicaux élargis + type de voix (voir README §10)
-- Rejouable sans risque.
-- ============================================================

alter type music_style_t add value if not exists 'mezwed';
alter type music_style_t add value if not exists 'amazigh';
alter type music_style_t add value if not exists 'rnb';

do $$
begin
  if not exists (select 1 from pg_type where typname = 'voice_type_t') then
    create type voice_type_t as enum ('homme', 'femme', 'duo', 'choeurs', 'enfant');
  end if;
end $$;

alter table public.songs add column if not exists voice_type voice_type_t not null default 'homme';

grant update (dialect, music_style, voice_type, recipient_name, occasion, brief, lyrics, lyrics_fr, lyrics_validated_at)
  on public.songs to authenticated;

grant insert (user_id, dialect, music_style, voice_type, recipient_name, occasion, brief)
  on public.songs to authenticated;
