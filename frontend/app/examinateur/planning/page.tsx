"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Loader2, CheckCircle, Clock, FileText, Download, AlertTriangle, Lock } from "lucide-react";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8002";

type Epreuve = {
  id: number;
  date: string;
  matiere: string;
  heure_debut: string;
  heure_fin: string;
  preparation_minutes: number | null;
  candidat_id: number | null;
  candidat_nom: string | null;
  candidat_prenom: string | null;
  note_valeur: number | null;
  note_statut: string | null;
  note_commentaire: string | null;
  salle_intitule: string | null;
  salle_preparation_intitule: string | null;
  planche_nom: string | null;
  conflit_etablissement: boolean;
};

type StatsMatiere = {
  count: number;
  moyenne: number | null;
  ecart_type: number | null;
  min: number | null;
  max: number | null;
};

type Stats = Record<string, { mes_notes: StatsMatiere; toutes_notes: StatsMatiere }>;

function authHeaders() {
  const token = sessionStorage.getItem("examinateur_token") ?? "";
  return { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
}

function formatDate(d: string) {
  return new Date(d + "T12:00:00").toLocaleDateString("fr-FR", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  });
}

function isLocked(statut: string | null) {
  return ["VALIDE", "HARMONISE", "PUBLIE"].includes(statut ?? "");
}

function parseNote(raw: string): number | null {
  const n = parseFloat(raw.replace(",", "."));
  return isNaN(n) ? null : n;
}

function isValidNote(raw: string): boolean {
  const n = parseNote(raw);
  return n !== null && n >= 0 && n <= 20;
}

function heurePrepa(heure_debut: string, prep_min: number): string {
  const [h, m] = heure_debut.split(":").map(Number);
  const total = ((h * 60 + m - prep_min) % 1440 + 1440) % 1440;
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

export default function ExaminateurPlanningPage() {
  const router = useRouter();
  const [epreuves, setEpreuves] = useState<Epreuve[]>([]);
  const [stats, setStats] = useState<Stats>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [drafts, setDrafts] = useState<Record<number, string>>({});
  const [comments, setComments] = useState<Record<number, string>>({});
  const [saving, setSaving] = useState<Record<number, "save" | "validate" | null>>({});
  const [saved, setSaved] = useState<Record<number, boolean>>({});
  const [exporting, setExporting] = useState(false);

  const load = useCallback(async () => {
    const token = sessionStorage.getItem("examinateur_token");
    if (!token) { router.replace("/examinateur"); return; }
    setLoading(true);
    setError("");
    try {
      const [dataEp, dataStats] = await Promise.all([
        fetch(`${API}/examinateur/me/epreuves`, { headers: authHeaders() }).then(r => r.json()),
        fetch(`${API}/examinateur/me/stats`, { headers: authHeaders() }).then(r => r.ok ? r.json() : {}),
      ]);
      const eps: Epreuve[] = dataEp;
      setEpreuves(eps);
      setStats(dataStats);
      const initDrafts: Record<number, string> = {};
      const initComments: Record<number, string> = {};
      eps.forEach((e) => {
        if (e.note_valeur !== null) initDrafts[e.id] = String(e.note_valeur);
        if (e.note_commentaire) initComments[e.id] = e.note_commentaire;
      });
      setDrafts(initDrafts);
      setComments(initComments);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => { load(); }, [load]);

  async function saveNote(ep: Epreuve, valider: boolean) {
    const raw = drafts[ep.id] ?? "";
    if (!isValidNote(raw)) { setError("Note invalide (0 à 20)"); return; }
    const valeur = parseNote(raw)!;
    setSaving((s) => ({ ...s, [ep.id]: valider ? "validate" : "save" }));
    setError("");
    try {
      const res = await fetch(`${API}/examinateur/me/epreuves/${ep.id}/noter`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ valeur, commentaire: comments[ep.id] ?? null, valider }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.detail ?? "Erreur");
      }
      setSaved((s) => ({ ...s, [ep.id]: true }));
      setTimeout(() => setSaved((s) => ({ ...s, [ep.id]: false })), 2500);
      await load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving((s) => ({ ...s, [ep.id]: null }));
    }
  }

  async function handleExport() {
    setExporting(true);
    const token = sessionStorage.getItem("examinateur_token") ?? "";
    try {
      const r = await fetch(`${API}/examinateur/me/epreuves/export`, { headers: { Authorization: `Bearer ${token}` } });
      if (!r.ok) { setError("Erreur export"); return; }
      const blob = await r.blob();
      const cd = r.headers.get("content-disposition") ?? "";
      const match = cd.match(/filename="([^"]+)"/);
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = match?.[1] ?? "planning.xlsx";
      a.click();
    } catch { setError("Erreur lors de l'export"); }
    finally { setExporting(false); }
  }

  const byDate = epreuves.reduce<Record<string, Epreuve[]>>((acc, e) => {
    (acc[e.date] ??= []).push(e);
    return acc;
  }, {});

  const matieres = Object.keys(stats);

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-white">
      <header className="bg-white border-b border-gray-100 shadow-sm">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center gap-3">
          <button onClick={() => router.back()} className="text-gray-400 hover:text-gray-700 transition">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <h1 className="text-lg font-semibold text-gray-900 flex-1">Mon planning & notes</h1>
          <button
            onClick={handleExport}
            disabled={exporting || epreuves.length === 0}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-purple-200 text-purple-600 hover:bg-purple-50 transition disabled:opacity-40"
          >
            {exporting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
            Exporter Excel
          </button>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8 space-y-6">
        {error && (
          <div className="rounded-lg bg-red-50 border border-red-100 px-4 py-3 text-sm text-red-600">{error}</div>
        )}

        {/* ── Dashboard stats ── */}
        {matieres.length > 0 && (
          <div className="space-y-3">
            {matieres.map((mat) => {
              const s = stats[mat];
              return (
                <div key={mat} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
                  <p className="text-sm font-semibold text-gray-800 mb-3">{mat} — Tableau de bord</p>
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { label: "Mes notes", data: s.mes_notes, color: "purple" },
                      { label: "Toutes les notes", data: s.toutes_notes, color: "gray" },
                    ].map(({ label, data, color }) => (
                      <div key={label} className={`rounded-xl p-3 ${color === "purple" ? "bg-purple-50 border border-purple-100" : "bg-gray-50 border border-gray-100"}`}>
                        <p className="text-xs font-semibold text-gray-500 mb-2">{label}</p>
                        {data.count === 0 ? (
                          <p className="text-xs text-gray-400 italic">Aucune note</p>
                        ) : (
                          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                            <span className="text-gray-500">Candidats</span><span className="font-semibold text-gray-800">{data.count}</span>
                            <span className="text-gray-500">Moyenne</span><span className="font-semibold text-gray-800">{data.moyenne?.toFixed(2)}</span>
                            <span className="text-gray-500">Écart-type</span><span className="font-semibold text-gray-800">{data.ecart_type?.toFixed(2)}</span>
                            <span className="text-gray-500">Min / Max</span><span className="font-semibold text-gray-800">{data.min} / {data.max}</span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ── Liste des créneaux ── */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-6 w-6 animate-spin text-purple-400" />
          </div>
        ) : epreuves.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-gray-200 p-16 text-center">
            <Clock className="h-10 w-10 mx-auto mb-3 text-gray-300" />
            <p className="text-base font-medium text-gray-500">Aucune épreuve assignée</p>
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
                    const locked = isLocked(ep.note_statut);
                    const raw = drafts[ep.id] ?? "";
                    const valid = raw === "" || isValidNote(raw);
                    const isDirty = raw !== "" || (comments[ep.id] ?? "") !== (ep.note_commentaire ?? "");
                    const isSaving = saving[ep.id];

                    return (
                      <div key={ep.id} className={`px-5 py-4 ${i > 0 ? "border-t border-gray-100" : ""} ${ep.conflit_etablissement ? "bg-amber-50/30" : ""}`}>
                        {/* Infos épreuve */}
                        <div className="flex items-start gap-2 mb-2 flex-wrap">
                          <span className="text-sm font-semibold text-gray-900">{ep.matiere}</span>
                          <span className="text-xs text-gray-400 font-mono">
                            {ep.preparation_minutes
                              ? `Prépa ${heurePrepa(ep.heure_debut, ep.preparation_minutes)} — `
                              : ""}
                            Passage {ep.heure_debut} – {ep.heure_fin}
                          </span>
                        </div>

                        {ep.candidat_id ? (
                          <p className="text-sm text-gray-700 mb-2">
                            {ep.candidat_prenom} <span className="font-medium">{ep.candidat_nom}</span>
                          </p>
                        ) : (
                          <p className="text-sm text-gray-400 italic mb-2">Aucun candidat assigné</p>
                        )}

                        {/* Salle + sujet */}
                        <div className="flex flex-wrap gap-3 mb-2 text-xs text-gray-500">
                          {ep.salle_preparation_intitule && (
                            <span>🚪 Prépa : <span className="font-medium text-gray-700">{ep.salle_preparation_intitule}</span></span>
                          )}
                          {ep.salle_intitule && (
                            <span>🏛 Salle : <span className="font-medium text-gray-700">{ep.salle_intitule}</span></span>
                          )}
                          {ep.planche_nom && (
                            <button
                              onClick={async () => {
                                const win = window.open("", "_blank");
                                if (!win) return;
                                const token = sessionStorage.getItem("examinateur_token") ?? "";
                                try {
                                  const r = await fetch(`${API}/examinateur/me/epreuves/${ep.id}/planche`, { headers: { Authorization: `Bearer ${token}` } });
                                  if (!r.ok) { win.close(); setError("Sujet non disponible"); return; }
                                  win.location.href = URL.createObjectURL(await r.blob());
                                } catch { win.close(); }
                              }}
                              className="flex items-center gap-1 text-purple-600 hover:text-purple-800 hover:underline transition"
                            >
                              <FileText className="h-3 w-3 shrink-0" />
                              <span className="font-medium">{ep.planche_nom}</span>
                            </button>
                          )}
                        </div>

                        {/* Alertes */}
                        <div className="flex flex-wrap gap-2 mb-2">
                          {ep.conflit_etablissement && (
                            <span className="flex items-center gap-1 text-xs bg-amber-50 border border-amber-200 text-amber-700 rounded-full px-2 py-0.5 font-medium">
                              <AlertTriangle className="h-3 w-3 shrink-0" />
                              Même établissement que le candidat
                            </span>
                          )}
                          {locked && (
                            <span className="flex items-center gap-1 text-xs bg-gray-100 border border-gray-200 text-gray-500 rounded-full px-2 py-0.5 font-medium">
                              <Lock className="h-3 w-3 shrink-0" />
                              {ep.note_statut === "VALIDE" ? "Note validée" : ep.note_statut === "HARMONISE" ? "Note harmonisée" : "Note publiée"}
                            </span>
                          )}
                        </div>

                        {/* Zone notation */}
                        {ep.candidat_id && (
                          <div className="mt-3 space-y-2">
                            <div className="flex items-center gap-2">
                              <div className="relative">
                                <input
                                  type="text"
                                  inputMode="decimal"
                                  value={raw}
                                  onChange={(e) => setDrafts((d) => ({ ...d, [ep.id]: e.target.value }))}
                                  placeholder="—"
                                  disabled={locked}
                                  className={`w-20 px-2.5 py-1.5 text-sm text-center rounded-lg border focus:outline-none focus:ring-2 transition disabled:bg-gray-50 disabled:text-gray-400 ${
                                    raw && !valid
                                      ? "border-red-400 bg-red-50 focus:ring-red-300"
                                      : "border-gray-200 focus:ring-purple-400"
                                  }`}
                                />
                                <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-gray-400 pointer-events-none">/20</span>
                              </div>
                              {raw && !valid && (
                                <span className="text-xs text-red-500">Note invalide (0–20)</span>
                              )}
                              {saved[ep.id] && (
                                <span className="flex items-center gap-1 text-xs text-green-600">
                                  <CheckCircle className="h-3.5 w-3.5" /> Enregistré
                                </span>
                              )}
                            </div>

                            {!locked && (
                              <textarea
                                value={comments[ep.id] ?? ""}
                                onChange={(e) => setComments((c) => ({ ...c, [ep.id]: e.target.value }))}
                                placeholder="Commentaire (optionnel)"
                                rows={2}
                                className="w-full px-3 py-2 text-xs rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-purple-300 resize-none"
                              />
                            )}

                            {locked && ep.note_commentaire && (
                              <p className="text-xs text-gray-500 italic bg-gray-50 rounded-lg px-3 py-2">
                                {ep.note_commentaire}
                              </p>
                            )}

                            {!locked && (
                              <div className="flex gap-2">
                                <button
                                  onClick={() => saveNote(ep, false)}
                                  disabled={!!isSaving || !isDirty || (!!raw && !valid)}
                                  className="text-xs px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition disabled:opacity-40"
                                >
                                  {isSaving === "save" ? <Loader2 className="h-3 w-3 animate-spin inline" /> : null}
                                  {" "}Enregistrer brouillon
                                </button>
                                <button
                                  onClick={() => saveNote(ep, true)}
                                  disabled={!!isSaving || !raw || !valid}
                                  className="text-xs px-3 py-1.5 rounded-lg bg-purple-600 text-white font-semibold hover:bg-purple-700 transition disabled:opacity-40 flex items-center gap-1"
                                >
                                  {isSaving === "validate" ? <Loader2 className="h-3 w-3 animate-spin" /> : <Lock className="h-3 w-3" />}
                                  Valider la note
                                </button>
                              </div>
                            )}
                          </div>
                        )}
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
