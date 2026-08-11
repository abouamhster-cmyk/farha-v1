-- ============================================================
-- FARHA — Retour à 1 seule génération/jour (abandon des 2 variations
-- au choix) + repricing pour garantir ≥50% de marge nette.
-- Voir README §7 pour le détail du calcul (coût réel API + frais Stripe/
-- PayPal, pire cas retenu volontairement sur PayPal, le plus cher).
--
-- Rejouable sans risque.
-- ============================================================

-- La colonne servait au sélecteur "2 versions au choix", abandonné : le
-- garde-fou de marge impose 1 seule génération musique/pochette par jour,
-- donc plus jamais qu'une seule variation à stocker.
alter table public.songs drop column if exists variations;

-- Repricing : pack4 (2,49€ → 2,99€) et pack40 (16,99€ → 19,49€) ne
-- garantissaient pas 50% de marge nette sur PayPal (le fournisseur le plus
-- cher) avec le vrai coût pire-cas mesuré (~0,22$/chanson). pack10/pack20
-- étaient déjà au-dessus du plancher, inchangés.
update public.pricing_packs set price_cents = 299 where id = 'pack4';
update public.pricing_packs set price_cents = 1949 where id = 'pack40';
