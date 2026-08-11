import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { supabase, callFunction } from "../lib/supabaseClient.js";

// --- IMAGES DU DIAPORAMA DE FOND HERO ---
const HERO_SLIDES = [
  "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?auto=format&fit=crop&w=1800&q=80",
  "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=1800&q=80",
  "https://images.unsplash.com/photo-1519741497674-611481863552?auto=format&fit=crop&w=1800&q=80",
  "https://images.unsplash.com/photo-1530103862676-de8c9debad1d?auto=format&fit=crop&w=1800&q=80",
];

// --- MOTS DYNAMIQUES DU HERO (CENTRÉS SUR LA MUSIQUE) ---
const DYNAMIC_WORDS = [
  "vos vidéos TikTok & Reels",
  "vos publicités & e-commerce",
  "vos sons d'humour & memes",
  "vos vlogs & storytimes",
  "vos mariages & soirées",
  "vos anniversaires & fêtes",
];

// --- VOS VRAIS FICHIERS AUDIO LOCAUX ---
const AUDIO_CARDS = [
  {
    id: 1,
    title: "Pour l'anniversaire de son Enfant (10 ans)",
    meta: "Darija Marocain · Pop Joyeuse",
    quote: "عيد ميلاد سعيد لولدي الغالي، عشر سنين أمل وفرحة في حياتنا...",
    bg: "/images/tiktok.png",
    audio: "/audios/tiktok.mp3"
  },
  {
    id: 2,
    title: "Pub Instagram Marque 'Atlas Wear'",
    meta: "Égyptien Masri · Pop Orientale",
    quote: "يا جمالو يا حلاوتو، اللبس الشيك وصل عندنا...",
    bg: "/images/pub.png",
    audio: "/audios/pub.mp3"
  },
  {
    id: 3,
    title: "Anniversaire Youssef (30 ans)",
    meta: "Darija Marocain · Chaâbi",
    quote: "يوسف يا خويا العزيز، ثلاثين سنة كملتيها بالخير...",
    bg: "/images/anniversaire_maroc.png",
    audio: "/audios/anniversaire_maroc.mp3"
  },
  {
    id: 4,
    title: "Anniversaire Amine (Raï Festif)",
    meta: "Darija Algérien · Raï",
    quote: "يا أمين يا خويا العزيز، اليوم عيد ميلادك والفرحة معانا...",
    bg: "/images/anniversaire_algerie.png",
    audio: "/audios/anniversaire_algerie.mp3"
  },
  {
    id: 5,
    title: "Fiançailles & Fête Tunisienne",
    meta: "Darija Tunisien · Chaâbi Festif",
    quote: "مبروك الخطوبة يا لالة، الفرحة دخلات لكل دار...",
    bg: "/images/fiancailles_tunisie.png",
    audio: "/audios/fiancailles_tunisie.mp3"
  },
  {
    id: 6,
    title: "Anniversaire Égyptien (Masri)",
    meta: "Égyptien Masri · Pop Orientale",
    quote: "كل سنة وأنت طيب يا غالي، سنة حلوة يا جميل...",
    bg: "/images/anniversaire_egypte.png",
    audio: "/audios/anniversaire_egypte.mp3"
  },
  {
    id: 7,
    title: "Succès & Réussite Pro",
    meta: "Darija Marocain · Pop Moderne",
    quote: "مبروك النجاح والترقية، تعبك وفرحتك ما ننساوهاش...",
    bg: "/images/reussite.png",
    audio: "/audios/reussite.mp3"
  },
  {
    id: 8,
    title: "Naissance Petite Sofia",
    meta: "Darija Marocain · Douce Berceuse",
    quote: "نورت الدنيا صوفيا، فرحة جديدة دخلت للدار...",
    bg: "/images/berceuse.png",
    audio: "/audios/berceuse.mp3"
  }
];

const FAQ_ITEMS = [
  { q: "Les clips vidéos 9:16 sont-ils disponibles ?", a: "Notre équipe travaille activement sur l'intégration des clips vidéos animés verticaux (9:16). Cette fonctionnalité sera disponible très prochainement pour tous nos membres !" },
  { q: "Quelle est la différence entre les modèles de génération selon le plan ?", a: "Plus la formule choisie est élevée, plus le studio débloque des modèles de composition musicale avancés (Google Lyria 3 Pro) et d'écriture poétique de niveau supérieur (Gemini 3.5 Pro), avec une vitesse de traitement prioritaire instantanée." },
  { q: "Est-ce que je peux utiliser la musique pour mes vidéos TikTok / Instagram / YouTube ?", a: "Oui ! Une fois débloquée, la musique vous appartient. Vous pouvez l'utiliser librement pour vos Reels, TikTok, vlogs, ou publicités commerciales sans problème de droits d'auteur." },
  { q: "Est-ce que le dialecte sonne vraiment naturel ?", a: "Absolument. Les paroles sont rédigées en écriture arabe authentique, avec les vraies expressions et l'accent du dialecte choisi (Marocain, Algérien, Tunisien, Égyptien, Levantin, Khaleeji, etc.)." },
  { q: "Puis-je modifier les paroles avant de composer la musique ?", a: "Oui, c'est gratuit et illimité ! Vous relisez le texte, modifiez les phrases si besoin, puis lancez la composition musicale quand vous êtes prêt." },
  { q: "Quels moyens de paiement acceptez-vous ?", a: "PayPal (cartes bancaires) et Fedapay (Mobile Money Afrique/Maghreb, Orange Money, Wave, virement)." },
];

// --- CONTENU MARKETING PROGRESSIF PAR PACK ---
const PLAN_CONTENT = {
  pack4: {
    name: "Découverte",
    desc: "Pour tester vos premiers sons",
    popular: false,
    modelTag: "Modèle Audio Standard HD",
    features: [
      "4 musiques complètes (Audio HD + Pochette)",
      "Paroles gratuites, modifiables & régénérables",
      "Crédits valables sans limite de temps",
      "Usage personnel & partages réseaux",
    ],
  },
  pack10: {
    name: "Créateur TikTok & Reels",
    desc: "Le choix le plus populaire sur les réseaux",
    popular: true,
    modelTag: "Modèle Audio Haute-Fidélité (-20% de réduction)",
    features: [
      "🔥 -20% de réduction (0,60 € / chanson)",
      "Tout le plan Découverte inclus",
      "10 musiques complètes HD",
      "Génération musicale prioritaire",
      "Clips Vidéos 9:16 (Prochainement)",
    ],
  },
  pack20: {
    name: "Pro & Business",
    desc: "Pour les marques, pubs et grands événements",
    popular: false,
    modelTag: "Modèle Studio Pro (Google Lyria 3 Pro)",
    features: [
      "⚡ -33% de réduction (0,50 € / chanson)",
      "Tout le plan Créateur inclus",
      "20 musiques complètes HD",
      "Auteur-parolier avancé (Gemini 3.5 Pro)",
      "Droits d'usage commercial & pubs inclus",
      "Support prioritaire dédié sous 12h",
    ],
  },
  pack40: {
    name: "Studio VIP",
    desc: "Pour les créateurs fréquents et agences",
    popular: false,
    modelTag: "Modèle Master Studio Ultra-HD (-35% de réduction)",
    features: [
      "👑 -35% de réduction (0,49 € / chanson)",
      "Tout le plan Pro & Business inclus",
      "40 musiques complètes HD",
      "Génération instantanée zéro attente",
      "Support privé WhatsApp 7j/7",
      "Badge Créateur VIP sur le profil",
    ],
  },
};

const PLAN_ORDER = ["pack4", "pack10", "pack20", "pack40"];

function formatEuros(cents) {
  return (cents / 100).toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €";
}

const REVIEWS_50 = [
  { id: 1, initial: "K", name: "Khadija B.", meta: "Paris · Reel Instagram", text: "J'ai créé un son en darija pour mon vlog de voyage au Maroc. Ma vidéo a dépassé les 100k vues sur Reels, incroyable !" },
  { id: 2, initial: "Y", name: "Yassine M.", meta: "Bruxelles · Mariage Dkhla", text: "On a fait jouer la chanson pendant la dkhla du mariage de mon frère à Marrakech. Tout le monde pensait qu'on avait payé un orchestre professionnel !" },
  { id: 3, initial: "A", name: "Amine K.", meta: "Lyon · Pub E-commerce", text: "J'ai créé un jingle en masri égyptien pour ma pub TikTok. Le taux de conversion de ma campagne a explosé !" },
  { id: 4, initial: "S", name: "Sarah L.", meta: "Montréal · Naissance Sofia", text: "La voix en darija tunisienne est d'une douceur incroyable. Une émotion pure pour la naissance de notre petite fille." },
  { id: 5, initial: "M", name: "Mehdi T.", meta: "Marseille · Humour TikTok", text: "On a fait une chanson parodique sur notre pote qui arrive toujours en retard. On a rigolé pendant des jours !" },
  { id: 6, initial: "L", name: "Leila H.", meta: "Casablanca · Hommage Maman", text: "Ma mère n'en revenait pas d'entendre son histoire racontée en chanson. C'est le meilleur cadeau que je lui ai offert." },
  { id: 7, initial: "K", name: "Karim R.", meta: "Alger · Réussite Diplôme", text: "Pour la réussite du Master de mon cousin à Alger. Le rythme raï est super entraînant, il était totalement choqué !" },
  { id: 8, initial: "N", name: "Nawel B.", meta: "Tunis · Pub Restaurant", text: "Créé en 3 minutes pour la réouverture de notre café. La chanson tourne en boucle dans le restaurant, nos clients adorent." },
  { id: 9, initial: "O", name: "Omar F.", meta: "Lille · Départ Retraite", text: "Créé pour le départ en retraite de mon père Hassan. Le ton en chaâbi est respectueux et très émouvant." },
  { id: 10, initial: "M", name: "Mounia Z.", meta: "Bordeaux · Anniversaire 30 ans", text: "Super expérience. J'ai pu réviser les paroles gratuitement avant de valider la musique, le résultat est impeccable." },
  { id: 11, initial: "F", name: "Farid C.", meta: "Oran · Content Creator", text: "Le style raï oranais est hyper authentique. Mes abonnés croyaient que c'était une collaboration avec un vrai studio." },
  { id: 12, initial: "H", name: "Houda S.", meta: "Rabat · Déclaration d'amour", text: "Une chanson douce en pop orientale pour mon fiancé. Il l'écoute encore en boucle tous les matins !" },
  { id: 13, initial: "A", name: "Anis G.", meta: "Genève · Succès BAC", text: "Offert pour le Bac de ma petite sœur. Elle l'a partagée directement sur Instagram et Snapchat." },
  { id: 14, initial: "M", name: "Meriem K.", meta: "Nantes · Anniversaire Papa", text: "Mon père a versé sa petite larme. Entendre son prénom dans une chanson en darija marocaine, ça n'a pas de prix." },
  { id: 15, initial: "R", name: "Rachid B.", meta: "Strasbourg · Fête de Famille", text: "Super sympa pour animer nos repas de famille. La livraison en MP3 se fait en 2 minutes chrono." },
  { id: 16, initial: "S", name: "Sonia P.", meta: "Toulouse · Cadeau Mariage", text: "Les invités pensaient qu'on avait enregistré la chanson dans un studio professionnel. Le rendu audio en 48kHz est propre." },
  { id: 17, initial: "I", name: "Ibrahim D.", meta: "Nice · Hommage Grand-père", text: "Une belle chanson acoustique en l'honneur de mon grand-père. Un hommage qui reste gravé à jamais." },
  { id: 18, initial: "Z", name: "Zineb A.", meta: "Agadir · Story Instagram", text: "J'ai illustré ma story d'anniversaire avec un son sur-mesure. C'est tellement plus original que les musiques classiques." },
  { id: 19, initial: "B", name: "Badr M.", meta: "Montpellier · Retrouvailles", text: "Envoyé à mon meilleur ami qui vit au Canada. Ça nous a rappelé tellement de souvenirs de jeunesse au quartier." },
  { id: 20, initial: "F", name: "Fatima O.", meta: "Oujda · Mariage Sœur", text: "Le style reggada/chaâbi est parfait pour faire bouger tout le monde. Très satisfaite de la vitesse de génération." },
  { id: 21, initial: "S", name: "Samira N.", meta: "Gatineau · Anniversaire Mariage", text: "10 ans de mariage fêtés avec une chanson qui retrace notre parcours. Un souvenir inestimable." },
  { id: 22, initial: "W", name: "Walid E.", meta: "Lausanne · Fête de l'Aïd", text: "On l'a écoutée en boucle sur la route des vacances. Les enfants connaissent déjà les paroles par cœur !" },
  { id: 23, initial: "I", name: "Inès M.", meta: "Rouen · Réussite Permis", text: "Un petit clin d'œil en musique pour mon frère qui a enfin eu son permis. On a trop rigolé en l'écoutant." },
  { id: 24, initial: "H", name: "Hamza B.", meta: "Tanger · Anniversaire Maman", text: "Le service est fluide et rapide. Les paroles écrites en écriture arabe sont très bien formulées." },
  { id: 25, initial: "C", name: "Chaima R.", meta: "Constantine · Mariage Cousine", text: "On a ajouté des détails sur sa passion pour la cuisine et les voyages, c'était ultra personnalisé !" },
  { id: 26, initial: "N", name: "Nabil V.", meta: "Tours · Promotion travail", text: "Offert pour la promotion de mon collègue de bureau. Tout l'open space a adoré l'idée !" },
  { id: 27, initial: "N", name: "Nawal T.", meta: "Sousse · Naissance Bébé", text: "Une berceuse douce en darija tunisienne pour notre nouveau-né. Merci infiniment !" },
  { id: 28, initial: "S", name: "Sofiane A.", meta: "Grenoble · Anniversaire 20 ans", text: "Généré en 2 minutes pour les 20 ans de mon frère. Le raï dansant a fait l'unanimité auprès des jeunes." },
  { id: 29, initial: "S", name: "Souad M.", meta: "Amiens · Remerciement Parents", text: "Une chanson de remerciement pour mes parents après mon mariage. Un moment très fort en émotion." },
  { id: 30, initial: "R", name: "Reda K.", meta: "Nancy · Fête de diplôme", text: "Mes amies m'ont fait la surprise pendant la soirée de remise de diplôme. Meilleure surprise !" },
  { id: 31, initial: "A", name: "Asma B.", meta: "Mulhouse · Fête des Mères", text: "Ma mère l'a mise directement comme sonnerie de téléphone portable tellement elle en est fière !" },
  { id: 32, initial: "B", name: "Bilal H.", meta: "Brest · Anniversaire Pote", text: "On a glissé nos blagues d'enfance dans le brief, le studio les a intégrées de façon ultra naturelle." },
  { id: 33, initial: "H", name: "Hajar S.", meta: "Fès · Fiançailles", text: "Musique orientale classique magnifique. Les violons et l'oud apportent une touche royale." },
  { id: 34, initial: "T", name: "Tariq M.", meta: "Dijon · Anniversaire Mariage", text: "Ma femme a adoré le geste. Ça change vraiment des cadeaux matériels classiques qu'on oublie vite." },
  { id: 35, initial: "M", name: "Myriam C.", meta: "Liège · Naissance Jumeaux", text: "Une chanson joyeuse et rythmée pour fêter l'arrivée de nos jumeaux. Merci pour ce beau travail." },
  { id: 36, initial: "H", name: "Hamza L.", meta: "Annaba · Réussite BACC", text: "L'accent algérien est super bien restitué. Très impressionné par la qualité du chant." },
  { id: 37, initial: "W", name: "Wafa K.", meta: "Sfax · TikTok Trend", text: "J'ai utilisé ma chanson pour lancer un challenge TikTok entre amies, le résultat est viral !" },
  { id: 38, initial: "Z", name: "Zakaria N.", meta: "Rennes · Crémaillère", text: "Pour notre crémaillère avec les amis. Une chanson chaâbi entraînante qui a mis l'ambiance dès l'arrivée." },
  { id: 39, initial: "H", name: "Hanane D.", meta: "Clermont · Fête de l'Aïd", text: "C'est devenu notre tradition de l'Aïd de créer une chanson personnalisée pour réunir la famille." },
  { id: 40, initial: "Y", name: "Youcef B.", meta: "Saint-Étienne · Hommage Oncle", text: "Un hommage chaleureux pour mon oncle. Les paroles exprimaient exactement ce qu'on ressentait." },
  { id: 41, initial: "L", name: "Lamia G.", meta: "Monaco · Pub Marque Beauté", text: "Nous avons utilisé un son Darija pour notre campagne locale de cosmétiques. Succès immédiat." },
  { id: 42, initial: "Y", name: "Youssef H.", meta: "Meknès · Remerciement Équipe", text: "Créé pour remercier mon équipe à la fin d'un gros projet. Un moment convivial et très original." },
  { id: 43, initial: "K", name: "Kenza S.", meta: "Perpignan · Naissance Neveu", text: "J'ai pu faire corriger deux mots sur les paroles gratuitement avant de lancer le chant. Super système !" },
  { id: 44, initial: "N", name: "Nassim T.", meta: "Charleroi · Mariage Amis", text: "Les mariés ont pleuré en écoutant leur histoire chantée. C'était le moment fort de la soirée." },
  { id: 45, initial: "R", name: "Rim E.", meta: "Kénitra · Anniversaire Mamie", text: "Ma grand-mère était émerveillée. Elle n'imaginait pas qu'une chanson pouvait être faite sur mesure pour elle." },
  { id: 46, initial: "A", name: "Adel K.", meta: "Batna · Succès examen", text: "La voix en chaâbi algérien est chaleureuse et entraînante. Excellent rapport qualité-prix." },
  { id: 47, initial: "B", name: "Boutheina L.", meta: "Bizerte · Déclaration d'amour", text: "Un poème chanté en darija avec une mélodie pop douce. Mon mari a été très touché." },
  { id: 48, initial: "A", name: "Adil M.", meta: "Nîmes · Anniversaire 50 ans", text: "Pour les 50 ans de mon grand frère. On a chanté tous ensemble le refrain pendant le gâteau !" },
  { id: 49, initial: "S", name: "Salma H.", meta: "Nantes · Retrouvailles Soeur", text: "Une chanson pleine d'amour pour ma sœur que je n'avais pas vue depuis deux ans." },
  { id: 50, initial: "I", name: "Ilyes B.", meta: "Marseille · Fête de Naissance", text: "Superbe ambiance chaâbi/raï. Le fichier MP3 48kHz s'entend super bien sur de grosses enceintes." }
];

function useSiteStats() {
  const [stats, setStats] = useState({
    landing_visits: 12450,
    songs_created: 1485,
    downloads: 3920,
    users_count: 890,
  });

  useEffect(() => {
    supabase
      .rpc("simulate_credible_activity")
      .then(({ data }) => {
        if (data && typeof data === "object") {
          setStats((prev) => ({ ...prev, ...data }));
        } else {
          supabase.from("site_stats").select("key,value").then(({ data: dbRows }) => {
            if (dbRows) {
              const map = Object.fromEntries(dbRows.map((r) => [r.key, r.value]));
              setStats((s) => ({ ...s, ...map }));
            }
          });
        }
      })
      .catch(() => {
        supabase.from("site_stats").select("key,value").then(({ data: dbRows }) => {
          if (dbRows) {
            const map = Object.fromEntries(dbRows.map((r) => [r.key, r.value]));
            setStats((s) => ({ ...s, ...map }));
          }
        });
      });

    callFunction("track-stat", { key: "landing_visits" }).catch(() => {});

    const channel = supabase
      .channel("site_stats_realtime")
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "site_stats" },
        (payload) => {
          if (payload.new && payload.new.key) {
            setStats((prev) => ({
              ...prev,
              [payload.new.key]: payload.new.value,
            }));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return stats;
}

function AnimatedCounter({ target, suffix = "", duration = 1800 }) {
  const [value, setValue] = useState(0);
  const prev = useRef(0);

  useEffect(() => {
    if (target === prev.current) return;
    const start = prev.current;
    prev.current = target;
    const startTime = performance.now();

    function step(now) {
      const p = Math.min((now - startTime) / duration, 1);
      const ease = p === 1 ? 1 : 1 - Math.pow(2, -10 * p);
      setValue(Math.round(start + (target - start) * ease));
      if (p < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }, [target, duration]);

  return <span>{value.toLocaleString("fr-FR")}{suffix}</span>;
}

function HeroBackground() {
  const [currentSlide, setCurrentSlide] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % HERO_SLIDES.length);
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {HERO_SLIDES.map((slide, index) => (
        <div
          key={slide}
          className={`absolute inset-0 bg-cover bg-center transition-opacity duration-1000 ease-in-out scale-105 ${
            index === currentSlide ? "opacity-100" : "opacity-0"
          }`}
          style={{ backgroundImage: `url('${slide}')` }}
        />
      ))}

      <div className="absolute inset-0 bg-gradient-to-b from-black/85 via-black/80 to-[#0C0F0E] backdrop-blur-[3px]" />

      <div
        className="absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage:
            "repeating-linear-gradient(45deg, #E89528 0px, #E89528 1px, transparent 1px, transparent 28px), repeating-linear-gradient(-45deg, #E89528 0px, #E89528 1px, transparent 1px, transparent 28px)",
        }}
      />

      <div className="absolute bottom-0 left-0 right-0 h-36 bg-gradient-to-t from-[#0C0F0E] via-[#0C0F0E]/80 to-transparent" />
    </div>
  );
}

function Hero({ stats }) {
  const [wordIndex, setWordIndex] = useState(0);
  const [fading, setFading] = useState(false);

  useEffect(() => {
    const id = setInterval(() => {
      setFading(true);
      setTimeout(() => {
        setWordIndex((i) => (i + 1) % DYNAMIC_WORDS.length);
        setFading(false);
      }, 300);
    }, 2800);
    return () => clearInterval(id);
  }, []);

  return (
    <section className="relative overflow-hidden bg-[#0C0F0E] text-white">
      <HeroBackground />

      <div className="relative z-10 max-w-[1080px] mx-auto px-6 sm:px-8 flex flex-col items-center justify-center text-center pt-8 sm:pt-20 pb-16 sm:pb-24">
        
        <div className="inline-flex items-center gap-2 bg-white/10 border border-safran/50 backdrop-blur-md text-safran-bright px-4 py-2 rounded-full text-xs sm:text-sm font-bold uppercase tracking-wider mb-6 shadow-md">
           {"👑 LE STUDIO N°1 DE COMPOSITION MUSICALE DU MONDE ARABE & MAGHRÉBIN"}
        </div>

        <p className="font-arabic text-safran text-2xl sm:text-3xl mb-4 opacity-95 drop-shadow">
          صوب موسيقاك فـ 3 دقايق
        </p>

        <h1 className="font-display font-extrabold leading-[1.15] mb-6 text-[1.8rem] sm:text-4xl md:text-5xl lg:text-6xl xl:text-[4.2rem] tracking-tight drop-shadow-lg">
          {"Créez votre musique en Darija pour "}
          <span
            className={`inline-block text-transparent bg-clip-text bg-gradient-to-r from-safran-bright via-safran to-safran-bright drop-shadow-[0_2px_14px_rgba(232,149,40,0.4)] transition-opacity duration-300 ${
              fading ? "opacity-0" : "opacity-100"
            }`}
          >
            {DYNAMIC_WORDS[wordIndex]}
          </span>
        </h1>

        <p className="text-base sm:text-xl text-white/85 max-w-[660px] leading-relaxed mb-8 font-normal">
          {"Pionniers de la création musicale sur-mesure. Transformez vos moments les plus précieux, vos vidéos et vos projets en chansons inoubliables en 3 minutes "}
          <span className="text-safran-bright font-semibold">{"(Clips vidéos 9:16 très prochainement !)"}</span>.
        </p>

        <div className="flex flex-col sm:flex-row items-center gap-4 w-full sm:w-auto mb-2">
          <Link
            to="/inscription"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2.5 bg-henne hover:bg-henne-light text-white font-bold text-base sm:text-lg px-9 py-4 rounded-xl shadow-[0_14px_35px_rgba(184,58,40,0.45)] transition-all hover:-translate-y-0.5"
          >
            {"Lancer ma première création →"}
          </Link>
          <a
            href="#exemples"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 text-white hover:text-white text-sm sm:text-base font-semibold transition-colors py-3.5 px-6 bg-white/10 hover:bg-white/15 rounded-xl border border-white/20 backdrop-blur-sm"
          >
            {"🎬 Écouter les réalisations du Studio"}
          </a>
        </div>

        <div className="flex flex-wrap gap-4 sm:gap-6 justify-center mt-6 text-xs sm:text-sm text-white/75 font-medium">
          {["Premier essai offert", "Haute Qualité Audio 48kHz", "Droits d'utilisation réservés"].map((t) => (
            <span key={t} className="flex items-center gap-1.5">
              <span className="text-safran font-bold">✓</span> {t}
            </span>
          ))}
        </div>

        <div className="flex justify-around sm:justify-center gap-4 sm:gap-12 w-full mt-12 sm:mt-16 pt-8 border-t border-white/15">
          {[
            { label: "chansons créées", value: stats.songs_created },
            { label: "téléchargements", value: stats.downloads },
            { label: "visiteurs", value: stats.landing_visits },
          ].map((s) => (
            <div key={s.label} className="text-center">
              <div className="font-display font-bold text-2xl sm:text-3xl text-white">
                <AnimatedCounter target={s.value} />
              </div>
              <div className="text-white/50 text-[0.68rem] sm:text-xs mt-1 uppercase tracking-wider">{s.label}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Marquee() {
  const items = ["RÉSEAUX SOCIAUX & REELS", "STUDIO DE HAUTE CRÉATION", "PUBS & E-COMMERCE", "ANNIVERSAIRES", "HUMOUR & MEMES", "MARIAGES", "VLOGS & STORIES"];
  const track = [...items, ...items];
  return (
    <div className="bg-emerald text-safran overflow-hidden py-3 sm:py-3.5 border-y border-white/10 whitespace-nowrap font-display text-xs sm:text-[0.9rem] font-semibold tracking-[0.1em]">
      <div className="inline-flex" style={{ animation: "marquee 30s linear infinite" }}>
        {track.map((item, i) => (<div key={i} className="mx-3 sm:mx-5 inline-flex items-center gap-3 sm:gap-5 uppercase">{item} <span className="text-white/30">✦</span></div>))}
      </div>
      <style>{`@keyframes marquee { 0%{transform:translateX(0)} 100%{transform:translateX(-50%)} }`}</style>
    </div>
  );
}

function AudioCard({ card, isPlaying, progress, currentTime, onToggle, onSeek }) {
  return (
    <div className="relative rounded-2xl overflow-hidden flex flex-col justify-between p-5 min-h-[300px] sm:min-h-[320px] border border-white/10" style={{ backgroundImage: `url('${card.bg}')`, backgroundSize: "cover", backgroundPosition: "center" }}>
      <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-black/50 to-black/90" />
      <div className="relative z-10 flex flex-col h-full justify-between gap-3">
        <div className="flex items-center gap-3">
          <button
            onClick={onToggle}
            className={`w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0 transition-all shadow-lg cursor-pointer ${
              isPlaying ? "bg-henne text-white" : "bg-safran text-ink"
            }`}
          >
            <span className="text-base">{isPlaying ? "❚❚" : "▶"}</span>
          </button>
          <div>
            <h4 className="text-white font-bold text-sm sm:text-base leading-tight">{card.title}</h4>
            <span className="text-safran-bright text-[0.75rem] font-semibold">{card.meta}</span>
          </div>
        </div>

        <div className="font-arabic text-right text-white/90 text-sm sm:text-base leading-relaxed bg-white/10 backdrop-blur-sm rounded-xl px-3 py-2.5 border border-white/10">
          {card.quote}
        </div>

        <div>
          <div onClick={onSeek} className="w-full h-1.5 bg-white/20 rounded-full overflow-hidden cursor-pointer mb-2">
            <div className="h-full bg-safran-bright rounded-full transition-[width] duration-100" style={{ width: `${progress}%` }} />
          </div>
          <div className="flex justify-between items-center">
            <span className="text-white/50 text-xs font-semibold">{currentTime}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function AudioSection() {
  const [activeId, setActiveId] = useState(null);
  const activeAudioRef = useRef(null);
  const [progress, setProgress] = useState(0);
  const [currentTime, setCurrentTime] = useState("0:00");

  function handleTogglePlay(card) {
    if (activeId === card.id) {
      if (activeAudioRef.current) {
        if (activeAudioRef.current.paused) {
          activeAudioRef.current.play().catch(() => {});
        } else {
          activeAudioRef.current.pause();
        }
      }
    } else {
      if (activeAudioRef.current) {
        activeAudioRef.current.pause();
        activeAudioRef.current.currentTime = 0;
      }

      const encodedSrc = encodeURI(card.audio);
      const newAudio = new Audio(encodedSrc);
      activeAudioRef.current = newAudio;
      setActiveId(card.id);

      newAudio.addEventListener("timeupdate", () => {
        const pct = (newAudio.currentTime / newAudio.duration) * 100;
        setProgress(isNaN(pct) ? 0 : pct);
        const m = Math.floor(newAudio.currentTime / 60);
        const s = Math.floor(newAudio.currentTime % 60);
        setCurrentTime(`${m}:${s < 10 ? "0" : ""}${s}`);
      });

      newAudio.addEventListener("ended", () => {
        setActiveId(null);
        setProgress(0);
        setCurrentTime("0:00");
      });

      newAudio.addEventListener("error", () => {
        setActiveId(null);
      });

      newAudio.play().catch(() => {
        setActiveId(null);
      });
    }
  }

  function handleSeek(card, e) {
    if (activeId !== card.id || !activeAudioRef.current || !activeAudioRef.current.duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const pos = (e.clientX - rect.left) / rect.width;
    activeAudioRef.current.currentTime = pos * activeAudioRef.current.duration;
  }

  return (
    <section id="exemples" className="py-12 sm:py-20 bg-[#0F1310]">
      <div className="max-w-[1120px] mx-auto px-6 sm:px-8">
        <div className="text-center mb-8 sm:mb-12">
          <div className="text-henne text-xs font-bold uppercase tracking-widest mb-2 sm:mb-3">Réalisations du Studio</div>
          <h2 className="font-display font-bold text-white text-2xl sm:text-3xl lg:text-4xl mb-2 sm:mb-3">Inspiration & Usages Sur-Mesure</h2>
          <p className="text-white/50 text-xs sm:text-sm max-w-[520px] mx-auto">Compositions personnalisées pour vidéos TikTok/Reels, publicités de marques ou célébrations d'exception.</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {AUDIO_CARDS.map((card) => (
            <AudioCard
              key={card.id}
              card={card}
              isPlaying={activeId === card.id && activeAudioRef.current && !activeAudioRef.current.paused}
              progress={activeId === card.id ? progress : 0}
              currentTime={activeId === card.id ? currentTime : "0:00"}
              onToggle={() => handleTogglePlay(card)}
              onSeek={(e) => handleSeek(card, e)}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

function StatsBanner({ stats }) {
  return (
    <div className="bg-emerald-light py-8 sm:py-12">
      <div className="max-w-[1120px] mx-auto px-6 sm:px-8 grid grid-cols-2 md:grid-cols-4 gap-6 sm:gap-8">
        {[
          { key: "songs_created", label: "Musiques composées", suffix: "+" },
          { key: "downloads", label: "Téléchargements", suffix: "+" },
          { key: "landing_visits", label: "Visiteurs", suffix: "" },
          { key: "users_count", label: "Membres de la Tribu", suffix: "+" }
        ].map(({ key, label, suffix }) => (
          <div key={key} className="text-center">
            <div className="font-display font-bold text-2xl sm:text-4xl text-safran leading-none">
              <AnimatedCounter target={stats[key] ?? 0} suffix={suffix} />
            </div>
            <div className="text-white/60 text-[0.7rem] sm:text-sm mt-1.5 uppercase tracking-wider font-semibold">{label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Reviews() {
  const [isPaused, setIsPaused] = useState(false);

  const doubleReviews = [...REVIEWS_50, ...REVIEWS_50];

  return (
    <section id="avis" className="py-12 sm:py-20 bg-cream overflow-hidden">
      <div className="max-w-[1120px] mx-auto px-6 sm:px-8 text-center mb-8 sm:mb-10">
        <div className="text-henne text-xs font-bold uppercase tracking-widest mb-2 sm:mb-3">Témoignages de la Communauté (50+)</div>
        <h2 className="font-display font-bold text-2xl sm:text-3xl lg:text-4xl mb-2">Ce qu'ils en disent</h2>
        <p className="text-muted text-xs sm:text-sm max-w-[520px] mx-auto">
          Défilement automatique. <b>Cliquez ou survolez</b> pour mettre en pause.
        </p>
      </div>

      <div
        className="relative w-full cursor-pointer py-2"
        onClick={() => setIsPaused(!isPaused)}
        onMouseEnter={() => setIsPaused(true)}
        onMouseLeave={() => setIsPaused(false)}
      >
        <div
          className="flex gap-4 sm:gap-6 w-max"
          style={{
            animation: "scrollHorizontal 120s linear infinite",
            animationPlayState: isPaused ? "paused" : "running",
          }}
        >
          {doubleReviews.map((r, idx) => (
            <div
              key={`${r.id}-${idx}`}
              className="w-[280px] sm:w-[380px] bg-white rounded-2xl p-5 sm:p-6 border border-line shadow-sm flex flex-col justify-between flex-shrink-0 transition-transform duration-200 hover:scale-[1.02]"
            >
              <p className="text-muted italic text-xs sm:text-[0.92rem] leading-relaxed mb-4 sm:mb-6 whitespace-normal">
                "{r.text}"
              </p>
              <div className="flex items-center gap-3 border-t border-line/60 pt-3">
                <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-emerald text-safran flex items-center justify-center font-bold text-xs sm:text-sm flex-shrink-0">
                  {r.initial}
                </div>
                <div className="text-left">
                  <div className="font-bold text-xs sm:text-sm text-ink">{r.name}</div>
                  <div className="text-muted text-[0.68rem] sm:text-xs">{r.meta}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <style>{`
        @keyframes scrollHorizontal {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
      `}</style>
    </section>
  );
}

function Pricing() {
  const [plans, setPlans] = useState(null);

  useEffect(() => {
    supabase
      .from("pricing_packs")
      .select("id, song_count, price_cents")
      .eq("active", true)
      .then(({ data }) => {
        if (!data) return;
        setPlans(
          data
            .map((pack) => ({
              id: pack.id,
              songs: pack.song_count,
              price: formatEuros(pack.price_cents),
              perSong: formatEuros(Math.round(pack.price_cents / pack.song_count)),
              ...PLAN_CONTENT[pack.id],
            }))
            .filter((p) => p.name)
            .sort((a, b) => PLAN_ORDER.indexOf(a.id) - PLAN_ORDER.indexOf(b.id))
        );
      });
  }, []);

  return (
    <section id="tarifs" className="py-16 sm:py-24 bg-white border-t border-line">
      <div className="max-w-[1280px] mx-auto px-6 sm:px-8 lg:px-10">
        <div className="text-center mb-10 sm:mb-14">
          <div className="text-henne text-xs sm:text-sm font-bold uppercase tracking-widest mb-2 sm:mb-3">Tarifs</div>
          <h2 className="font-display font-bold text-2xl sm:text-3xl lg:text-4xl">Simple, transparent</h2>
          <p className="text-muted text-xs sm:text-base mt-2">Première création offerte. Rédaction des paroles gratuite. Vous ne débloquez que le projet final qui vous plaît.</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 lg:gap-6 items-stretch">
          {(plans ?? []).map((plan) => (
            <div key={plan.id} className={`relative rounded-3xl flex flex-col justify-between overflow-hidden transition-all hover:shadow-lg ${plan.popular ? "bg-[#0C0F0E] text-white border-2 border-safran shadow-xl" : "bg-white border border-line"}`}>
              {plan.popular && (
                <div className="bg-safran text-ink text-[0.68rem] font-bold uppercase tracking-wider text-center py-2">Le plus choisi</div>
              )}
              <div className="p-6 sm:p-7 lg:p-8 flex-1 flex flex-col justify-between">
                <div>
                  <div className={`text-xs font-bold uppercase tracking-widest mb-1.5 ${plan.popular ? "text-safran" : "text-emerald"}`}>{plan.name}</div>
                  <p className={`text-[0.78rem] mb-3 ${plan.popular ? "text-white/50" : "text-muted"}`}>{plan.desc}</p>
                  
                  {plan.modelTag && (
                    <div className="mb-4">
                      <span className={`inline-block text-[0.7rem] font-bold px-3 py-1 rounded-lg border ${
                        plan.popular ? "bg-safran/15 text-safran border-safran/30" : "bg-emerald/10 text-emerald border-emerald/20"
                      }`}>
                        ⚡ {plan.modelTag}
                      </span>
                    </div>
                  )}

                  <div className="mb-1">
                    <span className={`font-display text-3xl sm:text-4xl font-bold leading-none ${plan.popular ? "text-white" : "text-ink"}`}>{plan.price}</span>
                  </div>
                  <div className={`text-xs mb-6 ${plan.popular ? "text-white/40" : "text-muted"}`}>{plan.songs} musiques · {plan.perSong} / son</div>
                  
                  <ul className="space-y-3 mb-8">
                    {(plan.features || []).map((f) => (
                      <li key={f} className={`flex items-start gap-2.5 text-xs sm:text-[0.8rem] ${plan.popular ? "text-white/80" : "text-muted"}`}>
                        <span className={`mt-0.5 font-bold ${plan.popular ? "text-safran" : "text-emerald"}`}>✓</span> {f}
                      </li>
                    ))}
                  </ul>
                </div>

                <Link to="/inscription" className={`block text-center rounded-xl py-3.5 font-bold text-sm transition-colors mt-auto ${plan.popular ? "bg-safran hover:bg-safran-bright text-ink" : "bg-emerald hover:bg-emerald-light text-white"}`}>
                  Choisir ce plan
                </Link>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function FAQ() {
  const [open, setOpen] = useState(null);
  return (
    <section id="faq" className="py-12 sm:py-20 bg-cream border-t border-line">
      <div className="max-w-[760px] mx-auto px-6 sm:px-8">
        <div className="text-center mb-8 sm:mb-12">
          <div className="text-henne text-xs font-bold uppercase tracking-widest mb-2 sm:mb-3">FAQ</div>
          <h2 className="font-display font-bold text-2xl sm:text-3xl lg:text-4xl">Questions fréquentes</h2>
        </div>
        <div className="space-y-1">
          {FAQ_ITEMS.map((item, i) => (
            <div key={i} className="border-b border-line">
              <button onClick={() => setOpen(open === i ? null : i)} className="w-full text-left py-4 sm:py-5 flex justify-between items-center gap-4 font-display text-base sm:text-[1.08rem] font-semibold">
                <span>{item.q}</span>
                <span className={`text-henne text-lg sm:text-xl flex-shrink-0 transition-transform duration-200 ${open === i ? "rotate-45" : ""}`}>+</span>
              </button>
              <div className={`overflow-hidden transition-[max-height] duration-300 ease-in-out ${open === i ? "max-h-60" : "max-h-0"}`}>
                <p className="text-muted text-xs sm:text-[0.96rem] leading-relaxed pb-4 sm:pb-5">{item.a}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function FinalCTA() {
  return (
    <section className="relative bg-[#0C0F0E] text-white text-center py-16 sm:py-28 overflow-hidden">
      <div
        className="absolute inset-0 bg-cover bg-center scale-105"
        style={{
          backgroundImage:
            "url('https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=1800&q=80')",
        }}
      />
      <div className="absolute inset-0 bg-black/80 backdrop-blur-[2px]" />

      <div className="relative z-10 max-w-[700px] mx-auto px-6 sm:px-8">
        <p className="font-arabic text-safran text-xl sm:text-3xl mb-3 sm:mb-4 drop-shadow">صوب أول أغنية ديالك فـ 3 دقايق</p>
        <h2 className="font-display font-bold text-2xl sm:text-4xl lg:text-5xl text-white mb-3 sm:mb-4 leading-tight drop-shadow-md">
          Donnez une voix authentique à vos idées.
        </h2>
        <p className="text-white/70 text-xs sm:text-base mb-6 sm:mb-8 max-w-[580px] mx-auto drop-shadow-sm">
          Création offerte. Testez vos paroles et écoutez votre premier morceau composé par le studio sans engagement.
        </p>
        <Link to="/inscription" className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-safran hover:bg-safran-bright text-ink font-bold text-base px-8 py-3.5 sm:px-10 sm:py-4 rounded-xl shadow-lg transition-all hover:-translate-y-0.5">
          Rejoindre le Studio & Créer maintenant →
        </Link>
      </div>
    </section>
  );
}

export default function Landing() {
  const stats = useSiteStats();
  return (
    <div>
      <Hero stats={stats} />
      <Marquee />
      <AudioSection />
      <StatsBanner stats={stats} />
      <Reviews />
      <Pricing />
      <FAQ />
      <FinalCTA />
      <footer className="bg-[#0C0F0E] text-white/30 border-t border-white/5 py-6 sm:py-8">
        <div className="max-w-[1120px] mx-auto px-6 sm:px-8 flex justify-between items-center flex-wrap gap-4 text-xs sm:text-sm">
          <div className="flex items-center gap-2 font-display font-bold text-white/60"><span className="w-2 h-2 rounded-full bg-henne" /> Farha</div>
          <div>© 2026 Farha — Le Studio de Haute Création Musicale.</div>
        </div>
      </footer>
    </div>
  );
}