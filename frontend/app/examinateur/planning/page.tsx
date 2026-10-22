"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Loader2, CheckCircle, Clock, FileText, Download, AlertTriangle, Lock, X, ExternalLink,
  CalendarDays, MapPin, Search, Users, BarChart3, List, CalendarRange,
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
  est_second_examinateur?: boolean;
  co_examinateur?: string | null;
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

// Pastille d'état de la note, affichée en haut à droite de chaque créneau
function statutNote(statut: string | null): { label: string; cls: string } {
  switch (statut) {
    case "VALIDE": return { label: "Note validée", cls: "bg-green-50 border-green-200 text-green-800" };
    case "HARMONISE": return { label: "Note harmonisée", cls: "bg-green-50 border-green-200 text-green-800" };
    case "PUBLIE": return { label: "Note publiée", cls: "bg-green-50 border-green-200 text-green-800" };
    case "BROUILLON": return { label: "Brouillon", cls: "bg-gray-100 border-gray-300 text-gray-800" };
    default: return { label: "À noter", cls: "bg-amber-50 border-amber-200 text-amber-900" };
  }
}

// Saisie au centième près (« 14,25 » ou « 14.25 »), jamais arrondie : plus de deux
// décimales est refusé plutôt qu'arrondi.
function parseNote(raw: string): number | null {
  const t = raw.trim().replace(",", ".");
  if (!/^\d{1,2}(\.\d{1,2})?$/.test(t)) return null;
  return parseFloat(t);
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

// ── Vue « Emploi du temps » (composant partagé : app/_espace/EmploiDuTemps.tsx) ──
function styleBloc(ep: Pick<Epreuve, "candidat_id" | "note_statut">): React.CSSProperties {
  if (!ep.candidat_id) return { backgroundColor: "#FFFFFF", borderColor: "#9CA3AF", borderStyle: "dashed" };
  if (isLocked(ep.note_statut)) return { backgroundColor: "#F0FDF4", borderColor: "#15803D" };
  if (ep.note_statut === "BROUILLON") return { backgroundColor: "#F3F4F6", borderColor: "#4B5563" };
  return { backgroundColor: RED + "12", borderColor: RED };
}

const LEGENDE_EDT: LegendeEdt[] = [
  { label: "À noter", style: styleBloc({ candidat_id: 1, note_statut: null }) },
  { label: "Brouillon", style: styleBloc({ candidat_id: 1, note_statut: "BROUILLON" }) },
  { label: "Note validée", style: styleBloc({ candidat_id: 1, note_statut: "VALIDE" }) },
  { label: "Sans candidat", style: styleBloc({ candidat_id: null, note_statut: null }) },
];

function versCreneauEdt(ep: Epreuve): CreneauEdt {
  const nom = ep.candidat_id
    ? `${ep.candidat_prenom ?? ""} ${ep.candidat_nom ?? ""}`.trim()
    : "Sans candidat";
  return {
    id: ep.id,
    date: ep.date,
    heure_debut: ep.heure_debut,
    heure_fin: ep.heure_fin,
    preparation_minutes: ep.preparation_minutes,
    titre: nom,
    detail: ep.salle_intitule ? `Salle ${ep.salle_intitule}` : null,
    infobulle: `${ep.heure_debut} – ${ep.heure_fin} · ${ep.matiere} · ${nom}${ep.salle_intitule ? ` · Salle ${ep.salle_intitule}` : ""}`,
    style: styleBloc(ep),
  };
}

function StatsBloc({ label, data, accent }: { label: string; data: StatsMatiere; accent: boolean }) {
  return (
    <div
      className={`rounded-xl p-4 border ${accent ? "" : "bg-gray-50 border-gray-100"}`}
      style={accent ? { backgroundColor: RED + "0A", borderColor: RED + "33" } : undefined}
    >
      <p className="text-xs font-semibold uppercase tracking-wide text-gray-800 mb-3">{label}</p>
      {data.count === 0 ? (
        <p className="text-sm text-gray-700 italic">Aucune note</p>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {[
            ["Candidats", String(data.count)],
            ["Moyenne", data.moyenne?.toFixed(2) ?? "—"],
            ["Écart-type", data.ecart_type?.toFixed(2) ?? "—"],
            ["Min / Max", `${data.min} / ${data.max}`],
          ].map(([l, v]) => (
            <div key={l}>
              <p className="text-[11px] font-medium text-gray-700">{l}</p>
              <p className="text-base font-bold text-gray-900 tabular-nums">{v}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
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
  const [exporting, setExporting] = useState<"pdf" | "xlsx" | null>(null);
  const [filterDate, setFilterDate] = useState("");
  const [searchCandidat, setSearchCandidat] = useState("");
  // Vue liste (saisie des notes) ou emploi du temps schématique — mémorisée par navigateur
  const [vue, setVue] = useState<"liste" | "edt">("liste");
  // Créneau mis en évidence après un clic dans l'emploi du temps
  const [surligne, setSurligne] = useState<number | null>(null);

  useEffect(() => {
    try { if (localStorage.getItem("examinateur_vue") === "edt") setVue("edt"); } catch { /* stockage indisponible */ }
  }, []);

  function changerVue(v: "liste" | "edt") {
    setVue(v);
    try { localStorage.setItem("examinateur_vue", v); } catch { /* stockage indisponible */ }
  }

  // Clic sur un bloc de l'emploi du temps : retour à la liste, sur la journée du
  // créneau, défilement jusqu'à lui et mise en évidence pendant quelques secondes.
  function allerAuCreneau(ep: Epreuve) {
    changerVue("liste");
    setFilterDate(ep.date);
    setSurligne(ep.id);
    // Délai suffisant pour laisser le navigateur sortir du plein écran le cas échéant
    setTimeout(() => document.getElementById(`ep-${ep.id}`)?.scrollIntoView({ behavior: "smooth", block: "center" }), 300);
    setTimeout(() => setSurligne((s) => (s === ep.id ? null : s)), 3000);
  }
  // Sujet (planche PDF) affiché dans la page — plus fiable qu'une fenêtre surgissante,
  // que les bloqueurs de pop-up peuvent empêcher.
  const [sujet, setSujet] = useState<{ ep: Epreuve; url: string | null; loading: boolean; error: string } | null>(null);

  async function ouvrirSujet(ep: Epreuve) {
    setSujet({ ep, url: null, loading: true, error: "" });
    const token = sessionStorage.getItem("examinateur_token") ?? "";
    try {
      const r = await fetch(`${API}/examinateur/me/epreuves/${ep.id}/planche`, { headers: { Authorization: `Bearer ${token}` } });
      if (!r.ok) {
        const d = await r.json().catch(() => ({}));
        setSujet({ ep, url: null, loading: false, error: d.detail ?? "Sujet non disponible" });
        return;
      }
      const url = URL.createObjectURL(await r.blob());
      setSujet({ ep, url, loading: false, error: "" });
    } catch {
      setSujet({ ep, url: null, loading: false, error: "Impossible de charger le sujet" });
    }
  }

  function fermerSujet() {
    if (sujet?.url) URL.revokeObjectURL(sujet.url);
    setSujet(null);
  }

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
    if (!isValidNote(raw)) { setError("Note invalide : de 0 à 20, au centième près au maximum (ex. 14,25)"); return; }
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

  // Export du planning en PDF (imprimable) ou Excel — limité à la date filtrée si un
  // filtre de date est actif, sinon toutes les journées.
  async function handleExport(format: "pdf" | "xlsx") {
    setExporting(format);
    setError("");
    const token = sessionStorage.getItem("examinateur_token") ?? "";
    const route = format === "pdf" ? "export-pdf" : "export";
    const qs = filterDate ? `?date=${filterDate}` : "";
    try {
      const r = await fetch(`${API}/examinateur/me/epreuves/${route}${qs}`, { headers: { Authorization: `Bearer ${token}` } });
      if (!r.ok) { setError("Erreur lors de l'export"); return; }
      const blob = await r.blob();
      const cd = r.headers.get("content-disposition") ?? "";
      const match = cd.match(/filename="([^"]+)"/);
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = match?.[1] ?? `planning.${format}`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    } catch { setError("Erreur lors de l'export"); }
    finally { setExporting(null); }
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

  const matieres = Object.keys(stats);

  // Avancement de la saisie : notes validées (ou au-delà) parmi les créneaux ayant un candidat
  const avecCandidat = epreuves.filter((e) => e.candidat_id);
  const nbValidees = avecCandidat.filter((e) => isLocked(e.note_statut)).length;
  const pctValidees = avecCandidat.length ? Math.round((nbValidees / avecCandidat.length) * 100) : 0;

  const pastille = (actif: boolean) =>
    `shrink-0 px-3 py-1.5 rounded-full text-sm font-medium border transition capitalize ${
      actif ? "text-white shadow-sm" : "bg-white text-gray-900 border-gray-300 hover:border-gray-400"
    }`;

  return (
    <div className="max-w-4xl mx-auto px-4 py-10">
      <PageHeader
        icon={<CalendarDays className="h-6 w-6" />}
        title="Mon planning & notes"
        subtitle="Consultez vos créneaux d'oral, les sujets et saisissez les notes des candidats."
        actions={(["pdf", "xlsx"] as const).map((f) => (
          <button
            key={f}
            onClick={() => handleExport(f)}
            disabled={exporting !== null || epreuves.length === 0}
            title={filterDate ? "Exporter la journée filtrée" : "Exporter tout mon planning"}
            className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg border bg-white font-medium hover:bg-red-50 transition disabled:opacity-40"
            style={{ borderColor: RED + "55", color: RED }}
          >
            {exporting === f ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            {f === "pdf" ? "PDF" : "Excel"}
          </button>
        ))}
      />

      <div className="space-y-6">
        {error && <Alert tone="error">{error}</Alert>}

        {/* ── Avancement de la saisie ── */}
        {!loading && avecCandidat.length > 0 && (
          <div className="bg-white rounded-2xl border border-black/5 shadow-sm p-5">
            <div className="flex flex-wrap items-baseline justify-between gap-2 mb-3">
              <p className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                <Users className="h-4 w-4" style={{ color: RED }} />
                Avancement de la saisie
              </p>
              <p className="text-sm text-gray-900 tabular-nums">
                <span className="font-bold">{nbValidees}</span> / {avecCandidat.length} note{avecCandidat.length > 1 ? "s" : ""} validée{nbValidees > 1 ? "s" : ""}
              </p>
            </div>
            <div className="h-2.5 rounded-full bg-gray-100 overflow-hidden">
              <div className="h-full rounded-full transition-all" style={{ width: `${pctValidees}%`, backgroundColor: RED }} />
            </div>
          </div>
        )}

        {/* ── Dashboard stats ── */}
        {matieres.map((mat) => {
          const s = stats[mat];
          return (
            <div key={mat} className="bg-white rounded-2xl border border-black/5 shadow-sm p-5">
              <p className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <BarChart3 className="h-4 w-4" style={{ color: RED }} />
                {mat} — Tableau de bord
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <StatsBloc label="Mes notes" data={s.mes_notes} accent />
                <StatsBloc label="Toutes les notes" data={s.toutes_notes} accent={false} />
              </div>
            </div>
          );
        })}

        {/* ── Filtres ── */}
        {!loading && epreuves.length > 0 && (
          <div className="bg-white rounded-2xl border border-black/5 shadow-sm p-4 space-y-3">
            <div className="inline-flex rounded-lg border border-gray-300 p-0.5 bg-gray-50">
              {([
                ["liste", "Liste & notes", <List key="l" className="h-4 w-4" />],
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

        {/* ── Liste des créneaux ── */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-6 w-6 animate-spin" style={{ color: RED }} />
          </div>
        ) : epreuves.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-16 text-center">
            <Clock className="h-10 w-10 mx-auto mb-3" style={{ color: RED }} />
            <p className="text-base font-semibold text-gray-900">Aucune épreuve pour l&apos;instant</p>
            <p className="text-sm text-gray-700 mt-1">Vos épreuves apparaîtront ici dès qu&apos;un candidat y sera affecté.</p>
          </div>
        ) : Object.keys(byDate).length === 0 ? (
          <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-10 text-center">
            <p className="text-sm font-medium text-gray-900">Aucun résultat pour cette sélection</p>
          </div>
        ) : vue === "edt" ? (
          <EmploiDuTemps
            creneaux={filtered.map(versCreneauEdt)}
            legende={LEGENDE_EDT}
            consigne="Cliquez sur un créneau pour le noter"
            onSelect={(id) => { const ep = filtered.find((e) => e.id === id); if (ep) allerAuCreneau(ep); }}
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
                    const locked = isLocked(ep.note_statut);
                    const raw = drafts[ep.id] ?? "";
                    const valid = raw === "" || isValidNote(raw);
                    const isDirty = raw !== "" || (comments[ep.id] ?? "") !== (ep.note_commentaire ?? "");
                    const isSaving = saving[ep.id];
                    const statut = statutNote(ep.note_statut);

                    return (
                      <div
                        key={ep.id}
                        id={`ep-${ep.id}`}
                        className={`flex gap-4 px-4 sm:px-5 py-5 transition-colors duration-700 ${
                          surligne === ep.id ? "bg-red-50" : ep.conflit_etablissement ? "bg-amber-50/40" : ""
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
                          {/* Candidat + état de la note */}
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            {ep.candidat_id ? (
                              <p className="text-base text-gray-900">
                                {ep.candidat_prenom} <span className="font-bold uppercase">{ep.candidat_nom}</span>
                              </p>
                            ) : (
                              <p className="text-sm text-gray-700 italic">Aucun candidat assigné</p>
                            )}
                            {ep.candidat_id && (
                              <span className={`inline-flex items-center gap-1 text-xs font-semibold border rounded-full px-2.5 py-0.5 ${statut.cls}`}>
                                {locked && <Lock className="h-3 w-3 shrink-0" />}
                                {statut.label}
                              </span>
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

                          {/* Sujet affecté au candidat */}
                          {ep.planche_nom ? (
                            <button
                              onClick={() => ouvrirSujet(ep)}
                              className="inline-flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg border bg-white font-medium hover:bg-red-50 transition max-w-full"
                              style={{ borderColor: RED + "55", color: RED }}
                            >
                              <FileText className="h-4 w-4 shrink-0" />
                              <span className="truncate">Consulter le sujet : <span className="font-semibold">{ep.planche_nom}</span></span>
                            </button>
                          ) : (
                            <p className="inline-flex items-center gap-1.5 text-sm text-gray-700 italic">
                              <FileText className="h-4 w-4 shrink-0" />
                              Aucun sujet affecté pour l&apos;instant
                            </p>
                          )}

                          {/* Alertes */}
                          {(ep.conflit_etablissement || ep.co_examinateur) && (
                            <div className="flex flex-wrap gap-2">
                              {ep.conflit_etablissement && (
                                <span className="flex items-center gap-1 text-xs bg-amber-50 border border-amber-200 text-amber-900 rounded-full px-2.5 py-0.5 font-medium">
                                  <AlertTriangle className="h-3 w-3 shrink-0" />
                                  Même établissement que le candidat
                                </span>
                              )}
                              {ep.co_examinateur && (
                                <span className="flex items-center gap-1 text-xs bg-blue-50 border border-blue-200 text-blue-900 rounded-full px-2.5 py-0.5 font-medium">
                                  Jury avec {ep.co_examinateur}
                                  {ep.est_second_examinateur ? " (examinateur principal)" : " (2ᵉ examinateur)"}
                                  {" "}— note commune, saisissable par chacun
                                </span>
                              )}
                            </div>
                          )}

                          {/* Zone notation */}
                          {ep.candidat_id && (
                            <div className="rounded-xl bg-gray-50 border border-gray-100 p-3 space-y-2.5">
                              <div className="flex flex-wrap items-center gap-2">
                                <label className="text-xs font-semibold uppercase tracking-wide text-gray-800">Note</label>
                                <div className="relative">
                                  <input
                                    type="text"
                                    inputMode="decimal"
                                    value={raw}
                                    onChange={(e) => setDrafts((d) => ({ ...d, [ep.id]: e.target.value }))}
                                    placeholder="—"
                                    disabled={locked}
                                    className={`w-24 pl-3 pr-9 py-1.5 text-base font-semibold text-gray-900 text-center rounded-lg border bg-white focus:outline-none focus:ring-2 transition tabular-nums disabled:bg-gray-100 disabled:text-gray-700 ${
                                      raw && !valid
                                        ? "border-red-400 bg-red-50 focus:ring-red-300"
                                        : "border-gray-300 focus:ring-[#C62828]/40"
                                    }`}
                                  />
                                  <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-gray-700 pointer-events-none">/20</span>
                                </div>
                                {raw && !valid && (
                                  <span className="text-xs text-red-700">Note invalide : 0 à 20, deux décimales au maximum (ex. 14,25)</span>
                                )}
                                {saved[ep.id] && (
                                  <span className="flex items-center gap-1 text-xs font-medium text-green-700">
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
                                  className="w-full px-3 py-2 text-sm text-gray-900 rounded-lg border border-gray-300 bg-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-[#C62828]/30 resize-none"
                                />
                              )}

                              {locked && ep.note_commentaire && (
                                <p className="text-sm text-gray-800 italic bg-white border border-gray-100 rounded-lg px-3 py-2">
                                  {ep.note_commentaire}
                                </p>
                              )}

                              {!locked && (
                                <div className="flex flex-wrap gap-2">
                                  <button
                                    onClick={() => saveNote(ep, false)}
                                    disabled={!!isSaving || !isDirty || (!!raw && !valid)}
                                    className="text-sm px-3 py-1.5 rounded-lg border border-gray-300 bg-white text-gray-900 font-medium hover:bg-gray-50 transition disabled:opacity-40 flex items-center gap-1.5"
                                  >
                                    {isSaving === "save" && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                                    Enregistrer brouillon
                                  </button>
                                  <button
                                    onClick={() => saveNote(ep, true)}
                                    disabled={!!isSaving || !raw || !valid}
                                    className="text-sm px-3 py-1.5 rounded-lg text-white font-semibold shadow-sm hover:opacity-90 transition disabled:opacity-40 flex items-center gap-1.5"
                                    style={{ backgroundColor: RED }}
                                  >
                                    {isSaving === "validate" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Lock className="h-3.5 w-3.5" />}
                                    Valider la note
                                  </button>
                                </div>
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

      {/* ── Consultation du sujet ── */}
      {sujet && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-[2px] flex items-center justify-center p-3 sm:p-6" onClick={fermerSujet}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl h-[92vh] flex flex-col overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-200">
              <div
                className="h-9 w-9 rounded-lg flex items-center justify-center shrink-0"
                style={{ backgroundColor: RED + "14", color: RED }}
              >
                <FileText className="h-5 w-5" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-900 truncate">{sujet.ep.planche_nom}</p>
                <p className="text-xs text-gray-700 truncate">
                  {sujet.ep.matiere} · {formatDate(sujet.ep.date)} · {sujet.ep.heure_debut}
                  {sujet.ep.candidat_nom && <> · {sujet.ep.candidat_prenom} {sujet.ep.candidat_nom}</>}
                </p>
              </div>
              {sujet.url && (
                <a
                  href={sujet.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hidden sm:inline-flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg border border-gray-300 text-gray-900 hover:bg-gray-50 transition"
                >
                  <ExternalLink className="h-3.5 w-3.5" /> Ouvrir dans un onglet
                </a>
              )}
              <button onClick={fermerSujet} className="p-1.5 rounded-lg text-gray-700 hover:bg-gray-100 hover:text-black transition" title="Fermer">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="flex-1 bg-gray-100">
              {sujet.loading ? (
                <div className="h-full flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin" style={{ color: RED }} /></div>
              ) : sujet.error ? (
                <div className="h-full flex items-center justify-center text-sm text-red-700">{sujet.error}</div>
              ) : (
                <iframe src={sujet.url ?? undefined} title={`Sujet ${sujet.ep.planche_nom ?? ""}`} className="w-full h-full border-0" />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
