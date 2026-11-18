"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useToast, useConfirm } from "../Toast";
import {
  Plus,
  Trash2,
  KeyRound,
  X,
  Loader2,
  Download,
  Upload,
  GraduationCap,
  CheckCircle2,
  Send,
} from "lucide-react";
import {
  BandeauTripletsSansNumero,
  Btn,
  EpreuveFlat,
  ErrorMsg,
  EtablissementItem,
  Examinateur,
  Field,
  ImportExcelModal,
  Input,
  IntentionAffectation,
  MatiereItem,
  Modal,
  Planning,
  Select,
  Spinner,
  StatutBadge,
  debutPrepa,
  del,
  detailPrepa,
  formatDate,
  get,
  intentions,
  memoriserPlanning,
  patch,
  plageAvecPrepa,
  planningMemorise,
  post,
  put,
  useFiltre,
  useIntentionAffectation,
  useMatieres,
} from "./commun";

type Indisponibilite = {
  id: number;
  examinateur_id: number;
  debut: string;
  fin: string;
  commentaire: string | null;
};

// ── AffectationTab (examinateurs) ─────────────────────────────────────────────

type IndispoItem = { id: number; debut: string; fin: string };

function AffectationTab({ planningId, examinateurs, filtresInitiaux }: {
  planningId: number;
  examinateurs: Examinateur[];
  // Arrivée depuis un lien « manque examinateur » : créneau visé, sans examinateur
  filtresInitiaux?: IntentionAffectation | null;
}) {
  const toast = useToast();
  const [epreuves, setEpreuves] = useState<EpreuveFlat[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedExId, setSelectedExId] = useState<number | "">("");
  const [filterDate, setFilterDate] = useFiltre("affectation:date", filtresInitiaux?.date ?? "", planningId, !!filtresInitiaux);
  const [filterMatiere, setFilterMatiere] = useFiltre("affectation:matiere", filtresInitiaux?.matiere ?? "", planningId, !!filtresInitiaux);
  const [filterSession, setFilterSession] = useFiltre<"" | "MATIN" | "APRES_MIDI">("affectation:session", "", planningId, !!filtresInitiaux);
  const [filterHeure, setFilterHeure] = useFiltre("affectation:heure", filtresInitiaux?.heure ?? "", planningId, !!filtresInitiaux);
  // "" = tous, "__sans" = épreuves sans numéro de matrice, sinon « T5 »
  const [filterTriplet, setFilterTriplet] = useFiltre("affectation:triplet", "", planningId, !!filtresInitiaux);
  const [filterEtat, setFilterEtat] = useFiltre<"" | "sans" | "avec" | "lui">("affectation:etat", filtresInitiaux ? "sans" : "", planningId, !!filtresInitiaux);
  // 2ᵉ examinateur : "" = tous, "__avec" / "__sans", ou l'id d'un examinateur précis
  const [filterEx2, setFilterEx2] = useFiltre("affectation:ex2", "", planningId, !!filtresInitiaux);
  // Dédoublement : "" = tous, "__doublons" / "__simples", ou le rang du jury ("1", "2"…)
  const [filterDoublon, setFilterDoublon] = useFiltre("affectation:doublons", "", planningId, !!filtresInitiaux);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [assigning, setAssigning] = useState(false);
  const [deassigning, setDeassigning] = useState<number | null>(null);
  const [indispos, setIndispos] = useState<IndispoItem[]>([]);
  const [conflicts, setConflicts] = useState<{ epreuve_id: number; reason: string; date: string; heure: string }[]>([]);

  const selectedEx = examinateurs.find((e) => e.id === selectedExId) ?? null;

  // Load all epreuves when planning changes
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await get<EpreuveFlat[]>(`plannings/${planningId}/epreuves`);
      setEpreuves(data);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [planningId]);

  useEffect(() => { load(); }, [load]);

  // Load indisponibilités when examiner changes
  useEffect(() => {
    if (!selectedExId) { setIndispos([]); return; }
    get<IndispoItem[]>(`examinateurs/${selectedExId}/indisponibilites`)
      .then(setIndispos)
      .catch(() => setIndispos([]));
    setSelected(new Set());
    setConflicts([]);
  }, [selectedExId]);

  // Check if a slot overlaps with any indisponibilité
  function isIndispo(ep: EpreuveFlat): boolean {
    if (!indispos.length) return false;
    const start = new Date(`${ep.date}T${ep.heure_debut}`);
    const end = new Date(`${ep.date}T${ep.heure_fin}`);
    return indispos.some((ind) => start < new Date(ind.fin) && end > new Date(ind.debut));
  }

  // Filter epreuves
  const matieres = selectedEx
    ? selectedEx.matieres
    : Array.from(new Set(epreuves.map((e) => e.matiere))).sort();

  // Dédoublement de jury : plusieurs épreuves sur le même créneau (date, matière, heure).
  // Rang #1, #2… calculé sur tout le planning, comme dans « Salles & surveillants » :
  // le même jury porte le même numéro sur les deux écrans, quels que soient les filtres.
  const rangJury = new Map<number, number>();
  const tailleCreneau = new Map<string, number>();
  const cleCreneau = (e: EpreuveFlat) => `${e.date}||${e.matiere}||${e.heure_debut}`;
  for (const e of epreuves) {
    const n = (tailleCreneau.get(cleCreneau(e)) ?? 0) + 1;
    tailleCreneau.set(cleCreneau(e), n);
    rangJury.set(e.id, n);
  }
  const estDoublon = (e: EpreuveFlat) => (tailleCreneau.get(cleCreneau(e)) ?? 1) > 1;
  const maxJurys = Math.max(1, ...Array.from(tailleCreneau.values()));

  const filtered = epreuves.filter((ep) => {
    if (filterDoublon === "__doublons" && !estDoublon(ep)) return false;
    if (filterDoublon === "__simples" && estDoublon(ep)) return false;
    if (filterDoublon && !filterDoublon.startsWith("__") && (!estDoublon(ep) || rangJury.get(ep.id) !== Number(filterDoublon))) return false;
    if (filterMatiere && ep.matiere !== filterMatiere) return false;
    if (filterDate && ep.date !== filterDate) return false;
    if (filterSession && ep.demi_journee_type !== filterSession) return false;
    if (filterHeure && ep.heure_debut !== filterHeure) return false;
    if (filterTriplet === "__sans" && ep.triplet) return false;
    if (filterTriplet && filterTriplet !== "__sans" && ep.triplet !== filterTriplet) return false;
    const aExaminateur = ep.examinateur_id != null || ep.examinateur2_id != null;
    if (filterEtat === "sans" && aExaminateur) return false;
    if (filterEtat === "avec" && !aExaminateur) return false;
    if (filterEtat === "lui" && (selectedExId === "" || (ep.examinateur_id !== selectedExId && ep.examinateur2_id !== selectedExId))) return false;
    if (filterEx2 === "__avec" && ep.examinateur2_id == null) return false;
    if (filterEx2 === "__sans" && ep.examinateur2_id != null) return false;
    if (filterEx2 && !filterEx2.startsWith("__") && ep.examinateur2_id !== Number(filterEx2)) return false;
    // If examiner selected, only show their matières
    if (selectedEx && !selectedEx.matieres.includes(ep.matiere)) return false;
    return true;
  });

  const dates = Array.from(new Set(filtered.map((e) => e.date))).sort();

  // Toggle slot in selection (skip indispos)
  function toggle(id: number, indispo: boolean) {
    if (indispo) return;
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function toggleAll(ids: number[]) {
    const selectable = ids.filter((id) => {
      const ep = epreuves.find((e) => e.id === id);
      return ep && !isIndispo(ep);
    });
    const allSelected = selectable.every((id) => selected.has(id));
    setSelected((prev) => {
      const next = new Set(prev);
      if (allSelected) selectable.forEach((id) => next.delete(id));
      else selectable.forEach((id) => next.add(id));
      return next;
    });
  }

  async function handleAssign() {
    if (!selectedExId || selected.size === 0) return;
    setAssigning(true);
    setConflicts([]);
    try {
      const res = await post<{ assigned: number[]; conflicts: typeof conflicts }>(
        `examinateurs/assign-bulk`,
        { examinateur_id: selectedExId, epreuve_ids: Array.from(selected) }
      );
      if (res.assigned.length > 0) {
        toast.success(`${res.assigned.length} créneau(x) affecté(s)`);
      }
      if (res.conflicts.length > 0) {
        setConflicts(res.conflicts);
        toast.warning(`${res.conflicts.length} conflit(s) détecté(s)`);
      }
      setSelected(new Set());
      await load();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setAssigning(false);
    }
  }

  async function handleDeassign(epreuveId: number, slot: 1 | 2) {
    setDeassigning(epreuveId * 10 + slot);
    try {
      await post(`examinateurs/epreuves/${epreuveId}/assigner`, { examinateur_id: null, slot });
      await load();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setDeassigning(null);
    }
  }

  const assigned = filtered.filter((e) => e.examinateur_id !== null || e.examinateur2_id !== null).length;

  return (
    <div className="space-y-4">
      <BandeauTripletsSansNumero planningId={planningId} epreuves={epreuves} onFait={load} />
      {/* Controls */}
      <div className="bg-white rounded-xl border shadow-sm p-4 space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-800 mb-1">Examinateur</label>
            <select
              value={selectedExId}
              onChange={(e) => {
                setSelectedExId(e.target.value ? Number(e.target.value) : "");
                setFilterMatiere("");
                if (!e.target.value) setFilterEtat((f) => (f === "lui" ? "" : f));
              }}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#C62828]/30"
            >
              <option value="">— Tous les examinateurs —</option>
              {examinateurs.map((ex) => (
                <option key={ex.id} value={ex.id}>
                  {ex.nom} {ex.prenom}{ex.matieres.length ? ` — ${ex.matieres.join(", ")}` : ""}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-800 mb-1">Matière</label>
            <select
              value={filterMatiere}
              onChange={(e) => setFilterMatiere(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#C62828]/30"
            >
              <option value="">Toutes</option>
              {matieres.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-800 mb-1">Date</label>
            <select
              value={filterDate}
              onChange={(e) => setFilterDate(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#C62828]/30"
            >
              <option value="">Toutes les dates</option>
              {Array.from(new Set(epreuves.map((e) => e.date))).sort().map((d) => (
                <option key={d} value={d}>
                  {new Date(d + "T12:00:00").toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" })}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-800 mb-1">Triplet</label>
            <select
              value={filterTriplet}
              onChange={(e) => setFilterTriplet(e.target.value)}
              title="Triplet de la matrice de la journée type ; à combiner avec la date"
              className="w-full border rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#C62828]/30"
            >
              <option value="">Tous les triplets</option>
              {Array.from(new Set(epreuves.flatMap((e) => (e.triplet ? [e.triplet] : []))))
                .sort((a, b) => Number(a.slice(1)) - Number(b.slice(1)))
                .map((tr) => <option key={tr} value={tr}>{tr}</option>)}
              {epreuves.some((e) => !e.triplet) && <option value="__sans">Sans triplet</option>}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-800 mb-1">Session</label>
            <select
              value={filterSession}
              onChange={(e) => setFilterSession(e.target.value as "" | "MATIN" | "APRES_MIDI")}
              className="w-full border rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#C62828]/30"
            >
              <option value="">Matin et après-midi</option>
              <option value="MATIN">Matin</option>
              <option value="APRES_MIDI">Après-midi</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-800 mb-1">Horaire</label>
            <select
              value={filterHeure}
              onChange={(e) => setFilterHeure(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#C62828]/30"
            >
              <option value="">Tous les horaires</option>
              {Array.from(new Set(epreuves.map((e) => e.heure_debut))).sort().map((h) => <option key={h} value={h}>{h}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-800 mb-1">Affectation</label>
            <select
              value={filterEtat}
              onChange={(e) => setFilterEtat(e.target.value as "" | "sans" | "avec" | "lui")}
              className="w-full border rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#C62828]/30"
            >
              <option value="">Toutes les épreuves</option>
              <option value="sans">Sans examinateur</option>
              <option value="avec">Avec examinateur</option>
              <option value="lui" disabled={selectedExId === ""}>Affectées à l&apos;examinateur choisi</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-800 mb-1">2ᵉ examinateur</label>
            <select
              value={filterEx2}
              onChange={(e) => setFilterEx2(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#C62828]/30"
            >
              <option value="">Tous</option>
              <option value="__avec">Avec 2ᵉ examinateur</option>
              <option value="__sans">Sans 2ᵉ examinateur</option>
              {examinateurs.map((ex) => (
                <option key={ex.id} value={String(ex.id)}>{ex.nom} {ex.prenom}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-800 mb-1">Doublons</label>
            <select
              value={filterDoublon}
              onChange={(e) => setFilterDoublon(e.target.value)}
              title="Dédoublement de jury : plusieurs épreuves en parallèle sur le même créneau (même date, matière et horaire)"
              className="w-full border rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#C62828]/30"
            >
              <option value="">Tous les créneaux</option>
              <option value="__doublons">Créneaux dédoublés</option>
              <option value="__simples">Créneaux simples</option>
              {maxJurys > 1 && Array.from({ length: maxJurys }, (_, i) => String(i + 1)).map((r) => (
                <option key={r} value={r}>Jury #{r} des doublons</option>
              ))}
            </select>
          </div>
        </div>
        {(filterMatiere || filterDate || filterSession || filterHeure || filterTriplet || filterEtat || filterEx2 || filterDoublon) && (
          <div className="flex items-center gap-3 text-xs text-gray-800">
            <span>{filtered.length} épreuve{filtered.length > 1 ? "s" : ""} affichée{filtered.length > 1 ? "s" : ""} sur {epreuves.length}</span>
            <button
              onClick={() => { setFilterMatiere(""); setFilterDate(""); setFilterSession(""); setFilterHeure(""); setFilterTriplet(""); setFilterEtat(""); setFilterEx2(""); setFilterDoublon(""); }}
              className="text-[#C62828] hover:underline"
            >
              Réinitialiser les filtres
            </button>
          </div>
        )}

        {filtered.length > 0 && (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-xs text-gray-800">{assigned}/{filtered.length} attribué(s)</span>
              <div className="w-32 bg-gray-100 rounded-full h-1.5">
                <div className="bg-[#C62828] h-1.5 rounded-full" style={{ width: `${filtered.length ? (assigned / filtered.length) * 100 : 0}%` }} />
              </div>
            </div>
            {selectedExId && selected.size > 0 && (
              <button
                onClick={handleAssign}
                disabled={assigning}
                className="flex items-center gap-1.5 px-4 py-1.5 bg-[#C62828] text-white text-sm font-semibold rounded-lg hover:bg-[#B71C1C] transition disabled:opacity-50"
              >
                {assigning ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                Affecter {selected.size} créneau{selected.size > 1 ? "x" : ""}
              </button>
            )}
          </div>
        )}
      </div>

      {/* Conflicts */}
      {conflicts.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
          <p className="text-sm font-semibold text-amber-800 mb-2">&#9888; {conflicts.length} conflit(s) non affecté(s)</p>
          <ul className="space-y-1">
            {conflicts.map((c, i) => (
              <li key={i} className="text-xs text-amber-700">
                {new Date(c.date + "T12:00:00").toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" })} {c.heure} — {c.reason}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Slots by date */}
      {loading ? (
        <div className="p-8 text-center"><Spinner /></div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-black/15 p-14 text-center">
          <p className="text-gray-700 font-medium">{selectedExId ? "Aucun créneau pour les matières de cet examinateur" : "Aucun créneau"}</p>
        </div>
      ) : (
        dates.map((date) => {
          const eps = filtered.filter((e) => e.date === date);
          const allIds = eps.map((e) => e.id);
          const selectableIds = allIds.filter((id) => {
            const ep = eps.find((e) => e.id === id)!;
            return !isIndispo(ep);
          });
          const allChecked = selectableIds.length > 0 && selectableIds.every((id) => selected.has(id));

          return (
            <div key={date}>
              <div className="flex items-center gap-2 mb-2">
                {selectedExId && selectableIds.length > 0 && (
                  <input
                    type="checkbox"
                    checked={allChecked}
                    onChange={() => toggleAll(allIds)}
                    className="h-3.5 w-3.5 rounded accent-[#C62828]"
                  />
                )}
                <p className="text-xs font-semibold text-gray-700 uppercase tracking-wide">
                  {new Date(date + "T12:00:00").toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })}
                </p>
              </div>
              <div className="bg-white rounded-xl shadow-sm overflow-hidden border border-black/5">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-black/[0.02]">
                      {selectedExId && <th className="w-8 px-3 py-2" />}
                      <th
                        className="text-left px-4 py-2 font-medium text-gray-700 text-xs"
                        title="Triplet de la matrice de la journée type (Journée-types > Matrice oraux)"
                      >
                        Triplet
                      </th>
                      <th className="text-left px-4 py-2 font-medium text-gray-700 text-xs">Horaire</th>
                      <th className="text-left px-4 py-2 font-medium text-gray-700 text-xs">Matière</th>
                      <th className="text-left px-4 py-2 font-medium text-gray-700 text-xs">Candidat</th>
                      <th className="text-left px-4 py-2 font-medium text-gray-700 text-xs">Exam. 1</th>
                      <th className="text-left px-4 py-2 font-medium text-gray-700 text-xs">Exam. 2</th>
                      <th className="text-left px-4 py-2 font-medium text-gray-700 text-xs">Statut</th>
                    </tr>
                  </thead>
                  <tbody>
                    {eps.map((ep, i) => {
                      const indispo = isIndispo(ep);
                      const isChecked = selected.has(ep.id);
                      const isMine1 = selectedExId !== "" && ep.examinateur_id === (selectedExId as number);
                      const isMine2 = selectedExId !== "" && ep.examinateur2_id === (selectedExId as number);
                      const isDead = deassigning !== null;

                      return (
                        <tr
                          key={ep.id}
                          onClick={() => selectedExId && toggle(ep.id, indispo)}
                          className={`border-b last:border-0 transition cursor-default ${
                            isChecked ? "bg-red-50/60" : i % 2 === 0 ? "" : "bg-black/[0.01]"
                          } ${selectedExId && !indispo ? "hover:bg-black/[0.02] cursor-pointer" : ""}`}
                        >
                          {selectedExId && (
                            <td className="px-3 py-3 text-center" onClick={(e) => e.stopPropagation()}>
                              {indispo ? (
                                <span title="Indisponibilité" className="text-amber-500 text-xs">&#9888;</span>
                              ) : (
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={() => toggle(ep.id, false)}
                                  className="h-3.5 w-3.5 rounded accent-[#C62828]"
                                />
                              )}
                            </td>
                          )}
                          <td className="px-4 py-3 whitespace-nowrap">
                            {ep.triplet ? (
                              <span className="text-xs font-bold px-2 py-0.5 rounded bg-gray-100 text-gray-900 tabular-nums">{ep.triplet}</span>
                            ) : (
                              <span className="text-xs text-gray-700" title="Journée générée sans matrice de journée type">—</span>
                            )}
                          </td>
                          <td className="px-4 py-3 font-mono text-xs text-gray-800 whitespace-nowrap">
                            {ep.heure_debut.slice(0,5)} – {ep.heure_fin.slice(0,5)}
                            {indispo && (
                              <span className="ml-1.5 text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded font-medium">Indisponible</span>
                            )}
                          </td>
                          <td className="px-4 py-3 font-medium text-xs text-gray-700 whitespace-nowrap">
                            {ep.matiere}
                            {estDoublon(ep) && (
                              <span
                                className="ml-1.5 inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-semibold align-middle"
                                style={{ backgroundColor: "#EEF2FF", color: "#3730A3" }}
                                title={`Créneau dédoublé : jury ${rangJury.get(ep.id)} sur ${tailleCreneau.get(cleCreneau(ep))}${ep.salle_intitule ? `, salle ${ep.salle_intitule}` : ", salle non affectée"}`}
                              >
                                Jury #{rangJury.get(ep.id)}
                                <span className="font-normal">· {ep.salle_intitule ? `salle ${ep.salle_intitule}` : "sans salle"}</span>
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-xs text-gray-800">
                            {ep.candidat_id
                              ? `${ep.candidat_prenom ?? ""} ${ep.candidat_nom ?? ""}`.trim()
                              : <span className="text-gray-700 italic">—</span>}
                          </td>
                          <td className="px-4 py-3 text-xs" onClick={(e) => e.stopPropagation()}>
                            {ep.examinateur_id ? (
                              <span className={`flex items-center gap-1 ${isMine1 ? "text-[#C62828] font-semibold" : "text-gray-800"}`}>
                                {ep.examinateur_nom} {ep.examinateur_prenom?.charAt(0)}.
                                {isMine1 && (
                                  <button
                                    onClick={() => handleDeassign(ep.id, 1)}
                                    disabled={isDead}
                                    className="text-gray-700 hover:text-red-500 transition ml-0.5"
                                    title="Désaffecter"
                                  >
                                    <X className="h-3 w-3" />
                                  </button>
                                )}
                              </span>
                            ) : <span className="text-gray-700">—</span>}
                          </td>
                          <td className="px-4 py-3 text-xs" onClick={(e) => e.stopPropagation()}>
                            {ep.examinateur2_id ? (
                              <span className={`flex items-center gap-1 ${isMine2 ? "text-[#C62828] font-semibold" : "text-gray-800"}`}>
                                {ep.examinateur2_nom} {ep.examinateur2_prenom?.charAt(0)}.
                                {isMine2 && (
                                  <button
                                    onClick={() => handleDeassign(ep.id, 2)}
                                    disabled={isDead}
                                    className="text-gray-700 hover:text-red-500 transition ml-0.5"
                                    title="Désaffecter"
                                  >
                                    <X className="h-3 w-3" />
                                  </button>
                                )}
                              </span>
                            ) : <span className="text-gray-700">—</span>}
                          </td>
                          <td className="px-4 py-3">
                            <StatutBadge statut={ep.statut} />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}

function MatieresCheckboxes({
  selected,
  onChange,
  matieres,
}: {
  selected: string[];
  onChange: (v: string[]) => void;
  matieres: MatiereItem[];
}) {
  const toggle = (intitule: string) => {
    onChange(selected.includes(intitule) ? selected.filter((m) => m !== intitule) : [...selected, intitule]);
  };
  if (matieres.length === 0)
    return <p className="text-xs text-gray-700 italic">Aucune matière configurée dans Paramétrages.</p>;
  return (
    <div className="flex flex-wrap gap-2">
      {matieres.filter((m) => m.active).map((m) => (
        <button
          key={m.id}
          type="button"
          onClick={() => toggle(m.intitule)}
          className={`px-2.5 py-1 rounded-lg border text-sm transition ${
            selected.includes(m.intitule)
              ? "bg-blue-600 text-white border-blue-600"
              : "bg-white text-gray-800 border-black/15 hover:border-black/30"
          }`}
        >
          {m.intitule}
        </button>
      ))}
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDt(iso: string): string {
  try {
    return new Date(iso).toLocaleString("fr-FR", {
      day: "2-digit", month: "2-digit", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

// ── Indisponibilités ──────────────────────────────────────────────────────────

function IndisponibilitesSection({ examinateurId, onLoad }: { examinateurId: number; onLoad?: (items: Indisponibilite[]) => void }) {
  const toast = useToast();
  const confirm = useConfirm();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Indisponibilite[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [debut, setDebut] = useState("");
  const [fin, setFin] = useState("");
  const [comment, setComment] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const data = await get<Indisponibilite[]>(`examinateurs/${examinateurId}/indisponibilites`).catch(() => []);
    setItems(data);
    onLoad?.(data);
    setLoading(false);
  }, [examinateurId]);

  useEffect(() => { load(); }, [load]);

  async function save() {
    setSaving(true); setErr("");
    try {
      if (editingId) {
        await put(`examinateurs/${examinateurId}/indisponibilites/${editingId}`, { debut, fin, commentaire: comment || null });
      } else {
        await post(`examinateurs/${examinateurId}/indisponibilites`, { debut, fin, commentaire: comment || null });
      }
      setShowAdd(false); setEditingId(null); setDebut(""); setFin(""); setComment("");
      load();
    } catch (e: unknown) { setErr(e instanceof Error ? e.message : "Erreur"); }
    finally { setSaving(false); }
  }

  function startEdit(item: Indisponibilite) {
    setEditingId(item.id);
    setDebut(item.debut.slice(0, 16));
    setFin(item.fin.slice(0, 16));
    setComment(item.commentaire ?? "");
    setShowAdd(true);
  }

  async function remove(id: number) {
    if (!await confirm("Supprimer cette indisponibilité ?", { confirmLabel: "Supprimer", danger: true })) return;
    await del(`examinateurs/${examinateurId}/indisponibilites/${id}`);
    toast.success("Indisponibilité supprimée");
    load();
  }

  return (
    <div className="border rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-3 bg-black/[0.02] hover:bg-black/[0.04] transition text-sm font-medium"
      >
        <span className="flex items-center gap-2">
          <span>Indisponibilités</span>
          {items.length > 0 && (
            <span className="text-[10px] bg-amber-100 text-amber-700 rounded-full px-1.5 py-0.5 font-semibold">{items.length}</span>
          )}
        </span>
        <span className="text-gray-700 text-xs">{open ? "▲" : "▼"}</span>
      </button>

      {open && (
        <div className="p-4 space-y-3">
          {loading ? <div className="text-center py-4"><Spinner /></div> : items.length === 0 ? (
            <p className="text-sm text-gray-700 text-center py-2">Aucune indisponibilité enregistrée.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-xs text-gray-700">
                  <th className="text-left py-1.5 font-medium">Début</th>
                  <th className="text-left py-1.5 font-medium">Fin</th>
                  <th className="text-left py-1.5 font-medium">Commentaire</th>
                  <th className="py-1.5" />
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id} className="border-b last:border-0">
                    <td className="py-2 pr-3 whitespace-nowrap text-sm">{formatDt(item.debut)}</td>
                    <td className="py-2 pr-3 whitespace-nowrap text-sm">{formatDt(item.fin)}</td>
                    <td className="py-2 text-gray-800 text-sm">{item.commentaire ?? "—"}</td>
                    <td className="py-2 text-right whitespace-nowrap">
                      <button onClick={() => startEdit(item)} className="text-xs text-blue-500 hover:text-blue-700 mr-3">Éditer</button>
                      <button onClick={() => remove(item.id)} className="text-xs text-red-400 hover:text-red-600">Supprimer</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {showAdd ? (
            <div className="bg-black/[0.02] rounded-lg p-3 space-y-2 border">
              <div className="grid grid-cols-2 gap-2">
                <Field label="Début"><Input type="datetime-local" value={debut} onChange={(e) => setDebut(e.target.value)} /></Field>
                <Field label="Fin"><Input type="datetime-local" value={fin} onChange={(e) => setFin(e.target.value)} /></Field>
              </div>
              <Field label="Commentaire">
                <Input value={comment} onChange={(e) => setComment(e.target.value)} placeholder="ex : Voyage professionnel" />
              </Field>
              <ErrorMsg msg={err} />
              <div className="flex gap-2">
                <Btn label={saving ? "Enregistrement…" : editingId ? "Modifier" : "Ajouter"} onClick={save} disabled={saving || !debut || !fin} small />
                <Btn label="Annuler" onClick={() => { setShowAdd(false); setEditingId(null); setErr(""); }} variant="ghost" small />
              </div>
            </div>
          ) : (
            <button
              onClick={() => { setShowAdd(true); setEditingId(null); setDebut(""); setFin(""); setComment(""); }}
              className="flex items-center gap-1 text-sm text-[#C62828] hover:underline"
            >
              <Plus className="h-3.5 w-3.5" /> Ajouter une indisponibilité
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ── Créneaux de l'examinateur ─────────────────────────────────────────────────

function CreneauxExaminateur({
  planningId,
  examinateur,
  indisponibilites,
}: {
  planningId: number;
  examinateur: Examinateur;
  indisponibilites: Indisponibilite[];
}) {
  const [epreuves, setEpreuves] = useState<EpreuveFlat[]>([]);
  const [loading, setLoading] = useState(true);
  // Filtres de recherche
  const [fExaminateur, setFExaminateur] = useState("");
  const [fCandidat, setFCandidat] = useState("");
  const [fHeure, setFHeure] = useState("");
  const [fJour, setFJour] = useState("");
  const [fMatiere, setFMatiere] = useState("");

  useEffect(() => {
    setLoading(true);
    get<EpreuveFlat[]>(`plannings/${planningId}/epreuves`)
      .then((all) => setEpreuves(all.filter((e) => examinateur.matieres.includes(e.matiere))))
      .catch(() => setEpreuves([]))
      .finally(() => setLoading(false));
  }, [planningId, examinateur.id, examinateur.matieres.join(",")]);

  function isIndispo(date: string, heure_debut: string): boolean {
    const slotDt = new Date(`${date}T${heure_debut}:00`);
    return indisponibilites.some((i) => slotDt >= new Date(i.debut) && slotDt < new Date(i.fin));
  }

  if (loading) return <div className="flex justify-center py-6"><Spinner /></div>;
  if (epreuves.length === 0)
    return <p className="text-sm text-gray-700 text-center py-4">Aucun créneau dans ce planning pour ces matières.</p>;

  const contient = (texte: string, q: string) => texte.toLowerCase().includes(q.trim().toLowerCase());
  const jours = [...new Set(epreuves.map((e) => e.date))].sort();
  const matieresCreneaux = [...new Set(epreuves.map((e) => e.matiere))].sort();
  const matiere = matieresCreneaux.includes(fMatiere) ? fMatiere : "";
  const heures = [...new Set(epreuves.filter((e) => !fJour || e.date === fJour).map((e) => e.heure_debut))].sort();
  const heure = heures.includes(fHeure) ? fHeure : "";
  const filtrees = epreuves.filter((e) => {
    if (matiere && e.matiere !== matiere) return false;
    if (fJour && e.date !== fJour) return false;
    if (heure && e.heure_debut !== heure) return false;
    if (fExaminateur.trim()) {
      const noms = [e.examinateur_nom, e.examinateur_prenom, e.examinateur2_nom, e.examinateur2_prenom].filter(Boolean).join(" ");
      if (!contient(noms, fExaminateur)) return false;
    }
    if (fCandidat.trim() && !contient(`${e.candidat_nom ?? ""} ${e.candidat_prenom ?? ""}`, fCandidat)) return false;
    return true;
  });
  const filtresActifs = !!(fExaminateur.trim() || fCandidat.trim() || heure || fJour || matiere);
  const champ = "text-xs text-gray-900 border border-black/15 rounded-lg px-2.5 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-black/10";

  return (
    <div className="space-y-2">
      {/* Filtres de recherche */}
      <div className="rounded-xl border border-black/10 bg-black/[0.02] p-2.5 space-y-2">
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-2">
          <select value={matiere} onChange={(e) => setFMatiere(e.target.value)} aria-label="Filtrer par matière" className={champ}>
            <option value="">Toutes les matières</option>
            {matieresCreneaux.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
          <input type="text" value={fExaminateur} onChange={(e) => setFExaminateur(e.target.value)}
            placeholder="Examinateur…" aria-label="Filtrer par examinateur" className={champ} />
          <input type="text" value={fCandidat} onChange={(e) => setFCandidat(e.target.value)}
            placeholder="Candidat…" aria-label="Filtrer par candidat" className={champ} />
          <select value={heure} onChange={(e) => setFHeure(e.target.value)} aria-label="Filtrer par heure de passage" className={champ}>
            <option value="">Toutes les heures</option>
            {heures.map((h) => <option key={h} value={h}>{h}</option>)}
          </select>
          <select value={fJour} onChange={(e) => setFJour(e.target.value)} aria-label="Filtrer par jour" className={champ}>
            <option value="">Tous les jours</option>
            {jours.map((d) => <option key={d} value={d}>{formatDate(d)}</option>)}
          </select>
        </div>
        <div className="flex items-center justify-end gap-2 text-xs text-gray-900">
          <span><span className="font-semibold">{filtrees.length}</span> créneau{filtrees.length > 1 ? "x" : ""}{filtresActifs && <> sur {epreuves.length}</>}</span>
          {filtresActifs && (
            <button type="button" onClick={() => { setFExaminateur(""); setFCandidat(""); setFHeure(""); setFJour(""); setFMatiere(""); }}
              className="font-medium text-[#C62828] hover:underline">
              Réinitialiser
            </button>
          )}
        </div>
      </div>

    <div className="overflow-x-auto rounded-xl border">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-black/[0.03] border-b text-xs text-gray-800">
            <th className="px-3 py-2 w-6" />
            <th className="px-3 py-2 text-left font-medium">Matière</th>
            <th className="px-3 py-2 text-left font-medium">Jour</th>
            <th className="px-3 py-2 text-left font-medium">Heure passage</th>
            <th className="px-3 py-2 text-left font-medium">Examinateur</th>
            <th className="px-3 py-2 text-left font-medium">Candidat</th>
            <th className="px-3 py-2 text-left font-medium">Alerte</th>
          </tr>
        </thead>
        <tbody>
          {filtrees.length === 0 && (
            <tr><td colSpan={7} className="px-3 py-6 text-center text-sm text-gray-700">Aucun créneau ne correspond aux filtres.</td></tr>
          )}
          {filtrees.map((e) => {
            const indispo = isIndispo(e.date, e.heure_debut);
            return (
              <tr key={e.id} className={`border-b last:border-0 ${indispo ? "bg-red-50/60" : "hover:bg-black/[0.01]"}`}>
                <td className="px-3 py-2 text-center">
                  <span className={`inline-block h-2 w-2 rounded-full ${indispo ? "bg-red-400" : "bg-green-400"}`} />
                </td>
                <td className="px-3 py-2 font-medium">{e.matiere}</td>
                <td className="px-3 py-2 whitespace-nowrap text-gray-800">{formatDate(e.date)}</td>
                <td className="px-3 py-2 whitespace-nowrap" title={detailPrepa(e)}>
                  <span className="font-mono text-gray-900">{plageAvecPrepa(e)}</span>
                  {!!e.preparation_minutes && (
                    <span className="block text-[11px] text-gray-700">prépa {debutPrepa(e)} · oral {e.heure_debut}</span>
                  )}
                </td>
                <td className="px-3 py-2 text-gray-800">
                  {e.examinateur_nom
                    ? `${e.examinateur_nom} ${e.examinateur_prenom ?? ""}`
                    : <span className="text-gray-700 italic">—</span>}
                </td>
                <td className="px-3 py-2">
                  {e.candidat_nom
                    ? <span>{e.candidat_nom} {e.candidat_prenom}</span>
                    : <span className="text-gray-700 italic">—</span>}
                </td>
                <td className="px-3 py-2">
                  {indispo && (
                    <span className="text-xs font-semibold text-red-600 bg-red-50 px-1.5 py-0.5 rounded">Indisponible !</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
    </div>
  );
}

// ── Fiche détail examinateur ──────────────────────────────────────────────────

function ExaminateurFiche({
  ex,
  planningId,
  onUpdated,
  onDeleted,
}: {
  ex: Examinateur;
  planningId: number;
  onUpdated: (updated: Examinateur) => void;
  onDeleted: () => void;
}) {
  const toast = useToast();
  const confirm = useConfirm();
  const matieres = useMatieres();
  const [nom, setNom] = useState(ex.nom);
  const [prenom, setPrenom] = useState(ex.prenom);
  const [email, setEmail] = useState(ex.email);
  const [telephone, setTelephone] = useState(ex.telephone ?? "");
  const [etablissement, setEtablissement] = useState(ex.etablissement ?? "");
  const [codeUai, setCodeUai] = useState(ex.code_uai ?? "");
  const [commentaire, setCommentaire] = useState(ex.commentaire ?? "");
  const [selectedMatieres, setSelectedMatieres] = useState<string[]>(ex.matieres);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const [showIdentifiants, setShowIdentifiants] = useState(false);
  const [mdpProvisoire, setMdpProvisoire] = useState<string | null>(null);
  // Export du planning de l'examinateur (mêmes documents que dans son espace)
  const [showExport, setShowExport] = useState(false);
  const [exportPerimetre, setExportPerimetre] = useState<"planning" | "tous">("planning");
  const [exportDate, setExportDate] = useState("");
  const [exportVides, setExportVides] = useState(true);
  const [exportEnCours, setExportEnCours] = useState<"pdf" | "xlsx" | null>(null);
  const exporterPlanning = async (format: "pdf" | "xlsx") => {
    setExportEnCours(format);
    try {
      const params = new URLSearchParams({ format, inclure_sans_candidat: String(exportVides) });
      if (exportPerimetre === "planning") params.set("planning_id", String(planningId));
      if (exportDate) params.set("date", exportDate);
      const res = await fetch(`/api/backend/examinateurs/${ex.id}/planning-export?${params}`);
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.detail ?? "Erreur lors de l'export");
      }
      const blob = await res.blob();
      const cd = res.headers.get("content-disposition") ?? "";
      const nom = cd.match(/filename="([^"]+)"/)?.[1] ?? `planning_${ex.nom}.${format}`;
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = nom;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    } catch (e) { toast.error(e instanceof Error ? e.message : String(e)); }
    finally { setExportEnCours(null); }
  };
  const [generationMdp, setGenerationMdp] = useState(false);
  const genererMotDePasse = async () => {
    if (!await confirm(
      `Générer un nouveau mot de passe provisoire pour ${ex.prenom} ${ex.nom} ? Son mot de passe actuel ne fonctionnera plus.`,
      { confirmLabel: "Générer", danger: true }
    )) return;
    setGenerationMdp(true);
    try {
      const r = await post<{ login: string; new_password: string }>(`parametrages/examinateurs/${ex.id}/reset-password`, {});
      setMdpProvisoire(r.new_password);
    } catch (e) { toast.error(e instanceof Error ? e.message : String(e)); }
    finally { setGenerationMdp(false); }
  };
  const [indisponibilites, setIndisponibilites] = useState<Indisponibilite[]>([]);
  const [etablissements, setEtablissements] = useState<EtablissementItem[]>([]);
  const [searchEtab, setSearchEtab] = useState(ex.etablissement ? `${ex.etablissement}${ex.code_uai ? ` (${ex.code_uai})` : ""}` : "");
  const [showEtabList, setShowEtabList] = useState(false);

  useEffect(() => {
    get<EtablissementItem[]>("parametrages/etablissements/").then(setEtablissements).catch(() => {});
  }, []);

  useEffect(() => {
    setNom(ex.nom); setPrenom(ex.prenom); setEmail(ex.email);
    setTelephone(ex.telephone ?? ""); setEtablissement(ex.etablissement ?? "");
    setCodeUai(ex.code_uai ?? ""); setCommentaire(ex.commentaire ?? "");
    setSelectedMatieres(ex.matieres); setErr("");
    setSearchEtab(ex.etablissement ? `${ex.etablissement}${ex.code_uai ? ` (${ex.code_uai})` : ""}` : "");
  }, [ex.id]);

  async function save() {
    setSaving(true); setErr("");
    try {
      const updated = await put<Examinateur>(`examinateurs/${ex.id}`, {
        nom: nom.trim().toUpperCase(), prenom: prenom.trim(), email: email.trim(),
        matieres: selectedMatieres,
        code_uai: codeUai.trim() || null,
        etablissement: etablissement.trim() || null,
        telephone: telephone.trim() || null,
        commentaire: commentaire.trim() || null,
      });
      toast.success("Examinateur modifié");
      onUpdated(updated);
    } catch (e: unknown) { setErr(e instanceof Error ? e.message : "Erreur"); }
    finally { setSaving(false); }
  }

  async function toggleActif() {
    try {
      const newActif = ex.actif_planning !== true;
      const updated = await patch<Examinateur>(
        `examinateurs/${ex.id}/plannings/${planningId}`,
        { actif: newActif }
      );
      toast.success(newActif ? "Actif pour ce planning" : "Inactif pour ce planning");
      onUpdated(updated);
    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : "Erreur"); }
  }

  async function deleteEx() {
    if (!await confirm(`Supprimer ${ex.prenom} ${ex.nom} ?`, { confirmLabel: "Supprimer", danger: true })) return;
    try { await del(`examinateurs/${ex.id}`); toast.success("Examinateur supprimé"); onDeleted(); }
    catch (e: unknown) { toast.error(e instanceof Error ? e.message : "Erreur"); }
  }

  return (
    <div className="overflow-y-auto h-full">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 px-6 pt-5 pb-4 border-b sticky top-0 bg-white z-10">
        <div>
          <p className="text-xs text-gray-700 uppercase tracking-wide mb-0.5">Examinateur</p>
          <h3 className="text-lg font-semibold">{ex.prenom} {ex.nom}</h3>
          <div className="flex flex-wrap gap-1 mt-1">
            {ex.matieres.map((m) => (
              <span key={m} className="text-[11px] bg-blue-50 text-blue-700 rounded px-1.5 py-0.5 font-medium">{m}</span>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0 mt-1">
          <button
            onClick={toggleActif}
            className={`flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border font-medium transition ${
              ex.actif_planning === true
                ? "bg-green-50 text-green-700 border-green-200 hover:bg-green-100"
                : ex.actif_planning === false
                  ? "bg-orange-50 text-orange-700 border-orange-200 hover:bg-orange-100"
                  : "bg-black/5 text-gray-700 border-black/10 hover:bg-black/10"
            }`}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${ex.actif_planning === true ? "bg-green-500" : ex.actif_planning === false ? "bg-orange-400" : "bg-black/30"}`} />
            {ex.actif_planning === true ? "Actif ce planning" : ex.actif_planning === false ? "Inactif ce planning" : "Non associé"}
          </button>
          <button
            onClick={() => setShowIdentifiants(true)}
            className="text-xs px-2.5 py-1.5 rounded-lg border border-blue-200 text-blue-600 hover:bg-blue-50 transition font-medium flex items-center gap-1"
          >
            <Send className="h-3 w-3" /> Identifiants
          </button>
          <button
            onClick={() => setShowExport(true)}
            className="text-xs px-2.5 py-1.5 rounded-lg border border-red-200 text-[#C62828] hover:bg-red-50 transition font-medium flex items-center gap-1"
          >
            <Download className="h-3 w-3" /> Exporter le planning
          </button>
          <button onClick={deleteEx} className="p-1.5 text-red-400 hover:text-red-600 transition" title="Supprimer">
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="px-6 py-5 space-y-5">
        {/* Infos */}
        <div className="grid grid-cols-2 gap-3">
          <Field label="Nom"><Input value={nom} onChange={(e) => setNom(e.target.value)} /></Field>
          <Field label="Prénom"><Input value={prenom} onChange={(e) => setPrenom(e.target.value)} /></Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Email"><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
          <Field label="Téléphone"><Input value={telephone} onChange={(e) => setTelephone(e.target.value)} placeholder="06 12 34 56 78" /></Field>
        </div>
        <Field label="Établissement">
          <div className="relative">
            <Input
              value={searchEtab}
              onChange={(e) => {
                setSearchEtab(e.target.value);
                setShowEtabList(true);
                if (!e.target.value) { setEtablissement(""); setCodeUai(""); }
              }}
              onFocus={() => setShowEtabList(true)}
              onBlur={() => setTimeout(() => setShowEtabList(false), 150)}
              placeholder={etablissements.length === 0 ? "Saisir manuellement…" : "Rechercher un établissement…"}
            />
            {showEtabList && etablissements.filter((e) => {
              const q = searchEtab.toLowerCase();
              return e.nom.toLowerCase().includes(q) || e.code_uai.toLowerCase().includes(q) || (e.ville ?? "").toLowerCase().includes(q);
            }).slice(0, 50).length > 0 && (
              <div className="absolute z-50 mt-1 w-full bg-white border rounded-lg shadow-lg max-h-48 overflow-y-auto">
                {etablissements.filter((e) => {
                  const q = searchEtab.toLowerCase();
                  return e.nom.toLowerCase().includes(q) || e.code_uai.toLowerCase().includes(q) || (e.ville ?? "").toLowerCase().includes(q);
                }).slice(0, 50).map((e) => (
                  <button
                    key={e.id}
                    type="button"
                    onMouseDown={() => {
                      setEtablissement(e.nom);
                      setCodeUai(e.code_uai);
                      setSearchEtab(`${e.nom} (${e.code_uai})${e.ville ? ` — ${e.ville}` : ""}`);
                      setShowEtabList(false);
                    }}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-blue-50 border-b last:border-0"
                  >
                    <span className="font-medium">{e.nom}</span>
                    <span className="text-gray-800 ml-2 text-xs">{e.code_uai}{e.ville ? ` — ${e.ville}` : ""}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </Field>
        <Field label="Code UAI"><Input value={codeUai} onChange={(e) => setCodeUai(e.target.value)} placeholder="0750001A" /></Field>
        <Field label="Matière(s)">
          <MatieresCheckboxes selected={selectedMatieres} onChange={setSelectedMatieres} matieres={matieres} />
        </Field>
        <Field label="Commentaire">
          <textarea
            value={commentaire}
            onChange={(e) => setCommentaire(e.target.value)}
            rows={2}
            placeholder="Remarques sur cet examinateur…"
            className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black/10 resize-none"
          />
        </Field>
        <ErrorMsg msg={err} />
        <Btn label={saving ? "Enregistrement…" : "Enregistrer"} onClick={save} disabled={saving} />

        {/* Indisponibilités */}
        <IndisponibilitesSection examinateurId={ex.id} onLoad={setIndisponibilites} />

        {/* Créneaux */}
        <div>
          <p className="text-xs font-semibold text-gray-700 uppercase tracking-widest mb-3">Créneaux</p>
          <CreneauxExaminateur planningId={planningId} examinateur={ex} indisponibilites={indisponibilites} />
        </div>
      </div>

      {/* Modal identifiants */}
      <Modal open={showExport} onClose={() => setShowExport(false)} title={`Planning de ${ex.prenom} ${ex.nom}`}>
        <div className="space-y-4">
          <p className="text-sm text-gray-900">
            Mêmes documents que ceux que l&apos;examinateur télécharge depuis son espace : PDF prêt à imprimer,
            ou Excel (avec les notes).
          </p>
          <Field label="Périmètre">
            <Select value={exportPerimetre} onChange={(e) => setExportPerimetre(e.target.value as "planning" | "tous")}>
              <option value="planning">Ce planning uniquement</option>
              <option value="tous">Tous les plannings</option>
            </Select>
          </Field>
          <Field label="Journée (facultatif)">
            <Input type="date" value={exportDate} onChange={(e) => setExportDate(e.target.value)} />
          </Field>
          <label className="flex items-center gap-2 text-sm text-gray-900 cursor-pointer">
            <input type="checkbox" checked={exportVides} onChange={(e) => setExportVides(e.target.checked)} />
            Inclure les créneaux sans candidat
          </label>
          <p className="text-xs text-gray-700">
            L&apos;espace examinateur, lui, n&apos;affiche que les épreuves qui ont un candidat.
          </p>
          <div className="flex gap-2 justify-end">
            {(["pdf", "xlsx"] as const).map((f) => (
              <Btn
                key={f}
                label={exportEnCours === f ? "Génération…" : f === "pdf" ? "Télécharger le PDF" : "Télécharger l'Excel"}
                icon={exportEnCours === f ? Loader2 : Download}
                small
                variant={f === "pdf" ? "primary" : "ghost"}
                disabled={exportEnCours !== null}
                onClick={() => exporterPlanning(f)}
              />
            ))}
          </div>
        </div>
      </Modal>

      <Modal open={showIdentifiants} onClose={() => { setShowIdentifiants(false); setMdpProvisoire(null); }} title="Identifiants examinateur">
        <div className="space-y-4">
          <p className="text-sm text-gray-900">
            <strong>{ex.prenom} {ex.nom}</strong> se connecte à l&apos;espace examinateur avec son adresse email
            et son mot de passe.
          </p>
          <div className="rounded-lg bg-black/[0.03] p-4 space-y-2.5 font-mono text-sm border">
            <div className="flex justify-between gap-4 items-center">
              <span className="text-gray-900 text-xs uppercase tracking-wide">Login</span>
              <span className="font-semibold select-all">{ex.email}</span>
            </div>
            {mdpProvisoire && (
              <>
                <div className="h-px bg-black/5" />
                <div className="flex justify-between gap-4 items-center">
                  <span className="text-gray-900 text-xs uppercase tracking-wide">Mot de passe provisoire</span>
                  <span className="font-semibold select-all text-lg">{mdpProvisoire}</span>
                </div>
              </>
            )}
          </div>
          {mdpProvisoire ? (
            <p className="text-xs text-gray-900">
              Communiquez ce mot de passe à l&apos;examinateur : il ne sera plus affiché après fermeture de cette fenêtre.
              Il pourra le modifier depuis « Changer mon mot de passe ».
            </p>
          ) : (
            <div className="space-y-2">
              <p className="text-xs text-gray-900">
                Première connexion ou mot de passe oublié : l&apos;examinateur clique sur « Mot de passe oublié ? »
                sur la page de connexion et reçoit un lien par email. Vous pouvez aussi lui générer un mot de passe provisoire.
              </p>
              <Btn
                label={generationMdp ? "Génération…" : "Générer un mot de passe provisoire"}
                icon={generationMdp ? Loader2 : KeyRound}
                small
                variant="ghost"
                disabled={generationMdp}
                onClick={genererMotDePasse}
              />
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}

// ── Formulaire création ───────────────────────────────────────────────────────

function CreateExaminateurForm({
  planningId,
  onCreated,
  onCancel,
}: {
  planningId: number;
  onCreated: () => void;
  onCancel: () => void;
}) {
  const matieres = useMatieres();
  const [nom, setNom] = useState("");
  const [prenom, setPrenom] = useState("");
  const [email, setEmail] = useState("");
  const [telephone, setTelephone] = useState("");
  const [selectedMatieres, setSelectedMatieres] = useState<string[]>([]);
  const [codeUai, setCodeUai] = useState("");
  const [etablissement, setEtablissement] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [etablissements, setEtablissements] = useState<EtablissementItem[]>([]);
  const [searchEtab, setSearchEtab] = useState("");
  const [showEtabList, setShowEtabList] = useState(false);

  useEffect(() => {
    get<EtablissementItem[]>("parametrages/etablissements/").then(setEtablissements).catch(() => {});
  }, []);

  const filteredEtabs = etablissements.filter((e) => {
    const q = searchEtab.toLowerCase();
    return e.nom.toLowerCase().includes(q) || e.code_uai.toLowerCase().includes(q) || (e.ville ?? "").toLowerCase().includes(q);
  });

  function selectEtab(e: EtablissementItem) {
    setEtablissement(e.nom);
    setCodeUai(e.code_uai);
    setSearchEtab(`${e.nom} (${e.code_uai})${e.ville ? ` — ${e.ville}` : ""}`);
    setShowEtabList(false);
  }

  async function submit() {
    setLoading(true); setError("");
    try {
      const created = await post<Examinateur>("examinateurs/", {
        nom: nom.trim().toUpperCase(), prenom: prenom.trim(), email: email.trim(),
        telephone: telephone.trim() || null,
        matieres: selectedMatieres,
        code_uai: codeUai.trim() || null,
        etablissement: etablissement.trim() || null,
      });
      await patch(`examinateurs/${created.id}/plannings/${planningId}`, { actif: true });
      onCreated();
    } catch (e: unknown) { setError(e instanceof Error ? e.message : "Erreur"); }
    finally { setLoading(false); }
  }

  return (
    <div className="overflow-y-auto h-full">
      <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b sticky top-0 bg-white z-10">
        <h3 className="text-lg font-semibold">Nouvel examinateur</h3>
        <button onClick={onCancel} className="p-1 text-gray-700 hover:text-black transition"><X className="h-4 w-4" /></button>
      </div>
      <div className="px-6 py-5 space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Nom *"><Input value={nom} onChange={(e) => setNom(e.target.value)} placeholder="MARTIN" /></Field>
          <Field label="Prénom *"><Input value={prenom} onChange={(e) => setPrenom(e.target.value)} placeholder="Sophie" /></Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Email *"><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="s.martin@…" /></Field>
          <Field label="Téléphone"><Input value={telephone} onChange={(e) => setTelephone(e.target.value)} placeholder="06 12 34 56 78" /></Field>
        </div>
        <Field label="Établissement">
          <div className="relative">
            <Input
              value={searchEtab}
              onChange={(e) => { setSearchEtab(e.target.value); setShowEtabList(true); if (!e.target.value) { setEtablissement(""); setCodeUai(""); } }}
              onFocus={() => setShowEtabList(true)}
              onBlur={() => setTimeout(() => setShowEtabList(false), 150)}
              placeholder={etablissements.length === 0 ? "Aucun établissement — saisir manuellement" : "Rechercher un établissement…"}
            />
            {showEtabList && filteredEtabs.length > 0 && (
              <div className="absolute z-50 mt-1 w-full bg-white border rounded-lg shadow-lg max-h-48 overflow-y-auto">
                {filteredEtabs.slice(0, 50).map((e) => (
                  <button
                    key={e.id}
                    type="button"
                    onMouseDown={() => selectEtab(e)}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-blue-50 border-b last:border-0"
                  >
                    <span className="font-medium">{e.nom}</span>
                    <span className="text-gray-800 ml-2 text-xs">{e.code_uai}{e.ville ? ` — ${e.ville}` : ""}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
          {etablissements.length === 0 && (
            <p className="text-xs text-amber-600 mt-1">Aucun établissement enregistré. Importez une liste UAI dans Paramétrages.</p>
          )}
        </Field>
        <Field label="Code UAI"><Input value={codeUai} onChange={(e) => setCodeUai(e.target.value)} placeholder="0750001A" /></Field>
        <Field label="Matière(s) *">
          <MatieresCheckboxes selected={selectedMatieres} onChange={setSelectedMatieres} matieres={matieres} />
        </Field>
        <ErrorMsg msg={error} />
        <div className="flex gap-2">
          <Btn label={loading ? "Création…" : "Créer l'examinateur"} icon={Plus} onClick={submit}
            disabled={loading || !nom || !prenom || !email} />
          <Btn label="Annuler" onClick={onCancel} variant="ghost" />
        </div>
      </div>
    </div>
  );
}

// ── Section principale Examinateurs ──────────────────────────────────────────

export function ExaminateursSection() {
  const toast = useToast();
  const intention = useIntentionAffectation("examinateur");
  const [plannings, setPlannings] = useState<Planning[]>([]);
  const [selectedPlanningId, setSelectedPlanningId] = useState<number | null>(intention?.planningId ?? null);
  const [examinateurs, setExaminateurs] = useState<Examinateur[]>([]);
  const [selectedEx, setSelectedEx] = useState<Examinateur | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [showImportEx, setShowImportEx] = useState(false);
  const [loading, setLoading] = useState(false);
  const [filterActif, setFilterActif] = useFiltre<"tous" | "actif" | "inactif">("examinateurs:actif", "tous");
  // Recherche globale : fiche de l'examinateur à ouvrir dès le chargement de la liste
  const [exRecherche] = useState(() => intentions.examinateur);
  useEffect(() => { if (exRecherche) intentions.examinateur = null; }, [exRecherche]);
  const exAOuvrir = useRef<number | null>(exRecherche?.id ?? null);
  const [searchEx, setSearchEx] = useFiltre("examinateurs:recherche", exRecherche?.nom ?? "", undefined, !!exRecherche);
  const [filterMatiereEx, setFilterMatiereEx] = useFiltre("examinateurs:matiere", "");
  const [filterEtabEx, setFilterEtabEx] = useFiltre("examinateurs:etab", "");
  const [tab, setTab] = useFiltre<"fiche" | "affectation">("examinateurs:onglet", intention ? "affectation" : "fiche", undefined, !!intention);

  useEffect(() => {
    get<Planning[]>("plannings/").then((ps) => {
      setPlannings(ps);
      if (ps.length > 0) setSelectedPlanningId((cur) => cur ?? planningMemorise(ps) ?? ps[0].id);
    }).catch(() => {});
  }, []);
  useEffect(() => memoriserPlanning(selectedPlanningId), [selectedPlanningId]);

  const loadExaminateurs = useCallback(async () => {
    if (!selectedPlanningId) return;
    setLoading(true);
    try {
      const data = await get<Examinateur[]>(`examinateurs/?planning_id=${selectedPlanningId}`);
      setExaminateurs(data);
      const id = exAOuvrir.current;
      exAOuvrir.current = null;
      setSelectedEx((prev) => {
        const cible = prev?.id ?? id;
        return cible != null ? (data.find((e) => e.id === cible) ?? null) : null;
      });
    } finally { setLoading(false); }
  }, [selectedPlanningId]);

  useEffect(() => { loadExaminateurs(); }, [loadExaminateurs]);

  const matieresEx = [...new Set(examinateurs.flatMap((ex) => ex.matieres))].sort((a, b) => a.localeCompare(b, "fr"));
  const etabsEx = [...new Set(examinateurs.map((ex) => ex.etablissement).filter((e): e is string => !!e))]
    .sort((a, b) => a.localeCompare(b, "fr"));
  const filtresExActifs = filterActif !== "tous" || !!searchEx.trim() || !!filterMatiereEx || !!filterEtabEx;

  const filtered = examinateurs.filter((ex) => {
    const actifOk = filterActif === "tous" ? true
      : filterActif === "actif" ? ex.actif_planning === true
      : ex.actif_planning !== true;
    if (!actifOk) return false;
    if (filterMatiereEx === "__aucune") { if (ex.matieres.length > 0) return false; }
    else if (filterMatiereEx && !ex.matieres.includes(filterMatiereEx)) return false;
    if (filterEtabEx === "__aucun") { if (ex.etablissement) return false; }
    else if (filterEtabEx && ex.etablissement !== filterEtabEx) return false;
    if (!searchEx.trim()) return true;
    const q = searchEx.trim().toLowerCase();
    return `${ex.nom} ${ex.prenom} ${ex.email} ${ex.etablissement ?? ""}`.toLowerCase().includes(q);
  });

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <GraduationCap className="h-5 w-5 text-[#C62828]" />
          <h2 className="text-lg font-semibold">Examinateurs</h2>
        </div>
        <div className="flex items-center gap-2">
          <select
            className="border rounded-lg px-3 py-2 text-sm"
            value={selectedPlanningId ?? ""}
            onChange={(e) => {
              setSelectedPlanningId(e.target.value ? Number(e.target.value) : null);
              setSelectedEx(null); setShowCreate(false);
            }}
          >
            <option value="">— Sélectionner un planning —</option>
            {plannings.map((p) => <option key={p.id} value={p.id}>{p.nom}</option>)}
          </select>
          {selectedPlanningId && (
            <Btn label="Importer" icon={Upload} small variant="ghost" onClick={() => setShowImportEx(true)} />
          )}
        </div>
      </div>

      {/* Onglets */}
      {selectedPlanningId && (
        <div className="flex gap-1 border-b border-black/10">
          {(["fiche", "affectation"] as const).map((t) => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-4 py-2 text-sm font-medium rounded-t-lg transition -mb-px border border-b-0 ${
                tab === t ? "bg-white border-black/10 text-black" : "border-transparent text-gray-700 hover:text-black"
              }`}
            >
              {t === "fiche" ? "Fiches" : "Affectation aux épreuves"}
            </button>
          ))}
        </div>
      )}

      {selectedPlanningId && tab === "affectation" && (
        <AffectationTab planningId={selectedPlanningId} examinateurs={examinateurs} filtresInitiaux={intention} />
      )}

      {selectedPlanningId && tab === "fiche" && (
        <div className="flex bg-white rounded-xl shadow-sm overflow-hidden border" style={{ minHeight: 560 }}>
          {/* Colonne gauche : liste */}
          <div className="w-56 shrink-0 border-r flex flex-col">
            <div className="p-3 border-b space-y-2">
              <div className="flex rounded-lg border overflow-hidden text-xs w-full">
                {(["tous", "actif", "inactif"] as const).map((f) => (
                  <button key={f} onClick={() => setFilterActif(f)}
                    className={`flex-1 py-1.5 transition ${filterActif === f ? "bg-black text-white" : "bg-white text-gray-800 hover:bg-black/5"}`}
                  >
                    {f === "tous" ? "Tous" : f === "actif" ? "Actifs" : "Inact."}
                  </button>
                ))}
              </div>
              <input
                type="text"
                placeholder="Nom, e-mail, établissement…"
                value={searchEx}
                onChange={(e) => setSearchEx(e.target.value)}
                className="w-full border border-black/15 rounded-lg px-2.5 py-1.5 text-xs text-gray-900 focus:outline-none focus:ring-2 focus:ring-red-300"
              />
              <select
                value={filterMatiereEx}
                onChange={(e) => setFilterMatiereEx(e.target.value)}
                className="w-full border border-black/15 rounded-lg px-2 py-1.5 text-xs text-gray-900 bg-white"
                title="Matière"
              >
                <option value="">Toutes les matières</option>
                {matieresEx.map((m) => <option key={m} value={m}>{m}</option>)}
                <option value="__aucune">— Sans matière —</option>
              </select>
              <select
                value={filterEtabEx}
                onChange={(e) => setFilterEtabEx(e.target.value)}
                className="w-full border border-black/15 rounded-lg px-2 py-1.5 text-xs text-gray-900 bg-white"
                title="Établissement"
              >
                <option value="">Tous les établissements</option>
                {etabsEx.map((et) => <option key={et} value={et}>{et}</option>)}
                <option value="__aucun">— Sans établissement —</option>
              </select>
              <div className="flex items-center justify-between text-[11px] text-gray-800">
                <span>{filtered.length} / {examinateurs.length} examinateur{examinateurs.length > 1 ? "s" : ""}</span>
                {filtresExActifs && (
                  <button
                    onClick={() => { setFilterActif("tous"); setSearchEx(""); setFilterMatiereEx(""); setFilterEtabEx(""); }}
                    className="text-[#C62828] hover:underline"
                  >
                    Réinitialiser
                  </button>
                )}
              </div>
            </div>
            <div className="flex-1 overflow-y-auto divide-y">
              {loading ? <div className="p-4 text-center"><Spinner /></div> :
               filtered.length === 0 ? <p className="text-xs text-gray-700 text-center p-4">Aucun examinateur</p> :
               filtered.map((ex) => (
                <button
                  key={ex.id}
                  onClick={() => { setSelectedEx(ex); setShowCreate(false); }}
                  className={`w-full text-left px-3 py-2.5 transition text-sm flex items-center gap-2 ${
                    selectedEx?.id === ex.id
                      ? "bg-[#C62828]/8 text-[#C62828] border-l-2 border-[#C62828]"
                      : "hover:bg-black/[0.02] text-black border-l-2 border-transparent"
                  }`}
                >
                  <span className={`h-2 w-2 rounded-full shrink-0 ${ex.actif_planning === true ? "bg-green-500" : ex.actif_planning === false ? "bg-orange-400" : "bg-black/15"}`} />
                  <div className="min-w-0">
                    <p className="truncate font-medium text-sm">{ex.prenom} {ex.nom}</p>
                    <p className="truncate text-xs text-gray-700">{ex.matieres.join(", ") || "—"}</p>
                  </div>
                </button>
              ))}
            </div>
            <div className="p-3 border-t">
              <button
                onClick={() => { setShowCreate(true); setSelectedEx(null); }}
                className="w-full flex items-center justify-center gap-1.5 text-sm text-[#C62828] border border-[#C62828]/30 rounded-lg py-2 hover:bg-[#C62828]/5 transition font-medium"
              >
                <Plus className="h-3.5 w-3.5" /> Nouvel examinateur
              </button>
            </div>
          </div>

          {/* Panneau droit : fiche ou création */}
          <div className="flex-1 min-w-0">
            {showCreate ? (
              <CreateExaminateurForm
                planningId={selectedPlanningId}
                onCreated={() => { setShowCreate(false); toast.success("Examinateur créé"); loadExaminateurs(); }}
                onCancel={() => setShowCreate(false)}
              />
            ) : selectedEx ? (
              <ExaminateurFiche
                key={selectedEx.id}
                ex={selectedEx}
                planningId={selectedPlanningId}
                onUpdated={(updated) => {
                  setExaminateurs((prev) => prev.map((e) => e.id === updated.id ? updated : e));
                  setSelectedEx(updated);
                }}
                onDeleted={() => { setSelectedEx(null); loadExaminateurs(); }}
              />
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-gray-700 gap-3 py-16">
                <GraduationCap className="h-12 w-12" />
                <p className="text-sm text-gray-700">Sélectionnez un examinateur ou créez-en un nouveau</p>
              </div>
            )}
          </div>
        </div>
      )}

      <ImportExcelModal
        open={showImportEx}
        onClose={() => setShowImportEx(false)}
        title="Importer des examinateurs"
        templateUrl={`/api/backend/excel/examinateurs/template`}
        uploadUrl={`/api/backend/excel/plannings/${selectedPlanningId}/examinateurs/import`}
        onSuccess={loadExaminateurs}
        resultRenderer={(r) => r.examinateurs?.length > 0 && (
          <div className="mt-3 max-h-40 overflow-y-auto">
            <p className="text-xs font-medium text-green-700 mb-1">Examinateurs importés :</p>
            <table className="w-full text-xs">
              <thead><tr>
                <th className="text-left text-green-700">Nom</th>
                <th className="text-left text-green-700">Matières</th>
              </tr></thead>
              <tbody>
                {r.examinateurs.map((e: {id: number; prenom: string; nom: string; matieres: string[]}) => (
                  <tr key={e.id}>
                    <td>{e.prenom} {e.nom}</td>
                    <td>{e.matieres.join(", ")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="text-xs text-gray-900 mt-2">
              Pour leur première connexion, les examinateurs cliquent sur « Mot de passe oublié ? » dans
              l&apos;espace examinateur (lien envoyé par email), ou utilisent un mot de passe provisoire généré
              depuis leur fiche (bouton « Identifiants »).
            </p>
          </div>
        )}
      />
    </div>
  );
}
