-- Ajouter les colonnes de bénéfices par plan aux pricing_packs
ALTER TABLE pricing_packs
  ADD COLUMN IF NOT EXISTS max_duration_seconds integer NOT NULL DEFAULT 60,
  ADD COLUMN IF NOT EXISTS support_tier text NOT NULL DEFAULT 'email_48h',
  ADD COLUMN IF NOT EXISTS commercial_use boolean NOT NULL DEFAULT false;

-- Mettre à jour les valeurs par plan
UPDATE pricing_packs SET max_duration_seconds = 90,  support_tier = 'email_48h',     commercial_use = false WHERE id = 'pack4';
UPDATE pricing_packs SET max_duration_seconds = 120, support_tier = 'email_24h',     commercial_use = false WHERE id = 'pack10';
UPDATE pricing_packs SET max_duration_seconds = 150, support_tier = 'priority_12h',  commercial_use = true  WHERE id = 'pack20';
UPDATE pricing_packs SET max_duration_seconds = 180, support_tier = 'whatsapp_7j7',  commercial_use = true  WHERE id = 'pack40';

-- Les anciens packs inactifs gardent les valeurs par défaut (90s, email_48h, false)
