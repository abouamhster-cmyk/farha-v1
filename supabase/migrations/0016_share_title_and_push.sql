-- =====================================================================
-- MIGRATION 0016 : Titre libre du partage + abonnements push
-- =====================================================================

-- 1. Titre libre choisi par le sender (remplace le gabarit generique).
ALTER TABLE share_links ADD COLUMN IF NOT EXISTS title text;

-- 2. Abonnements Web Push du createur (pour recevoir une notification
--    systeme — meme telephone verrouille — quand le destinataire ecoute).
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL UNIQUE,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user_id ON push_subscriptions(user_id);

-- L'utilisateur gere ses propres abonnements (l'ecriture reelle passe
-- surtout par l'Edge Function save-push-subscription en service_role,
-- mais on autorise aussi le client a lire/supprimer les siens).
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users manage own push subs (select)' AND tablename = 'push_subscriptions') THEN
    CREATE POLICY "Users manage own push subs (select)" ON push_subscriptions FOR SELECT TO authenticated USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users manage own push subs (delete)' AND tablename = 'push_subscriptions') THEN
    CREATE POLICY "Users manage own push subs (delete)" ON push_subscriptions FOR DELETE TO authenticated USING (auth.uid() = user_id);
  END IF;
END $$;
