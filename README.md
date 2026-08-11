# Farha — Application complète (frontend + backend)

Scaffold prêt à brancher : React (Vite + Tailwind) + Supabase (Postgres, Auth, Storage, Edge
Functions). Paroles + pochette via Gemini, musique via **Google Lyria**, paiement via
Stripe/PayPal/Fedapay, e-mails via Brevo.

## Structure

```
farha-app/
  frontend/          → app React (Vite)
  supabase/
    schema.sql        → tables, RLS, triggers, RPCs — à exécuter en premier
    config.toml        → config des Edge Functions
    functions/          → une Edge Function par dossier (Deno)
    .env.example         → template des secrets serveur
```

## 1. Mettre en place Supabase

1. Créer un projet sur [supabase.com](https://supabase.com).
2. **Projet neuf (jamais initialisé)** : dans l'éditeur SQL, exécuter l'intégralité de
   `supabase/schema.sql`, puis `supabase/migrations/0002_public_stats_and_testimonials.sql`
   (dans cet ordre — le second dépend du premier). Cela crée : les tables (`profiles`,
   `songs`, `orders`, `pricing_packs`), le RLS sur chaque table, le trigger de création de
   profil (gère e-mail classique **et** Google Auth), les buckets de stockage privés
   (`song-previews`, `song-full`, `song-covers`, `song-videos`), et les RPC
   d'incrément/décrément atomique de crédits.

   **Projet déjà initialisé** (vous avez déjà exécuté `schema.sql` lors d'une session
   précédente) : n'exécutez PAS `schema.sql` une deuxième fois (les `create table` sans
   `if not exists` échoueraient). Exécutez uniquement
   `supabase/migrations/0003_covers_and_schema_sync.sql`, qui applique en sécurité les
   nouvelles colonnes (pochette IA, `lyrics_fr`, colonnes vidéo) et les nouveaux buckets
   sans toucher à ce qui existe déjà.
3. Activer **Google** comme provider dans Authentication → Providers, avec vos
   `Client ID` / `Client Secret` Google Cloud (écran de consentement OAuth configuré côté
   Google Cloud Console).
4. Installer la CLI Supabase, puis lier le projet :
   ```bash
   npm install -g supabase
   supabase login
   supabase link --project-ref <votre-ref-projet>
   ```
5. Définir les secrets des Edge Functions :
   ```bash
   cp supabase/.env.example supabase/.env
   # remplir supabase/.env avec vos vraies clés
   supabase secrets set --env-file supabase/.env
   ```
6. Déployer toutes les fonctions :
   ```bash
   supabase functions deploy generate-lyrics
   supabase functions deploy generate-music
   supabase functions deploy unlock-song
   supabase functions deploy get-download-url
   supabase functions deploy create-checkout
   supabase functions deploy stripe-webhook
   supabase functions deploy paypal-webhook
   supabase functions deploy fedapay-webhook
   supabase functions deploy send-welcome-email
   supabase functions deploy track-stat
   supabase functions deploy get-public-song
   supabase functions deploy share-meta
   ```

   `generate-video` et `check-video-status` (clip vidéo Veo pour TikTok/Reels)
   existent dans le dossier `functions/` mais ne sont **pas encore reliés au
   frontend** — à ne déployer que si vous construisez cette fonctionnalité.

### Database Webhook pour l'e-mail de bienvenue

Dans Supabase Dashboard → Database → Webhooks, créer un webhook :
- Table : `profiles`
- Évènement : `INSERT`
- Type : `HTTP Request` vers l'URL de la fonction `send-welcome-email`

C'est ce webhook qui déclenche l'e-mail Brevo une seule fois par utilisateur, que
l'inscription se fasse par e-mail ou par Google (le trigger `handle_new_user` crée le
profil dans les deux cas, donc le webhook se déclenche dans les deux cas).

### Catalogue tarifaire

Le catalogue réel n'est plus `single`/`pack3`/`pack5` à prix fixe : `pricing_packs.id` et
`orders.pack_id` sont du texte libre (plus un enum) pour ajouter/retirer une formule sans
migration de type. Formules actives en production : `pack4` (Découverte, 4 chansons,
2,99€), `pack10` (Populaire, 10, 5,99€), `pack20` (Premium, 20, 9,99€), `pack40` (VIP, 40,
19,49€) — dimensionnées pour garantir ≥50% de marge nette même sur le fournisseur de
paiement le plus cher (PayPal), voir §7 pour le détail du calcul. Les anciennes formules
restent en base (`active = false`) pour ne pas casser l'historique des commandes déjà
payées, mais ne sont plus proposées à l'achat.

### Webhooks des fournisseurs de paiement

- **Stripe** : Dashboard → Developers → Webhooks → ajouter un endpoint pointant vers
  `.../functions/v1/stripe-webhook`, évènement `checkout.session.completed`. Copier le
  secret de signature dans `STRIPE_WEBHOOK_SECRET`.
- **PayPal** : Developer Dashboard → votre app → Webhooks → ajouter
  `.../functions/v1/paypal-webhook`, évènements `CHECKOUT.ORDER.APPROVED` et
  `PAYMENT.CAPTURE.COMPLETED`. Noter le `Webhook ID` dans `PAYPAL_WEBHOOK_ID`.
- **Fedapay** : Dashboard Fedapay → Webhooks → ajouter
  `.../functions/v1/fedapay-webhook`, évènement `transaction.approved`. Configurer un
  secret partagé dans `FEDAPAY_WEBHOOK_SECRET`.

## 2. Moteur musical : Google Lyria

`generate-music` appelle l'API Gemini (`GEMINI_API_KEY`, modèles
`lyria-3-pro-preview` / `lyria-3-clip-preview`) de façon **synchrone** : la
requête HTTP reste ouverte jusqu'à ce que l'audio soit généré, stocké, et le
statut de la chanson passé à `preview_ready`. En cas d'échec Gemini, elle
retente automatiquement via Vertex AI (`GCP_PROJECT_ID` + `VERTEX_ACCESS_TOKEN`,
appel synchrone `:predict`). Il n'y a donc pas de polling côté frontend à
prévoir : la réponse de `generate-music` contient directement la chanson à
l'état `preview_ready`.

Remplacer `VERTEX_ACCESS_TOKEN` (statique, pour le dev) par un vrai échange
OAuth2 de compte de service GCP avant la mise en production — voir les
commentaires dans `generate-music/index.ts`.

**Suno a été retiré du scaffold** (précédemment branché derrière un adaptateur
`musicProviders.ts`, jamais appelé en pratique) : Suno n'a pas d'API
self-service publique, et l'ancien code assumait à tort un flux asynchrone à
base de `provider_job_id` incompatible avec le flux réellement utilisé par le
frontend. À réintroduire proprement (adaptateur + polling only si un vrai
accès partenaire Suno est obtenu, avec un flux entièrement asynchrone côté
frontend aussi).

## 3. Frontend

```bash
cd frontend
npm install
cp .env.example .env
# remplir VITE_SUPABASE_URL et VITE_SUPABASE_ANON_KEY (Project Settings → API)
npm run dev
```

Build de production : `npm run build` (sortie dans `frontend/dist/`), à déployer sur
Vercel/Netlify/Cloudflare Pages etc. Ne pas oublier de configurer `SITE_URL` côté secrets
Supabase pour qu'il pointe vers le domaine de production (utilisé dans les redirections de
paiement).

## 4. Ce qui reste à faire avant un lancement réel

- [ ] Remplacer la troncature d'extrait par octets (`generate-music/index.ts`) par un vrai
      découpage audio (ffmpeg) avec fade-out.
- [ ] Remplacer les avis clients d'exemple sur la landing page par de vrais témoignages
      (cahier des charges §6 — honnêteté, zéro faux avis).
- [ ] CGV, CGU, politique de confidentialité, mentions légales, conformité RGPD.
- [ ] Vérifier les obligations légales spécifiques Maroc/Algérie/Tunisie en plus du RGPD.
- [ ] Politique de remboursement/nouvelle tentative si la génération échoue après achat.
- [ ] Clip vidéo Veo (`generate-video`/`check-video-status`) : backend câblé et sécurisé,
      mais **volontairement non branché au frontend** (aucun bouton, aucune route ne
      l'appelle) — fonctionnalité à activer plus tard, voir §8.
- [ ] `Landing.jsx` (hero, `FAQ_ITEMS`) présente encore les clips vidéo Google Veo comme
      une fonctionnalité livrée ("Comment fonctionne la génération de Clip Vidéo par Google
      Veo ?" etc.) — corrigé sur les pages de tarification (`PricingPage.jsx`/section
      `Pricing()` de `Landing.jsx`, voir §7), mais pas sur le reste du contenu marketing de
      la landing. À corriger avant lancement pour éviter de vendre une fonctionnalité qui
      n'existe pas encore côté utilisateur.

## 5. Nettoyage effectué (voir historique de conversation)

Le scaffold contenait plusieurs générations de prototypes non nettoyées entre elles.
Ont été supprimés : pages/composants/contextes frontend orphelins d'un ancien prototype
(`CreateSongWizard`, `Pricing.jsx`, `Auth.jsx`, `Faq.jsx`, `context/AuthContext.jsx`,
`components/layout/*`, `components/ui/*`, `lib/generation.js`, une feuille de style
Tailwind v4 incompatible avec le Tailwind v3 installé), les migrations SQL d'un schéma de
prototype antérieur incompatible avec `schema.sql` (`0001_init.sql`,
`0003_fix_oauth_profile_sync.sql`), la fonction Edge dupliquée `brevo-welcome`, et le flux
de génération musicale asynchrone mort (`music-status/index.ts` +
`_shared/musicProviders.ts`, jamais appelés par le frontend, incompatibles avec le flux
synchrone réellement utilisé). Ont aussi été corrigés : `paypal-webhook` créditait
silencieusement **aucun** paiement PayPal (format de `custom_id` désynchronisé de
`create-checkout`), et `stripe-webhook`/`paypal-webhook` créaient une commande en double
au lieu de mettre à jour celle en `pending` (source de commandes fantômes dans
l'historique visible par le client). Stripe est maintenant réellement câblé côté
`create-checkout` (auparavant seul le webhook existait, sans jamais être appelable).

Pochette IA : `SongDetail.jsx` appelait un service tiers gratuit non affilié
(`image.pollinations.ai`) à chaque affichage, sans authentification, sans garantie de
disponibilité, en envoyant le contenu de la chanson à un tiers non maîtrisé. Remplacé par
une vraie génération serveur dans `generate-music/index.ts` (Gemini `gemini-2.5-flash-image`,
à partir du style musical + de l'occasion + du brief), stockée dans le bucket privé
`song-covers` et exposée par URL signée comme les extraits audio. Best-effort : un échec de
pochette (`image_path` reste `null`) n'empêche jamais la chanson d'être livrée, le frontend
affiche un visuel de repli.

Faille corrigée : `check-video-status` lisait/écrivait le statut vidéo de n'importe quelle
chanson par son `id`, sans vérifier qu'elle appartenait à l'appelant (IDOR) — corrigé en
filtrant sur `user_id`, comme le fait déjà `generate-video`.

Prix affichés désynchronisés du prix facturé : `PricingPage.jsx` et la section `Pricing()`
de `Landing.jsx` codaient les prix en dur dans un tableau JS, complètement déconnecté de
`pricing_packs` (la seule table lue par `create-checkout` pour facturer réellement). Le
repricing du §7 aurait fait payer aux clients un montant différent de celui affiché, un vrai
risque de confiance/litige. Les deux pages lisent maintenant `pricing_packs` en direct au
chargement — un futur changement de prix en base n'aura plus besoin de toucher au frontend.

Modération basique ajoutée (`_shared/moderation.ts`, liste de mots-clés — pas un vrai modèle
de modération) suite à un cas réel observé en prod : une chanson satirique sur la politique
générait des paroles sans problème, puis échouait à la génération AUDIO avec un message
technique opaque (`"Aucun modèle n'a pu générer l'audio."`) — le modèle audio de Gemini
refuse plus de sujets que le modèle de texte. Filtré maintenant à deux endroits :
`generate-lyrics` (avant même de dépenser le coût des paroles) et `generate-music` en
défense en profondeur (les paroles restent modifiables à la main côté client après
génération, donc `generate-lyrics` seul ne suffit pas). `generate-music` détecte aussi
directement un refus de sécurité dans la réponse Gemini (`finishReason`/`blockReason`) pour
les sujets que la liste de mots-clés laisserait passer, et évite dans ce cas de basculer sur
Vertex pour rien (même contenu, refus probable aussi).

**Faille critique corrigée (paywall contourné)** : la troncature de l'extrait gratuit
supposait un débit audio fixe (128kbps mp3 / 48kHz-16bit-stéréo wav) pour calculer combien
d'octets garder pour 30s. Quand le débit réel renvoyé par l'API était plus bas que supposé,
le nombre d'octets calculé pour "30s" dépassait la taille réelle du fichier entier —
`slice(0, min(taille_totale, limite_calculée))` ne tronquait alors RIEN, et l'extrait
"gratuit" contenait la chanson complète, identique au fichier payant. Observé en prod :
extrait ET version débloquée affichaient tous les deux 1:59, sans coupure. Corrigé dans
`_shared/audioTruncate.ts` : le débit réel est maintenant LU dans le fichier (header RIFF
pour le wav, header de frame MPEG pour le mp3) au lieu d'être deviné, avec un plafond de
sécurité dur à 60% de la taille du fichier — un extrait ne peut désormais plus jamais
atteindre la taille du fichier complet, même si la détection de débit se trompe (mp3 VBR
notamment, où le débit varie au cours du fichier).

⚠️ Ce fix ne corrige que les **futures** générations. Les chansons déjà générées avant ce
correctif ont un extrait déjà mal tronqué stocké dans `song-previews` — dites-le-moi si vous
voulez un script de correction ponctuel pour les régénérer rétroactivement.

**Précision a posteriori** : le "1:59 qui se coupe brutalement, identique pour l'extrait et la
version débloquée" observé en prod avait en réalité DEUX causes distinctes, pas une seule :
1. Le bug de troncature ci-dessus (corrigé).
2. **La cause principale** : l'API Lyria n'a pas de paramètre de durée dédié (voir
   [ai.google.dev/gemini-api/docs/music-generation](https://ai.google.dev/gemini-api/docs/music-generation))
   — la durée se pilote uniquement par consigne en langage naturel dans le prompt. Notre
   prompt ne demandait ni durée cible ni structure (intro/outro), donc le modèle choisissait
   sa propre durée par défaut (~2min) et pouvait s'arrêter en pleine phrase au lieu de
   conclure. **On n'imposait donc rien nulle part dans le code** — c'était une consigne
   manquante, pas une limite technique. Corrigé dans `generate-music/index.ts` : le prompt
   demande maintenant explicitement une chanson complète de 2min30-3min avec structure et
   fin naturelle. Ça reste une instruction en langage naturel (pas un paramètre API garanti à
   la seconde près), donc la durée réelle peut varier légèrement, mais ne devrait plus se
   couper au milieu.

## 6. Partage viral (mécanique de rétention/acquisition)

Chaque chanson a une page publique non listée `/ecouter/:songId` (`PublicSong.jsx`),
alimentée par la fonction publique `get-public-song` — qui ne renvoie QUE des champs sûrs
(jamais le fichier payant complet, jamais le brief brut, jamais l'identité du créateur).
Le bouton "Partager" dans `SongDetail.jsx` ne partage pas cette URL directement, mais
celle de la fonction `share-meta` : un SPA React ne peut pas avoir de belle carte
d'aperçu WhatsApp/Instagram (ces apps ne lisent que le HTML brut, sans exécuter de JS) —
`share-meta` sert donc un HTML minimal avec les balises `og:image`/`og:title` correctes
puis redirige instantanément un vrai navigateur vers la page React. C'est la boucle de
croissance principale : un destinataire de chanson qui clique devient un nouveau visiteur
avec un contexte fort ("chanson pour Yasmine") plutôt qu'un lien nu.

## 7. Marge — dimensionnement au 50% net garanti

Règle produit : **1 seule génération musique+pochette par jour et par utilisateur**
(`FREE_GENERATIONS_PER_DAY=1`), les paroles restent librement retouchables
(`MAX_REGENERATIONS=4` dans `generate-lyrics/index.ts`), l'extrait s'arrête physiquement à
30s (`PREVIEW_SECONDS` dans `generate-music/index.ts` — le fichier stocké dans
`song-previews` est tronqué à la source, pas juste caché côté UI) et la version complète
n'est lisible/téléchargeable qu'après déblocage par crédit.

**Pourquoi ce garde-fou existe** : l'extrait ET le fichier complet ET la pochette sont
générés dès la validation des paroles, **avant tout paiement**. Sans limite, un compte peut
créer un nombre illimité de chansons gratuites qui ne convertissent jamais — un coût réel
sans aucune contrepartie.

### Coût réel par chanson (source : [ai.google.dev/gemini-api/docs/pricing](https://ai.google.dev/gemini-api/docs/pricing), août 2026)

| Poste | Coût | Pire cas retenu |
|---|---|---|
| Audio (Lyria 3 Pro Preview) | 0,08 $/chanson | 0,08 $ |
| Pochette (`gemini-2.5-flash-image`) | 0,039 $/image | 0,039 $ |
| Paroles (`gemini-3.5-flash`, jusqu'à 4 régénérations) | ~0,019 $/régénération | 0,076 $ (4×) |
| Stockage + egress Supabase (cycle de vie du fichier) | — | ~0,02 $ |
| **Total pire cas / chanson (COGS)** | | **~0,22 $** |

### Formule de dimensionnement des packs

Pour un pack de **N** chansons au prix **P** (en $), avec `fee` les frais du fournisseur de
paiement, la marge nette est : `P - fee(P) - N×0,22`. Le prix plancher pour ≥50% de marge
nette est :

```
P ≥ (frais_fixe + N × 0,22) / (0,5 − frais_%)
```

Calculé pour les deux fournisseurs (Stripe : 2,9% + 0,30$ ; PayPal : 3,49% + 0,49$ — plus
cher en % ET en fixe, donc le calcul contraignant) :

| Pack | Chansons | Prix | Marge nette (Stripe) | Marge nette (PayPal) |
|---|---|---|---|---|
| Découverte | 4 | 2,99 € | ~60,6% | ~54,1% |
| Populaire | 10 | 5,99 € | ~58,5% | ~54,9% |
| Premium | 20 | 9,99 € | ~53,5% | ~51,2% |
| VIP | 40 | 19,49 € | ~55,7% | ~52,4% |

Tous les packs actifs clearent 50% de marge nette **quel que soit le fournisseur de
paiement choisi par le client** — c'est pour ça que le calcul est fait sur le pire cas
(PayPal), pas sur Stripe seul. `pack4` (2,49€ → 2,99€) et `pack40` (16,99€ → 19,49€) ont été
repricés à la hausse par rapport à la version précédente ; `pack10`/`pack20` étaient déjà
dans les clous. La dégressivité au chanson reste cohérente et monotone : 0,7475€ → 0,599€ →
0,4995€ → 0,487€ par chanson du plus petit au plus gros pack.

### Ce qui reste à évaluer

Ces chiffres supposent le **pire cas** (Lyria Pro plutôt que le fallback moins cher, 4
régénérations de paroles) — le coût réel moyen sera probablement inférieur, donc la marge
réelle observée devrait être meilleure que ce tableau. Frais Fedapay non inclus (non
documentés publiquement, à vérifier sur leur dashboard). `FREE_GENERATIONS_PER_DAY=1` est
un point de départ prudent, pas une mesure de vrai trafic — à ajuster une fois un vrai taux
de conversion observé.

## 8. Clip vidéo (Veo) — câblé mais désactivé

`generate-video` et `check-video-status` sont fonctionnels et sécurisés côté backend
(colonnes `video_*`, bucket `song-videos`, policy de lecture, vérification `user_id`), mais
**aucune route ni bouton du frontend ne les appelle** : la fonctionnalité est volontairement
hors du cycle utilisateur actuel, pour être activée plus tard sans nouvelle migration à
prévoir. Avant de la brancher au frontend : ajouter une fonction `get-video-url` (ou
réutiliser le pattern URL signée déjà en place), décider si un clip consomme un crédit
séparé ou est inclus dans le déblocage audio, et un player vidéo dans `SongDetail.jsx`.

## 9. Styles musicaux élargis & type de voix

`music_style_t` couvre maintenant 10 styles réellement écoutés/produits au Maghreb (pas une
liste exhaustive académique, une sélection volontairement restreinte à ce qui change vraiment
le rendu) : les 7 d'origine (chaâbi, raï, rap/trap, pop orientale, acoustique, gnawa,
oriental/andalou) + **mezwed** (populaire tunisien, sous-représenté avant — seul le dialecte
`tunisien` existait sans style dédié), **amazigh/berbère** (poids culturel important au
Maroc/Algérie, absent avant), et **rnb** (fusion moderne R&B/afrobeat, tendance jeune
génération). `rap` et `gnawa` existaient déjà côté backend mais n'étaient pas proposés dans
`CreateSong.jsx` — corrigé au passage.

Nouvelle dimension indépendante du style : `voice_type_t` (`homme`, `femme`, `duo`,
`choeurs`, `enfant`) — un chaâbi de mariage se chante souvent en chœur, une berceuse plutôt
en voix d'enfant ou de femme, etc. Injecté dans les deux prompts (paroles ET musique) :
`generate-lyrics` adapte la personne grammaticale ("je" masculin/féminin, "nous" pour un
chœur, dialogue alterné pour un duo), `generate-music` ajoute une consigne de voix explicite
au prompt Lyria (`VOICE_PROMPTS`). Champ `voice_type` ajouté aux mêmes GRANT que
`music_style` (colonne modifiable par le client à la création/avant validation des paroles,
comme les autres champs du brief).
