"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Loader2, Clock, Download, AlertTriangle, CheckCircle, UserX } from "lucide-react";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8002";

type Epreuve = {
  id: number;
  date: string;
  matiere: string;
  heure_debut: string;
  heure_fin: string;
  preparation_minutes: number | null;
  statut: string;
  candidat_id: number | null;
  candidat_nom: string | null;
  candidat_prenom: string | null;
  salle_intitule: string | null;
  salle_preparation_intitule: string | null;
  planche_nom: string | null;
  examinateur_nom: string | null;
  examinateur_prenom: string | null;
};

function authHeaders() {
  const token = sessionStorage.getItem("surveillant_token") ?? "";
  return { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
}

function formatDate(d: string) {
  return new Date(d + "T12:00:00").toLocaleDateString("fr-FR", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  });
}

function heurePrepa(heure_debut: string, prep_min: number): string {
  const [h, m] = heure_debut.split(":").map(Number);
  const total = ((h * 60 + m - prep_min) % 1440 + 1440) % 1440;
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

export default function SurveillantPlanningPage() {
  const router = useRouter();
  const [epreuves, setEpreuves] = useState<Epreuve[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filterDate, setFilterDate] = useState("");
  const [searchCandidat, setSearchCandidat] = useState("");
  const [toggling, setToggling] = useState<Set<number>>(new Set());
  const [exporting, setExporting] = useState(false);

  const load = useCallback(async () => {
    const token = sessionStorage.getItem("surveillant_token");
    if (!token) { router.replace("/surveillant"); return; }
    setLoading(true);
    try {
      const res = await fetch(`${API}/surveillant/me/epreuves`, { headers: authHeaders() });
      if (res.status === 401) { sessionStorage.removeItem("surveillant_token"); router.replace("/surveillant"); return; }
      setEpreuves(await res.json());
    } catch { setError("Erreur lors du chargement"); }
    finally { setLoading(false); }
  }, [router]);

  useEffect(() => { load(); }, [load]);

  async function toggleAbsent(ep: Epreuve) {
    setToggling((s) => new Set(s).add(ep.id));
    try {
      const isAbsent = ep.statut === "ABSENT";
      const res = await fetch(`${API}/surveillant/me/epreuves/${ep.id}/marquer-absent`, {
        method: isAbsent ? "DELETE" : "POST",
        headers: authHeaders(),
      });
      if (!res.ok) { const d = await res.json().catch(() => ({})); setError(d.detail ?? "Erreur"); return; }
      await load();
    } catch { setError("Erreur"); }
    finally { setToggling((s) => { const n = new Set(s); n.delete(ep.id); return n; }); }
  }

  async function handleExport() {
    setExporting(true);
    const token = sessionStorage.getItem("surveillant_token") ?? "";
    try {
      const r = await fetch(`${API}/surveillant/me/epreuves/export`, { headers: { Authorization: `Bearer ${token}` } });
      if (!r.ok) { setError("Erreur export"); return; }
      const blob = await r.blob();
      const cd = r.headers.get("content-disposition") ?? "";
      const match = cd.match(/filename="([^"]+)"/);
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = match?.[1] ?? "surveillance.xlsx";
      a.click();
    } catch { setError("Erreur export"); }
    finally { setExporting(false); }
  }

  const dates = [...new Set(epreuves.map((e) => e.date))].sort();

  const filtered = epreuves.filter((e) => {
    if (filterDate && e.date !== filterDate) return false;
    if (searchCandidat.trim()) {
      const q = searchCandidat.trim().toLowerCase();
      const nom = `${e.candidat_prenom ?? ""} ${e.candidat_nom ?? ""}`.toLowerCase();
      if (!nom.includes(q)) return false;
    }
    return true;
  });

  const byDate = filtered.reduce<Record<string, Epreuve[]>>((acc, e) => {
    (acc[e.date] ??= []).push(e);
    return acc;
  }, {});

  return (
    <div className="min-h-screen bg-[#F5F5F5]">
      <header className="bg-white border-b border-gray-100 shadow-sm">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center gap-3">
          <button onClick={() => router.back()} className="text-gray-400 hover:text-gray-700 transition">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <h1 className="text-lg font-semibold text-gray-900 flex-1">Mon planning de surveillance</h1>
          <button
            onClick={handleExport}
            disabled={exporting || epreuves.length === 0}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-red-200 text-[#C62828] hover:bg-red-50 transition disabled:opacity-40"
          >
            {exporting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
            Exporter Excel
          </button>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8 space-y-5">
        {error && <div className="rounded-lg bg-red-50 border border-red-100 px-4 py-3 text-sm text-red-600">{error}</div>}

        {/* Filtres */}
        {!loading && epreuves.length > 0 && (
          <div className="flex gap-2 flex-wrap">
            <select value={filterDate} onChange={(e) => setFilterDate(e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#C62828]/30 bg-white">
              <option value="">Toutes les dates</option>
              {dates.map((d) => (
                <option key={d} value={d}>
                  {new Date(d + "T12:00:00").toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" })}
                </option>
              ))}
            </select>
            <input type="text" value={searchCandidat} onChange={(e) => setSearchCandidat(e.target.value)}
              placeholder="Rechercher un candidat…"
              className="flex-1 min-w-[180px] border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#C62828]/30 bg-white" />
            {(filterDate || searchCandidat) && (
              <button onClick={() => { setFilterDate(""); setSearchCandidat(""); }}
                className="text-xs text-gray-400 hover:text-gray-700 px-2 transition">Effacer</button>
            )}
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-[#C62828]/60" /></div>
        ) : epreuves.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-gray-200 p-16 text-center">
            <Clock className="h-10 w-10 mx-auto mb-3 text-gray-300" />
            <p className="text-base font-medium text-gray-500">Aucune épreuve assignée</p>
          </div>
        ) : Object.keys(byDate).length === 0 ? (
          <div className="rounded-2xl border border-dashed border-gray-200 p-10 text-center">
            <p className="text-sm text-gray-500">Aucun résultat pour cette sélection</p>
          </div>
        ) : (
          <div className="space-y-8">
            {Object.entries(byDate).sort(([a], [b]) => a.localeCompare(b)).map(([date, eps]) => (
              <div key={date}>
                <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3 capitalize">
                  {formatDate(date)}
                </h2>
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                  {eps.map((ep, i) => {
                    const isAbsent = ep.statut === "ABSENT";
                    const isEmpty = !ep.candidat_id;
                    const busy = toggling.has(ep.id);

                    return (
                      <div key={ep.id} className={`px-5 py-4 ${i > 0 ? "border-t border-gray-100" : ""} ${isAbsent ? "bg-red-50/30" : isEmpty ? "bg-gray-50/50" : ""}`}>
                        {/* Horaire + matière */}
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <span className="text-sm font-semibold text-gray-900">{ep.matiere}</span>
                          <span className="text-xs text-gray-400 font-mono">
                            {ep.preparation_minutes ? `Prépa ${heurePrepa(ep.heure_debut, ep.preparation_minutes)} — ` : ""}
                            Passage {ep.heure_debut} – {ep.heure_fin}
                          </span>
                          {isEmpty && (
                            <span className="text-[10px] bg-gray-100 text-gray-500 rounded-full px-2 py-0.5 font-medium">Créneau libre</span>
                          )}
                        </div>

                        {/* Candidat */}
                        {ep.candidat_id ? (
                          <div className="flex items-center justify-between gap-3 flex-wrap">
                            <div>
                              <p className={`text-sm ${isAbsent ? "line-through text-gray-400" : "text-gray-700"}`}>
                                {ep.candidat_prenom} <span className="font-medium">{ep.candidat_nom}</span>
                              </p>
                              {isAbsent && (
                                <span className="flex items-center gap-1 text-xs text-red-600 font-medium mt-0.5">
                                  <AlertTriangle className="h-3 w-3" /> Absent
                                </span>
                              )}
                            </div>
                            <button
                              onClick={() => toggleAbsent(ep)}
                              disabled={busy}
                              className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border font-medium transition disabled:opacity-40 ${
                                isAbsent
                                  ? "border-green-200 text-green-700 hover:bg-green-50 bg-green-50"
                                  : "border-red-200 text-red-600 hover:bg-red-50"
                              }`}
                            >
                              {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : isAbsent ? <CheckCircle className="h-3 w-3" /> : <UserX className="h-3 w-3" />}
                              {isAbsent ? "Marquer présent" : "Marquer absent"}
                            </button>
                          </div>
                        ) : (
                          <p className="text-sm text-gray-400 italic">Aucun candidat inscrit</p>
                        )}

                        {/* Salle + examinateur + sujet */}
                        <div className="flex flex-wrap gap-3 mt-2 text-xs text-gray-500">
                          {ep.salle_preparation_intitule && (
                            <span>🚪 Prépa : <span className="font-medium text-gray-700">{ep.salle_preparation_intitule}</span></span>
                          )}
                          {ep.salle_intitule && (
                            <span>🏛 Salle : <span className="font-medium text-gray-700">{ep.salle_intitule}</span></span>
                          )}
                          {ep.examinateur_nom && (
                            <span>👤 Examinateur : <span className="font-medium text-gray-700">{ep.examinateur_prenom} {ep.examinateur_nom}</span></span>
                          )}
                          {ep.planche_nom && (
                            <span>📄 Sujet : <span className="font-medium text-gray-700">{ep.planche_nom}</span></span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
