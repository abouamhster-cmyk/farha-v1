import { useState } from "react";
import { Link } from "react-router-dom";
import { ChevronLeft } from "lucide-react";

const TABS = [
  { id: "cgu", label: "Conditions d'utilisation" },
  { id: "privacy", label: "Politique de confidentialité" },
];

export default function Legal() {
  const [tab, setTab] = useState("cgu");

  return (
    <div className="min-h-screen bg-cream">
      <div className="max-w-5xl mx-auto px-6 sm:px-10 lg:px-16 py-10 sm:py-16">
        <Link to="/" className="text-xs text-muted hover:text-emerald mb-6 inline-flex items-center gap-1 font-semibold">
          <ChevronLeft size={14} /> Retour
        </Link>

        <h1 className="font-display text-2xl sm:text-3xl font-bold mb-6">Mentions légales</h1>

        <div className="flex gap-2 mb-8">
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
                tab === t.id ? "bg-emerald text-white" : "bg-white border border-line text-muted hover:text-ink"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="bg-white border border-line rounded-2xl p-6 sm:p-8 prose-sm">
          {tab === "cgu" ? <CGU /> : <Privacy />}
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div className="mb-6">
      <h2 className="font-display font-bold text-base mb-2">{title}</h2>
      <div className="text-sm text-muted leading-relaxed space-y-2">{children}</div>
    </div>
  );
}

function CGU() {
  return (
    <>
      <p className="text-xs text-muted mb-4">Dernière mise à jour : 13 août 2026</p>

      <Section title="1. Objet">
        <p>Les présentes conditions régissent l'utilisation du service Farha, accessible à l'adresse farha-v1.vercel.app. En utilisant le service, vous acceptez ces conditions.</p>
      </Section>

      <Section title="2. Description du service">
        <p>Farha est un service de création musicale personnalisée. L'utilisateur décrit sa chanson (occasion, destinataire, style), les paroles sont générées automatiquement et modifiables gratuitement, puis la musique est composée à partir de ces paroles.</p>
      </Section>

      <Section title="3. Inscription">
        <p>L'inscription est gratuite. Elle peut se faire par e-mail ou via Google OAuth. Vous devez fournir des informations exactes et maintenir la confidentialité de vos identifiants.</p>
      </Section>

      <Section title="4. Crédits et paiement">
        <p>Les paroles sont gratuites et illimitées. La composition musicale consomme un crédit par chanson. Les crédits sont achetés par packs et n'expirent jamais.</p>
        <p>Les paiements sont traités par Stripe (carte bancaire), PayPal, et Fedapay (Mobile Money). Tous les prix sont affichés en euros TTC.</p>
      </Section>

      <Section title="5. Droits d'utilisation">
        <p>Une fois la musique générée et débloquée, vous disposez d'une licence d'utilisation personnelle. Les packs Pro et Studio VIP incluent les droits d'usage commercial (publicités, contenus de marque).</p>
        <p>Vous ne pouvez pas revendre, redistribuer ou sous-licencier les fichiers audio en tant que tels.</p>
      </Section>

      <Section title="6. Contenu interdit">
        <p>Il est interdit d'utiliser le service pour créer du contenu haineux, diffamatoire, pornographique, faisant l'apologie de la violence ou portant atteinte aux droits d'un tiers.</p>
      </Section>

      <Section title="7. Responsabilité">
        <p>Le service est fourni "en l'état". Farha ne garantit pas la disponibilité permanente du service ni l'absence d'erreurs dans les paroles générées. Les paroles sont modifiables avant la composition musicale.</p>
      </Section>

      <Section title="8. Résiliation">
        <p>Vous pouvez supprimer votre compte à tout moment en nous contactant. Les crédits non utilisés ne sont pas remboursables sauf disposition légale contraire.</p>
      </Section>

      <Section title="9. Contact">
        <p>Pour toute question : abouamhster@gmail.com</p>
      </Section>
    </>
  );
}

function Privacy() {
  return (
    <>
      <p className="text-xs text-muted mb-4">Dernière mise à jour : 13 août 2026</p>

      <Section title="1. Responsable du traitement">
        <p>Farha, accessible à farha-v1.vercel.app. Contact : abouamhster@gmail.com</p>
      </Section>

      <Section title="2. Données collectées">
        <p>Nous collectons les données suivantes :</p>
        <ul className="list-disc pl-4 space-y-1">
          <li>Nom complet et adresse e-mail (inscription)</li>
          <li>Photo de profil (Google OAuth, optionnel)</li>
          <li>Contenu des chansons (brief, paroles, fichiers audio générés)</li>
          <li>Historique des commandes et paiements</li>
        </ul>
      </Section>

      <Section title="3. Finalités">
        <p>Vos données sont utilisées pour :</p>
        <ul className="list-disc pl-4 space-y-1">
          <li>Fournir et améliorer le service</li>
          <li>Traiter les paiements</li>
          <li>Envoyer des emails transactionnels (bienvenue, confirmation d'achat)</li>
        </ul>
        <p>Nous n'envoyons pas de newsletters ni d'emails marketing sans votre consentement.</p>
      </Section>

      <Section title="4. Sous-traitants">
        <p>Vos données peuvent être traitées par :</p>
        <ul className="list-disc pl-4 space-y-1">
          <li>Supabase (hébergement, base de données, authentification)</li>
          <li>Vercel (hébergement frontend)</li>
          <li>Google Cloud (génération musicale et paroles via API)</li>
          <li>Stripe, PayPal, Fedapay (paiements)</li>
          <li>Brevo (emails transactionnels)</li>
        </ul>
      </Section>

      <Section title="5. Durée de conservation">
        <p>Vos données sont conservées tant que votre compte est actif. En cas de suppression de compte, vos données personnelles sont supprimées sous 30 jours. Les fichiers audio générés sont supprimés immédiatement.</p>
      </Section>

      <Section title="6. Vos droits">
        <p>Conformément au RGPD, vous disposez d'un droit d'accès, de rectification, de suppression et de portabilité de vos données. Pour exercer ces droits : abouamhster@gmail.com</p>
      </Section>

      <Section title="7. Cookies">
        <p>Nous utilisons uniquement des cookies essentiels au fonctionnement du service (session d'authentification). Aucun cookie publicitaire ou de tracking tiers n'est utilisé.</p>
      </Section>

      <Section title="8. Sécurité">
        <p>Les données sont chiffrées en transit (HTTPS) et au repos. L'accès aux données est protégé par Row Level Security (RLS) : chaque utilisateur ne peut accéder qu'à ses propres données.</p>
      </Section>
    </>
  );
}
