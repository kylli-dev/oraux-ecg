"use client";

// Pointage d'un candidat par le surveillant, partagé par « Liste & présences » et
// « Aujourd'hui » : deux boutons Présent / Absent. Un clic sur l'état déjà choisi l'annule
// (le candidat redevient « pas encore pointé ») ; Présent sur un absent le remet présent.

import { Loader2, UserCheck, UserX } from "lucide-react";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8002";

export type EpreuvePointable = {
  id: number;
  statut: string;
  candidat_id: number | null;
  presence_le?: string | null; // heure d'arrivée (ISO UTC)
};

export type EtatPointage = "present" | "absent" | "attendu";

export function etatPointage(e: EpreuvePointable): EtatPointage {
  if (e.statut === "ABSENT") return "absent";
  return e.presence_le ? "present" : "attendu";
}

// « 10:17 », heure locale
export function heureArrivee(e: EpreuvePointable): string | null {
  return e.presence_le
    ? new Date(e.presence_le).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })
    : null;
}

// Envoie le pointage voulu ; renvoie un message d'erreur, ou null si c'est enregistré
export async function pointer(e: EpreuvePointable, cible: "present" | "absent"): Promise<string | null> {
  const actuel = etatPointage(e);
  const [route, methode] =
    cible === "present"
      ? ["marquer-present", actuel === "present" ? "DELETE" : "POST"]
      : ["marquer-absent", actuel === "absent" ? "DELETE" : "POST"];
  try {
    const r = await fetch(`${API}/surveillant/me/epreuves/${e.id}/${route}`, {
      method: methode,
      headers: { Authorization: `Bearer ${sessionStorage.getItem("surveillant_token") ?? ""}` },
    });
    if (r.ok) return null;
    const d = await r.json().catch(() => ({}));
    return d.detail ?? "L'enregistrement a échoué. Réessayez.";
  } catch {
    return "L'enregistrement a échoué. Vérifiez votre connexion.";
  }
}

export function BoutonsPointage({
  epreuve,
  occupe,
  onPointer,
  grand = false,
}: {
  epreuve: EpreuvePointable;
  occupe: boolean;
  onPointer: (cible: "present" | "absent") => void;
  grand?: boolean;
}) {
  const etat = etatPointage(epreuve);
  const taille = grand ? "h-12 px-5 text-base" : "h-10 px-3.5 text-sm";
  const base = `inline-flex items-center justify-center gap-1.5 font-semibold border-2 transition disabled:opacity-50 ${taille}`;
  return (
    <div className="inline-flex shrink-0 rounded-xl overflow-hidden" role="group" aria-label="Pointage">
      <button
        onClick={() => onPointer("present")}
        disabled={occupe}
        aria-pressed={etat === "present"}
        title={etat === "present" ? "Annuler le pointage" : "Candidat arrivé"}
        className={`${base} rounded-l-xl ${
          etat === "present" ? "bg-green-600 border-green-600 text-white" : "bg-white border-gray-300 text-gray-900 hover:border-green-600"
        }`}
      >
        {occupe ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserCheck className="h-4 w-4" />}
        Présent
      </button>
      <button
        onClick={() => onPointer("absent")}
        disabled={occupe}
        aria-pressed={etat === "absent"}
        title={etat === "absent" ? "Annuler l'absence" : "Candidat absent"}
        className={`${base} -ml-0.5 rounded-r-xl ${
          etat === "absent" ? "bg-amber-500 border-amber-500 text-white" : "bg-white border-gray-300 text-gray-900 hover:border-amber-500"
        }`}
      >
        <UserX className="h-4 w-4" />
        Absent
      </button>
    </div>
  );
}
