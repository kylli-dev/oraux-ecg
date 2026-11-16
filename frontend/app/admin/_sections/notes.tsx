"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useToast } from "../Toast";
import { Loader2, Download, CheckCircle2, FileSpreadsheet, Send, Save } from "lucide-react";
import {
  Btn,
  Empty,
  Examinateur,
  Field,
  Input,
  Planning,
  RED,
  Select,
  Spinner,
  formatDateCourte,
  get,
  memoriserPlanning,
  patch,
  planningMemorise,
  post,
  useFiltre,
} from "./commun";

// ── NotesSection ───────────────────────────────────────────────────────────────

type NoteAdmin = {
  id: number;
  candidat_id: number;
  candidat_nom: string;
  candidat_prenom: string;
  matiere: string;
  valeur: number | null;
  note_harmonisee: number | null;
  commentaire: string | null;
  statut: "BROUILLON" | "VALIDE" | "HARMONISE" | "PUBLIE";
  examinateurs?: string[];
  planning_id?: number | null;
};

type NoteCell = {
  note_id: number;
  valeur: number | null;
  note_harmonisee: number | null;
  ecart: number | null;
  commentaire: string | null;
  statut: string;
};

type TableauCandidat = {
  id: number;
  nom: string;
  prenom: string;
  code_candidat: string | null;
  handicape: boolean | null;
  date: string;
  notes: Record<string, NoteCell>;
};

type TableauData = {
  matieres: string[];
  candidats: TableauCandidat[];
};

// ── Notes : saisie au centième près, jamais arrondie ─────────────────────────
// Accepte « 14,25 » comme « 14.25 ». Refuse plus de deux décimales plutôt que d'arrondir.
function lireNote(raw: string): { valeur: number | null; erreur: string | null } {
  const t = raw.trim().replace(",", ".");
  if (t === "") return { valeur: null, erreur: null };
  if (!/^\d{1,2}(\.\d{1,2})?$/.test(t)) {
    return { valeur: null, erreur: "Note invalide : de 0 à 20, au centième près au maximum (ex. 14,25)" };
  }
  const v = parseFloat(t);
  if (v < 0 || v > 20) return { valeur: null, erreur: "Note invalide : elle doit être comprise entre 0 et 20" };
  return { valeur: v, erreur: null };
}

// Affichage exact au centième (14 → « 14,00 », 14,25 → « 14,25 ») — jamais d'arrondi au dixième
function fmtNote(v: number): string {
  return v.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function NotesSection() {
  const toast = useToast();
  const [tab, setTab] = useFiltre<"tableau" | "publication" | "saisie">("notes:onglet", "tableau");

  // ── Tableau tab state ────────────────────────────────────────────────────────
  const [plannings, setPlannings] = useState<Planning[]>([]);
  const [planningId, setPlanningId] = useState<number | "">("");
  const [tableau, setTableau] = useState<TableauData | null>(null);
  const [loadingT, setLoadingT] = useState(false);
  // Inline edit: note_id → draft value
  const [editHarm, setEditHarm] = useState<Record<number, string>>({});
  // Filtres du tableau des notes
  const [tRecherche, setTRecherche] = useState("");
  const [tDate, setTDate] = useState("");
  const [tMatiere, setTMatiere] = useState("");
  const [tStatut, setTStatut] = useState("");      // BROUILLON | VALIDE | HARMONISE | PUBLIE | MANQUANTE
  const [tHarm, setTHarm] = useState("");          // "ecart" | "non_harmonisee"
  const resetFiltresTableau = () => { setTRecherche(""); setTDate(""); setTMatiere(""); setTStatut(""); setTHarm(""); };
  const [savingHarm, setSavingHarm] = useState<Record<number, boolean>>({});

  useEffect(() => {
    get<Planning[]>("plannings/").then((ps) => {
      setPlannings(ps);
      setPlanningId((cur) => cur || planningMemorise(ps) || cur);
    }).catch(() => {});
  }, []);
  useEffect(() => memoriserPlanning(planningId), [planningId]);

  useEffect(() => {
    if (!planningId) { setTableau(null); return; }
    setLoadingT(true);
    get<TableauData>(`notes/tableau?planning_id=${planningId}`)
      .then(setTableau)
      .catch(() => {})
      .finally(() => setLoadingT(false));
  }, [planningId]);

  async function saveHarm(noteId: number, raw: string) {
    const { valeur: val, erreur } = lireNote(raw);
    if (erreur) {
      toast.error(erreur.replace("Note invalide", "Note harmonisée invalide"));
      return;
    }
    setSavingHarm((s) => ({ ...s, [noteId]: true }));
    try {
      await patch(`notes/${noteId}/harmoniser`, { note_harmonisee: val });
      // Update tableau in place
      setTableau((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          candidats: prev.candidats.map((c) => ({
            ...c,
            notes: Object.fromEntries(
              Object.entries(c.notes).map(([mat, n]) => {
                if (n.note_id !== noteId) return [mat, n];
                const nh = val;
                const ecart = nh !== null && n.valeur !== null ? Math.round((nh - n.valeur) * 100) / 100 : null;
                return [mat, { ...n, note_harmonisee: nh, ecart }];
              })
            ),
          })),
        };
      });
      setEditHarm((e) => { const next = { ...e }; delete next[noteId]; return next; });
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : String(err));
    } finally {
      setSavingHarm((s) => ({ ...s, [noteId]: false }));
    }
  }

  function doExport() {
    if (!planningId) return;
    const a = document.createElement("a");
    a.href = `/api/backend/notes/tableau/export?planning_id=${planningId}`;
    a.download = `notes_planning_${planningId}.xlsx`;
    a.click();
  }

  // ── Publication tab state ─────────────────────────────────────────────────
  const [notes, setNotes] = useState<NoteAdmin[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [publishing, setPublishing] = useState<Record<number, boolean>>({});
  const [publishingAll, setPublishingAll] = useState(false);
  const [pubVue, setPubVue] = useFiltre<"tout" | "brouillons" | "attente" | "publiees">("notes:publication", "tout");
  const [pubRecherche, setPubRecherche] = useState("");
  const [pubExaminateur, setPubExaminateur] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await get<NoteAdmin[]>("notes/");
      setNotes(data);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { if (tab === "publication") load(); }, [load, tab]);

  async function publierNote(note: NoteAdmin) {
    setPublishing((p) => ({ ...p, [note.id]: true }));
    try {
      await post(`notes/${note.id}/publier`, {});
      setNotes((prev) => prev.map((n) => n.id === note.id ? { ...n, statut: "PUBLIE" } : n));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setPublishing((p) => ({ ...p, [note.id]: false }));
    }
  }

  async function validerNote(note: NoteAdmin) {
    setPublishing((p) => ({ ...p, [note.id]: true }));
    setError("");
    try {
      await post(`notes/${note.id}/valider`, {});
      setNotes((prev) => prev.map((n) => n.id === note.id
        ? { ...n, statut: "VALIDE", note_harmonisee: n.note_harmonisee ?? n.valeur }
        : n));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setPublishing((p) => ({ ...p, [note.id]: false }));
    }
  }

  async function publierTout() {
    setPublishingAll(true);
    setError("");
    try {
      await post("notes/publier-tout", {});
      await load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setPublishingAll(false);
    }
  }

  // Circuit : brouillon → validée par l'examinateur (→ harmonisée) → publiée.
  // Seules les notes validées / harmonisées se publient ; les brouillons attendent la
  // validation de l'examinateur.
  const noteFinale = (n: NoteAdmin) => n.note_harmonisee ?? n.valeur;
  const aPublier = notes.filter((n) => (n.statut === "VALIDE" || n.statut === "HARMONISE") && noteFinale(n) !== null);
  const enAttente = notes.filter((n) => n.statut === "BROUILLON");
  const publiees = notes.filter((n) => n.statut === "PUBLIE");
  // conservé sous ce nom pour le bouton « Tout publier » de l'en-tête
  const brouillons = aPublier;

  // Note affichée = celle que verra le candidat (harmonisée si elle existe)
  const affNote = (n: NoteAdmin) => {
    const f = noteFinale(n);
    if (f === null) return <span className="text-gray-700 italic">—</span>;
    return (
      <>
        {fmtNote(f)}/20
        {n.note_harmonisee !== null && n.valeur !== null && n.note_harmonisee !== n.valeur && (
          <span className="ml-1.5 text-xs font-normal text-gray-700">(examinateur : {fmtNote(n.valeur)})</span>
        )}
      </>
    );
  };

  // ── Saisie tab state ──────────────────────────────────────────────────────
  type SaisieEpreuve = {
    epreuve_id: number;
    date: string;
    matiere: string;
    heure_debut: string;
    heure_fin: string;
    preparation_minutes: number | null;
    candidat_id: number | null;
    candidat_nom: string | null;
    candidat_prenom: string | null;
    note_id: number | null;
    valeur: number | null;
    commentaire: string | null;
    statut: string | null;
  };

  const [saisiePlanningId, setSaisiePlanningId] = useState<number | "">("");
  const [saisieExamId, setSaisieExamId] = useState<number | "">("");
  const [saisieExams, setSaisieExams] = useState<Examinateur[]>([]);
  const [saisieRows, setSaisieRows] = useState<SaisieEpreuve[]>([]);
  const [saisieLoading, setSaisieLoading] = useState(false);
  // Draft edits: epreuve_id → {valeur, commentaire}
  const [saisieDraft, setSaisieDraft] = useState<Record<number, { valeur: string; commentaire: string }>>({});
  const [saisieSaving, setSaisieSaving] = useState<Record<number, boolean>>({});

  useEffect(() => {
    if (tab !== "saisie") return;
    const q = saisiePlanningId ? `?planning_id=${saisiePlanningId}` : "";
    get<Examinateur[]>(`examinateurs/${q}`).then(setSaisieExams).catch(() => {});
  }, [tab, saisiePlanningId]);

  useEffect(() => {
    if (tab !== "saisie" || !saisieExamId) { setSaisieRows([]); return; }
    setSaisieLoading(true);
    const q = saisiePlanningId ? `&planning_id=${saisiePlanningId}` : "";
    get<SaisieEpreuve[]>(`notes/saisie?examinateur_id=${saisieExamId}${q}`)
      .then((rows) => {
        setSaisieRows(rows);
        // Init drafts with existing values
        const drafts: Record<number, { valeur: string; commentaire: string }> = {};
        rows.forEach((r) => {
          drafts[r.epreuve_id] = {
            valeur: r.valeur !== null ? String(r.valeur) : "",
            commentaire: r.commentaire ?? "",
          };
        });
        setSaisieDraft(drafts);
      })
      .catch(() => {})
      .finally(() => setSaisieLoading(false));
  }, [tab, saisieExamId, saisiePlanningId]);

  async function saveSaisie(epId: number) {
    const draft = saisieDraft[epId];
    if (!draft) return;
    const { valeur: valNum, erreur } = lireNote(draft.valeur);
    if (erreur) {
      toast.error(erreur);
      return;
    }
    setSaisieSaving((s) => ({ ...s, [epId]: true }));
    try {
      await post("notes/saisir", {
        epreuve_id: epId,
        valeur: valNum,
        commentaire: draft.commentaire || null,
      });
      setSaisieRows((prev) =>
        prev.map((r) =>
          r.epreuve_id === epId
            ? { ...r, valeur: valNum, commentaire: draft.commentaire || null, statut: r.statut ?? "BROUILLON" }
            : r
        )
      );
      toast.success("Note enregistrée");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setSaisieSaving((s) => ({ ...s, [epId]: false }));
    }
  }

  return (
    <div className="max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-semibold">Notes</h2>
          <p className="text-sm text-gray-700 mt-0.5">Consultation du tableau de notes et publication</p>
        </div>
        <div className="flex items-center gap-2">
        {tab === "tableau" && planningId !== "" && (
          <Btn label="Exporter .xlsx" icon={Download} variant="ghost" onClick={doExport} />
        )}
        {tab === "publication" && brouillons.length > 0 && (
          <button
            onClick={publierTout}
            disabled={publishingAll}
            className="flex items-center gap-2 text-sm bg-green-600 text-white rounded-lg px-4 py-2 hover:bg-green-700 transition disabled:opacity-50 font-semibold"
          >
            {publishingAll ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            Tout publier ({brouillons.length})
          </button>
        )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-black/5 p-1 rounded-xl w-fit">
        {(["tableau", "saisie", "publication"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition ${
              tab === t ? "bg-white shadow text-black" : "text-gray-800 hover:text-black"
            }`}
          >
            {t === "tableau" ? "Tableau des notes" : t === "saisie" ? "Saisie" : "Publication"}
          </button>
        ))}
      </div>

      {/* ── Tableau des notes ────────────────────────────────────────────────── */}
      {tab === "tableau" && (() => {
        const matieresVisibles = tableau ? tableau.matieres.filter((m) => !tMatiere || m === tMatiere) : [];
        const q = tRecherche.trim().toLowerCase();
        const candidatsFiltres = (tableau?.candidats ?? []).filter((c) => {
          if (q && !`${c.nom} ${c.prenom} ${c.code_candidat ?? ""}`.toLowerCase().includes(q)) return false;
          if (tDate && c.date !== tDate) return false;
          const cellules = matieresVisibles.map((m) => c.notes[m]);
          if (tStatut === "MANQUANTE" && !cellules.some((n) => !n || n.valeur === null)) return false;
          if (tStatut && tStatut !== "MANQUANTE" && !cellules.some((n) => n && n.statut === tStatut)) return false;
          if (tHarm === "ecart" && !cellules.some((n) => n && n.ecart !== null && n.ecart !== 0)) return false;
          if (tHarm === "non_harmonisee" && !cellules.some((n) => n && n.valeur !== null && n.note_harmonisee === null)) return false;
          return true;
        });
        const datesTableau = [...new Set((tableau?.candidats ?? []).map((c) => c.date).filter(Boolean))].sort();
        const filtresTableauActifs = !!(tRecherche || tDate || tMatiere || tStatut || tHarm);
        return (
        <div className="space-y-5">
          <div className="flex items-end gap-4">
            <Field label="Planning">
              <Select value={planningId} onChange={(e) => setPlanningId(e.target.value === "" ? "" : Number(e.target.value))}>
                <option value="">— Sélectionner un planning</option>
                {plannings.map((p) => <option key={p.id} value={p.id}>{p.nom}</option>)}
              </Select>
            </Field>
          </div>

          {planningId !== "" && tableau && tableau.candidats.length > 0 && (
            <div className="bg-white rounded-xl border border-black/10 shadow-sm p-4 space-y-3">
              <div className="grid gap-3 grid-cols-2 md:grid-cols-5">
                <Field label="Recherche">
                  <Input value={tRecherche} onChange={(e) => setTRecherche(e.target.value)} placeholder="Nom, prénom, n° candidat" />
                </Field>
                <Field label="Date">
                  <Select value={tDate} onChange={(e) => setTDate(e.target.value)}>
                    <option value="">Toutes</option>
                    {datesTableau.map((d) => <option key={d} value={d}>{/^\d{4}-\d{2}-\d{2}/.test(d) ? formatDateCourte(d) : d}</option>)}
                  </Select>
                </Field>
                <Field label="Matière">
                  <Select value={tMatiere} onChange={(e) => setTMatiere(e.target.value)}>
                    <option value="">Toutes</option>
                    {tableau.matieres.map((m) => <option key={m} value={m}>{m}</option>)}
                  </Select>
                </Field>
                <Field label="Statut de note">
                  <Select value={tStatut} onChange={(e) => setTStatut(e.target.value)}>
                    <option value="">Tous</option>
                    <option value="BROUILLON">Brouillon</option>
                    <option value="VALIDE">Validée</option>
                    <option value="HARMONISE">Harmonisée</option>
                    <option value="PUBLIE">Publiée</option>
                    <option value="MANQUANTE">Note manquante</option>
                  </Select>
                </Field>
                <Field label="Harmonisation">
                  <Select value={tHarm} onChange={(e) => setTHarm(e.target.value)}>
                    <option value="">Toutes</option>
                    <option value="ecart">Note modifiée (écart ≠ 0)</option>
                    <option value="non_harmonisee">Pas encore harmonisée</option>
                  </Select>
                </Field>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-900">
                  <span className="font-semibold">{candidatsFiltres.length}</span> candidat{candidatsFiltres.length > 1 ? "s" : ""}
                  {filtresTableauActifs && <> sur {tableau.candidats.length}</>}
                  {(tStatut || tHarm) && (
                    <span className="text-gray-700"> — au moins une {tMatiere ? `note de ${tMatiere}` : "note"} concernée</span>
                  )}
                </span>
                {filtresTableauActifs && (
                  <button onClick={resetFiltresTableau} className="text-sm font-medium hover:underline" style={{ color: RED }}>
                    Réinitialiser les filtres
                  </button>
                )}
              </div>
            </div>
          )}

          {!planningId ? (
            <Empty message="Sélectionnez un planning" />
          ) : loadingT ? (
            <div className="flex justify-center py-12 text-gray-700"><Spinner /></div>
          ) : !tableau || tableau.candidats.length === 0 ? (
            <Empty message="Aucune note disponible pour ce planning" sub="Les notes apparaîtront ici dès leur saisie par les examinateurs." />
          ) : candidatsFiltres.length === 0 ? (
            <Empty message="Aucun candidat ne correspond aux filtres" />
          ) : (
            <div className="overflow-x-auto rounded-xl border bg-white shadow-sm">
              <table className="text-xs border-collapse min-w-full">
                <thead>
                  {/* Row 1 : fixed cols + matière headers */}
                  <tr className="bg-[#1A237E]">
                    {["Nom", "Prénom", "N° Cand.", "Date"].map((h) => (
                      <th key={h} rowSpan={2} className="px-3 py-2.5 text-left text-white font-semibold border border-[#283593] align-bottom whitespace-nowrap">{h}</th>
                    ))}
                    {matieresVisibles.map((mat) => (
                      <th key={mat} colSpan={3} className="px-3 py-2 text-center text-white font-semibold border border-[#283593] whitespace-nowrap">{mat}</th>
                    ))}
                  </tr>
                  {/* Row 2 : sub-headers */}
                  <tr className="bg-[#E8EAF6]">
                    {matieresVisibles.flatMap((mat) => (
                      ["Note", "Harm.", "Écart"].map((sub) => (
                        <th key={`${mat}-${sub}`} className="px-2 py-1.5 text-center text-[#1A237E] font-semibold border border-[#C5CAE9] whitespace-nowrap">{sub}</th>
                      ))
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {candidatsFiltres.map((cand, ri) => (
                    <tr key={cand.id} className={ri % 2 === 0 ? "bg-white" : "bg-[#FAFAFA]"}>
                      <td className="px-3 py-2 font-semibold border border-black/8 whitespace-nowrap">{cand.nom.toUpperCase()}</td>
                      <td className="px-3 py-2 border border-black/8 whitespace-nowrap">{cand.prenom}</td>
                      <td className="px-3 py-2 text-gray-800 border border-black/8">{cand.code_candidat ?? "—"}</td>
                      <td className="px-3 py-2 text-gray-800 border border-black/8 whitespace-nowrap">{cand.date}</td>
                      {matieresVisibles.map((mat) => {
                        const n = cand.notes[mat];
                        if (!n) {
                          return (
                            <React.Fragment key={mat}>
                              <td className="px-2 py-2 text-center text-gray-700 border border-black/8" colSpan={3}>—</td>
                            </React.Fragment>
                          );
                        }
                        const isEditingH = editHarm[n.note_id] !== undefined;
                        const ecartColor = n.ecart === null ? "" : n.ecart > 0 ? "text-green-600" : n.ecart < 0 ? "text-red-500" : "text-gray-700";
                        return (
                          <React.Fragment key={mat}>
                            <td className="px-2 py-2 text-center border border-black/8 font-medium">
                              {n.valeur !== null ? fmtNote(n.valeur) : <span className="text-gray-700">—</span>}
                            </td>
                            <td className="px-1 py-1 text-center border border-black/8 min-w-[64px]">
                              {isEditingH ? (
                                <div className="flex items-center gap-1">
                                  <input
                                    autoFocus
                                    type="text"
                                    inputMode="decimal"
                                    placeholder="ex. 14,25"
                                    value={editHarm[n.note_id]}
                                    onChange={(e) => setEditHarm((prev) => ({ ...prev, [n.note_id]: e.target.value }))}
                                    onKeyDown={(e) => {
                                      if (e.key === "Enter") saveHarm(n.note_id, editHarm[n.note_id]);
                                      if (e.key === "Escape") setEditHarm((prev) => { const next = { ...prev }; delete next[n.note_id]; return next; });
                                    }}
                                    className="w-16 px-1 py-0.5 rounded border border-blue-300 text-xs text-center"
                                  />
                                  {savingHarm[n.note_id] && <Loader2 className="h-3 w-3 animate-spin text-blue-500 shrink-0" />}
                                </div>
                              ) : (
                                <button
                                  onClick={() => setEditHarm((prev) => ({ ...prev, [n.note_id]: n.note_harmonisee !== null ? String(n.note_harmonisee) : "" }))}
                                  className="w-full text-center hover:bg-blue-50 rounded px-1 py-0.5 transition group"
                                  title="Cliquer pour saisir la note harmonisée"
                                >
                                  {n.note_harmonisee !== null
                                    ? <span className="font-semibold text-blue-700">{fmtNote(n.note_harmonisee)}</span>
                                    : <span className="text-gray-700 group-hover:text-blue-400">—</span>}
                                </button>
                              )}
                            </td>
                            <td className={`px-2 py-2 text-center border border-black/8 text-xs font-medium ${ecartColor}`}>
                              {n.ecart !== null ? (n.ecart > 0 ? `+${fmtNote(n.ecart)}` : fmtNote(n.ecart)) : "—"}
                            </td>
                          </React.Fragment>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
        );
      })()}

      {/* ── Saisie admin ──────────────────────────────────────────────────────── */}
      {tab === "saisie" && (
        <div className="space-y-5">
          <div className="flex items-end gap-4 flex-wrap">
            <Field label="Planning (optionnel)">
              <Select value={saisiePlanningId} onChange={(e) => { setSaisiePlanningId(e.target.value === "" ? "" : Number(e.target.value)); setSaisieExamId(""); }}>
                <option value="">— Tous les plannings</option>
                {plannings.map((p) => <option key={p.id} value={p.id}>{p.nom}</option>)}
              </Select>
            </Field>
            <Field label="Examinateur">
              <Select value={saisieExamId} onChange={(e) => setSaisieExamId(e.target.value === "" ? "" : Number(e.target.value))}>
                <option value="">— Sélectionner un examinateur</option>
                {saisieExams.map((ex) => (
                  <option key={ex.id} value={ex.id}>{ex.nom.toUpperCase()} {ex.prenom}</option>
                ))}
              </Select>
            </Field>
          </div>

          {!saisieExamId ? (
            <Empty message="Sélectionnez un examinateur" sub="Choisissez éventuellement un planning pour filtrer la liste." />
          ) : saisieLoading ? (
            <div className="flex justify-center py-12 text-gray-700"><Spinner /></div>
          ) : saisieRows.length === 0 ? (
            <Empty message="Aucune épreuve trouvée pour cet examinateur" />
          ) : (
            <div className="overflow-x-auto rounded-xl border bg-white shadow-sm">
              <table className="text-sm border-collapse min-w-full">
                <thead>
                  <tr className="bg-[#1A237E] text-white text-xs">
                    {["Date", "Matière", "Prép.", "Passage", "Candidat", "Note /20", "Commentaire", "Statut", ""].map((h) => (
                      <th key={h} className="px-3 py-2.5 text-left font-semibold whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {saisieRows.map((row, ri) => {
                    const draft = saisieDraft[row.epreuve_id] ?? { valeur: "", commentaire: "" };
                    const saving = saisieSaving[row.epreuve_id] ?? false;
                    return (
                      <tr key={row.epreuve_id} className={ri % 2 === 0 ? "bg-white" : "bg-[#FAFAFA]"}>
                        <td className="px-3 py-2 border border-black/8 whitespace-nowrap text-xs text-gray-800">{row.date}</td>
                        <td className="px-3 py-2 border border-black/8 font-medium whitespace-nowrap">{row.matiere}</td>
                        <td className="px-3 py-2 border border-black/8 text-xs text-gray-800 whitespace-nowrap">
                          {row.preparation_minutes ? `${row.heure_debut.slice(0,5)} (−${row.preparation_minutes}′)` : "—"}
                        </td>
                        <td className="px-3 py-2 border border-black/8 text-xs font-medium whitespace-nowrap">{row.heure_debut.slice(0,5)}–{row.heure_fin.slice(0,5)}</td>
                        <td className="px-3 py-2 border border-black/8 whitespace-nowrap">
                          {row.candidat_nom
                            ? <span>{row.candidat_nom.toUpperCase()} <span className="text-gray-800">{row.candidat_prenom}</span></span>
                            : <span className="text-gray-700 italic">Non assigné</span>}
                        </td>
                        <td className="px-2 py-1.5 border border-black/8">
                          <input
                            type="text"
                            inputMode="decimal"
                            value={draft.valeur}
                            onChange={(e) => setSaisieDraft((prev) => ({ ...prev, [row.epreuve_id]: { ...draft, valeur: e.target.value } }))}
                            placeholder="—"
                            className="w-16 px-2 py-1 rounded border border-black/15 text-sm text-center focus:outline-none focus:border-[#1A237E]"
                          />
                        </td>
                        <td className="px-2 py-1.5 border border-black/8">
                          <input
                            type="text"
                            value={draft.commentaire}
                            onChange={(e) => setSaisieDraft((prev) => ({ ...prev, [row.epreuve_id]: { ...draft, commentaire: e.target.value } }))}
                            placeholder="Commentaire…"
                            className="w-48 px-2 py-1 rounded border border-black/15 text-sm focus:outline-none focus:border-[#1A237E]"
                          />
                        </td>
                        <td className="px-3 py-2 border border-black/8 text-xs">
                          {row.statut === "PUBLIE" ? (
                            <span className="bg-green-100 text-green-700 rounded-full px-2 py-0.5 font-medium">Publiée</span>
                          ) : row.statut === "BROUILLON" ? (
                            <span className="bg-amber-100 text-amber-700 rounded-full px-2 py-0.5 font-medium">Brouillon</span>
                          ) : (
                            <span className="text-gray-700">—</span>
                          )}
                        </td>
                        <td className="px-3 py-2 border border-black/8">
                          <button
                            onClick={() => saveSaisie(row.epreuve_id)}
                            disabled={saving || !row.candidat_id}
                            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-[#1A237E] text-white font-semibold hover:bg-[#283593] transition disabled:opacity-40 whitespace-nowrap"
                            title={!row.candidat_id ? "Aucun candidat assigné à cette épreuve" : "Enregistrer"}
                          >
                            {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
                            Enregistrer
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── Publication ───────────────────────────────────────────────────────── */}
      {tab === "publication" && (() => {
        // Trois catégories : brouillons des examinateurs → en attente de publication (validées
        // / harmonisées) → publiées. Sélecteur + recherche + filtre examinateur.
        const categorie = (n: NoteAdmin) =>
          n.statut === "PUBLIE" ? "publiees"
          : n.statut === "BROUILLON" ? "brouillons"
          : "attente";
        const q = pubRecherche.trim().toLowerCase();
        const visibles = notes
          .filter((n) => pubVue === "tout" || categorie(n) === pubVue)
          .filter((n) => !pubExaminateur || (n.examinateurs ?? []).includes(pubExaminateur))
          .filter((n) => !q || `${n.candidat_nom} ${n.candidat_prenom} ${n.matiere} ${(n.examinateurs ?? []).join(" ")}`.toLowerCase().includes(q));
        const examinateursPub = [...new Set(notes.flatMap((n) => n.examinateurs ?? []))].sort((a, b) => a.localeCompare(b, "fr"));
        const VUES = [
          { k: "tout", label: "Tout", n: notes.length },
          { k: "brouillons", label: "Brouillons des examinateurs", n: enAttente.length },
          { k: "attente", label: "En attente de publication", n: aPublier.length },
          { k: "publiees", label: "Publiées", n: publiees.length },
        ] as const;
        const BADGE: Record<string, { label: string; cls: string }> = {
          BROUILLON: { label: "Brouillon", cls: "bg-amber-50 text-amber-800 border-amber-200" },
          VALIDE: { label: "Validée", cls: "bg-blue-50 text-blue-800 border-blue-200" },
          HARMONISE: { label: "Harmonisée", cls: "bg-indigo-50 text-indigo-800 border-indigo-200" },
          PUBLIE: { label: "Publiée", cls: "bg-emerald-50 text-emerald-800 border-emerald-200" },
        };
        return (
      <div className="space-y-4">
      {error && (
        <div className="rounded-lg bg-red-50 border border-red-100 px-4 py-3 text-sm text-red-600">{error}</div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-gray-700" />
        </div>
      ) : notes.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-200 p-16 text-center">
          <FileSpreadsheet className="h-10 w-10 mx-auto mb-3 text-gray-700" />
          <p className="text-base font-medium text-gray-900">Aucune note saisie</p>
          <p className="text-sm text-gray-700 mt-1">Les notes apparaîtront ici dès leur saisie par les examinateurs.</p>
        </div>
      ) : (
        <>
          {/* Sélecteur de catégorie */}
          <div className="flex flex-wrap gap-2">
            {VUES.map((v) => (
              <button
                key={v.k}
                onClick={() => setPubVue(v.k)}
                className={`text-sm px-3 py-1.5 rounded-lg border font-medium transition ${
                  pubVue === v.k ? "bg-[#C62828] text-white border-[#C62828]" : "bg-white text-gray-900 border-gray-300 hover:bg-gray-50"
                }`}
              >
                {v.label} <span className={pubVue === v.k ? "opacity-90" : "text-gray-700"}>({v.n})</span>
              </button>
            ))}
          </div>

          {/* Recherche + examinateur */}
          <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 max-w-2xl">
            <Input value={pubRecherche} onChange={(e) => setPubRecherche(e.target.value)} placeholder="Rechercher un candidat, une matière, un examinateur…" />
            <Select value={pubExaminateur} onChange={(e) => setPubExaminateur(e.target.value)}>
              <option value="">Tous les examinateurs</option>
              {examinateursPub.map((x) => <option key={x} value={x}>{x}</option>)}
            </Select>
          </div>

          {pubVue === "brouillons" && (
            <p className="text-sm text-gray-900">
              Notes saisies par les examinateurs mais <strong>pas encore validées</strong> : elles ne peuvent pas être publiées.
              Relancez l&apos;examinateur, ou validez la note vous-même avec « Valider ».
            </p>
          )}
          {pubVue === "attente" && (
            <p className="text-sm text-gray-900">
              Notes validées (ou harmonisées), prêtes à être publiées. « Tout publier » publie l&apos;ensemble de ces notes.
            </p>
          )}

          {visibles.length === 0 ? (
            <div className="rounded-xl border border-dashed border-gray-300 p-8 text-center text-sm text-gray-900">
              Aucune note dans cette catégorie{(q || pubExaminateur) ? " pour ces filtres" : ""}.
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 text-left">
                    {["Candidat", "Matière", "Note", "Jury (examinateurs)", "Commentaire", "Statut", ""].map((h) => (
                      <th key={h} className="px-4 py-2.5 text-xs font-semibold text-gray-900 whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {visibles.map((note) => {
                    const b = BADGE[note.statut] ?? { label: note.statut, cls: "bg-gray-50 text-gray-800 border-gray-200" };
                    return (
                      <tr key={note.id} className="border-t border-gray-100 align-top">
                        <td className="px-4 py-2.5 font-medium text-gray-900 whitespace-nowrap">
                          {note.candidat_nom.toUpperCase()} {note.candidat_prenom}
                        </td>
                        <td className="px-4 py-2.5 text-gray-900">{note.matiere}</td>
                        <td className="px-4 py-2.5 font-semibold text-gray-900 whitespace-nowrap">{affNote(note)}</td>
                        <td className="px-4 py-2.5 text-gray-900">
                          {(note.examinateurs ?? []).length > 0
                            ? (note.examinateurs ?? []).join(", ")
                            : <span className="italic text-gray-700">—</span>}
                        </td>
                        <td className="px-4 py-2.5 text-gray-900 max-w-xs">
                          {note.commentaire ? <span className="line-clamp-2" title={note.commentaire}>{note.commentaire}</span> : <span className="text-gray-700">—</span>}
                        </td>
                        <td className="px-4 py-2.5">
                          <span className={`inline-block text-xs border rounded-full px-2 py-0.5 font-medium whitespace-nowrap ${b.cls}`}>{b.label}</span>
                        </td>
                        <td className="px-4 py-2.5 text-right whitespace-nowrap">
                          {note.statut === "BROUILLON" ? (
                            <button
                              onClick={() => validerNote(note)}
                              disabled={publishing[note.id] || note.valeur === null}
                              title="Valider cette note à la place de l'examinateur : elle passera « En attente de publication »"
                              className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-gray-300 text-gray-900 font-medium hover:bg-gray-50 transition disabled:opacity-40"
                            >
                              {publishing[note.id] ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle2 className="h-3 w-3" />}
                              Valider
                            </button>
                          ) : note.statut !== "PUBLIE" ? (
                            <button
                              onClick={() => publierNote(note)}
                              disabled={publishing[note.id] || noteFinale(note) === null}
                              className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-green-600 text-white font-semibold hover:bg-green-700 transition disabled:opacity-40"
                            >
                              {publishing[note.id] ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
                              Publier
                            </button>
                          ) : null}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
      </div>
        );
      })()}
    </div>
  );
}
