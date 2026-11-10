// Gabarit (journée type) appliqué à chaque demi-journée d'un planning.
// Données : GET plannings/{id}/gabarits-appliques et la vue journée (backend/app/api/plannings.py).

export type GabaritDemiJournee = {
  type: string; // MATIN | APRES_MIDI
  journee_type_nom?: string | null; // null = création/génération manuelle, ou antérieure à l'enregistrement du gabarit
  gabarit_applique_le?: string | null; // ISO UTC
};

const ORDRE: Record<string, number> = { MATIN: 0, APRES_MIDI: 1 };
const LIBELLE_TYPE: Record<string, string> = { MATIN: "Matin", APRES_MIDI: "Après-midi" };

/** « HGG 17 » si toute la date vient du même gabarit, sinon « Matin : X · Après-midi : non renseigné ». */
export function resumeGabarits(djs: GabaritDemiJournee[]): string {
  if (djs.length === 0) return "";
  const tries = [...djs].sort((a, b) => (ORDRE[a.type] ?? 9) - (ORDRE[b.type] ?? 9));
  const noms = new Set(tries.map((d) => d.journee_type_nom ?? null));
  if (noms.size === 1) return tries[0].journee_type_nom ?? "Non renseigné";
  return tries
    .map((d) => `${LIBELLE_TYPE[d.type] ?? d.type} : ${d.journee_type_nom ?? "non renseigné"}`)
    .join(" · ");
}

/** Date d'application la plus récente, « le 10/11 à 14:05 » (heure de Paris). */
export function dateApplication(djs: GabaritDemiJournee[]): string {
  const dates = djs.map((d) => d.gabarit_applique_le).filter((d): d is string => !!d).sort();
  if (dates.length === 0) return "";
  const d = new Date(dates[dates.length - 1]);
  const jour = d.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "Europe/Paris" });
  const heure = d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Paris" });
  return `le ${jour} à ${heure}`;
}

/** Regroupe la liste de l'API par date : { "2026-06-12": [...] }. */
export function gabaritsParDate<T extends GabaritDemiJournee & { date: string }>(liste: T[]): Record<string, T[]> {
  const parDate: Record<string, T[]> = {};
  for (const l of liste) (parDate[l.date] ??= []).push(l);
  return parDate;
}
