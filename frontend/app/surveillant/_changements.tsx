"use client";

// Fenêtre « Votre planning a changé » : un admin a modifié une affectation (salle,
// horaire, candidat, créneau ajouté ou retiré) depuis la dernière visite du surveillant.
// Elle s'ouvre sur chaque page jusqu'au clic sur « J'ai pris connaissance ».

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { AlertTriangle, Loader2, X } from "lucide-react";
import { RED } from "./_ui";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8002";
const PAGES_PUBLIQUES = ["/surveillant", "/surveillant/mot-de-passe-oublie", "/surveillant/reinitialiser-mot-de-passe"];

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
  const [envoi, setEnvoi] = useState(false);
  // « Plus tard » ferme la fenêtre pour la page en cours ; elle revient à la page suivante
  const [fermeSur, setFermeSur] = useState<string | null>(null);

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
      /* la fenêtre reste affichée, on pourra recliquer */
    }
    setEnvoi(false);
  }

  if (publique || changements.length === 0 || fermeSur === pathname) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-[2px] flex items-center justify-center p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="titre-changements"
        className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[85vh] flex flex-col overflow-hidden"
      >
        {/* En-tête */}
        <div className="flex items-start gap-3 px-5 py-4 border-b border-gray-200">
          <div className="h-10 w-10 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: RED + "14", color: RED }}>
            <AlertTriangle className="h-5 w-5" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 id="titre-changements" className="text-base font-bold text-gray-900">Votre planning a changé</h2>
            <p className="text-sm text-gray-800">
              {changements.length} modification{changements.length > 1 ? "s" : ""} depuis votre dernière visite.
              Vérifiez vos salles et horaires avant de vous présenter.
            </p>
          </div>
          <button
            onClick={() => setFermeSur(pathname)}
            className="p-1.5 rounded-lg text-gray-800 hover:bg-gray-100 hover:text-black transition"
            title="Fermer (la fenêtre reviendra tant que vous n'avez pas confirmé)"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Liste des modifications */}
        <ul className="flex-1 overflow-y-auto px-5 py-3 divide-y divide-gray-100">
          {changements.map((c, i) => (
            <li key={i} className="flex items-start gap-3 py-2.5">
              <div className="w-20 shrink-0 text-sm tabular-nums">
                <p className="font-semibold text-gray-900 capitalize">{jour(c.date)}</p>
                <p className="text-gray-800">{c.heure}</p>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900">{c.matiere}</p>
                {c.type === "ajoute" && (
                  <span className="inline-block mt-0.5 text-xs font-semibold rounded-full px-2 py-0.5 bg-green-50 border border-green-200 text-green-800">Nouveau créneau</span>
                )}
                {c.type === "retire" && (
                  <span className="inline-block mt-0.5 text-xs font-semibold rounded-full px-2 py-0.5 bg-red-50 border border-red-200" style={{ color: RED }}>Créneau retiré</span>
                )}
                {c.type === "modifie" && (
                  <p className="text-sm text-gray-900"><span className="font-semibold">Modifié :</span> {c.details.join(", ")}</p>
                )}
              </div>
            </li>
          ))}
        </ul>

        {/* Actions */}
        <div className="flex flex-wrap justify-end gap-2 px-5 py-4 border-t border-gray-200 bg-gray-50">
          <button
            onClick={() => setFermeSur(pathname)}
            className="h-9 px-4 rounded-lg border border-gray-300 bg-white text-sm font-medium text-gray-900 hover:bg-gray-100 transition"
          >
            Plus tard
          </button>
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
