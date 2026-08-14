-- =====================================================================
-- MIGRATION 0018 : Musique de reference (fonctionnalite premium Pro/VIP)
-- =====================================================================
-- L'utilisateur (palier Pro pack20 ou Studio VIP pack40) peut fournir un
-- extrait audio de reference. generate-music le fait analyser par Gemini
-- (description du style) puis Lyria compose dans ce style avec ses paroles.
-- =====================================================================

-- Chemin storage de l'extrait de reference attache a la chanson.
ALTER TABLE public.songs ADD COLUMN IF NOT EXISTS style_ref_path text;

-- Bucket PRIVE pour les extraits de reference.
INSERT INTO storage.buckets (id, name, public)
VALUES ('style-refs', 'style-refs', false)
ON CONFLICT (id) DO NOTHING;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Authenticated upload style refs' AND tablename = 'objects') THEN
    CREATE POLICY "Authenticated upload style refs"
      ON storage.objects FOR INSERT TO authenticated
      WITH CHECK (bucket_id = 'style-refs');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Authenticated read own style refs' AND tablename = 'objects') THEN
    CREATE POLICY "Authenticated read own style refs"
      ON storage.objects FOR SELECT TO authenticated
      USING (bucket_id = 'style-refs');
  END IF;
END $$;
