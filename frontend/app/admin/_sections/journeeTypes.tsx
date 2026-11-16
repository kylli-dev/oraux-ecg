"use client";

import React, { useState, useEffect, useCallback } from "react";
import { AnimatePresence, motion } from "framer-motion";
import InterfaceAdminENSAEPlanning from "../../InterfaceAdminENSAEPlanning";
import { useToast, useConfirm } from "../Toast";
import { type CaseTriplet, MARGE_ENTRE_EPREUVES, exceptionsMatrice, minutes } from "../echangeTriplets";
import { corpsBlocModifie } from "../blocsGabarit";
import {
  Settings2,
  Plus,
  Trash2,
  X,
  Wand2,
  LayoutGrid,
  AlertTriangle,
  Pencil,
} from "lucide-react";
import {
  ApplyForm,
  Btn,
  Empty,
  ErrorMsg,
  Field,
  Input,
  JourneeType,
  Modal,
  Planning,
  Select,
  Spinner,
  StatutBadge,
  del,
  formatDateCourte,
  get,
  hm,
  memoriserPlanning,
  planningMemorise,
  post,
  put,
  useFiltre,
  useMatieres,
} from "./commun";

type Bloc = {
  id: number;
  journee_type_id: number;
  ordre: number;
  type_bloc: "GENERATION" | "PAUSE";
  heure_debut: string;
  heure_fin: string;
  matieres: string[];
  matieres_config: MatiereConfig[] | null;
  duree_minutes: number | null;
  pause_minutes: number | null;
  preparation_minutes: number | null;
  salles_par_matiere: number;
  nb_slots: number | null;
  bonus_slots: number;
  type_demi_journee: "MATIN" | "APRES_MIDI" | null;
  custom_matrix?: number[][] | null;
};

// ── Helpers éditeur ───────────────────────────────────────────────────────────
function minutesFromTime(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + (m || 0);
}

const TL_START = 8 * 60;
const TL_END   = 19 * 60;
const TL_TOTAL = TL_END - TL_START;
const TL_HOURS = [8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18];

// ── BlocTimeline ──────────────────────────────────────────────────────────────
function BlocTimeline({
  blocs,
  selectedBlocId,
  onSelect,
}: {
  blocs: Bloc[];
  selectedBlocId: number | null;
  onSelect: (id: number | null) => void;
}) {
  return (
    <div className="flex gap-3 select-none">
      {/* Heure labels */}
      <div className="relative shrink-0 w-10" style={{ height: 440 }}>
        {TL_HOURS.map((h) => (
          <div
            key={h}
            className="absolute right-1 text-[10px] font-mono text-gray-700 -translate-y-1/2"
            style={{ top: `${((h * 60 - TL_START) / TL_TOTAL) * 100}%` }}
          >
            {h}h
          </div>
        ))}
      </div>

      {/* Zone timeline */}
      <div
        className="relative flex-1 rounded-xl border border-black/8 bg-gray-50 overflow-hidden cursor-default"
        style={{ height: 440 }}
        onClick={(e) => { if (e.target === e.currentTarget) onSelect(null); }}
      >
        {/* Lignes horaires */}
        {TL_HOURS.map((h) => (
          <div
            key={h}
            className={`absolute left-0 right-0 border-t ${h === 12 ? "border-black/15 border-dashed" : "border-black/5"}`}
            style={{ top: `${((h * 60 - TL_START) / TL_TOTAL) * 100}%` }}
          />
        ))}
        <div
          className="absolute left-1.5 text-[9px] font-medium text-gray-700 -translate-y-1/2"
          style={{ top: `${((12 * 60 - TL_START) / TL_TOTAL) * 100}%` }}
        >
          midi
        </div>

        {/* Blocs */}
        {blocs.map((bloc) => {
          const startMin  = minutesFromTime(bloc.heure_debut);
          const endMin    = minutesFromTime(bloc.heure_fin);
          const topPct    = ((startMin - TL_START) / TL_TOTAL) * 100;
          const heightPct = Math.max(((endMin - startMin) / TL_TOTAL) * 100, 1.5);
          const isGen     = bloc.type_bloc === "GENERATION";
          const selected  = bloc.id === selectedBlocId;

          return (
            <div
              key={bloc.id}
              onClick={(e) => { e.stopPropagation(); onSelect(selected ? null : bloc.id); }}
              className={`absolute left-2 right-2 rounded-lg cursor-pointer transition-all overflow-hidden ${
                isGen
                  ? selected
                    ? "bg-blue-500 ring-2 ring-blue-300 shadow-lg"
                    : "bg-blue-400/85 hover:bg-blue-500"
                  : selected
                    ? "bg-orange-400 ring-2 ring-orange-200 shadow-lg"
                    : "bg-orange-300/80 hover:bg-orange-400"
              }`}
              style={{ top: `${topPct}%`, height: `${heightPct}%` }}
            >
              <div className="px-2 py-1 text-white">
                <div className="text-xs font-semibold truncate">
                  {isGen
                    ? bloc.matieres.length ? bloc.matieres.join(" · ") : "GENERATION"
                    : "PAUSE"}
                </div>
                <div className="text-[10px] text-white/70">
                  {hm(bloc.heure_debut)} – {hm(bloc.heure_fin)}
                  {isGen && ` · ${bloc.nb_slots ?? bloc.matieres.length ** 2} créneaux`}
                </div>
              </div>
            </div>
          );
        })}

        {blocs.length === 0 && (
          <div className="flex items-center justify-center h-full text-xs text-gray-700">
            Aucun bloc — créez-les avec l'assistant (bouton Modifier)
          </div>
        )}
      </div>
    </div>
  );
}

// ── JourneeTypeEditor ─────────────────────────────────────────────────────────
function JourneeTypeEditor({ jt, onRename }: { jt: JourneeType; onRename?: (newNom: string) => void }) {
  const toast = useToast();
  const confirm = useConfirm();
  const [blocs, setBlocs] = useState<Bloc[]>([]);
  const [selectedBlocId, setSelectedBlocId] = useState<number | null>(null);

  // Renommage
  const [editingNom, setEditingNom] = useState(false);
  const [nomValue, setNomValue] = useState(jt.nom);
  const [savingNom, setSavingNom] = useState(false);
  const saveNom = async () => {
    if (!nomValue.trim() || nomValue === jt.nom) { setEditingNom(false); setNomValue(jt.nom); return; }
    setSavingNom(true);
    try {
      await put(`journee-types/${jt.id}`, { nom: nomValue.trim() });
      onRename?.(nomValue.trim());
      toast.success("Nom mis à jour");
      setEditingNom(false);
    } catch { toast.error("Erreur lors de la sauvegarde"); }
    finally { setSavingNom(false); }
  };

  // Planning application
  const [plannings, setPlannings] = useState<Planning[]>([]);
  const [selPlanning, setSelPlanning] = useState<Planning | null>(null);
  const [applyDate, setApplyDate] = useState("");
  const [applying, setApplying] = useState(false);
  const [applyResult, setApplyResult] = useState<{ epreuves_created: number; demi_journees_created: number } | null>(null);
  const [applyError, setApplyError] = useState("");

  const load = useCallback(async () => {
    try { setBlocs(await get<Bloc[]>(`journee-types/${jt.id}/blocs`)); } catch {}
  }, [jt.id]);

  useEffect(() => {
    load();
    get<Planning[]>("plannings/").then(setPlannings).catch(() => {});
  }, [load]);

  const selectedBloc = blocs.find((b) => b.id === selectedBlocId) ?? null;

  const handleDelete = async (blocId: number) => {
    if (!await confirm("Supprimer ce bloc ?", { confirmLabel: "Supprimer", danger: true })) return;
    await del(`journee-types/blocs/${blocId}`);
    toast.success("Bloc supprimé");
    setSelectedBlocId(null);
    load();
  };

  const handleApply = async () => {
    if (!selPlanning || !applyDate) return;
    setApplying(true);
    setApplyError("");
    setApplyResult(null);
    try {
      const res = await post<{ epreuves_created: number; demi_journees_created: number }>(
        `plannings/${selPlanning.id}/apply-journee-type`,
        { journee_type_id: jt.id, date: applyDate }
      );
      setApplyResult(res);
    } catch (e: any) {
      setApplyError(e.message);
    } finally {
      setApplying(false);
    }
  };

  return (
    <div className="flex divide-x border-t">
      {/* ── Panneau gauche : Timeline + édition ── */}
      <div className="flex-1 p-5 min-w-0">
        {/* Nom de la journée type */}
        <div className="flex items-center gap-2 mb-4">
          {editingNom ? (
            <>
              <input
                autoFocus
                className="flex-1 text-sm font-medium border border-black/20 rounded-lg px-2.5 py-1 focus:outline-none focus:ring-1 focus:ring-black/30"
                value={nomValue}
                onChange={(e) => setNomValue(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") saveNom(); if (e.key === "Escape") { setEditingNom(false); setNomValue(jt.nom); } }}
              />
              <button onClick={saveNom} disabled={savingNom} className="text-xs px-3 py-1 bg-black text-white rounded-lg font-medium disabled:opacity-40">
                {savingNom ? "…" : "OK"}
              </button>
              <button onClick={() => { setEditingNom(false); setNomValue(jt.nom); }} className="text-xs text-gray-700 hover:text-black px-2 py-1">
                Annuler
              </button>
            </>
          ) : (
            <button
              onClick={() => setEditingNom(true)}
              className="text-sm font-medium text-gray-900 hover:text-black flex items-center gap-1.5 group"
              title="Modifier le nom"
            >
              {nomValue}
              <Pencil className="h-3 w-3 text-gray-700 group-hover:text-black transition" />
            </button>
          )}
        </div>

        <div className="flex items-center justify-between mb-4">
          <span className="text-xs font-semibold text-gray-700 uppercase tracking-wide">
            Blocs ({blocs.length})
          </span>
        </div>

        <BlocTimeline
          blocs={blocs}
          selectedBlocId={selectedBlocId}
          onSelect={(id) => setSelectedBlocId(id)}
        />

        <AnimatePresence>
          {selectedBloc && (
            <motion.div
              key={`edit-${selectedBloc.id}`}
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="mt-4 rounded-xl border border-blue-200 bg-blue-50/40 p-4"
            >
              <EditBlocForm
                bloc={selectedBloc}
                dureeDefaut={jt.duree_defaut_minutes}
                pauseDefaut={jt.pause_defaut_minutes}
                preparationDefaut={jt.preparation_defaut_minutes}
                onSuccess={(updated) => {
                  setBlocs((prev) => prev.map((b) => b.id === updated.id ? updated : b));
                  setSelectedBlocId(null);
                }}
                onCancel={() => setSelectedBlocId(null)}
              />
              <div className="mt-2 flex justify-end">
                <Btn
                  label="Supprimer ce bloc"
                  icon={Trash2}
                  onClick={() => handleDelete(selectedBloc.id)}
                  small
                  variant="danger"
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {blocs.length > 0 && !selectedBloc && (
          <p className="mt-3 text-xs text-gray-700 text-center">
            Cliquez sur un bloc pour le modifier
          </p>
        )}
      </div>

      {/* ── Panneau droit : Appliquer au planning ── */}
      <div className="w-72 shrink-0 p-5 bg-gray-50/60">
        <p className="text-xs font-semibold text-gray-700 uppercase tracking-wide mb-4">
          Appliquer au planning
        </p>
        <div className="space-y-3">
          <Field label="Planning">
            <Select
              value={selPlanning?.id ?? ""}
              onChange={(e) => {
                const p = plannings.find((x) => x.id === Number(e.target.value)) ?? null;
                setSelPlanning(p);
                setApplyDate("");
                setApplyResult(null);
                setApplyError("");
              }}
            >
              <option value="">— Choisir —</option>
              {plannings.map((p) => (
                <option key={p.id} value={p.id}>{p.nom}</option>
              ))}
            </Select>
          </Field>

          {selPlanning && (
            <Field label="Date">
              <Input
                type="date"
                value={applyDate}
                min={selPlanning.date_debut}
                max={selPlanning.date_fin}
                onChange={(e) => { setApplyDate(e.target.value); setApplyResult(null); setApplyError(""); }}
              />
            </Field>
          )}

          <Btn
            label={applying ? "Application…" : "Appliquer ce gabarit"}
            icon={Wand2}
            onClick={handleApply}
            disabled={applying || !selPlanning || !applyDate}
          />

          {applyResult && (
            <div className="rounded-lg bg-emerald-50 border border-emerald-200 px-3 py-2 text-xs text-emerald-700">
              ✓ {applyResult.demi_journees_created} demi-journée(s) —{" "}
              {applyResult.epreuves_created} épreuve(s) générée(s)
            </div>
          )}
          <ErrorMsg msg={applyError} />
        </div>

        {selPlanning && (
          <div className="mt-5 pt-4 border-t border-black/5">
            <p className="text-[10px] text-gray-700 font-medium uppercase tracking-wide mb-1">
              Plage du planning
            </p>
            <p className="text-xs text-gray-800">
              {formatDateCourte(selPlanning.date_debut)} → {formatDateCourte(selPlanning.date_fin)}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Section : Journées types ───────────────────────────────────────────────────
function ApplyJourneeTypeToPlanning({ jt, onClose }: { jt: JourneeType; onClose: () => void }) {
  const [plannings, setPlannings] = useState<Planning[]>([]);
  const [loading, setLoading] = useState(true);
  const [planningId, setPlanningId] = useState<number | null>(null);

  useEffect(() => {
    get<Planning[]>("plannings/")
      .then((ps) => {
        setPlannings(ps);
        if (ps.length > 0) setPlanningId(planningMemorise(ps) ?? ps[0].id);
      })
      .finally(() => setLoading(false));
  }, []);
  useEffect(() => memoriserPlanning(planningId), [planningId]);

  if (loading) {
    return <div className="flex justify-center py-8"><Spinner /></div>;
  }

  if (plannings.length === 0) {
    return (
      <p className="text-sm text-gray-800">
        Aucun planning disponible. Créez-en un dans la section &laquo; Plannings &raquo;.
      </p>
    );
  }

  const planning = plannings.find((p) => p.id === planningId);

  return (
    <div className="space-y-4">
      <Field label="Planning">
        <Select value={planningId ?? ""} onChange={(e) => setPlanningId(Number(e.target.value))}>
          {plannings.map((p) => (
            <option key={p.id} value={p.id}>
              {p.nom} ({formatDateCourte(p.date_debut)} → {formatDateCourte(p.date_fin)})
            </option>
          ))}
        </Select>
      </Field>
      {planning && (
        <ApplyForm
          key={planning.id}
          planningId={planning.id}
          date={planning.date_debut}
          dateDebut={planning.date_debut}
          dateFin={planning.date_fin}
          journeeTypes={[jt]}
          onSuccess={onClose}
          precocherDate={false}
        />
      )}
    </div>
  );
}

export function JourneeTypesSection() {
  const toast = useToast();
  const confirm = useConfirm();
  const [tab, setTab] = useFiltre<"gabarits" | "matrice">("journeeTypes:onglet", "gabarits");
  const [jts, setJts] = useState<JourneeType[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState<number | null>(null);
  const [wizardEdit, setWizardEdit] = useState<{ jt: JourneeType; blocs: Bloc[] } | null>(null);
  const [applyingJt, setApplyingJt] = useState<JourneeType | null>(null);

  const openWizardEdit = async (jt: JourneeType) => {
    try {
      const blocs = await get<Bloc[]>(`journee-types/${jt.id}/blocs`);
      setWizardEdit({ jt, blocs });
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setJts(await get<JourneeType[]>("journee-types/"));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleDelete = async (id: number) => {
    if (!await confirm("Supprimer cette journée type ?", { confirmLabel: "Supprimer", danger: true })) return;
    try {
      await del(`journee-types/${id}`);
      toast.success("Journée type supprimée");
      if (editing === id) setEditing(null);
      load();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-xl font-semibold">Journées types</h2>
          <p className="text-sm text-gray-700 mt-0.5">
            Gabarits de génération des créneaux
          </p>
        </div>
        {tab === "gabarits" && (
          <Btn
            label="Nouvelle journée type"
            icon={Plus}
            onClick={() => setShowCreate(true)}
          />
        )}
      </div>

      {/* Onglets */}
      <div className="flex gap-1 mb-6 border-b border-black/10">
        {(["gabarits", "matrice"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium rounded-t-lg transition -mb-px border border-b-0 ${
              tab === t
                ? "bg-white border-black/10 text-black"
                : "border-transparent text-gray-700 hover:text-black"
            }`}
          >
            {t === "gabarits" ? "Gabarits" : "Matrice oraux"}
          </button>
        ))}
      </div>

      {tab === "matrice" ? (
        <InterfaceAdminENSAEPlanning />
      ) : loading ? (
        <div className="flex justify-center py-16 text-gray-700">
          <Spinner />
        </div>
      ) : jts.length === 0 ? (
        <Empty
          message="Aucune journée type"
          sub="Créez un gabarit pour définir la structure et les créneaux d'une journée."
        />
      ) : (
        <div className="space-y-3">
          {jts.map((jt) => (
            <div
              key={jt.id}
              className="rounded-xl border bg-white shadow-sm overflow-hidden"
            >
              <div className="flex items-center justify-between px-5 py-4">
                <div className="flex items-center gap-3">
                  <span className="font-medium">{jt.nom}</span>

                  <span className="text-xs text-gray-700">
                    {jt.duree_defaut_minutes}min &bull; pause{" "}
                    {jt.pause_defaut_minutes}min
                    {jt.preparation_defaut_minutes > 0 && (
                      <> &bull; prép. {jt.preparation_defaut_minutes}min</>
                    )}
                  </span>
                  <StatutBadge statut={jt.statut_initial} />
                </div>
                <div className="flex gap-2">
                  <Btn
                    label="Appliquer"
                    icon={Wand2}
                    onClick={() => setApplyingJt(jt)}
                    small
                  />
                  <Btn
                    label="Modifier"
                    icon={Pencil}
                    onClick={() => openWizardEdit(jt)}
                    small
                    variant="ghost"
                  />
                  <Btn
                    label={editing === jt.id ? "Fermer" : "Blocs"}
                    icon={Settings2}
                    onClick={() => setEditing(editing === jt.id ? null : jt.id)}
                    small
                    variant="ghost"
                  />
                  <Btn
                    label="Supprimer"
                    icon={Trash2}
                    onClick={() => handleDelete(jt.id)}
                    small
                    variant="danger"
                  />
                </div>
              </div>

              <AnimatePresence>
                {editing === jt.id && (
                  <motion.div
                    key="editor"
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden border-t"
                  >
                    <JourneeTypeEditor jt={jt} onRename={(newNom) => setJts(prev => prev.map(j => j.id === jt.id ? { ...j, nom: newNom } : j))} />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ))}
        </div>
      )}

      <Modal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        title="Créer une journée type"
        wide
      >
        <CreateJourneeTypeForm
          onSuccess={() => {
            setShowCreate(false);
            toast.success("Journée type créée");
            load();
          }}
        />
      </Modal>

      <Modal
        open={!!wizardEdit}
        onClose={() => setWizardEdit(null)}
        title={wizardEdit ? `Modifier — ${wizardEdit.jt.nom}` : ""}
        wide
      >
        {wizardEdit && (
          <CreateJourneeTypeForm
            editJt={wizardEdit}
            onSuccess={() => {
              setWizardEdit(null);
              toast.success("Journée type mise à jour");
              load();
            }}
          />
        )}
      </Modal>

      <Modal
        open={!!applyingJt}
        onClose={() => setApplyingJt(null)}
        title={applyingJt ? `Appliquer — ${applyingJt.nom}` : ""}
        wide
      >
        {applyingJt && (
          <ApplyJourneeTypeToPlanning
            jt={applyingJt}
            onClose={() => {
              setApplyingJt(null);
              toast.success("Gabarit appliqué");
            }}
          />
        )}
      </Modal>
    </div>
  );
}

// ── Helpers wizard journée type ────────────────────────────────────────────────
function minutesToHM(total: number): string {
  const h = Math.floor(total / 60) % 24;
  const m = total % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

// Mémorise la dernière durée de pause déjeuner saisie (par admin, dans ce navigateur),
// pour la reproposer par défaut au lieu de retomber sur une valeur figée à chaque fois
// qu'on bascule en mode "journée complète" ou qu'on crée un nouveau gabarit.
const PAUSE_MIDI_STORAGE_KEY = "oraux_admin_pause_midi_minutes";
function getRememberedPauseMidi(): number {
  if (typeof window === "undefined") return 60;
  const v = Number(window.localStorage.getItem(PAUSE_MIDI_STORAGE_KEY));
  return v > 0 ? v : 60;
}
function rememberPauseMidi(minutes: number) {
  if (typeof window === "undefined" || minutes <= 0) return;
  try { window.localStorage.setItem(PAUSE_MIDI_STORAGE_KEY, String(minutes)); } catch { /* ignore */ }
}

const TRIPLET_BG = [
  "#FEF9C3","#DCFCE7","#DBEAFE","#FCE7F3","#FEE2E2",
  "#FFEDD5","#F3E8FF","#ECFDF5","#E0F2FE",
];
const TRIPLET_RING = [
  "#FDE047","#86EFAC","#93C5FD","#F9A8D4","#FCA5A5",
  "#FDBA74","#D8B4FE","#6EE7B7","#7DD3FC",
];

type MatiereConfig = {
  nom: string;
  duree_minutes: number;
  preparation_minutes: number;
  // Dédoublement de jury pour CETTE matière (nb de salles en parallèle) — null/absent =
  // retombe sur le réglage global "Salles par matière" du gabarit (voir blocCapacity).
  salles?: number | null;
};

type BlocWizard = {
  heure_debut: string;
  heure_fin: string;
  pause_minutes: number;
  nb_slots: number | null;        // null → N² automatique (créneaux ORAL)
  bonus_slots: number;            // créneaux bonus urgences (après les oraux réguliers)
  matieres_config: MatiereConfig[];
  pause_midi_minutes: number;     // durée réelle de la pause déjeuner en minutes (0 = pas de pause)
  pause_midi_after: number | null; // null = auto (moitié des créneaux oraux)
  // Nature explicite (MATIN/APRES_MIDI) — null = déduite de heure_debut (comportement historique),
  // utile pour forcer la nature d'un bloc "jury" en dédoublement même s'il déborde sur midi.
  type_demi_journee?: "MATIN" | "APRES_MIDI" | null;
};

type WizardParams = {
  nom: string;
  salles_par_matiere: number;
  statut_initial: string;
  mode: "demi-journee" | "journee-complete";
  blocs: BlocWizard[];
};

type MatrixRow = {
  deb_prepa: string;
  deb_exam: string;
  fin_exam: string;
  candidates: number[];
  // Dédoublement de jury (salles_par_matiere > 1) : les S-1 candidats des salles
  // parallèles pour chaque matière de cette ligne, en plus du candidat "principal" de
  // `candidates` — voir buildBlocRows. undefined/vide si salles_par_matiere <= 1.
  extraCandidates?: number[][];
  bloc_idx: number;
  isPause?: boolean;
  isBonus?: boolean;
};

// Marge minimale entre la fin d'un passage et le début de préparation du suivant, pour un
// même candidat (le temps de changer de salle) — DOIT rester synchronisée avec
// MARGIN_TRANSITION_MINUTES côté backend (portal.py) et InterfaceAdminENSAEPlanning.jsx.
const MARGIN_TRANSITION_MINUTES = 30;

// Pas de rotation — DOIT rester identique au calcul réellement utilisé par le backend
// pour l'inscription des candidats (_rotation_offset dans portal.py, partagée par
// get_triplets / s_inscrire_triplet) : le plus petit écart (en nombre de créneaux) entre
// deux passages d'un même candidat qui laisse au moins MARGIN_TRANSITION_MINUTES entre la
// fin d'un examen et le début de la préparation suivante, plutôt que d'étaler
// systématiquement chaque matière sur toute la journée (ancien modèle total_slots //
// N_rooms, qui pouvait représenter plusieurs heures d'écart). Ici, au sein d'un même bloc,
// l'intervalle entre deux créneaux consécutifs d'une même salle est constant (`interval`),
// donc l'écart minimal viable se réduit simplement à ceil((slotDuration + marge) / interval)
// — la version backend, elle, doit composer avec des horaires réels potentiellement
// hétérogènes (plusieurs blocs de durées différentes, trou de pause déjeuner), d'où un
// calcul par horaires plutôt que par une simple division.
function rotationOffset(slotDuration: number, interval: number): number {
  if (interval <= 0) return 1;
  return Math.max(1, Math.ceil((slotDuration + MARGIN_TRANSITION_MINUTES) / interval));
}

function blocCapacity(bloc: BlocWizard, configs: MatiereConfig[]): number {
  const N = configs.length;
  if (!N) return 0;
  const maxDuree = Math.max(...configs.map(c => c.duree_minutes));
  const maxPrep = Math.max(...configs.map(c => c.preparation_minutes));
  const [hh, mm] = bloc.heure_debut.split(":").map(Number);
  const [efh, efm] = bloc.heure_fin.split(":").map(Number);
  const start = hh * 60 + mm;
  const end = efh * 60 + efm;
  const interval = maxDuree + bloc.pause_minutes;
  const slotDuration = maxPrep + maxDuree;
  const pauseMinutes = bloc.pause_midi_minutes ?? 0;
  // L'insertion réelle de la pause (buildBlocRows) ne coûte pas seulement pauseMinutes :
  // elle ancre la reprise sur pauseDisplayEnd = t + (slotDuration - interval) + pauseMinutes,
  // soit (slotDuration - interval) de PLUS que pauseMinutes seul (le temps de "rattrapage" du
  // dernier examen avant la pause, qui occupe slotDuration mais n'avance t que de interval).
  // Sans ce surcoût, la fenêtre estimée ici promettait 1 créneau de plus que ce que
  // buildBlocRows pouvait réellement générer (ex. 14 demandés, 13 générés avec une pause).
  const pauseOverhead = pauseMinutes > 0 ? pauseMinutes + (slotDuration - interval) : 0;
  const availableOral = (end - start) - pauseOverhead;
  const maxSlots = interval > 0 ? Math.floor((availableOral - slotDuration) / interval) + 1 : 0;
  // La fenêtre horaire (heure_debut → heure_fin) plafonne la capacité, mais SANS arrondir
  // à un multiple de N : depuis le correctif "fenêtre horaire fait foi" (buildMatrix côté
  // Matrice oraux, cf. genCount), la rotation n'exige plus que nb_slots soit un multiple de
  // N pour être complète — n'importe quel nombre marche (vérifié en conditions réelles avec
  // 17 créneaux). Arrondir ici était donc redondant ET néfaste : comme updateNbSlots recalcule
  // heure_fin pour tenir EXACTEMENT le nb_slots saisi, ce plafond arrondi la reréduisait
  // aussitôt (ex. 17 → 15), donnant l'impression trompeuse que l'heure de fin résistait à la
  // valeur tapée alors qu'elle la suit fidèlement.
  const capped = Math.max(N, Math.max(0, maxSlots));
  return bloc.nb_slots !== null ? Math.min(bloc.nb_slots, capped) : capped;
}

// Horaires des lignes d'un bloc de l'assistant ; les numéros de triplet sont posés ensuite
// par buildMatrix, comme la Matrice oraux.
function buildBlocRows(bloc: BlocWizard, configs: MatiereConfig[] | undefined, bloc_idx: number): MatrixRow[] {
  configs = configs ?? bloc.matieres_config;
  const N = configs.length;
  if (!N) return [];
  const maxDuree = Math.max(...configs.map(c => c.duree_minutes));
  const maxPrep = Math.max(...configs.map(c => c.preparation_minutes));
  const [hh, mm] = bloc.heure_debut.split(":").map(Number);
  const start = hh * 60 + mm;
  const [efh, efm] = bloc.heure_fin.split(":").map(Number);
  const end = efh * 60 + efm;
  const interval = maxDuree + bloc.pause_minutes;
  const pauseMinutes = bloc.pause_midi_minutes ?? 0;
  const Kregular = blocCapacity(bloc, configs);
  const Kbonus = bloc.bonus_slots ?? 0;
  const Ktotal = Kregular + Kbonus;
  const pauseAfter = bloc.pause_midi_after ?? Math.ceil(Kregular / 2);

  const rows: MatrixRow[] = [];
  let t = start;
  for (let oral = 0; oral < Ktotal; oral++) {
    if (pauseMinutes > 0 && oral === pauseAfter) {
      // La pause démarre exactement à la fin du dernier oral. Le bloc PAUSE réellement
      // enregistré en base (saveBlocsToJt) va de la fin de ce dernier oral (fin_exam) au
      // deb_prepa du prochain oral — donc pour que ce bloc PAUSE dure exactement
      // pauseMinutes (ce que l'admin a tapé, et ce que montre déjà ce bandeau), le prochain
      // oral doit reprendre à pauseDisplayEnd, pas pauseMinutes après le t théorique.
      // Contrepartie assumée : la préparation du prochain oral démarre pile à la fin du
      // bloc PAUSE affiché, donc la coupure réelle en salle d'examen (fin_exam → deb_exam)
      // devient pauseMinutes + preparation_minutes, un peu plus longue que pauseMinutes —
      // c'est le bloc PAUSE visible qui fait foi, pas la seule salle d'examen.
      const pauseDisplayStart = t + (maxPrep + maxDuree - interval);
      const pauseDisplayEnd = pauseDisplayStart + pauseMinutes;
      rows.push({ deb_prepa: minutesToHM(pauseDisplayStart), deb_exam: minutesToHM(pauseDisplayStart), fin_exam: minutesToHM(pauseDisplayEnd), candidates: [], bloc_idx, isPause: true });
      t = pauseDisplayEnd;
    }
    // Même condition d'arrêt que generate_in_range côté backend (t + prépa + durée <= fin) :
    // si ce créneau ne rentre plus dans la fenêtre, on arrête ici plutôt que de continuer à
    // générer au-delà de heure_fin. Sans ça, un nb_slots (ou des bonus) trop ambitieux pour la
    // fenêtre produisait un aperçu qui dépassait silencieusement l'heure de fin annoncée.
    if (t + maxPrep + maxDuree > end) break;
    rows.push({
      deb_prepa: minutesToHM(t),
      deb_exam: minutesToHM(t + maxPrep),
      fin_exam: minutesToHM(t + maxPrep + maxDuree),
      candidates: [],
      bloc_idx,
      isPause: false,
      isBonus: oral >= Kregular,   // les derniers Kbonus créneaux sont marqués bonus
    });
    t += interval;
  }

  return rows;
}

// Numérotation des triplets IDENTIQUE à la Matrice oraux (InterfaceAdminENSAEPlanning.jsx,
// buildMatrix) et à la génération des épreuves (generation.py) : chaque bloc ENREGISTRÉ a sa
// propre rotation — en journée complète, le matin et l'après-midi séparément, de part et
// d'autre de la pause, puisque saveBlocsToJt les enregistre comme deux blocs. Ligne i,
// matière j : premier numéro du bloc + (i − j × écart) mod nombre de lignes. Les blocs se
// suivent en réservant chacun nb_slots (ou N²) numéros. Une ligne au-delà de nb_slots
// (créneau bonus) ne porte pas de triplet : -1.
function buildMatrix(p: WizardParams): MatrixRow[] {
  let premier = 0;
  const sDefault = Math.max(1, p.salles_par_matiere ?? 1);
  return p.blocs.flatMap((bloc, idx) => {
    const configs = bloc.matieres_config ?? [];
    const rows = buildBlocRows(bloc, configs, idx);
    const N = configs.length;
    if (!N || !rows.length) return rows;
    const maxDuree = Math.max(...configs.map(c => c.duree_minutes));
    const maxPrep = Math.max(...configs.map(c => c.preparation_minutes));
    const step = rotationOffset(maxPrep + maxDuree, maxDuree + bloc.pause_minutes);
    const salles = configs.map((c) => Math.max(1, c.salles ?? sDefault));
    const sMax = Math.max(1, ...salles);
    // Mêmes découpes que saveBlocsToJt
    const decoupe = p.mode === "journee-complete" && (bloc.pause_midi_minutes ?? 0) > 0;
    const pauseIdx = rows.findIndex(r => r.isPause);
    const segments = decoupe && pauseIdx !== -1
      ? [rows.slice(0, pauseIdx), rows.slice(pauseIdx + 1).filter(r => !r.isPause)]
      : [rows.filter(r => !r.isPause)];
    for (const seg of segments) {
      if (!seg.length) continue;
      const reserve = decoupe ? seg.length : (bloc.nb_slots ?? N * N);
      const G = Math.min(reserve, seg.length);
      seg.forEach((row, i) => {
        const lane = (j: number, r: number) => i < G ? premier + r * G + (((i - j * step) % G) + G) % G : -1;
        row.candidates = Array.from({ length: N }, (_, j) => lane(j, 0));
        row.extraCandidates = sMax > 1 && i < G
          ? Array.from({ length: N }, (_, j) => Array.from({ length: salles[j] - 1 }, (_, k) => lane(j, k + 1)))
          : undefined;
      });
      premier += reserve;
    }
    return rows;
  });
}

// ── Wizard création journée type (2 étapes) ────────────────────────────────────
// Converts an API Bloc to a BlocWizard for the wizard form
function blocToWizard(b: Bloc): BlocWizard {
  const toHM = (t: string) => t.length === 8 ? t.slice(0, 5) : t; // "08:00:00" → "08:00"
  const configs: MatiereConfig[] = b.matieres_config?.length
    ? b.matieres_config
    : b.matieres.map(nom => ({ nom, duree_minutes: b.duree_minutes ?? 30, preparation_minutes: b.preparation_minutes ?? 30 }));
  return {
    heure_debut: toHM(b.heure_debut),
    heure_fin: toHM(b.heure_fin),
    pause_minutes: b.pause_minutes ?? 0,
    nb_slots: b.nb_slots ?? null,
    bonus_slots: b.bonus_slots ?? 0,
    matieres_config: configs,
    pause_midi_minutes: 0,
    pause_midi_after: null,
    type_demi_journee: b.type_demi_journee ?? null,
  };
}

// Nature effective d'un bloc du wizard : la valeur explicite si définie (override admin),
// sinon déduite de heure_debut (comportement historique, cohérent avec le backend).
function effectiveDjType(bloc: BlocWizard): "MATIN" | "APRES_MIDI" {
  if (bloc.type_demi_journee === "MATIN" || bloc.type_demi_journee === "APRES_MIDI") return bloc.type_demi_journee;
  return parseInt(bloc.heure_debut) < 12 ? "MATIN" : "APRES_MIDI";
}

// Replace sur la matrice calculée les positions de triplets enregistrées (bloc.custom_matrix).
// La correspondance se fait par horaires et matières : en journée complète, un bloc de
// l'assistant correspond à deux blocs enregistrés, de part et d'autre de la pause déjeuner.
function appliquerDisposition(base: MatrixRow[], p: WizardParams, blocs: Bloc[]): { rows: MatrixRow[]; perdue: boolean } {
  const rows = base.map(r => ({ ...r, candidates: [...r.candidates] }));
  const cle = (noms: string[]) => [...noms].sort().join(",");
  let perdue = false;
  for (const b of blocs) {
    const custom = b.custom_matrix;
    if (!custom) continue;
    const deb = b.heure_debut.slice(0, 5);
    const fin = b.heure_fin.slice(0, 5);
    const cibles = rows.filter(r =>
      !r.isPause && r.candidates[0] >= 0 && r.deb_prepa >= deb && r.deb_prepa < fin
      && cle(p.blocs[r.bloc_idx].matieres_config.map(c => c.nom)) === cle(b.matieres)
    );
    if (cibles.length !== custom.length || cibles.some((r, i) => r.candidates.length !== custom[i].length)) {
      perdue = true;
      continue;
    }
    cibles.forEach((r, i) => { r.candidates = [...custom[i]]; });
  }
  return { rows, perdue };
}

const AVIS_DISPOSITION_PERDUE = "Les paramètres ne correspondent plus à la disposition enregistrée : les positions des triplets reviennent à la formule automatique.";

function CreateJourneeTypeForm({ onSuccess, editJt }: { onSuccess: () => void; editJt?: { jt: JourneeType; blocs: Bloc[] } }) {
  const isEdit = !!editJt;
  const [step, setStep] = useState<1 | 2>(1);
  const allMatieres = useMatieres();
  const DEFAULT_BLOC: BlocWizard = { heure_debut: "08:00", heure_fin: "13:00", pause_minutes: 0, nb_slots: null, bonus_slots: 0, matieres_config: [], pause_midi_minutes: 0, pause_midi_after: null };

  const initParams = (): WizardParams => {
    if (editJt) {
      const genBlocs = editJt.blocs.filter(b => b.type_bloc === "GENERATION");
      const key = (b: Bloc) => [...b.matieres].sort().join(",");
      const toHM = (t: string) => t.length === 8 ? t.slice(0, 5) : t;
      const toMin = (hhmm: string) => { const [h, m] = hhmm.split(":").map(Number); return h * 60 + m; };

      // Regroupe les blocs par "jury" (même liste de matières) — en journée complète, chaque
      // jury peut être représenté par 1 bloc (sans pause déjeuner) ou 2 blocs consécutifs
      // séparés par la pause déjeuner (mêmes matières des deux côtés).
      const groupsMap = new Map<string, Bloc[]>();
      for (const b of genBlocs) {
        const k = key(b);
        (groupsMap.get(k) ?? groupsMap.set(k, []).get(k)!).push(b);
      }
      const groups = Array.from(groupsMap.values()).map(bs => {
        const sorted = [...bs].sort((a, b) => toMin(toHM(a.heure_debut)) - toMin(toHM(b.heure_debut)));
        return { blocs: sorted, start: Math.min(...sorted.map(b => toMin(toHM(b.heure_debut)))), end: Math.max(...sorted.map(b => toMin(toHM(b.heure_fin)))) };
      });

      // Journée complète : un seul jury (peu importe qu'il soit scindé par la pause déjeuner),
      // ou plusieurs jurys dont les plages horaires SE CHEVAUCHENT (jurys parallèles sur la
      // même journée — pattern dédoublement). Des blocs à matières différentes mais
      // séquentiels dans le temps (Matin ≠ Après-midi, aucun chevauchement) restent, eux,
      // une demi-journée classique.
      const overlaps = (a: { start: number; end: number }, b: { start: number; end: number }) => a.start < b.end && b.start < a.end;
      const isJC = groups.length <= 1 || groups.every((g, i) => groups.slice(i + 1).every(g2 => overlaps(g, g2)));
      const inferredMode: WizardParams["mode"] = isJC ? "journee-complete" : "demi-journee";

      // nb_slots effectif d'un bloc sauvegardé : null veut dire "N² implicite", pas 0 — sans
      // ce fallback, un bloc en N² implicite (fréquent, ex. bloc après-midi jamais
      // explicitement chiffré) disparaissait purement et simplement du total recalculé à la
      // réouverture du formulaire d'édition (9+9 devenait 9+0=9).
      const effectiveSlots = (b: Bloc) => b.nb_slots ?? b.matieres.length ** 2;

      // Fusionne les 1-2 blocs d'un même jury (matin+après-midi scindés par la pause
      // déjeuner) en 1 seul bloc wizard, avec pause_midi_minutes/pause_midi_after reconstruits.
      const mergeGroup = (g: { blocs: Bloc[] }): BlocWizard => {
        const b0 = blocToWizard(g.blocs[0]);
        if (g.blocs.length < 2) return b0;
        const gap = toMin(toHM(g.blocs[1].heure_debut)) - toMin(toHM(g.blocs[0].heure_fin));
        return {
          ...b0,
          heure_debut: toHM(g.blocs[0].heure_debut),
          heure_fin: toHM(g.blocs[g.blocs.length - 1].heure_fin),
          nb_slots: g.blocs.reduce((s, b) => s + effectiveSlots(b), 0) || null,
          pause_midi_minutes: Math.max(0, gap),
          pause_midi_after: effectiveSlots(g.blocs[0]),
        };
      };

      const inferredBlocs: BlocWizard[] = !genBlocs.length
        ? [DEFAULT_BLOC]
        : isJC
          ? groups.map(mergeGroup)
          : genBlocs.map(blocToWizard);

      return {
        nom: editJt.jt.nom,
        salles_par_matiere: genBlocs[0]?.salles_par_matiere ?? 1,
        statut_initial: editJt.jt.statut_initial,
        mode: inferredMode,
        blocs: inferredBlocs,
      };
    }
    return {
      nom: "",
      salles_par_matiere: 1,
      statut_initial: "LIBRE",
      mode: "demi-journee",
      blocs: [
        { heure_debut: "08:00", heure_fin: "13:00", pause_minutes: 0, nb_slots: null, bonus_slots: 0, matieres_config: [], pause_midi_minutes: 0, pause_midi_after: null },
        { heure_debut: "14:00", heure_fin: "18:00", pause_minutes: 0, nb_slots: null, bonus_slots: 0, matieres_config: [], pause_midi_minutes: 0, pause_midi_after: null },
      ],
    };
  };

  const [p, setP] = useState<WizardParams>(initParams);
  // `base` = la matrice telle que calculée par la formule, `matrix` = avec les déplacements de
  // triplets. Comparer les deux dit ce qui a été déplacé ; `base` dit aussi si les paramètres
  // ont changé depuis (les positions n'ont alors plus de sens).
  const [base, setBase] = useState<MatrixRow[]>(() => buildMatrix(p));
  const dispositionInitiale = () => appliquerDisposition(base, p, editJt?.blocs ?? []);
  const [matrix, setMatrix] = useState<MatrixRow[]>(() => dispositionInitiale().rows);
  const [avisDisposition, setAvisDisposition] = useState(() => dispositionInitiale().perdue ? AVIS_DISPOSITION_PERDUE : "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const toggleBlocMatiere = (blocIdx: number, intitule: string) => {
    setP(prev => ({
      ...prev,
      blocs: prev.blocs.map((b, i) => {
        if (i !== blocIdx) return b;
        const exists = b.matieres_config.find(c => c.nom === intitule);
        return {
          ...b,
          matieres_config: exists
            ? b.matieres_config.filter(c => c.nom !== intitule)
            : [...b.matieres_config, { nom: intitule, duree_minutes: 30, preparation_minutes: 30 }],
        };
      }),
    }));
  };

  const setBlocMatiereConfig = (blocIdx: number, nom: string, k: keyof Omit<MatiereConfig, "nom">, v: number) =>
    setP(prev => ({
      ...prev,
      blocs: prev.blocs.map((b, i) => i !== blocIdx ? b : {
        ...b,
        matieres_config: b.matieres_config.map(c => c.nom === nom ? { ...c, [k]: v } : c),
      }),
    }));

  const set = (k: keyof WizardParams, v: any) => setP((prev) => ({ ...prev, [k]: v }));
  const setBloc = (idx: number, k: keyof BlocWizard, v: any) =>
    setP((prev) => ({ ...prev, blocs: prev.blocs.map((b, i) => i === idx ? { ...b, [k]: v } : b) }));
  const addBloc = () => setP((prev) => {
    // En mode "journée complète", un nouveau bloc représente typiquement un jury parallèle
    // sur la même plage horaire (pattern dédoublement à 2 jurys) : on reprend donc les
    // horaires et la pause déjeuner du premier bloc plutôt que le créneau après-midi par
    // défaut du mode "demi-journée", qui n'aurait pas de sens ici.
    const newBloc: BlocWizard = prev.mode === "journee-complete"
      ? { ...DEFAULT_BLOC, heure_debut: prev.blocs[0].heure_debut, heure_fin: prev.blocs[0].heure_fin, pause_midi_minutes: prev.blocs[0].pause_midi_minutes, pause_midi_after: prev.blocs[0].pause_midi_after, bonus_slots: 0 }
      : { ...DEFAULT_BLOC, heure_debut: "14:00", heure_fin: "18:00", bonus_slots: 0 };
    return { ...prev, blocs: [...prev.blocs, newBloc] };
  });
  const removeBloc = (idx: number) => setP((prev) => ({ ...prev, blocs: prev.blocs.filter((_, i) => i !== idx) }));

  const allerMatrice = () => {
    if (p.blocs.every(b => b.matieres_config.length === 0)) {
      setError("Sélectionnez au moins une matière dans un bloc"); return;
    }
    setError("");
    // Tant que les paramètres ne changent pas, on garde la matrice telle quelle, déplacements compris
    const calculee = buildMatrix(p);
    if (JSON.stringify(calculee) !== JSON.stringify(base)) {
      if (JSON.stringify(matrix) !== JSON.stringify(base)) setAvisDisposition(AVIS_DISPOSITION_PERDUE);
      setBase(calculee);
      setMatrix(calculee);
    }
    setStep(2);
  };

  // Positions à enregistrer pour un bloc : null tant qu'aucun triplet n'a été déplacé, le bloc
  // suit alors la formule automatique
  const dispositionDe = (rows: MatrixRow[]) => {
    const orales = rows.filter(r => !r.isPause && r.candidates[0] >= 0);
    const deplace = orales.some(r => JSON.stringify(r.candidates) !== JSON.stringify(base[matrix.indexOf(r)].candidates));
    return deplace ? orales.map(r => r.candidates) : null;
  };

  // Mode demi-journée : l'écart entre la fin d'un bloc et le début du bloc suivant devient un
  // bloc PAUSE, comme la pause déjeuner du mode journée complète. Clé : indice du bloc qui
  // suit la pause. Des blocs qui se chevauchent (jurys en parallèle) n'ont pas de pause.
  const pausesEntreBlocs = (): Map<number, { debut: string; fin: string }> => {
    const out = new Map<number, { debut: string; fin: string }>();
    if (p.mode !== "demi-journee") return out;
    let finPrecedente: string | null = null;
    for (let idx = 0; idx < p.blocs.length; idx++) {
      const bloc = p.blocs[idx];
      const oraux = matrix.filter(r => r.bloc_idx === idx && !r.isPause);
      if (!bloc.matieres_config.length || !oraux.length) continue;
      const debut = oraux[0].deb_prepa;
      if (finPrecedente && finPrecedente < debut) out.set(idx, { debut: finPrecedente, fin: debut });
      const fin = oraux[oraux.length - 1].fin_exam;
      if (!finPrecedente || fin > finPrecedente) finPrecedente = fin;
    }
    return out;
  };

  const saveBlocsToJt = async (jtId: number) => {
    let ordre = 1;
    const pauses = pausesEntreBlocs();
    for (let idx = 0; idx < p.blocs.length; idx++) {
      const bloc = p.blocs[idx];
      if (!bloc.matieres_config.length) continue;
      const blocRows = matrix.filter(r => r.bloc_idx === idx);
      if (!blocRows.length) continue;
      const pause = pauses.get(idx);
      if (pause) {
        await post(`journee-types/${jtId}/blocs`, { type_bloc: "PAUSE", ordre: ordre++, heure_debut: pause.debut + ":00", heure_fin: pause.fin + ":00" });
      }
      const bMaxDuree = Math.max(...bloc.matieres_config.map(c => c.duree_minutes));
      const bMaxPrep = Math.max(...bloc.matieres_config.map(c => c.preparation_minutes));
      const blocPayload = {
        type_bloc: "GENERATION",
        matieres: bloc.matieres_config.map(c => c.nom),
        matieres_config: bloc.matieres_config,
        duree_minutes: bMaxDuree,
        pause_minutes: bloc.pause_minutes,
        preparation_minutes: bMaxPrep,
        salles_par_matiere: p.salles_par_matiere,
        bonus_slots: bloc.bonus_slots ?? 0,
        // Override explicite pertinent seulement en mode "demi-journee" (le mode "journée
        // complète" scinde déjà lui-même son unique bloc en avant/après pause plus bas).
        type_demi_journee: p.mode === "demi-journee" ? (bloc.type_demi_journee ?? null) : null,
      };
      if (p.mode === "journee-complete" && (bloc.pause_midi_minutes ?? 0) > 0) {
        // Découpe autour de la ligne isPause réellement insérée par buildBlocRows, plutôt que
        // de recalculer un index séparément : ça évite tout écart si la fenêtre horaire est
        // trop juste pour caser tous les créneaux théoriques (Kregular) — le nombre de lignes
        // réellement générées peut alors être inférieur, et un recalcul indépendant du point de
        // coupure divergerait du point où la pause a vraiment été insérée dans la rotation.
        const pauseRowIdx = blocRows.findIndex(r => r.isPause);
        const oralBefore = pauseRowIdx === -1 ? blocRows.filter(r => !r.isPause) : blocRows.slice(0, pauseRowIdx);
        const oralAfter = pauseRowIdx === -1 ? [] : blocRows.slice(pauseRowIdx + 1).filter(r => !r.isPause);
        if (oralBefore.length) await post(`journee-types/${jtId}/blocs`, { ...blocPayload, ordre: ordre++, heure_debut: oralBefore[0].deb_prepa + ":00", heure_fin: oralBefore[oralBefore.length - 1].fin_exam + ":00", nb_slots: oralBefore.length, custom_matrix: dispositionDe(oralBefore) });
        if (oralBefore.length && oralAfter.length) {
          // La pause déjeuner devient un vrai bloc PAUSE (pas juste un trou horaire implicite
          // entre deux blocs GENERATION), sur l'écart fin du matin -> début de la prépa de
          // l'après-midi. Grâce au calage de buildBlocRows sur pauseDisplayEnd, cet écart vaut
          // désormais toujours exactement pause_midi_minutes : le bloc PAUSE affiché correspond
          // pile à ce que l'admin a saisi (contrepartie : la préparation du premier oral de
          // l'après-midi démarre juste après, donc la coupure réelle en salle d'examen est un
          // peu plus longue que pause_midi_minutes — voir buildBlocRows). Le garde-fou ci-dessous
          // ne sert donc plus qu'à couvrir un éventuel cas dégénéré (pause_midi_minutes = 0
          // filtré plus haut, ou données legacy), pas un empiètement normal.
          const [ph, pm] = oralBefore[oralBefore.length - 1].fin_exam.split(":").map(Number);
          const [nh, nm] = oralAfter[0].deb_prepa.split(":").map(Number);
          if (ph * 60 + pm < nh * 60 + nm) {
            await post(`journee-types/${jtId}/blocs`, {
              type_bloc: "PAUSE",
              ordre: ordre++,
              heure_debut: oralBefore[oralBefore.length - 1].fin_exam + ":00",
              heure_fin: oralAfter[0].deb_prepa + ":00",
            });
          }
        }
        if (oralAfter.length) await post(`journee-types/${jtId}/blocs`, { ...blocPayload, ordre: ordre++, heure_debut: oralAfter[0].deb_prepa + ":00", heure_fin: oralAfter[oralAfter.length - 1].fin_exam + ":00", nb_slots: oralAfter.length, custom_matrix: dispositionDe(oralAfter) });
      } else {
        await post(`journee-types/${jtId}/blocs`, { ...blocPayload, ordre: ordre++, heure_debut: bloc.heure_debut + ":00", heure_fin: blocRows[blocRows.length - 1].fin_exam + ":00", nb_slots: bloc.nb_slots ?? null, custom_matrix: dispositionDe(blocRows) });
      }
    }
  };

  const handleSave = async () => {
    if (!p.nom.trim()) { setError("Nom requis : renseignez-le à l'étape 1 (Paramétrage)"); return; }
    setLoading(true);
    setError("");
    try {
      const allConfigs = p.blocs.flatMap(b => b.matieres_config);
      const maxDuree = allConfigs.length ? Math.max(...allConfigs.map(c => c.duree_minutes)) : 30;
      const maxPrep = allConfigs.length ? Math.max(...allConfigs.map(c => c.preparation_minutes)) : 30;

      if (isEdit && editJt) {
        // Mode édition : mettre à jour la JT + supprimer/recréer les blocs
        await put(`journee-types/${editJt.jt.id}`, { nom: p.nom });
        for (const b of editJt.blocs) {
          await del(`journee-types/blocs/${b.id}`);
        }
        await saveBlocsToJt(editJt.jt.id);
      } else {
        // Mode création
        const jt = await post<{ id: number }>("journee-types/", {
          nom: p.nom,
          duree_defaut_minutes: maxDuree,
          pause_defaut_minutes: p.blocs[0].pause_minutes,
          preparation_defaut_minutes: maxPrep,
          statut_initial: p.statut_initial,
        });
        await saveBlocsToJt(jt.id);
      }
      onSuccess();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  // ── Indicateur d'étapes ──────────────────────────────────────────────────────
  const StepPills = () => (
    <div className="flex items-center gap-2 mb-1">
      <button
        className={`text-[11px] font-bold px-2 py-0.5 rounded-full transition ${step === 1 ? "bg-black text-white" : "border border-black/20 text-gray-700 hover:border-black/50"}`}
        onClick={() => step === 2 && setStep(1)}
      >1</button>
      <button
        className={`text-xs transition ${step === 1 ? "font-semibold text-gray-900" : "text-gray-700 hover:text-black"}`}
        onClick={() => step === 2 && setStep(1)}
      >Paramétrage</button>
      <span className="text-gray-700 text-xs mx-1">→</span>
      <button
        className={`text-[11px] font-bold px-2 py-0.5 rounded-full transition ${step === 2 ? "bg-black text-white" : "border border-black/20 text-gray-700 hover:border-black/50"}`}
        onClick={() => step === 1 && allerMatrice()}
      >2</button>
      <button
        className={`text-xs transition ${step === 2 ? "font-semibold text-gray-900" : "text-gray-700 hover:text-black"}`}
        onClick={() => step === 1 && allerMatrice()}
      >Matrice & enregistrement</button>
    </div>
  );

  // ── Étape 1 ─────────────────────────────────────────────────────────────────
  if (step === 1) {
    const activeMatieres = allMatieres.filter(m => m.active);
    const blocLabel = (heure_debut: string, heure_fin: string) => {
      const debutH = parseInt(heure_debut);
      const finH = parseInt(heure_fin);
      // Un bloc qui chevauche midi ne peut pas être honnêtement étiqueté "Matin" en entier
      // (c'était le cas avant : le label ne regardait que l'heure de début).
      if (debutH < 12 && finH > 12) return "Journée complète";
      return debutH < 13 ? "Matin" : "Après-midi";
    };

    const isJC = p.mode === "journee-complete";

    // Quand on bascule en journée complète, reprendre la dernière durée de pause
    // déjeuner utilisée par l'admin (mémorisée dans ce navigateur) plutôt qu'une
    // valeur figée à 60min.
    const switchMode = (m: WizardParams["mode"]) => {
      if (m === "journee-complete") {
        setP(prev => ({
          ...prev,
          mode: m,
          blocs: [{
            ...prev.blocs[0],
            heure_debut: "08:30",
            heure_fin: "18:30",
            nb_slots: null,
            pause_midi_minutes: prev.blocs[0].pause_midi_minutes > 0 ? prev.blocs[0].pause_midi_minutes : getRememberedPauseMidi(),
            pause_midi_after: null,
          }],
        }));
      } else {
        setP(prev => ({
          ...prev,
          mode: m,
          blocs: [
            { ...prev.blocs[0], pause_midi_minutes: 0, pause_midi_after: null },
            { heure_debut: "14:00", heure_fin: "18:00", pause_minutes: prev.blocs[0].pause_minutes, nb_slots: null, bonus_slots: 0, matieres_config: [], pause_midi_minutes: 0, pause_midi_after: null },
          ],
        }));
      }
    };

    return (
      <div className="space-y-4">
        <StepPills />

        {/* ── Sélecteur de mode ── */}
        <div className="flex gap-2">
          {(["demi-journee", "journee-complete"] as const).map(m => (
            <button
              key={m}
              type="button"
              onClick={() => switchMode(m)}
              className={`flex-1 py-2 rounded-xl text-xs font-semibold border transition ${
                p.mode === m ? "bg-black text-white border-black" : "bg-white text-gray-800 border-black/15 hover:border-black/30"
              }`}
            >
              {m === "demi-journee" ? "Demi-journée" : "Journée complète"}
            </button>
          ))}
        </div>

        {/* Le nombre de salles se règle matière par matière (colonne « Jurys en parallèle » de chaque bloc) */}
        <Field label="Nom">
          <Input value={p.nom} onChange={(e) => set("nom", e.target.value)} placeholder="Journée standard ECG" />
        </Field>

        {/* ── Blocs horaires ── */}
        <div className="space-y-3">
          {p.blocs.map((bloc, idx) => {
            const N = bloc.matieres_config.length;
            const bMaxDuree = N > 0 ? Math.max(...bloc.matieres_config.map(c => c.duree_minutes)) : 0;
            const bMaxPrep = N > 0 ? Math.max(...bloc.matieres_config.map(c => c.preparation_minutes)) : 0;
            // La fenêtre horaire (heure_debut → heure_fin) fait foi : blocCapacity plafonne
            // toujours au multiple de N qui tient entièrement dedans, qu'un nb_slots manuel
            // soit saisi ou non — voir blocCapacity pour le détail du calcul et du plafonnage.
            const autoTotal = N > 0 ? blocCapacity({ ...bloc, nb_slots: null }, bloc.matieres_config) : 0;
            const total = bloc.nb_slots !== null ? blocCapacity(bloc, bloc.matieres_config) : autoTotal;
            return (
              <div key={idx} className="rounded-xl border border-black/10 bg-gray-50/60 p-4 space-y-3">
                {/* En-tête du bloc */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-gray-900">Bloc {idx + 1}</span>
                    {p.mode === "demi-journee" ? (
                      <div className="flex items-center gap-1" title="Nature de la demi-journée — déduite de l'heure de début par défaut, forçable pour un bloc « jury » parallèle qui déborde sur midi">
                        {(["MATIN", "APRES_MIDI"] as const).map((t) => (
                          <button
                            key={t}
                            type="button"
                            onClick={() => setBloc(idx, "type_demi_journee", t)}
                            className={`px-2 py-0.5 rounded-full text-[11px] font-semibold border transition ${
                              effectiveDjType(bloc) === t ? "bg-black text-white border-black" : "bg-white text-gray-700 border-black/15 hover:border-black/30"
                            }`}
                          >
                            {t === "MATIN" ? "Matin" : "Après-midi"}
                          </button>
                        ))}
                      </div>
                    ) : (
                      <span className="text-xs text-gray-700 font-medium">— {blocLabel(bloc.heure_debut, bloc.heure_fin)}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    {N > 0 && (
                      <span className="text-xs text-green-700 font-medium">
                        {bloc.nb_slots !== null
                          ? `${total} créneaux (manuel${bloc.nb_slots > total ? ", plafonné" : ""})`
                          : `${autoTotal} créneaux (max. fenêtre)`}
                      </span>
                    )}
                    {p.blocs.length > 1 && (
                      <button onClick={() => removeBloc(idx)} className="text-gray-700 hover:text-red-500 transition">
                        <X className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Matières du bloc */}
                <div className="space-y-1.5">
                  <p className="text-[11px] font-semibold text-gray-700 uppercase tracking-wide">Matières</p>
                  {activeMatieres.length === 0 ? (
                    <p className="text-xs text-amber-600">Aucune matière active — Paramétrages → Matières.</p>
                  ) : (
                    <div className="flex flex-wrap gap-1.5">
                      {activeMatieres.map(m => {
                        const checked = bloc.matieres_config.some(c => c.nom === m.intitule);
                        return (
                          <button key={m.id} type="button" onClick={() => toggleBlocMatiere(idx, m.intitule)}
                            className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition ${
                              checked ? "bg-black text-white border-black" : "bg-white text-gray-800 border-black/15 hover:border-black/30"
                            }`}
                          >
                            {m.intitule}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Durées par matière */}
                {N > 0 && (
                  <div className="rounded-lg border border-black/8 overflow-hidden">
                    <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="bg-white border-b border-black/5">
                          <th className="text-left px-3 py-1.5 text-gray-700 font-medium">Matière</th>
                          <th className="text-center px-3 py-1.5 text-gray-700 font-medium">Oral (min)</th>
                          <th className="text-center px-3 py-1.5 text-gray-700 font-medium">Prépa (min)</th>
                          <th className="text-center px-3 py-1.5 text-gray-700 font-medium" title="Même matière, mêmes horaires, plusieurs salles (1 = un seul jury). Pour faire passer ESH et HGG en même temps, ajoute plutôt un bloc en parallèle.">Jurys en parallèle</th>
                        </tr>
                      </thead>
                      <tbody>
                        {bloc.matieres_config.map((mc) => (
                          <tr key={mc.nom} className="border-b border-black/5 last:border-0 bg-white">
                            <td className="px-3 py-1.5 font-medium text-gray-900">{mc.nom}</td>
                            <td className="px-2 py-1 text-center">
                              <input type="number" value={mc.duree_minutes}
                                onChange={(e) => setBlocMatiereConfig(idx, mc.nom, "duree_minutes", Math.max(5, Number(e.target.value)))}
                                min={5} max={240}
                                className="w-14 text-center border border-black/10 rounded-lg px-1.5 py-0.5 text-xs focus:outline-none focus:ring-1 focus:ring-black/20"
                              />
                            </td>
                            <td className="px-2 py-1 text-center">
                              <input type="number" value={mc.preparation_minutes}
                                onChange={(e) => setBlocMatiereConfig(idx, mc.nom, "preparation_minutes", Math.max(0, Number(e.target.value)))}
                                min={0} max={120}
                                className="w-14 text-center border border-black/10 rounded-lg px-1.5 py-0.5 text-xs focus:outline-none focus:ring-1 focus:ring-black/20"
                              />
                            </td>
                            <td className="px-2 py-1 text-center">
                              <input type="number" value={mc.salles ?? p.salles_par_matiere}
                                onChange={(e) => setBlocMatiereConfig(idx, mc.nom, "salles", Math.max(1, Number(e.target.value)))}
                                title="Même matière, mêmes horaires, plusieurs salles (1 = un seul jury). Pour faire passer ESH et HGG en même temps, ajoute plutôt un bloc en parallèle."
                                min={1} max={50}
                                className="w-14 text-center border border-black/10 rounded-lg px-1.5 py-0.5 text-xs focus:outline-none focus:ring-1 focus:ring-black/20"
                              />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    </div>
                  </div>
                )}

                {/* Horaires du bloc */}
                {(() => {
                  const slotAdvance = bMaxDuree + bloc.pause_minutes;
                  const [sdh, sdm] = bloc.heure_debut.split(":").map(Number);
                  const startMin = sdh * 60 + sdm;
                  const pauseMidiMinutes = bloc.pause_midi_minutes ?? 0;
                  // L'insertion réelle de la pause (buildBlocRows) coûte pauseMinutes + le
                  // "rattrapage" du dernier examen avant la pause (slotDuration - interval),
                  // pas seulement pauseMinutes — sans ce surcoût, l'heure de fin calculée ici
                  // promet 1 créneau de plus que ce que buildBlocRows peut réellement générer
                  // (ex. nb_slots=14 avec pause déjeuner → seulement 13 lignes générées).
                  const pauseOverhead = (pm: number, interval: number) =>
                    pm > 0 ? pm + (bMaxPrep + bMaxDuree - interval) : 0;
                  // heure_fin inclut la pause déjeuner (durée fixe en minutes, indépendante du nb de créneaux)
                  const nbOralForFin = bloc.nb_slots ?? autoTotal;
                  const computedFinMin = nbOralForFin > 0 && slotAdvance > 0
                    ? startMin + bMaxPrep + nbOralForFin * slotAdvance + pauseOverhead(pauseMidiMinutes, slotAdvance)
                    : null;
                  const toHM = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
                  const computedFin = computedFinMin !== null ? toHM(computedFinMin) : null;
                  // Si la fin calculée dépasse la fin de bloc réellement enregistrée, les derniers
                  // créneaux demandés (nb_slots / bonus) ne rentreront pas dans la fenêtre et seront
                  // coupés à la génération (comme le fera aussi le backend à l'application réelle).
                  const [befh, befm] = bloc.heure_fin.split(":").map(Number);
                  const blocEndMin = befh * 60 + befm;
                  const depasseFenetre = computedFinMin !== null && computedFinMin > blocEndMin;

                  const updateNbSlots = (val: number | null) => {
                    setP(prev => ({
                      ...prev,
                      blocs: prev.blocs.map((b, i) => {
                        if (i !== idx) return b;
                        const sAdv = bMaxDuree + b.pause_minutes;
                        const pm = b.pause_midi_minutes ?? 0;
                        const [sh, sm] = b.heure_debut.split(":").map(Number);
                        const finMin = val !== null && sAdv > 0 ? (sh * 60 + sm) + bMaxPrep + val * sAdv + pauseOverhead(pm, sAdv) : null;
                        return { ...b, nb_slots: val, heure_fin: finMin !== null ? toHM(finMin) : b.heure_fin };
                      }),
                    }));
                  };

                  const updatePauseMidi = (minutes: number) => {
                    rememberPauseMidi(minutes);
                    setP(prev => ({
                      ...prev,
                      blocs: prev.blocs.map((b, i) => {
                        if (i !== idx) return b;
                        const sAdv = bMaxDuree + b.pause_minutes;
                        const nb = b.nb_slots ?? autoTotal;
                        const [sh, sm] = b.heure_debut.split(":").map(Number);
                        const finMin = nb > 0 && sAdv > 0 ? (sh * 60 + sm) + bMaxPrep + nb * sAdv + pauseOverhead(minutes, sAdv) : null;
                        return { ...b, pause_midi_minutes: minutes, heure_fin: finMin !== null ? toHM(finMin) : b.heure_fin };
                      }),
                    }));
                  };

                  return (
                    <div className="space-y-2">
                      <div className="grid grid-cols-4 gap-3">
                        <Field label="Début du bloc">
                          <Input type="time" value={bloc.heure_debut} onChange={(e) => setBloc(idx, "heure_debut", e.target.value)} />
                        </Field>
                        <Field label="Pause entre créneaux (min)">
                          <Input type="number" value={bloc.pause_minutes} onChange={(e) => setBloc(idx, "pause_minutes", Number(e.target.value))} min={0} max={120} />
                        </Field>
                        <Field
                          label="Nb créneaux oraux"
                          hint={
                            depasseFenetre ? `⚠ dépasse ${bloc.heure_fin} — coupé à la génération`
                            : computedFin ? `→ fin à ${computedFin}`
                            : autoTotal > 0 ? `vide = ${autoTotal} calculé` : ""
                          }
                        >
                          <Input
                            type="number"
                            value={bloc.nb_slots ?? ""}
                            placeholder={autoTotal > 0 ? String(autoTotal) : "—"}
                            onChange={(e) => updateNbSlots(e.target.value === "" ? null : Math.max(1, Number(e.target.value)))}
                            min={1}
                          />
                        </Field>
                        <Field label="Créneaux bonus" hint="urgences last-minute">
                          <Input
                            type="number"
                            value={bloc.bonus_slots ?? 0}
                            onChange={(e) => setBloc(idx, "bonus_slots", Math.max(0, Number(e.target.value)))}
                            min={0} max={50}
                          />
                        </Field>
                      </div>

                      {depasseFenetre && (
                        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 flex items-center gap-2">
                          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                          Le nombre de créneaux demandé finirait à {computedFin}, après la fin du bloc ({bloc.heure_fin}) : les derniers créneaux seront coupés à la génération, comme le fera aussi l&apos;application réelle.
                        </div>
                      )}

                      {/* Pause de midi — visible seulement en mode journée complète */}
                      {isJC && (
                        <div className="rounded-lg border border-orange-100 bg-orange-50/50 px-3 py-2.5 flex items-center gap-4">
                          <span className="text-[11px] font-semibold text-orange-700 uppercase tracking-wide shrink-0">Pause déjeuner</span>
                          <Field label="Durée (min)">
                            <Input
                              type="number"
                              value={pauseMidiMinutes}
                              onChange={(e) => updatePauseMidi(Math.max(0, Number(e.target.value)))}
                              min={0} step={5} max={600}
                              className="w-20"
                            />
                          </Field>
                          <Field label="Après le créneau n°" hint="vide = milieu auto">
                            <Input
                              type="number"
                              value={bloc.pause_midi_after ?? ""}
                              placeholder="auto"
                              onChange={(e) => setBloc(idx, "pause_midi_after", e.target.value === "" ? null : Math.max(1, Number(e.target.value)))}
                              min={1}
                            />
                          </Field>
                          {computedFin && (
                            <span className="text-xs text-orange-700 font-medium ml-auto shrink-0">
                              {bloc.nb_slots ?? autoTotal} créneaux + {pauseMidiMinutes}min de pause · fin à {computedFin}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>
            );
          })}
        </div>

        <button
          onClick={addBloc}
          className="w-full py-2 rounded-xl border border-dashed border-black/20 text-xs text-gray-700 hover:border-black/40 hover:text-black transition flex items-center justify-center gap-1.5"
        >
          <Plus className="h-3.5 w-3.5" /> Ajouter un bloc{isJC ? " (jury parallèle)" : ""}
        </button>

        <ErrorMsg msg={error} />
        <Btn label="Voir la matrice →" icon={LayoutGrid} onClick={allerMatrice} disabled={p.blocs.every(b => b.matieres_config.length === 0)} />
      </div>
    );
  }

  // ── Étape 2 ─────────────────────────────────────────────────────────────────
  const maxBlocN = Math.max(...p.blocs.map(b => b.matieres_config.length), 0);
  const totalCandidats = p.blocs.reduce((s, b) => s + blocCapacity(b, b.matieres_config ?? []) + (b.bonus_slots ?? 0), 0);
  const capacite = totalCandidats * p.salles_par_matiere;

  // Toutes les cases numérotées de la matrice, avec les horaires réels de chaque matière
  // (l'examen commence à deb_exam ; préparation et durée propres à la matière)
  const casesMatrice = (): CaseTriplet[] => matrix.flatMap((row, i) =>
    row.isPause ? [] : row.candidates.flatMap((k, j) => {
      const mc = p.blocs[row.bloc_idx]?.matieres_config[j];
      if (k < 0 || !mc) return [];
      const debExam = minutes(row.deb_exam);
      return [{ id: `${i}-${j}`, k, matiere: mc.nom, debExam, debut: debExam - mc.preparation_minutes, fin: debExam + mc.duree_minutes }];
    })
  );

  const exceptionsActuelles = exceptionsMatrice(casesMatrice());

  const pausesEtape2 = pausesEntreBlocs();

  const blocLabel = (heure_debut: string, heure_fin: string) => {
      const debutH = parseInt(heure_debut);
      const finH = parseInt(heure_fin);
      // Un bloc qui chevauche midi ne peut pas être honnêtement étiqueté "Matin" en entier
      // (c'était le cas avant : le label ne regardait que l'heure de début).
      if (debutH < 12 && finH > 12) return "Journée complète";
      return debutH < 13 ? "Matin" : "Après-midi";
    };

  return (
    <div className="space-y-4">
      <StepPills />

      {/* Récapitulatif */}
      <div className="rounded-lg bg-gray-50 border border-black/8 px-4 py-2.5 text-xs text-gray-800 flex flex-wrap gap-x-5 gap-y-1">
        <span className="font-semibold text-gray-900">{p.nom}</span>
        <span>{p.blocs.map((b, i) => b.matieres_config.length ? `Bloc ${i+1}: ${b.matieres_config.map(mc => mc.nom).join(", ")}` : null).filter(Boolean).join(" · ")}</span>
        {p.blocs.map((bloc, idx) => {
          const blocRows = matrix.filter(r => r.bloc_idx === idx);
          const oralRows = blocRows.filter(r => !r.isPause && !r.isBonus);
          const bonusRows = blocRows.filter(r => r.isBonus);
          const lastRow = blocRows.filter(r => !r.isPause).slice(-1)[0];
          return (
            <span key={idx}>
              Bloc {idx + 1} : {bloc.heure_debut} → {lastRow?.fin_exam ?? "?"} ({oralRows.length} oraux{bonusRows.length > 0 ? ` + ${bonusRows.length} bonus` : ""})
            </span>
          );
        })}
        {(() => {
          const regularTotal = p.blocs.reduce((s, b) => s + blocCapacity(b, b.matieres_config ?? []), 0);
          const bonusTotal = p.blocs.reduce((s, b) => s + (b.bonus_slots ?? 0), 0);
          return (
            <>
              <span className="font-medium text-gray-900">{totalCandidats} créneaux · {capacite} candidat(s)</span>
              {bonusTotal > 0 && (
                <span className="text-amber-600 font-medium">({regularTotal} oraux + {bonusTotal} bonus)</span>
              )}
            </>
          );
        })()}
      </div>

      {avisDisposition && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-xs text-amber-900">{avisDisposition}</div>
      )}

      {/* Barre d'outils matrice */}
      <div className="flex items-center justify-between">
        <p className="text-xs text-gray-700">
          Chaque triplet T<em>k</em> = un candidat passant {maxBlocN} épreuve(s) à des horaires décalés.
          {p.salles_par_matiere > 1 && <> · {capacite} candidats au total.</>}
        </p>
      </div>
      {/* Les échanges de triplets se font dans un seul écran, la Matrice oraux : l'assistant
          garde les positions enregistrées (appliquerDisposition) mais ne les modifie pas */}
      <p className="text-[11px] text-gray-700 -mt-2">
        Pour déplacer des triplets à la main, enregistrez la journée type puis ouvrez l&apos;onglet
        <strong> Matrice oraux</strong> : les positions déjà déplacées y sont conservées.
      </p>
      {exceptionsActuelles.length > 0 && (
        <details className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-xs text-amber-900">
          <summary className="cursor-pointer font-semibold">
            ⚠ {exceptionsActuelles.length} exception{exceptionsActuelles.length > 1 ? "s" : ""} dans cette matrice (moins de {MARGE_ENTRE_EPREUVES} min entre deux épreuves d&apos;un candidat, ou chevauchement)
          </summary>
          <ul className="mt-1.5 space-y-0.5 list-disc pl-4">
            {exceptionsActuelles.map((m) => <li key={m}>{m}</li>)}
          </ul>
        </details>
      )}

      {/* Matrice */}
      {(() => {
        const allMC = p.blocs.flatMap(b => b.matieres_config).filter((mc, i, arr) => arr.findIndex(x => x.nom === mc.nom) === i);
        const totalCols = 3 + allMC.length;
        return (
        <div className="overflow-x-auto rounded-xl border border-black/8">
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr className="bg-gray-50">
              <th className="text-left px-3 py-2 text-gray-700 font-medium border-b border-black/8 whitespace-nowrap">Dép. prépa</th>
              <th className="text-left px-3 py-2 text-gray-700 font-medium border-b border-black/8 whitespace-nowrap">Dép. exam</th>
              <th className="text-left px-3 py-2 text-gray-700 font-medium border-b border-black/8 whitespace-nowrap">Fin exam</th>
              {allMC.map((mc) => (
                <th key={mc.nom} className="text-center px-3 py-2 font-semibold border-b border-black/8 text-gray-900 whitespace-nowrap">
                  {mc.nom}
                  <span className="block text-[10px] font-normal text-gray-700">{mc.duree_minutes}' · {mc.preparation_minutes}' prépa</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {matrix.map((row, i) => {
              const isNewBloc = i === 0 || row.bloc_idx !== matrix[i - 1].bloc_idx;
              const blocMatieres = p.blocs[row.bloc_idx].matieres_config;
              return (
                <React.Fragment key={i}>
                  {isNewBloc && pausesEtape2.get(row.bloc_idx) && (
                    <tr className="border-b border-orange-100 bg-orange-50/40">
                      <td className="px-3 py-1.5 font-mono text-orange-700">{pausesEtape2.get(row.bloc_idx)!.debut}</td>
                      <td colSpan={totalCols - 1} className="px-3 py-1.5 text-[11px] font-semibold text-orange-700 tracking-wide">
                        — Pause {pausesEtape2.get(row.bloc_idx)!.debut} → {pausesEtape2.get(row.bloc_idx)!.fin} (enregistrée comme bloc pause) —
                      </td>
                    </tr>
                  )}
                  {isNewBloc && (
                    <tr>
                      <td colSpan={totalCols} className="px-3 py-1.5 bg-black/[0.04] text-[11px] font-semibold text-gray-800 uppercase tracking-wide">
                        Bloc {row.bloc_idx + 1} — {blocLabel(p.blocs[row.bloc_idx].heure_debut, p.blocs[row.bloc_idx].heure_fin)} · {p.blocs[row.bloc_idx].heure_debut} → {matrix.filter(r => r.bloc_idx === row.bloc_idx && !r.isPause).slice(-1)[0]?.fin_exam ?? p.blocs[row.bloc_idx].heure_fin}
                      </td>
                    </tr>
                  )}
                  {row.isPause ? (
                    <tr className="border-b border-orange-100 bg-orange-50/40">
                      <td className="px-3 py-1.5 font-mono text-orange-300">{row.deb_prepa}</td>
                      <td colSpan={totalCols - 1} className="px-3 py-1.5 text-[11px] font-semibold text-orange-400 tracking-wide">
                        — Pause déjeuner —
                      </td>
                    </tr>
                  ) : (
                  <tr className={`border-b last:border-0 ${row.isBonus ? "border-amber-100 bg-amber-50/50 hover:bg-amber-50" : "border-black/5 hover:bg-black/[0.015]"}`}>
                    <td className={`px-3 py-1.5 font-mono ${row.isBonus ? "text-amber-400" : "text-gray-700"}`}>{row.deb_prepa}</td>
                    <td className={`px-3 py-1.5 font-mono font-medium ${row.isBonus ? "text-amber-700" : "text-gray-900"}`}>{row.deb_exam}</td>
                    <td className={`px-3 py-1.5 font-mono ${row.isBonus ? "text-amber-400" : "text-gray-800"}`}>{row.fin_exam}</td>
                    {allMC.map((mc, globalJ) => {
                      const localJ = blocMatieres.findIndex(c => c.nom === mc.nom);
                      if (localJ === -1) {
                        return <td key={globalJ} className="px-3 py-1 text-center text-gray-700">—</td>;
                      }
                      const k = row.candidates[localJ];
                      if (k < 0) {
                        return (
                          <td key={globalJ} className="px-3 py-1 text-center text-[11px] font-medium text-amber-700" title="Créneau bonus : pas de triplet, ouvert aux urgences">
                            Bonus
                          </td>
                        );
                      }
                      return (
                        <td key={globalJ} className="px-3 py-1 text-center">
                          <span
                            className="inline-block px-2 py-0.5 rounded-full font-semibold text-[11px] text-gray-700"
                            style={{
                              backgroundColor: TRIPLET_BG[k % TRIPLET_BG.length],
                              outline: `1.5px solid ${TRIPLET_RING[k % TRIPLET_RING.length]}`,
                            }}
                          >
                            T{k + 1}
                          </span>
                          {/* Dédoublement de jury (salles_par_matiere > 1) : salles parallèles
                              en lecture seule, à côté du candidat principal ci-dessus. */}
                          {row.extraCandidates?.[localJ]?.map((k2) => (
                            <span
                              key={k2}
                              title="Jury en parallèle (même horaire)"
                              className="inline-block ml-1 px-2 py-0.5 rounded-full font-semibold text-[11px] text-gray-700 bg-black/[0.03] border border-dashed border-black/15"
                            >
                              T{k2 + 1}
                            </span>
                          ))}
                        </td>
                      );
                    })}
                  </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
        </div>
        );
      })()}

      {/* Statut initial */}
      <Field label="Statut initial des créneaux">
        <Select value={p.statut_initial} onChange={(e) => set("statut_initial", e.target.value)}>
          <option value="LIBRE">Libre (inscription ouverte)</option>
          <option value="CREE">Créé (non publié)</option>
        </Select>
      </Field>

      <ErrorMsg msg={error} />
      <div className="flex gap-2">
        <Btn label="← Retour" onClick={() => setStep(1)} variant="ghost" />
        <Btn label={loading ? "Enregistrement…" : isEdit ? "Mettre à jour" : "Enregistrer la journée type"} onClick={handleSave} disabled={loading} />
      </div>
    </div>
  );
}

// ── MatieresSelector ──────────────────────────────────────────────────────────
function MatieresSelector({
  selected,
  onChange,
}: {
  selected: string[];
  onChange: (next: string[]) => void;
}) {
  const matieres = useMatieres();
  const toggle = (m: string) =>
    onChange(selected.includes(m) ? selected.filter((x) => x !== m) : [...selected, m]);

  if (matieres.length === 0)
    return <p className="text-xs text-gray-700 italic">Aucune matière configurée — ajoutez-en dans Paramétrages → Matières.</p>;

  return (
    <div className="flex flex-wrap gap-2">
      {matieres.filter((m) => m.active).map((m) => {
        const active = selected.includes(m.intitule);
        return (
          <button
            key={m.id}
            type="button"
            onClick={() => toggle(m.intitule)}
            className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
              active
                ? "bg-black text-white border-black"
                : "bg-white text-gray-800 border-black/20 hover:border-black/40 hover:text-black"
            }`}
          >
            {m.intitule}
          </button>
        );
      })}
    </div>
  );
}

// ── EditBlocForm ───────────────────────────────────────────────────────────────
function EditBlocForm({
  bloc,
  dureeDefaut,
  pauseDefaut,
  preparationDefaut,
  onSuccess,
  onCancel,
}: {
  bloc: Bloc;
  dureeDefaut: number;
  pauseDefaut: number;
  preparationDefaut: number;
  onSuccess: (updated: Bloc) => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState({
    ordre: bloc.ordre,
    heure_debut: hm(bloc.heure_debut),
    heure_fin: hm(bloc.heure_fin),
    matieres: bloc.matieres,
    duree_minutes: bloc.duree_minutes ?? dureeDefaut,
    pause_minutes: bloc.pause_minutes ?? pauseDefaut,
    preparation_minutes: bloc.preparation_minutes ?? preparationDefaut,
    salles_par_matiere: bloc.salles_par_matiere ?? 1,
    nb_slots: bloc.nb_slots != null ? String(bloc.nb_slots) : "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const set = (k: string, v: any) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async () => {
    setLoading(true);
    setError("");
    try {
      const commun = { ordre: form.ordre, heure_debut: form.heure_debut, heure_fin: form.heure_fin };
      if (bloc.type_bloc === "GENERATION" && !form.matieres.length) throw new Error("Au moins une matière requise");
      // Un champ resté à sa valeur par défaut (bloc sans valeur propre) n'est pas envoyé
      const siModifie = <T,>(valeur: T, initiale: T, serveur: T | null) => (valeur === initiale ? serveur : valeur);
      const body = corpsBlocModifie(bloc, bloc.type_bloc === "GENERATION"
        ? {
            ...commun,
            matieres: form.matieres,
            duree_minutes: siModifie(form.duree_minutes, bloc.duree_minutes ?? dureeDefaut, bloc.duree_minutes),
            pause_minutes: siModifie(form.pause_minutes, bloc.pause_minutes ?? pauseDefaut, bloc.pause_minutes),
            preparation_minutes: siModifie(form.preparation_minutes, bloc.preparation_minutes ?? preparationDefaut, bloc.preparation_minutes),
            salles_par_matiere: form.salles_par_matiere,
            nb_slots: form.nb_slots.trim() === "" ? null : Number(form.nb_slots),
          }
        : commun);
      const updated = await put<Bloc>(`journee-types/blocs/${bloc.id}`, body);
      onSuccess(updated);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between mb-1">
        <p className="text-xs font-semibold text-gray-700 uppercase tracking-wide">
          Modifier le bloc{" "}
          <span className={`px-1.5 py-0.5 rounded-full ${bloc.type_bloc === "GENERATION" ? "bg-blue-100 text-blue-700" : "bg-orange-100 text-orange-600"}`}>
            {bloc.type_bloc}
          </span>
        </p>
        <button onClick={onCancel} className="p-1 hover:text-black text-gray-700 transition">
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Ordre">
          <Input type="number" value={form.ordre} onChange={(e) => set("ordre", Number(e.target.value))} min={1} />
        </Field>
        <div />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Heure début">
          <Input type="time" value={form.heure_debut} onChange={(e) => set("heure_debut", e.target.value)} />
        </Field>
        <Field label="Heure fin">
          <Input type="time" value={form.heure_fin} onChange={(e) => set("heure_fin", e.target.value)} />
        </Field>
      </div>
      {bloc.type_bloc === "GENERATION" && (
        <>
          <Field label="Matières">
            <MatieresSelector
              selected={form.matieres}
              onChange={(v) => set("matieres", v)}
            />
          </Field>
          <div className="grid grid-cols-3 gap-3">
            <Field label="Durée oral (min)">
              <Input type="number" value={form.duree_minutes} onChange={(e) => set("duree_minutes", Number(e.target.value))} min={5} max={240} />
            </Field>
            <Field label="Pause (min)">
              <Input type="number" value={form.pause_minutes} onChange={(e) => set("pause_minutes", Number(e.target.value))} min={0} max={120} />
            </Field>
            <Field label="Préparation (min)">
              <Input type="number" value={form.preparation_minutes} onChange={(e) => set("preparation_minutes", Number(e.target.value))} min={0} max={120} />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Jurys en parallèle" hint="même matière, mêmes horaires">
              <Input type="number" title="Même matière, mêmes horaires, plusieurs salles (1 = un seul jury). Pour faire passer ESH et HGG en même temps, ajoute plutôt un bloc en parallèle." value={form.salles_par_matiere} onChange={(e) => set("salles_par_matiere", Number(e.target.value))} min={1} max={50} />
            </Field>
            <Field label="Nb de créneaux" hint="vide = N²">
              <Input
                type="number"
                value={form.nb_slots}
                onChange={(e) => set("nb_slots", e.target.value)}
                placeholder={`N² = ${form.matieres.length ** 2}`}
                min={1}
                max={10000}
              />
            </Field>
          </div>
        </>
      )}
      <ErrorMsg msg={error} />
      <div className="flex gap-2">
        <Btn label={loading ? "Enregistrement…" : "Enregistrer"} onClick={submit} disabled={loading} small />
        <Btn label="Annuler" onClick={onCancel} small variant="ghost" />
      </div>
    </div>
  );
}
