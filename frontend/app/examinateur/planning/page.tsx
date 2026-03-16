"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Loader2, CheckCircle, Clock } from "lucide-react";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8002";

type Epreuve = {
  id: number;
  date: string;
  matiere: string;
  heure_debut: string;
  heure_fin: string;
  candidat_id: number | null;
  candidat_nom: string | null;
  candidat_prenom: string | null;
  note_valeur: number | null;
  note_statut: string | null;
};

function authHeaders() {
  const token = sessionStorage.getItem("examinateur_token") ?? "";
  return { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
}

function formatDate(d: string) {
  return new Date(d + "T12:00:00").toLocaleDateString("fr-FR", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  });
}

export default function ExaminateurPlanningPage() {
  const router = useRouter();
  const [epreuves, setEpreuves] = useState<Epreuve[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  // Local note drafts: epreuve_id → string value
  const [drafts, setDrafts] = useState<Record<number, string>>({});
  const [saving, setSaving] = useState<Record<number, boolean>>({});
  const [saved, setSaved] = useState<Record<number, boolean>>({});

  const load = useCallback(async () => {
    const token = sessionStorage.getItem("examinateur_token");
    if (!token) { router.replace("/examinateur"); return; }

    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${API}/examinateur/me/epreuves`, { headers: authHeaders() });
      if (res.status === 401) { sessionStorage.removeItem("examinateur_token"); router.replace("/examinateur"); return; }
      if (!res.ok) throw new Error("Erreur lors du chargement");
      const data: Epreuve[] = await res.json();
      setEpreuves(data);
      // Pre-fill drafts with existing notes
      const init: Record<number, string> = {};
      data.forEach((e) => {
        if (e.note_valeur !== null) init[e.id] = String(e.note_valeur);
      });
      setDrafts(init);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => { load(); }, [load]);

  async function saveNote(epreuve: Epreuve) {
    const raw = drafts[epreuve.id] ?? "";
    const valeur = parseFloat(raw.replace(",", "."));
    if (isNaN(valeur) || valeur < 0 || valeur > 20) {
      setError("La note doit être un nombre entre 0 et 20");
      return;
    }
    setSaving((s) => ({ ...s, [epreuve.id]: true }));
    setError("");
    try {
      const res = await fetch(`${API}/examinateur/me/epreuves/${epreuve.id}/noter`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ valeur }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail ?? "Erreur lors de l'enregistrement");
      }
      setSaved((s) => ({ ...s, [epreuve.id]: true }));
      setTimeout(() => setSaved((s) => ({ ...s, [epreuve.id]: false })), 2500);
      // Update local state
      setEpreuves((prev) =>
        prev.map((e) => e.id === epreuve.id ? { ...e, note_valeur: valeur, note_statut: "BROUILLON" } : e)
      );
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving((s) => ({ ...s, [epreuve.id]: false }));
    }
  }

  // Group by date
  const byDate = epreuves.reduce<Record<string, Epreuve[]>>((acc, e) => {
    (acc[e.date] ??= []).push(e);
    return acc;
  }, {});

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-white">
      <header className="bg-white border-b border-gray-100 shadow-sm">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center gap-3">
          <button onClick={() => router.back()} className="text-gray-400 hover:text-gray-700 transition">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <h1 className="text-lg font-semibold text-gray-900">Mon planning & notes</h1>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8">
        {error && (
          <div className="mb-5 rounded-lg bg-red-50 border border-red-100 px-4 py-3 text-sm text-red-600">
            {error}
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-6 w-6 animate-spin text-purple-400" />
          </div>
        ) : epreuves.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-gray-200 p-16 text-center">
            <Clock className="h-10 w-10 mx-auto mb-3 text-gray-300" />
            <p className="text-base font-medium text-gray-500">Aucune épreuve assignée</p>
            <p className="text-sm text-gray-400 mt-1">Vos créneaux apparaîtront ici dès leur affectation.</p>
          </div>
        ) : (
          <div className="space-y-8">
            {Object.entries(byDate).sort(([a], [b]) => a.localeCompare(b)).map(([date, eps]) => (
              <div key={date}>
                <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3 capitalize">
                  {formatDate(date)}
                </h2>
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                  {eps.map((ep, i) => (
                    <div key={ep.id} className={`px-5 py-4 ${i > 0 ? "border-t border-gray-100" : ""}`}>
                      <div className="flex items-start justify-between gap-4 flex-wrap">
                        {/* Left: info épreuve */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-sm font-semibold text-gray-900">{ep.matiere}</span>
                            <span className="text-xs text-gray-400 font-mono">{ep.heure_debut} – {ep.heure_fin}</span>
                          </div>
                          {ep.candidat_id ? (
                            <p className="text-sm text-gray-600">
                              {ep.candidat_prenom} <span className="font-medium">{ep.candidat_nom}</span>
                            </p>
                          ) : (
                            <p className="text-sm text-gray-400 italic">Aucun candidat assigné</p>
                          )}
                          {ep.note_statut === "PUBLIE" && (
                            <span className="inline-block mt-1 text-xs bg-green-100 text-green-700 rounded-full px-2 py-0.5 font-medium">
                              Note publiée
                            </span>
                          )}
                        </div>

                        {/* Right: note input */}
                        {ep.candidat_id && (
                          <div className="flex items-center gap-2 shrink-0">
                            <div className="relative">
                              <input
                                type="number"
                                min={0}
                                max={20}
                                step={0.5}
                                value={drafts[ep.id] ?? ""}
                                onChange={(e) =>
                                  setDrafts((d) => ({ ...d, [ep.id]: e.target.value }))
                                }
                                placeholder="—"
                                disabled={ep.note_statut === "PUBLIE"}
                                className="w-20 px-2.5 py-1.5 text-sm text-center rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-purple-400 disabled:bg-gray-50 disabled:text-gray-400"
                              />
                              <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-gray-400 pointer-events-none">/20</span>
                            </div>

                            {ep.note_statut !== "PUBLIE" && (
                              <button
                                onClick={() => saveNote(ep)}
                                disabled={saving[ep.id] || !drafts[ep.id]}
                                className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg bg-purple-600 text-white font-semibold hover:bg-purple-700 transition disabled:opacity-50"
                              >
                                {saving[ep.id] ? (
                                  <Loader2 className="h-3 w-3 animate-spin" />
                                ) : saved[ep.id] ? (
                                  <CheckCircle className="h-3 w-3" />
                                ) : null}
                                {saved[ep.id] ? "Enregistré" : "Enregistrer"}
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
