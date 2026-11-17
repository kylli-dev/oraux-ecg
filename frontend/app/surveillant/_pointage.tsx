"use client";

// Pointage d'un candidat par le surveillant, partagé par « Liste & présences » et
// « Aujourd'hui » : deux boutons Présent / Absent. Un clic sur l'état déjà choisi l'annule
// (le candidat redevient « pas encore pointé ») ; Présent sur un absent le remet présent.
// Et le signalement d'un incident sur le créneau (BlocIncident), transmis aux admins.

import { useState } from "react";
import { AlertTriangle, Loader2, UserCheck, UserX } from "lucide-react";
import { RED, inputClass, inputStyle } from "./_ui";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8002";

export type EpreuvePointable = {
  id: number;
  statut: string;
  candidat_id: number | null;
  presence_le?: string | null; // heure d'arrivée (ISO UTC)
  incident?: string | null;
  incident_le?: string | null; // ISO UTC
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

// Enregistre l'incident (texte vide = le retirer) ; renvoie un message d'erreur ou null
async function enregistrerIncident(id: number, texte: string): Promise<string | null> {
  try {
    const r = await fetch(`${API}/surveillant/me/epreuves/${id}/incident`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${sessionStorage.getItem("surveillant_token") ?? ""}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ texte }),
    });
    if (r.ok) return null;
    const d = await r.json().catch(() => ({}));
    return typeof d.detail === "string" ? d.detail : "L'enregistrement a échoué. Réessayez.";
  } catch {
    return "L'enregistrement a échoué. Vérifiez votre connexion.";
  }
}

// Incident du créneau : affiché s'il existe (modifier / retirer), sinon un lien pour le
// signaler. Les admins sont prévenus à chaque nouvel incident.
export function BlocIncident({ epreuve, onEnregistre }: { epreuve: EpreuvePointable; onEnregistre: () => void }) {
  const [edition, setEdition] = useState(false);
  const [texte, setTexte] = useState(epreuve.incident ?? "");
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState("");

  async function valider(valeur: string) {
    setEnvoi(true);
    setErreur("");
    const e = await enregistrerIncident(epreuve.id, valeur);
    setEnvoi(false);
    if (e) { setErreur(e); return; }
    setEdition(false);
    onEnregistre();
  }

  if (edition) {
    return (
      <div className="rounded-xl border border-gray-200 bg-gray-50 p-3 space-y-2">
        <label className="block text-xs font-semibold text-gray-900">Incident sur ce créneau</label>
        <textarea
          value={texte}
          onChange={(e) => setTexte(e.target.value)}
          maxLength={1000}
          rows={3}
          autoFocus
          placeholder="Ex. arrivé avec 10 min de retard, pièce d'identité manquante, malaise pendant l'épreuve…"
          className={`${inputClass} resize-y`}
          style={inputStyle}
        />
        {erreur && <p className="text-xs font-medium text-red-700">{erreur}</p>}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => valider(texte)}
            disabled={envoi || !texte.trim()}
            className="h-9 px-4 rounded-lg text-white text-sm font-semibold shadow-sm transition hover:opacity-90 disabled:opacity-50 inline-flex items-center gap-1.5"
            style={{ backgroundColor: RED }}
          >
            {envoi && <Loader2 className="h-4 w-4 animate-spin" />}
            Enregistrer et prévenir l&apos;admin
          </button>
          <button
            onClick={() => { setEdition(false); setTexte(epreuve.incident ?? ""); setErreur(""); }}
            className="h-9 px-3 rounded-lg border border-gray-300 bg-white text-sm font-medium text-gray-900 hover:bg-gray-100 transition"
          >
            Annuler
          </button>
          <span className="ml-auto text-[11px] text-gray-700 tabular-nums">{texte.length} / 1000</span>
        </div>
      </div>
    );
  }

  if (epreuve.incident) {
    const quand = epreuve.incident_le
      ? new Date(epreuve.incident_le).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })
      : null;
    return (
      <div className="rounded-xl border border-gray-200 border-l-4 bg-white px-3 py-2.5 text-sm text-gray-900" style={{ borderLeftColor: RED }}>
        <p className="flex items-start gap-1.5">
          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" style={{ color: RED }} />
          <span className="min-w-0 whitespace-pre-line">
            <strong>Incident{quand ? ` (signalé à ${quand})` : ""} :</strong> {epreuve.incident}
          </span>
        </p>
        {erreur && <p className="mt-1 text-xs font-medium text-red-700">{erreur}</p>}
        <div className="mt-1.5 flex gap-3 pl-5">
          <button onClick={() => { setTexte(epreuve.incident ?? ""); setEdition(true); }} className="text-xs font-semibold underline underline-offset-2" style={{ color: RED }}>
            Modifier
          </button>
          <button onClick={() => valider("")} disabled={envoi} className="text-xs font-semibold text-gray-800 underline underline-offset-2 disabled:opacity-50">
            Retirer
          </button>
        </div>
      </div>
    );
  }

  return (
    <button
      onClick={() => { setTexte(""); setEdition(true); }}
      className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-800 hover:text-[#C62828] transition"
    >
      <AlertTriangle className="h-4 w-4" />
      Signaler un incident
    </button>
  );
}
