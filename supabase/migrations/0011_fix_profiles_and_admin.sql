-- =====================================================================
-- MIGRATION 0011 : Fix profils manquants + admin
-- Exécuter dans Supabase > SQL Editor
-- =====================================================================

-- 1. Ajouter is_admin (pour le dashboard admin)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_admin BOOLEAN NOT NULL DEFAULT false;

-- 2. Recréer le trigger de création automatique de profil
--    (au cas où il n'existe pas dans la base de production)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  resolved_name text;
  resolved_avatar text;
BEGIN
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

  INSERT INTO public.profiles (id, full_name, avatar_url)
  VALUES (new.id, coalesce(nullif(trim(resolved_name), ''), split_part(new.email, '@', 1)), resolved_avatar)
  ON CONFLICT (id) DO NOTHING;

  RETURN new;
END;
$$;

-- Supprimer l'ancien trigger s'il existe, puis le recréer
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 3. Créer les profils manquants pour tous les utilisateurs existants
--    qui n'en ont pas (ceux qui se sont inscrits avant le trigger)
INSERT INTO public.profiles (id, full_name, avatar_url)
SELECT
  u.id,
  coalesce(
    nullif(trim(coalesce(
      u.raw_user_meta_data ->> 'full_name',
      u.raw_user_meta_data ->> 'name',
      trim(coalesce(u.raw_user_meta_data ->> 'given_name', '') || ' ' ||
           coalesce(u.raw_user_meta_data ->> 'family_name', '')),
      split_part(u.email, '@', 1)
    )), ''),
    split_part(u.email, '@', 1)
  ),
  coalesce(
    u.raw_user_meta_data ->> 'avatar_url',
    u.raw_user_meta_data ->> 'picture'
  )
FROM auth.users u
LEFT JOIN public.profiles p ON p.id = u.id
WHERE p.id IS NULL;

-- 4. RLS admin (lecture cross-user pour le dashboard admin)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Admins can read all profiles' AND tablename = 'profiles'
  ) THEN
    CREATE POLICY "Admins can read all profiles"
      ON profiles FOR SELECT TO authenticated
      USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Admins can read all orders' AND tablename = 'orders'
  ) THEN
    CREATE POLICY "Admins can read all orders"
      ON orders FOR SELECT TO authenticated
      USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Admins can read all songs' AND tablename = 'songs'
  ) THEN
    CREATE POLICY "Admins can read all songs"
      ON songs FOR SELECT TO authenticated
      USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Admins can read all share_links' AND tablename = 'share_links'
  ) THEN
    CREATE POLICY "Admins can read all share_links"
      ON share_links FOR SELECT TO authenticated
      USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true));
  END IF;
END $$;

-- 5. Share links table (si pas encore créée)
CREATE TABLE IF NOT EXISTS share_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  song_id UUID NOT NULL REFERENCES songs(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  share_type TEXT NOT NULL DEFAULT 'direct' CHECK (share_type IN ('direct', 'personalized')),
  sender_name TEXT,
  message TEXT,
  photo_path TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE share_links ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Users can create their own share links' AND tablename = 'share_links'
  ) THEN
    CREATE POLICY "Users can create their own share links"
      ON share_links FOR INSERT TO authenticated
      WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Users can view their own share links' AND tablename = 'share_links'
  ) THEN
    CREATE POLICY "Users can view their own share links"
      ON share_links FOR SELECT TO authenticated
      USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Public can view share links for public access' AND tablename = 'share_links'
  ) THEN
    CREATE POLICY "Public can view share links for public access"
      ON share_links FOR SELECT TO anon
      USING (true);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_share_links_song_id ON share_links(song_id);

-- Share photos bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('share-photos', 'share-photos', true)
ON CONFLICT (id) DO NOTHING;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Authenticated users can upload share photos' AND tablename = 'objects'
  ) THEN
    CREATE POLICY "Authenticated users can upload share photos"
      ON storage.objects FOR INSERT TO authenticated
      WITH CHECK (bucket_id = 'share-photos');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Public can view share photos' AND tablename = 'objects'
  ) THEN
    CREATE POLICY "Public can view share photos"
      ON storage.objects FOR SELECT TO anon, authenticated
      USING (bucket_id = 'share-photos');
  END IF;
END $$;
