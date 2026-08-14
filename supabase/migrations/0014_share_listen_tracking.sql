-- =====================================================================
-- MIGRATION 0014 : Suivi des écoutes des liens de partage + notif
-- =====================================================================
-- Permet d'informer le créateur quand le destinataire écoute la chanson
-- partagée. Ecrit uniquement par l'Edge Function track-share-listen
-- (service_role) ; aucune écriture client.
-- =====================================================================

ALTER TABLE share_links ADD COLUMN IF NOT EXISTS listen_count integer NOT NULL DEFAULT 0;
ALTER TABLE share_links ADD COLUMN IF NOT EXISTS first_listened_at timestamptz;
ALTER TABLE share_links ADD COLUMN IF NOT EXISTS last_notified_at timestamptz;
