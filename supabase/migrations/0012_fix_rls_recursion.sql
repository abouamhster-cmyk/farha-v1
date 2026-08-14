-- =====================================================================
-- MIGRATION 0012 : CORRECTIF CRITIQUE - recursion infinie RLS
-- =====================================================================
-- Les policies "Admins can read all ..." ajoutees en 0011 font un
-- SELECT sur profiles a l'interieur de leur clause USING. Comme la
-- policy est elle-meme sur profiles, Postgres detecte une RECURSION
-- INFINIE (erreur 42P17) et TOUTES les requetes sur profiles echouent.
--
-- Resultat : plus aucun profil ne se charge -> tous les utilisateurs
-- voient le fallback "Mon compte / 0 credits".
--
-- Ces policies sont INUTILES : le dashboard admin passe par les Edge
-- Functions (admin-stats, admin-ai-suggestions) qui utilisent la
-- service_role key et contournent deja le RLS. On les supprime donc.
-- =====================================================================

DROP POLICY IF EXISTS "Admins can read all profiles" ON profiles;
DROP POLICY IF EXISTS "Admins can read all orders" ON orders;
DROP POLICY IF EXISTS "Admins can read all songs" ON songs;
DROP POLICY IF EXISTS "Admins can read all share_links" ON share_links;

-- Verification : lister les policies restantes sur profiles
-- (doit contenir uniquement les policies utilisateur "own profile")
-- SELECT policyname FROM pg_policies WHERE tablename = 'profiles';
