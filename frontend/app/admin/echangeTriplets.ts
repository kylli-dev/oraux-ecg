// Contrôles d'un échange de triplets, communs à l'assistant de journée type (étape 2) et à la
// Matrice oraux : on refuse ce qui casserait un triplet, on signale ce qui ne respecte plus
// la marge entre deux passages d'un même candidat.

// Même marge que MARGIN_TRANSITION_MINUTES (generation.py, triplets.py, buildMatrix)
export const MARGE_ENTRE_EPREUVES = 30;

// Une case de la matrice : le triplet k passe `matiere` ; horaires en minutes depuis minuit.
export type CaseTriplet = {
  id: string;        // identifie la case (bloc, ligne, colonne)
  k: number;         // triplet (affiché T{k + 1})
  matiere: string;
  debExam: number;   // début de l'examen
  debut: number;     // début de la préparation
  fin: number;       // fin de l'examen
};

const hm = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;

export const minutes = (s: string) => {
  const [h, m] = s.split(":").map(Number);
  return h * 60 + (m || 0);
};

// Échanges interdits : deux matières différentes (le triplet aurait deux fois la même
// matière) ou deux cases à la même heure (échange horizontal, entre jurys en parallèle).
export function refusEchange(a: CaseTriplet, b: CaseTriplet): string | null {
  if (a.matiere !== b.matiere) {
    return `Échange refusé : T${a.k + 1} (${a.matiere}) et T${b.k + 1} (${b.matiere}) ne sont pas dans la même matière. ` +
      `Un triplet doit garder une épreuve par matière : échangez seulement à l'intérieur d'une même colonne.`;
  }
  if (a.debExam === b.debExam) {
    return `Échange refusé : T${a.k + 1} et T${b.k + 1} passent ${a.matiere} à la même heure (${hm(a.debExam)}). ` +
      `Les échanges horizontaux sont interdits.`;
  }
  return null;
}

// Les cases telles qu'elles seraient après l'échange de a et b
export function apresEchange(cases: CaseTriplet[], a: CaseTriplet, b: CaseTriplet): CaseTriplet[] {
  return cases.map((c) => (c.id === a.id ? { ...c, k: b.k } : c.id === b.id ? { ...c, k: a.k } : c));
}

// Pour chaque triplet donné : ses épreuves dans l'ordre, et l'écart entre la fin de chacune
// et le début de préparation de la suivante. Un écart négatif est un chevauchement.
export function controleEcarts(cases: CaseTriplet[], triplets: number[], marge = MARGE_ENTRE_EPREUVES) {
  const chevauchements: string[] = [];
  const ecartsCourts: string[] = [];
  for (const k of new Set(triplets)) {
    const siennes = cases.filter((c) => c.k === k).sort((x, y) => x.debut - y.debut);
    for (let i = 1; i < siennes.length; i++) {
      // la fin la plus tardive parmi les épreuves précédentes
      const prev = siennes.slice(0, i).reduce((p, c) => (c.fin > p.fin ? c : p));
      const next = siennes[i];
      const ecart = next.debut - prev.fin;
      if (ecart < 0) {
        chevauchements.push(
          `T${k + 1} : la préparation de ${next.matiere} (${hm(next.debut)}) commence avant la fin de ${prev.matiere} (${hm(prev.fin)})`
        );
      } else if (ecart < marge) {
        ecartsCourts.push(
          `T${k + 1} : ${ecart} min entre la fin de ${prev.matiere} (${hm(prev.fin)}) et la préparation de ${next.matiere} (${hm(next.debut)}), minimum ${marge} min`
        );
      }
    }
  }
  return { chevauchements, ecartsCourts };
}

// Exceptions déjà présentes dans la matrice, tous triplets confondus
export function exceptionsMatrice(cases: CaseTriplet[]): string[] {
  const { chevauchements, ecartsCourts } = controleEcarts(cases, cases.map((c) => c.k));
  return [...chevauchements, ...ecartsCourts];
}

// Décision pour un échange : refus (message) ou exceptions à faire confirmer (liste, vide si
// tout va bien). Seules comptent les exceptions que l'échange CRÉE : celles déjà présentes
// dans la matrice sont signalées à part (exceptionsMatrice).
export function verifierEchange(cases: CaseTriplet[], a: CaseTriplet, b: CaseTriplet): { refus: string | null; exceptions: string[] } {
  const refus = refusEchange(a, b);
  if (refus) return { refus, exceptions: [] };
  const avant = controleEcarts(cases, [a.k, b.k]);
  const apres = controleEcarts(apresEchange(cases, a, b), [a.k, b.k]);
  const chevauchements = apres.chevauchements.filter((m) => !avant.chevauchements.includes(m));
  if (chevauchements.length) {
    return { refus: `Échange refusé : un candidat serait à deux endroits en même temps.\n${chevauchements.join("\n")}`, exceptions: [] };
  }
  return { refus: null, exceptions: apres.ecartsCourts.filter((m) => !avant.ecartsCourts.includes(m)) };
}
