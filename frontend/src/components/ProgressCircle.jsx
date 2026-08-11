import { useEffect, useState } from "react";

// Cercle de progression animé qui simule l'avancement.
// estimatedSeconds = durée estimée totale.
// Le cercle se remplit progressivement, ralentit vers la fin (jamais 100% tant que c'est pas fini).
export default function ProgressCircle({ estimatedSeconds = 30, active = true, size = 80, label = "" }) {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (!active) return;
    setProgress(0);
    const start = Date.now();

    const interval = setInterval(() => {
      const elapsed = (Date.now() - start) / 1000;
      // Courbe logarithmique : avance vite au début, ralentit vers la fin
      // Plafonne à 92% — les 8% restants se remplissent quand active passe à false
      const raw = Math.min(0.92, 1 - Math.exp(-2.5 * elapsed / estimatedSeconds));
      setProgress(Math.round(raw * 100));
    }, 200);

    return () => clearInterval(interval);
  }, [active, estimatedSeconds]);

  useEffect(() => {
    if (!active && progress > 0) setProgress(100);
  }, [active]);

  const radius = (size - 8) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (progress / 100) * circumference;

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          {/* Track */}
          <circle
            cx={size / 2} cy={size / 2} r={radius}
            stroke="currentColor"
            className="text-line"
            strokeWidth="6"
            fill="none"
          />
          {/* Progress */}
          <circle
            cx={size / 2} cy={size / 2} r={radius}
            stroke="currentColor"
            className="text-safran"
            strokeWidth="6"
            fill="none"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            style={{ transition: "stroke-dashoffset 0.3s ease" }}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="font-display text-xl font-bold">{progress}%</span>
        </div>
      </div>
      {label && <p className="text-sm text-muted text-center">{label}</p>}
    </div>
  );
}
