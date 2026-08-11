-- ============================================================
-- FARHA — Ajouts pour restaurer honnêtement les fonctionnalités
-- retirées par erreur : compteur live et carrousel d'avis.
-- Au lieu de les supprimer, on les rend réels.
--
-- ORDRE D'EXÉCUTION : à exécuter APRÈS schema.sql (dépend de la table
-- public.songs). Les migrations 0001 et 0003 ont été supprimées : elles
-- décrivaient un schéma de prototype antérieur (profiles.first_name,
-- table credits, songs.audio_url...) incompatible avec schema.sql, qui
-- est la source de vérité unique du schéma — voir README §1.
-- ============================================================

-- ------------------------------------------------------------
-- Compteur public de chansons créées, basé sur les vraies données.
-- SECURITY DEFINER : contourne volontairement RLS pour ne renvoyer
-- qu'un NOMBRE agrégé (aucune donnée individuelle), consultable par
-- n'importe quel visiteur non connecté sur la Landing.
-- ------------------------------------------------------------
create or replace function public.get_public_song_count()
returns integer
language sql
security definer
set search_path = public
as $$
  select count(*)::integer from public.songs where status = 'completed';
$$;

grant execute on function public.get_public_song_count() to anon, authenticated;

-- ------------------------------------------------------------
-- Témoignages — table vide au départ. Remplie manuellement (dashboard
-- Supabase ou back-office futur) avec de VRAIS avis clients au fur et
-- à mesure. Le client ne peut jamais insérer lui-même un témoignage :
-- ça évite les faux avis auto-postés, en plus d'éviter d'en inventer
-- côté code.
-- ------------------------------------------------------------
create table public.testimonials (
  id uuid primary key default gen_random_uuid(),
  author_name text not null,
  author_location text not null default '',
  quote text not null,
  is_published boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.testimonials enable row level security;

create policy "testimonials_select_published" on public.testimonials
  for select using (is_published = true);

-- Aucun GRANT insert/update/delete pour authenticated/anon : uniquement
-- géré via le dashboard Supabase (service_role) par vous.
