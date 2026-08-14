// Blocs "skeleton" reutilisables avec effet shimmer.
// Utilises comme fallback de chargement (plutot qu'un ecran vide)
// et pour les listes en cours de chargement.

export function Skeleton({ className = "" }) {
  return (
    <div
      className={`relative overflow-hidden rounded-lg bg-line/50 ${className}`}
    >
      <div className="absolute inset-0 -translate-x-full animate-shimmer bg-gradient-to-r from-transparent via-white/60 to-transparent" />
    </div>
  );
}

// Fallback affiche pendant le chargement d'un chunk de page (code-splitting).
// Discret : la barre de progression du haut porte le ressenti de vitesse.
export function RouteFallback() {
  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 animate-fadeIn">
      <Skeleton className="h-8 w-48 mb-6" />
      <Skeleton className="h-4 w-72 mb-8" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="rounded-2xl border border-line bg-paper p-5">
            <Skeleton className="h-32 w-full mb-4" />
            <Skeleton className="h-4 w-3/4 mb-2" />
            <Skeleton className="h-4 w-1/2" />
          </div>
        ))}
      </div>
    </div>
  );
}
