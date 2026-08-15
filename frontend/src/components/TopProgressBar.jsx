import { useEffect, useState } from "react";
import { subscribe } from "../lib/progress.js";

// Barre de chargement fine en haut de l'ecran, degrade safran,
// avec une pastille lumineuse qui court en tete de barre.
export default function TopProgressBar() {
  const [{ value, visible }, setState] = useState({ value: 0, visible: false });

  useEffect(() => subscribe(setState), []);

  return (
    <div
      aria-hidden="true"
      className="fixed top-0 left-0 right-0 z-[100] h-[3px] pointer-events-none"
      style={{ opacity: visible ? 1 : 0, transition: "opacity 260ms ease" }}
    >
      <div
        className="h-full bg-gradient-to-r from-safran via-safran-bright to-henne"
        style={{
          width: `${Math.min(value, 1) * 100}%`,
          transition: "width 220ms cubic-bezier(0.22, 1, 0.36, 1)",
        }}
      />
    </div>
  );
}
