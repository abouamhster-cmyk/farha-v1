// Découpage de l'extrait gratuit — remplace l'ancienne troncature par octets
// qui supposait un débit fixe (128kbps mp3 / 48kHz-16bit-stéréo wav).
//
// BUG CORRIGÉ (critique, trouvé en prod) : quand le débit réel renvoyé par
// l'API (souvent plus bas que l'hypothèse) faisait que le nombre d'octets
// pour 30s calculé dépassait la taille réelle du fichier, `slice(0, min(...))`
// ne tronquait RIEN — l'extrait "gratuit" contenait alors la chanson
// COMPLÈTE, identique au fichier payant. Le paywall audio ne servait plus
// à rien pour cette chanson.
//
// Cette version lit le débit RÉEL directement dans le fichier (header RIFF
// pour le wav, header de frame MPEG pour le mp3) au lieu de le deviner, ET
// applique un plafond de sécurité dur (jamais plus de 60% du fichier) qui
// garantit qu'un extrait ne peut JAMAIS égaler le fichier complet, même si
// la détection de débit se trompe (ex: mp3 VBR, dont le débit varie et
// n'est donc qu'approximé par le débit de la première frame).
const HARD_MAX_FRACTION = 0.6;

function detectWavByteRate(bytes: Uint8Array): number | null {
  // Layout canonique RIFF/WAVE : "RIFF"(4) size(4) "WAVE"(4) "fmt "(4)
  // subchunkSize(4) audioFormat(2) channels(2) sampleRate(4) byteRate(4)...
  if (bytes.length < 32) return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const isRiff = bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46; // "RIFF"
  const isWave = bytes[8] === 0x57 && bytes[9] === 0x41 && bytes[10] === 0x56 && bytes[11] === 0x45; // "WAVE"
  const isFmt = bytes[12] === 0x66 && bytes[13] === 0x6d && bytes[14] === 0x74 && bytes[15] === 0x20; // "fmt "
  if (!isRiff || !isWave || !isFmt) return null;

  const byteRate = view.getUint32(28, true);
  return byteRate > 0 ? byteRate : null;
}

// MPEG1/2/2.5 Layer III uniquement (le seul cas réaliste pour "audio/mp3"
// renvoyé par une API). CBR uniquement : pour un fichier VBR, le débit de
// la première frame n'est qu'une approximation — compensé par
// HARD_MAX_FRACTION ci-dessus.
const MPEG1_L3_BITRATES = [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320, -1];
const MPEG2_L3_BITRATES = [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160, -1];

function detectMp3ByteRate(bytes: Uint8Array): number | null {
  const limit = Math.min(bytes.length - 4, 64 * 1024); // pas la peine de scanner tout le fichier
  for (let i = 0; i < limit; i++) {
    if (bytes[i] !== 0xff || (bytes[i + 1] & 0xe0) !== 0xe0) continue;

    const versionBits = (bytes[i + 1] >> 3) & 0x03; // 00=MPEG2.5, 10=MPEG2, 11=MPEG1
    const layerBits = (bytes[i + 1] >> 1) & 0x03; // 01=Layer III
    if (layerBits !== 0x01) continue;

    const bitrateIndex = (bytes[i + 2] >> 4) & 0x0f;
    const isMpeg1 = versionBits === 0x03;
    const table = isMpeg1 ? MPEG1_L3_BITRATES : MPEG2_L3_BITRATES;
    const kbps = table[bitrateIndex];
    if (!kbps || kbps < 0) continue; // index "free" ou "bad" — frame invalide pour notre usage

    return (kbps * 1000) / 8;
  }
  return null;
}

// Fallbacks conservateurs (débit élevé => moins d'octets gardés => on
// tronque plus court plutôt que pas assez si la détection échoue).
const FALLBACK_BYTES_PER_SECOND = { mp3: 40000, wav: 192000 }; // 320kbps mp3 ; 48kHz/16bit/stéréo wav

export function truncateAudioBytes(
  audioBytes: Uint8Array,
  ext: "mp3" | "wav",
  seconds: number
): { bytes: Uint8Array; bytesPerSecond: number } {
  const detected = ext === "wav" ? detectWavByteRate(audioBytes) : detectMp3ByteRate(audioBytes);
  const bytesPerSecond = detected ?? FALLBACK_BYTES_PER_SECOND[ext];

  const softLimit = Math.round(seconds * bytesPerSecond);
  const hardCeiling = Math.floor(audioBytes.length * HARD_MAX_FRACTION);
  const byteLimit = Math.min(softLimit, hardCeiling, audioBytes.length);

  return { bytes: audioBytes.slice(0, byteLimit), bytesPerSecond };
}
