import { useEffect } from "react";
import { done } from "../lib/progress.js";

// Enveloppe chaque page. Comme elle vit a l'interieur du <Suspense>,
// son montage coincide avec la disponibilite reelle du contenu (chunk
// charge) : on termine alors la barre de progression et on joue une
// micro-animation d'entree. Remonte a chaque changement de route.
export default function PageTransition({ children }) {
  useEffect(() => {
    done();
  }, []);

  return <div className="animate-pageEnter">{children}</div>;
}
