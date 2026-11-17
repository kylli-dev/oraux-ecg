"use client";

// Bandeau « Votre planning a changé » : un admin a modifié une affectation (salle,
// horaire, candidat, créneau ajouté ou retiré) depuis la dernière visite du surveillant.
// Il reste affiché sur toutes les pages jusqu'au clic sur « J'ai pris connaissance ».

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { AlertTriangle, Loader2 } from "lucide-react";
import { RED } from "./_ui";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8002";
const PAGES_PUBLIQUES = ["/surveillant", "/surveillant/mot-de-passe-oublie", "/surveillant/reinitialiser-mot-de-passe"];
const MAX_AFFICHES = 8;

type Changement = {
  date: string;
  heure: string;
  matiere: string;
  type: "ajoute" | "retire" | "modifie";
  details: string[];
};

function jour(date: string) {
  return new Date(date + "T12:00:00").toLocaleDateString("fr-FR", { weekday: "short", day: "2-digit", month: "2-digit" });
}

export function BandeauChangements() {
  const pathname = usePathname();
  const [changements, setChangements] = useState<Changement[]>([]);
  const [tout, setTout] = useState(false);
  const [envoi, setEnvoi] = useState(false);

  const publique = PAGES_PUBLIQUES.includes(pathname);

  // Revérifié à chaque changement de page : un admin peut modifier pendant la session
  useEffect(() => {
    if (publique) return;
    const token = sessionStorage.getItem("surveillant_token");
    if (!token) return;
    let annule = false;
    fetch(`${API}/surveillant/me/changements`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (!annule && d) setChangements(d.changements ?? []); })
      .catch(() => {});
    return () => { annule = true; };
  }, [pathname, publique]);

  async function priseDeConnaissance() {
    setEnvoi(true);
    try {
      const r = await fetch(`${API}/surveillant/me/changements/vu`, {
        method: "POST",
        headers: { Authorization: `Bearer ${sessionStorage.getItem("surveillant_token") ?? ""}` },
      });
      if (r.ok) setChangements([]);
    } catch {
      /* le bandeau reste affiché, on pourra recliquer */
    }
    setEnvoi(false);
  }

  if (publique || changements.length === 0) return null;
  const affiches = tout ? changements : changements.slice(0, MAX_AFFICHES);

  return (
    <div className="max-w-3xl mx-auto px-4 pt-6">
      <div className="rounded-xl border border-gray-200 border-l-4 bg-white px-4 py-3 shadow-sm" style={{ borderLeftColor: RED }} role="alert">
        <p className="flex items-center gap-2 text-sm font-semibold text-gray-900">
          <AlertTriangle className="h-4 w-4 shrink-0" style={{ color: RED }} />
          Votre planning a changé depuis votre dernière visite
        </p>
        <ul className="mt-2 space-y-1 pl-6 text-sm text-gray-900">
          {affiches.map((c, i) => (
            <li key={i} className="list-disc">
              <span className="font-medium capitalize">{jour(c.date)}</span> {c.heure} · {c.matiere} :{" "}
              {c.type === "ajoute" && <strong className="text-green-800">nouveau créneau</strong>}
              {c.type === "retire" && <strong style={{ color: RED }}>créneau retiré</strong>}
              {c.type === "modifie" && <strong>{c.details.join(", ")}</strong>}
            </li>
          ))}
        </ul>
        {changements.length > MAX_AFFICHES && (
          <button onClick={() => setTout((t) => !t)} className="mt-1 pl-6 text-xs font-semibold text-gray-800 underline underline-offset-2">
            {tout ? "Réduire" : `Voir les ${changements.length - MAX_AFFICHES} autres`}
          </button>
        )}
        <div className="mt-3">
          <button
            onClick={priseDeConnaissance}
            disabled={envoi}
            className="h-9 px-4 rounded-lg text-white text-sm font-semibold shadow-sm transition hover:opacity-90 disabled:opacity-50 inline-flex items-center gap-1.5"
            style={{ backgroundColor: RED }}
          >
            {envoi && <Loader2 className="h-4 w-4 animate-spin" />}
            J&apos;ai pris connaissance
          </button>
        </div>
      </div>
    </div>
  );
}
