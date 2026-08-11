-- =====================================================================
-- FARHA — SCHÉMA DE BASE DE DONNÉES SUPABASE
-- =====================================================================
-- À exécuter dans l'éditeur SQL Supabase (ou via `supabase db push`).
-- Isolation stricte des données : RLS activé sur CHAQUE table dès la
-- création (voir cahier des charges §6 "La sécurité des données").
-- =====================================================================

-- ---------------------------------------------------------------------
-- EXTENSIONS
-- ---------------------------------------------------------------------
create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------
-- ENUMS
-- ---------------------------------------------------------------------
create type dialect_t as enum ('marocain', 'algerien', 'tunisien');
-- Styles réellement écoutés/produits au Maghreb (voir README §10) : les 7
-- d'origine + mezwed (tunisien), amazigh/berbère (culturellement important
-- au Maroc/Algérie) et rnb (fusion moderne prisée par la jeune génération).
create type music_style_t as enum ('chaabi', 'rai', 'rap', 'pop', 'acoustique', 'gnawa', 'oriental', 'mezwed', 'amazigh', 'rnb');
-- Type de voix — dimension indépendante du style musical (ex: chaabi peut
-- se chanter en solo homme, en duo, ou en chœur de mariage). Peu d'options
-- volontairement (voir README §10) : celles qui changent vraiment le rendu
-- perçu, pas une liste exhaustive.
create type voice_type_t as enum ('homme', 'femme', 'duo', 'choeurs', 'enfant');
create type song_status_t as enum (
  'draft',              -- brief en cours de saisie
  'lyrics_generating',  -- Gemini en cours
  'lyrics_ready',       -- paroles proposées, à valider/retoucher
  'music_generating',   -- Suno/Lyria en cours (extrait gratuit)
  'preview_ready',      -- extrait gratuit dispo, pas encore acheté
  'purchased',          -- payé, génération du fichier complet en cours
  'completed',          -- fichier complet prêt et téléchargeable
  'failed'               -- échec technique, à traiter (retry/remboursement)
);
create type music_provider_t as enum ('suno', 'lyria');
create type order_status_t as enum ('pending', 'paid', 'failed', 'refunded');
create type payment_provider_t as enum ('stripe', 'paypal', 'fedapay');
-- Pas d'enum pour les packs : "pack_id"/"pricing_packs.id" sont du texte
-- simple (voir pricing_packs plus bas), pour pouvoir ajouter/retirer une
-- formule tarifaire sans migration de type enum à chaque fois.

-- ---------------------------------------------------------------------
-- PROFILES  (1-1 avec auth.users)
-- ---------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  avatar_url text,
  welcome_email_sent boolean not null default false,
  credits integer not null default 0,   -- chansons payées non encore consommées (packs)
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "Un utilisateur voit son propre profil"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Un utilisateur modifie son propre profil"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- Pas de policy INSERT/DELETE pour les utilisateurs : la création du
-- profil passe uniquement par le trigger handle_new_user (SECURITY DEFINER).

-- ---------------------------------------------------------------------
-- TRIGGER : création automatique du profil à l'inscription
-- Gère les DEUX cas : formulaire e-mail classique ET Google OAuth,
-- dont les champs de métadonnées diffèrent (cahier des charges §8).
-- ---------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  resolved_name text;
  resolved_avatar text;
begin
  -- Cas Google OAuth : les métadonnées arrivent sous 'full_name'/'name'
  -- et 'avatar_url'/'picture' selon le provider. Cas formulaire manuel :
  -- 'full_name' est passé explicitement au moment du signUp().
  resolved_name := coalesce(
    new.raw_user_meta_data ->> 'full_name',
    new.raw_user_meta_data ->> 'name',
    trim(coalesce(new.raw_user_meta_data ->> 'given_name', '') || ' ' ||
         coalesce(new.raw_user_meta_data ->> 'family_name', '')),
    split_part(new.email, '@', 1)
  );

  resolved_avatar := coalesce(
    new.raw_user_meta_data ->> 'avatar_url',
    new.raw_user_meta_data ->> 'picture'
  );

  insert into public.profiles (id, full_name, avatar_url)
  values (new.id, nullif(trim(resolved_name), ''), resolved_avatar)
  on conflict (id) do nothing;

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------
-- SONGS
-- ---------------------------------------------------------------------
create table public.songs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,

  -- Brief utilisateur
  dialect dialect_t not null,
  music_style music_style_t not null,
  voice_type voice_type_t not null default 'homme',
  recipient_name text,
  occasion text,
  brief text not null,

  -- Paroles (Gemini)
  lyrics text,
  lyrics_fr text,                              -- traduction française, générée en même temps que la darija
  lyrics_version integer not null default 0,   -- incrémenté à chaque régénération
  lyrics_validated_at timestamptz,

  -- Musique
  music_provider music_provider_t,
  provider_job_id text,                        -- id de tâche côté Suno/Lyria
  preview_audio_path text,                      -- chemin storage bucket PRIVÉ 'song-previews'
  full_audio_path text,                         -- chemin storage bucket PRIVÉ 'song-full' (débloqué après achat)
  duration_seconds integer,

  -- Pochette (Gemini, générée à partir du style/occasion/brief de la chanson)
  -- Best-effort : un échec de génération de pochette ne doit jamais faire
  -- échouer la chanson elle-même (voir generate-music/index.ts). Pas de
  -- colonne de statut séparée : image_path null = pas de pochette (le
  -- frontend affiche un visuel de repli), non-null = pochette disponible.
  image_path text,                              -- chemin storage bucket PRIVÉ 'song-covers'

  -- Clip vidéo (Google Veo) — fonctionnalité optionnelle, PAS ENCORE reliée au
  -- frontend (voir generate-video/check-video-status). Colonnes présentes pour
  -- que ces deux Edge Functions ne cassent pas si on les appelle manuellement,
  -- mais aucune UI ne les déclenche pour l'instant. Pas de contrainte CHECK
  -- stricte sur video_status pour rester permissif tant que la fonctionnalité
  -- est expérimentale.
  video_status text default 'idle',
  video_operation_name text,
  video_path text,                              -- chemin storage bucket PRIVÉ 'song-videos'

  status song_status_t not null default 'draft',
  failure_reason text,

  order_id uuid,  -- rempli une fois rattaché à une commande payée (FK ajoutée plus bas)

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.songs enable row level security;

create policy "Un utilisateur voit ses propres chansons"
  on public.songs for select
  using (auth.uid() = user_id);

create policy "Un utilisateur crée ses propres chansons"
  on public.songs for insert
  with check (auth.uid() = user_id);

create policy "Un utilisateur modifie ses propres chansons en brouillon"
  on public.songs for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Un utilisateur supprime ses propres brouillons"
  on public.songs for delete
  using (auth.uid() = user_id and status = 'draft');

-- Toute écriture liée à l'IA, au statut de paiement ou au déblocage du
-- fichier complet passe par les Edge Functions avec la service_role key
-- (qui contourne RLS) — jamais directement depuis le navigateur.

-- DURCISSEMENT COLONNE PAR COLONNE : le RLS ci-dessus n'empêche pas un
-- utilisateur d'appeler l'API REST Supabase directement et de modifier
-- N'IMPORTE QUELLE colonne de SA PROPRE ligne — y compris "status" ou
-- "order_id", ce qui permettrait de se déclarer "completed" sans payer.
-- On retire les privilèges larges accordés par défaut au rôle
-- "authenticated" et on ne réautorise que les colonnes que l'utilisateur
-- a légitimement le droit de modifier lui-même. Tout le reste (status,
-- lyrics via IA, music_provider, provider_job_id, chemins de stockage,
-- order_id, failure_reason) ne peut être écrit que par les Edge
-- Functions via la service_role key, qui contourne ces privilèges.
revoke insert, update on public.songs from authenticated;

grant insert (user_id, dialect, music_style, voice_type, recipient_name, occasion, brief)
  on public.songs to authenticated;

grant update (dialect, music_style, voice_type, recipient_name, occasion, brief, lyrics, lyrics_fr, lyrics_validated_at)
  on public.songs to authenticated;

-- Même logique sur profiles : un utilisateur peut renommer son profil,
-- mais jamais s'auto-créditer des chansons.
revoke update on public.profiles from authenticated;
grant update (full_name, avatar_url) on public.profiles to authenticated;

-- ---------------------------------------------------------------------
-- PRICING PACKS (catalogue, lecture publique)
-- ---------------------------------------------------------------------
create table public.pricing_packs (
  id text primary key,
  label text not null,
  song_count integer not null,
  price_cents integer not null,
  currency text not null default 'EUR',
  active boolean not null default true
);

alter table public.pricing_packs enable row level security;

create policy "Tout le monde peut lire les tarifs actifs"
  on public.pricing_packs for select
  using (active = true);

-- Catalogue dimensionné pour garantir ≥50% de marge nette même sur le
-- fournisseur de paiement le plus cher (PayPal : 3,49% + 0,49$, contre
-- Stripe 2,9% + 0,30$), en pire cas de coût de génération (~0,22$/chanson :
-- Lyria Pro 0,08$ + pochette 0,039$ + 4 régénérations de paroles 0,076$ +
-- stockage ~0,02$). Détail du calcul : voir README §7 "Marge". single/pack3/
-- pack5 désactivés (dégressivité par volume plus travaillée les remplace),
-- gardés en base pour ne pas casser l'historique de commandes déjà payées.
insert into public.pricing_packs (id, label, song_count, price_cents, currency, active) values
  ('single', 'À l''unité', 1, 299, 'EUR', false),
  ('pack3',  'Pack 3 Chansons', 3, 799, 'EUR', false),
  ('pack5',  'Pack Fête', 5, 1199, 'EUR', false),
  ('pack4',  'Découverte', 4, 299, 'EUR', true),
  ('pack10', 'Populaire', 10, 599, 'EUR', true),
  ('pack20', 'Premium', 20, 999, 'EUR', true),
  ('pack40', 'VIP', 40, 1949, 'EUR', true)
on conflict (id) do update set
  label = excluded.label,
  song_count = excluded.song_count,
  price_cents = excluded.price_cents,
  currency = excluded.currency,
  active = excluded.active;

-- ---------------------------------------------------------------------
-- ORDERS  (source de vérité du paiement — jamais créditée deux fois)
-- ---------------------------------------------------------------------
create table public.orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  pack_id text not null references public.pricing_packs(id),

  provider payment_provider_t not null,
  provider_session_id text,          -- id session Stripe Checkout / order PayPal / transaction Fedapay
  provider_event_id text,            -- id évènement webhook (clé d'idempotence)

  amount_cents integer not null,
  currency text not null default 'EUR',
  status order_status_t not null default 'pending',

  songs_granted integer not null,     -- = song_count du pack au moment de l'achat
  songs_consumed integer not null default 0,

  created_at timestamptz not null default now(),
  paid_at timestamptz
);

-- Idempotence dure au niveau base : un même évènement webhook du même
-- fournisseur ne peut jamais créer deux lignes (cahier des charges §6
-- "La fiabilité du paiement").
create unique index orders_provider_event_unique
  on public.orders (provider, provider_event_id)
  where provider_event_id is not null;

alter table public.orders enable row level security;

create policy "Un utilisateur voit ses propres commandes"
  on public.orders for select
  using (auth.uid() = user_id);

-- Aucune policy INSERT/UPDATE cote client : uniquement via Edge
-- Functions (service_role), déclenchées par les webhooks des
-- fournisseurs de paiement, jamais depuis le navigateur.

alter table public.songs
  add constraint songs_order_id_fkey
  foreign key (order_id) references public.orders(id) on delete set null;

-- ---------------------------------------------------------------------
-- FONCTION UTILITAIRE : updated_at automatique
-- ---------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger songs_set_updated_at
  before update on public.songs
  for each row execute function public.set_updated_at();

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- RPCs : incréments atomiques (évitent les races entre webhooks
-- concurrents ou doubles clics sur "débloquer")
-- ---------------------------------------------------------------------
create or replace function public.increment_profile_credits(p_user_id uuid, p_amount integer)
returns void
language sql
security definer
set search_path = public
as $$
  update public.profiles set credits = credits + p_amount where id = p_user_id;
$$;

-- Consomme 1 crédit de manière atomique. Retourne true si un crédit a
-- effectivement été consommé (false si le solde était déjà à 0).
create or replace function public.consume_profile_credit(p_user_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  affected integer;
begin
  update public.profiles
  set credits = credits - 1
  where id = p_user_id and credits > 0;

  get diagnostics affected = row_count;
  return affected > 0;
end;
$$;

-- ---------------------------------------------------------------------
-- STORAGE BUCKETS
-- ---------------------------------------------------------------------
-- 'song-previews' : bucket PRIVÉ. L'extrait gratuit reste protégé
--   derrière une URL signée à courte durée pour éviter le scraping en
--   masse, mais est accessible à tout utilisateur connecté propriétaire
--   de la chanson, sans vérification d'achat.
-- 'song-full'     : bucket PRIVÉ. Le fichier complet n'est JAMAIS
--   accessible par URL directe : uniquement via la Edge Function
--   get-download-url, qui vérifie server-side que la commande est payée
--   (cahier des charges §6 "La protection du fichier payant").
insert into storage.buckets (id, name, public)
values ('song-previews', 'song-previews', false)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('song-full', 'song-full', false)
on conflict (id) do nothing;

-- 'song-covers'  : bucket PRIVÉ pour les pochettes générées par IA (Gemini,
--   voir generate-music/index.ts). Pas de paywall dessus (la pochette reste
--   visible même sur l'extrait gratuit, pour donner envie d'acheter) : même
--   régime d'accès que 'song-previews', lecture directe par le propriétaire
--   via URL signée côté client.
insert into storage.buckets (id, name, public)
values ('song-covers', 'song-covers', false)
on conflict (id) do nothing;

-- 'song-videos' : bucket PRIVÉ pour les clips Veo (voir colonnes video_* sur
-- 'songs' ci-dessus). Fonctionnalité câblée côté backend mais volontairement
-- non appelée par le frontend pour l'instant (à activer plus tard) — voir
-- README §4. Policy de lecture posée dès maintenant pour que l'activation
-- future n'ait pas de migration supplémentaire à faire.
insert into storage.buckets (id, name, public)
values ('song-videos', 'song-videos', false)
on conflict (id) do nothing;

-- Le chemin de chaque fichier est préfixé par l'user_id (ex: <user_id>/<song_id>.mp3),
-- ce qui permet des policies simples et sûres basées sur le chemin.
create policy "Lecture de son propre extrait"
  on storage.objects for select
  using (bucket_id = 'song-previews' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "Lecture de sa propre pochette"
  on storage.objects for select
  using (bucket_id = 'song-covers' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "Lecture de sa propre vidéo"
  on storage.objects for select
  using (bucket_id = 'song-videos' and (storage.foldername(name))[1] = auth.uid()::text);

-- Aucune policy de lecture client sur 'song-full' : uniquement via
-- Edge Function avec service_role + URL signée temporaire.

-- ---------------------------------------------------------------------
-- INDEXES
-- ---------------------------------------------------------------------
create index songs_user_id_idx on public.songs (user_id);
-- Sert le comptage "générations gratuites des dernières 24h" dans
-- generate-music (garde-fou de marge, voir README §9).
create index songs_user_id_created_at_idx on public.songs (user_id, created_at);
create index songs_status_idx on public.songs (status);
create index orders_user_id_idx on public.orders (user_id);
create index orders_status_idx on public.orders (status);

-- ---------------------------------------------------------------------
-- COMPTEURS PUBLICS (visites landing, chansons créées, téléchargements)
-- Lecture publique (landing page), écriture uniquement via Edge Function
-- avec service_role (pas de manipulation côté client).
-- ---------------------------------------------------------------------
create table public.site_stats (
  key text primary key,
  value bigint not null default 0,
  updated_at timestamptz default now()
);

alter table public.site_stats enable row level security;

create policy "Lecture publique des stats"
  on public.site_stats for select
  using (true);

-- Valeurs initiales (à ajuster manuellement en prod si des données
-- existent déjà avant le lancement du système de comptage).
insert into public.site_stats (key, value) values
  ('landing_visits', 0),
  ('songs_created',  0),
  ('downloads',      0),
  ('users_count',    0)
on conflict (key) do nothing;

-- RPC atomique pour incrémenter sans race condition.
create or replace function public.increment_stat(p_key text, p_amount bigint default 1)
returns bigint
language sql
security definer
set search_path = public
as $$
  update public.site_stats set value = value + p_amount where key = p_key
  returning value;
$$;

-- ---------------------------------------------------------------------
-- RECONSTRUCTION — à vérifier contre la base réelle avant de faire
-- confiance à ce fichier comme source de vérité à 100%.
--
-- Ces 3 fonctions/triggers existent déjà sur la base de production mais
-- n'apparaissaient dans aucun fichier du repo avant ce commit (découvert
-- en comparant le schéma réel exporté depuis Supabase à ce fichier). Elles
-- sont reconstituées ici par déduction à partir de leur nom et du RPC
-- increment_stat ci-dessus, PAS copiées depuis la vraie définition. Si le
-- comportement observé en prod diffère (notamment la condition exacte de
-- "téléchargement" ci-dessous), remplacez ce bloc par le résultat de :
--   select proname, pg_get_functiondef(oid)
--   from pg_proc
--   where proname in ('trig_increment_user_count', 'trig_increment_song_count', 'trig_increment_download_count')
--     and pronamespace = 'public'::regnamespace;
-- ---------------------------------------------------------------------
create or replace function public.trig_increment_user_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.increment_stat('users_count', 1);
  return new;
end;
$$;

create or replace function public.trig_increment_song_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.increment_stat('songs_created', 1);
  return new;
end;
$$;

-- Hypothèse : un "téléchargement" correspond à la transition de statut
-- vers 'completed' (déblocage payant), seule transition observable dans
-- 'songs' qui s'en approche — à confirmer, ce n'est peut-être pas ce que
-- fait la vraie fonction en prod.
create or replace function public.trig_increment_download_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'completed' and old.status is distinct from 'completed' then
    perform public.increment_stat('downloads', 1);
  end if;
  return new;
end;
$$;

create trigger on_real_user_created
  after insert on public.profiles
  for each row execute function public.trig_increment_user_count();

create trigger on_real_song_created
  after insert on public.songs
  for each row execute function public.trig_increment_song_count();

create trigger on_real_song_downloaded
  after update on public.songs
  for each row execute function public.trig_increment_download_count();
