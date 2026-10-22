"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Loader2, Clock, Download, AlertTriangle, CheckCircle, UserX, CalendarDays, MapPin, Search,
  List, CalendarRange, User, FileText,
} from "lucide-react";
import { RED, PageHeader, Alert } from "../_ui";
import { EmploiDuTemps, type CreneauEdt, type LegendeEdt } from "../../_espace/EmploiDuTemps";

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

// ── Vue « Emploi du temps » (composant partagé : app/_espace/EmploiDuTemps.tsx) ──
function styleBloc(ep: Pick<Epreuve, "candidat_id" | "statut">): React.CSSProperties {
  if (!ep.candidat_id) return { backgroundColor: "#FFFFFF", borderColor: "#9CA3AF", borderStyle: "dashed" };
  if (ep.statut === "ABSENT") return { backgroundColor: "#FFFBEB", borderColor: "#B45309" };
  return { backgroundColor: RED + "12", borderColor: RED };
}

const LEGENDE_EDT: LegendeEdt[] = [
  { label: "Candidat attendu", style: styleBloc({ candidat_id: 1, statut: "" }) },
  { label: "Absent", style: styleBloc({ candidat_id: 1, statut: "ABSENT" }) },
  { label: "Créneau libre", style: styleBloc({ candidat_id: null, statut: "" }) },
];

function versCreneauEdt(ep: Epreuve): CreneauEdt {
  const nom = ep.candidat_id
    ? `${ep.candidat_prenom ?? ""} ${ep.candidat_nom ?? ""}`.trim() + (ep.statut === "ABSENT" ? " (absent)" : "")
    : "Créneau libre";
  return {
    id: ep.id,
    date: ep.date,
    heure_debut: ep.heure_debut,
    heure_fin: ep.heure_fin,
    preparation_minutes: ep.preparation_minutes,
    titre: nom,
    detail: ep.salle_intitule ? `Salle ${ep.salle_intitule} · ${ep.matiere}` : ep.matiere,
    infobulle: `${ep.heure_debut} – ${ep.heure_fin} · ${ep.matiere} · ${nom}${ep.salle_intitule ? ` · Salle ${ep.salle_intitule}` : ""}`,
    style: styleBloc(ep),
  };
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
  // Vue liste (présences) ou emploi du temps schématique — mémorisée par navigateur
  const [vue, setVue] = useState<"liste" | "edt">("liste");
  // Créneau mis en évidence après un clic dans l'emploi du temps
  const [surligne, setSurligne] = useState<number | null>(null);

  useEffect(() => {
    try { if (localStorage.getItem("surveillant_vue") === "edt") setVue("edt"); } catch { /* stockage indisponible */ }
  }, []);

  function changerVue(v: "liste" | "edt") {
    setVue(v);
    try { localStorage.setItem("surveillant_vue", v); } catch { /* stockage indisponible */ }
  }

  // Clic sur un bloc de l'emploi du temps : retour à la liste, sur la journée du
  // créneau, défilement jusqu'à lui et mise en évidence pendant quelques secondes.
  function allerAuCreneau(id: number) {
    const ep = epreuves.find((e) => e.id === id);
    if (!ep) return;
    changerVue("liste");
    setFilterDate(ep.date);
    setSurligne(ep.id);
    // Délai suffisant pour laisser le navigateur sortir du plein écran le cas échéant
    setTimeout(() => document.getElementById(`ep-${ep.id}`)?.scrollIntoView({ behavior: "smooth", block: "center" }), 300);
    setTimeout(() => setSurligne((s) => (s === ep.id ? null : s)), 3000);
  }

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

  // Résumé des présences sur l'ensemble du planning
  const attendus = epreuves.filter((e) => e.candidat_id).length;
  const absents = epreuves.filter((e) => e.candidat_id && e.statut === "ABSENT").length;
  const libres = epreuves.length - attendus;

  const pastille = (actif: boolean) =>
    `shrink-0 px-3 py-1.5 rounded-full text-sm font-medium border transition capitalize ${
      actif ? "text-white shadow-sm" : "bg-white text-gray-900 border-gray-300 hover:border-gray-400"
    }`;

  return (
    <div className="max-w-4xl mx-auto px-4 py-10">
      <PageHeader
        icon={<CalendarDays className="h-6 w-6" />}
        title="Mon planning de surveillance"
        subtitle="Consultez vos créneaux de surveillance et enregistrez les absences."
        actions={
          <button
            onClick={handleExport}
            disabled={exporting || epreuves.length === 0}
            className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg border bg-white font-medium hover:bg-red-50 transition disabled:opacity-40"
            style={{ borderColor: RED + "55", color: RED }}
          >
            {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            Exporter Excel
          </button>
        }
      />

      <div className="space-y-6">
        {error && <Alert tone="error">{error}</Alert>}

        {/* ── Résumé ── */}
        {!loading && epreuves.length > 0 && (
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: "Candidats attendus", valeur: attendus, cls: "text-gray-900" },
              { label: "Absents", valeur: absents, cls: absents ? "text-amber-800" : "text-gray-900" },
              { label: "Créneaux libres", valeur: libres, cls: "text-gray-900" },
            ].map((r) => (
              <div key={r.label} className="bg-white rounded-2xl border border-black/5 shadow-sm px-4 py-3">
                <p className="text-[11px] font-medium uppercase tracking-wide text-gray-700">{r.label}</p>
                <p className={`text-2xl font-bold tabular-nums ${r.cls}`}>{r.valeur}</p>
              </div>
            ))}
          </div>
        )}

        {/* ── Vue + filtres ── */}
        {!loading && epreuves.length > 0 && (
          <div className="bg-white rounded-2xl border border-black/5 shadow-sm p-4 space-y-3">
            <div className="inline-flex rounded-lg border border-gray-300 p-0.5 bg-gray-50">
              {([
                ["liste", "Liste & présences", <List key="l" className="h-4 w-4" />],
                ["edt", "Emploi du temps", <CalendarRange key="e" className="h-4 w-4" />],
              ] as const).map(([v, label, icone]) => (
                <button
                  key={v}
                  onClick={() => changerVue(v)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition ${
                    vue === v ? "text-white shadow-sm" : "text-gray-900 hover:bg-white"
                  }`}
                  style={vue === v ? { backgroundColor: RED } : undefined}
                >
                  {icone}
                  {label}
                </button>
              ))}
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-700 pointer-events-none" />
              <input
                type="text"
                value={searchCandidat}
                onChange={(e) => setSearchCandidat(e.target.value)}
                placeholder="Rechercher un candidat…"
                className="w-full pl-9 pr-3 py-2 rounded-lg border border-gray-300 text-sm text-gray-900 placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:border-transparent"
                style={{ "--tw-ring-color": RED } as React.CSSProperties}
              />
            </div>
            {dates.length > 1 && (
              <div className="flex gap-2 overflow-x-auto pb-1 sm:flex-wrap">
                <button
                  onClick={() => setFilterDate("")}
                  className={pastille(!filterDate)}
                  style={!filterDate ? { backgroundColor: RED, borderColor: RED } : undefined}
                >
                  Toutes les dates
                </button>
                {dates.map((d) => {
                  const actif = filterDate === d;
                  return (
                    <button
                      key={d}
                      onClick={() => setFilterDate(d)}
                      className={pastille(actif)}
                      style={actif ? { backgroundColor: RED, borderColor: RED } : undefined}
                    >
                      {new Date(d + "T12:00:00").toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" })}
                    </button>
                  );
                })}
              </div>
            )}
            {(filterDate || searchCandidat) && (
              <button
                onClick={() => { setFilterDate(""); setSearchCandidat(""); }}
                className="text-sm font-medium hover:underline underline-offset-2"
                style={{ color: RED }}
              >
                Effacer les filtres
              </button>
            )}
          </div>
        )}

        {/* ── Créneaux ── */}
        {loading ? (
          <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin" style={{ color: RED }} /></div>
        ) : epreuves.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-16 text-center">
            <Clock className="h-10 w-10 mx-auto mb-3" style={{ color: RED }} />
            <p className="text-base font-semibold text-gray-900">Aucune épreuve assignée</p>
            <p className="text-sm text-gray-700 mt-1">Vos créneaux de surveillance apparaîtront ici dès leur affectation.</p>
          </div>
        ) : Object.keys(byDate).length === 0 ? (
          <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-10 text-center">
            <p className="text-sm font-medium text-gray-900">Aucun résultat pour cette sélection</p>
          </div>
        ) : vue === "edt" ? (
          <EmploiDuTemps
            creneaux={filtered.map(versCreneauEdt)}
            legende={LEGENDE_EDT}
            consigne="Cliquez sur un créneau pour gérer la présence"
            titrePleinEcran="Mon emploi du temps de surveillance"
            onSelect={allerAuCreneau}
          />
        ) : (
          <div className="space-y-8">
            {Object.entries(byDate).sort(([a], [b]) => a.localeCompare(b)).map(([date, eps]) => (
              <section key={date}>
                <h2 className="flex items-center gap-2 text-sm font-semibold text-gray-900 uppercase tracking-wide mb-3">
                  <CalendarDays className="h-4 w-4" style={{ color: RED }} />
                  <span className="capitalize">{formatDate(date)}</span>
                  <span className="ml-auto text-xs font-medium normal-case tracking-normal text-gray-700">
                    {eps.length} créneau{eps.length > 1 ? "x" : ""}
                  </span>
                </h2>
                <div className="bg-white rounded-2xl border border-black/5 shadow-sm overflow-hidden divide-y divide-gray-100">
                  {eps.map((ep) => {
                    const isAbsent = ep.statut === "ABSENT";
                    const isEmpty = !ep.candidat_id;
                    const busy = toggling.has(ep.id);

                    return (
                      <div
                        key={ep.id}
                        id={`ep-${ep.id}`}
                        className={`flex gap-4 px-4 sm:px-5 py-5 transition-colors duration-700 ${
                          surligne === ep.id ? "bg-red-50" : isAbsent ? "bg-amber-50/50" : isEmpty ? "bg-gray-50/60" : ""
                        }`}
                      >
                        {/* Horaires */}
                        <div className="w-[4.5rem] sm:w-20 shrink-0 self-start text-center rounded-xl bg-gray-50 border border-gray-100 py-2.5 tabular-nums">
                          <p className="text-base sm:text-lg font-bold text-gray-900 leading-tight">{ep.heure_debut}</p>
                          <p className="text-xs text-gray-700">→ {ep.heure_fin}</p>
                          {ep.preparation_minutes ? (
                            <p className="mt-1.5 pt-1.5 border-t border-gray-200 text-[11px] text-gray-700">
                              Prépa<br /><span className="font-semibold text-gray-900">{heurePrepa(ep.heure_debut, ep.preparation_minutes)}</span>
                            </p>
                          ) : null}
                        </div>

                        <div className="flex-1 min-w-0 space-y-3">
                          {/* Candidat + présence */}
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            {ep.candidat_id ? (
                              <div>
                                <p className={`text-base ${isAbsent ? "line-through text-gray-700" : "text-gray-900"}`}>
                                  {ep.candidat_prenom} <span className="font-bold uppercase">{ep.candidat_nom}</span>
                                </p>
                                {isAbsent && (
                                  <span className="inline-flex items-center gap-1 mt-1 text-xs font-semibold border rounded-full px-2.5 py-0.5 bg-amber-50 border-amber-200 text-amber-900">
                                    <AlertTriangle className="h-3 w-3" /> Absent
                                  </span>
                                )}
                              </div>
                            ) : (
                              <p className="text-sm text-gray-700 italic">Aucun candidat inscrit — créneau libre</p>
                            )}
                            {ep.candidat_id && (
                              <button
                                onClick={() => toggleAbsent(ep)}
                                disabled={busy}
                                className={`flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg border font-medium transition disabled:opacity-40 ${
                                  isAbsent
                                    ? "border-green-300 text-green-800 bg-green-50 hover:bg-green-100"
                                    : "border-red-200 text-red-700 bg-white hover:bg-red-50"
                                }`}
                              >
                                {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : isAbsent ? <CheckCircle className="h-3.5 w-3.5" /> : <UserX className="h-3.5 w-3.5" />}
                                {isAbsent ? "Marquer présent" : "Marquer absent"}
                              </button>
                            )}
                          </div>

                          {/* Matière + salles */}
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span
                              className="text-xs font-semibold px-2.5 py-0.5 rounded-full"
                              style={{ backgroundColor: RED + "14", color: RED }}
                            >
                              {ep.matiere}
                            </span>
                            {ep.salle_preparation_intitule && (
                              <span className="inline-flex items-center gap-1 rounded-full border border-gray-300 bg-white px-2.5 py-0.5 text-xs font-medium text-gray-900">
                                <MapPin className="h-3 w-3" />
                                Prépa : {ep.salle_preparation_intitule}
                              </span>
                            )}
                            {ep.salle_intitule && (
                              <span
                                className="inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold text-gray-900"
                                style={{ borderColor: RED + "55", backgroundColor: RED + "0D" }}
                              >
                                <MapPin className="h-3 w-3" style={{ color: RED }} />
                                Salle : {ep.salle_intitule}
                              </span>
                            )}
                          </div>

                          {/* Examinateur + sujet */}
                          {(ep.examinateur_nom || ep.planche_nom) && (
                            <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-800">
                              {ep.examinateur_nom && (
                                <span className="inline-flex items-center gap-1.5">
                                  <User className="h-4 w-4 shrink-0 text-gray-700" />
                                  Examinateur : <span className="font-semibold text-gray-900">{ep.examinateur_prenom} {ep.examinateur_nom}</span>
                                </span>
                              )}
                              {ep.planche_nom && (
                                <span className="inline-flex items-center gap-1.5">
                                  <FileText className="h-4 w-4 shrink-0 text-gray-700" />
                                  Sujet : <span className="font-semibold text-gray-900">{ep.planche_nom}</span>
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
