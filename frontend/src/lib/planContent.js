import { Clock, Headphones, Shield, Crown, Zap, Music, FileText, Download, MessageCircle } from "lucide-react";

export const PLAN_CONTENT = {
  pack4: {
    name: "Découverte",
    popular: false,
    desc: "Pour essayer",
    icon: Music,
    features: [
      "4 musiques complètes",
      "Pochette d'album incluse",
      "Paroles gratuites et modifiables",
      "Crédits sans expiration",
    ],
    benefits: {
      duration: "1 min 30",
      support: "Email sous 48h",
      commercial: false,
    },
  },
  pack10: {
    name: "Créateur",
    popular: true,
    desc: "Idéal pour TikTok, Reels et réseaux",
    icon: Zap,
    discountBadge: "-20 %",
    features: [
      "10 musiques complètes",
      "Pochette d'album incluse",
      "Paroles gratuites et modifiables",
      "Crédits sans expiration",
    ],
    benefits: {
      duration: "2 min",
      support: "Email sous 24h",
      commercial: false,
    },
  },
  pack20: {
    name: "Pro",
    popular: false,
    desc: "Pour les marques et publicités",
    icon: Shield,
    discountBadge: "-33 %",
    features: [
      "20 musiques complètes",
      "Pochette d'album incluse",
      "Paroles gratuites et modifiables",
      "Droits d'usage commercial inclus",
      "Crédits sans expiration",
    ],
    benefits: {
      duration: "2 min 30",
      support: "Prioritaire sous 12h",
      commercial: true,
    },
  },
  pack40: {
    name: "Studio VIP",
    popular: false,
    desc: "Pour agences et créateurs fréquents",
    icon: Crown,
    discountBadge: "-35 %",
    features: [
      "40 musiques complètes",
      "Pochette d'album incluse",
      "Paroles gratuites et modifiables",
      "Droits d'usage commercial inclus",
      "Crédits sans expiration",
      "Support privé WhatsApp 7j/7",
    ],
    benefits: {
      duration: "3 min",
      support: "WhatsApp 7j/7",
      commercial: true,
    },
  },
};

export const PLAN_ORDER = ["pack4", "pack10", "pack20", "pack40"];

export function formatEuros(cents) {
  return (
    (cents / 100).toLocaleString("fr-FR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }) + " €"
  );
}
