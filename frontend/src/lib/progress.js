// Store minimaliste facon NProgress : une barre de chargement en haut
// qui monte de facon fluide (trickle) puis se termine a 100%.
// Aucune dependance externe.

let value = 0;
let visible = false;
let trickleTimer = null;
const listeners = new Set();

function emit() {
  for (const fn of listeners) fn({ value, visible });
}

export function subscribe(fn) {
  listeners.add(fn);
  fn({ value, visible });
  return () => listeners.delete(fn);
}

function clearTrickle() {
  if (trickleTimer) {
    clearInterval(trickleTimer);
    trickleTimer = null;
  }
}

export function start() {
  clearTrickle();
  visible = true;
  // On repart d'un petit pourcentage pour un demarrage percu instantane
  value = value > 0 && value < 1 ? value : 0.08;
  emit();

  // Trickle : on avance vite vers 90% max tant que non termine
  trickleTimer = setInterval(() => {
    const remaining = 0.9 - value;
    if (remaining <= 0.001) return;
    value += remaining * 0.2;
    emit();
  }, 140);
}

export function done() {
  clearTrickle();
  if (!visible) return;
  value = 1;
  emit();
  // On laisse la barre atteindre 100% puis on la cache en douceur
  setTimeout(() => {
    visible = false;
    emit();
    setTimeout(() => {
      value = 0;
      emit();
    }, 200);
  }, 140);
}
