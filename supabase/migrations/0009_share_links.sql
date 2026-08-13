-- Table pour les liens de partage (directs et personnalisés)
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

CREATE POLICY "Users can create their own share links"
  ON share_links FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view their own share links"
  ON share_links FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Public can view share links for public access"
  ON share_links FOR SELECT
  TO anon
  USING (true);

CREATE INDEX idx_share_links_song_id ON share_links(song_id);

-- Bucket pour les photos de partage personnalisées
INSERT INTO storage.buckets (id, name, public)
VALUES ('share-photos', 'share-photos', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Authenticated users can upload share photos"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'share-photos');

CREATE POLICY "Public can view share photos"
  ON storage.objects FOR SELECT
  TO anon, authenticated
  USING (bucket_id = 'share-photos');
