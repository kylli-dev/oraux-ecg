"use client";

/**
 * PlanificationView — Éditeur de planning avec 3 niveaux de liberté
 *
 * Niveau 1 — Configuration de session :
 *   Chaque session (demi-journée) est configurable indépendamment :
 *   heure début/fin, durée créneau, pause, nb salles, nb matières, pause méridienne.
 *
 * Niveau 2 — Édition du planning généré :
 *   Les lignes de triplet sont glissables (drag handle). Déposer sur une autre
 *   ligne effectue un échange atomique des horaires. Détection de collision
 *   en temps réel (avertissement visible, action non bloquée).
 *
 * Niveau 3 — Cas limites :
 *   Créneaux vides, triplets incomplets, sessions asymétriques — tout est autorisé
 *   et signalé visuellement sans blocage.
 */

import { useState, useEffect, useCallback } from "react";
import {
  DndContext,
  DragEndEvent,
  DragStartEvent,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
  useDraggable,
} from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import {
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  X,
  GripVertical,
  User,
  Loader2,
  Sun,
  Sunset,
  Settings2,
  Plus,
  AlertTriangle,
  CheckCircle2,
  ArrowLeftRight,
} from "lucide-react";

// ── Types ────────────────────────────────────────────────────────────────────

type Planning = {
  id: number;
  nom: string;
  date_debut: string;
  date_fin: string;
  statut: string;
};

type Candidat = {
  id: number;
  nom: string;
  prenom: string;
  email: string;
  code_acces: string;
};

type EpreuveCard = {
  id: number;
  matiere: string;
  heure_debut: string;
  heure_fin: string;
  statut: string;
  preparation_minutes?: number | null;
  candidat_id?: number | null;
  candidat_nom?: string | null;
  candidat_prenom?: string | null;
  examinateur_id?: number | null;
  examinateur_nom?: string | null;
  examinateur_prenom?: string | null;
  planche_id?: number | null;
  planche_nom?: string | null;
};

type DemiJournee = {
  id: number;
  type: string;
  heure_debut: string;
  heure_fin: string;
  epreuves: EpreuveCard[];
};

type DayViewData = {
  planning_id: number;
  date: string;
  demi_journees: DemiJournee[];
};

/** Données d'une ligne de triplet (slot = heure_debut partagée par toutes les épreuves de la ligne) */
type TripletRow = {
  slot: string;              // "HH:MM"
  epreuves: EpreuveCard[];   // toutes les épreuves à cet horaire
  isComplete: boolean;       // toutes les matières présentes
  hasAssigned: boolean;      // au moins un candidat affecté
};

// ── API helpers ───────────────────────────────────────────────────────────────

async function apiFetch<T = unknown>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`/api/backend/${path}`, {
    method,
    headers: body instanceof FormData ? {} : body ? { "Content-Type": "application/json" } : {},
    body: body ? (body instanceof FormData ? body : JSON.stringify(body)) : undefined,
    cache: "no-store",
  });
  if (res.status === 204) return null as T;
  const data = await res.json();
  if (!res.ok) throw new Error(data.detail ?? JSON.stringify(data));
  return data;
}

// ── Utilitaires ───────────────────────────────────────────────────────────────

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + "T12:00:00");
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function hm(t: string) { return t?.slice(0, 5) ?? ""; }

function hmToMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

function minutesToHm(mins: number): string {
  const h = Math.floor(((mins % 1440) + 1440) % 1440 / 60);
  const m = ((mins % 60) + 60) % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function subtractMinutes(t: string, minutes: number): string {
  return minutesToHm(hmToMinutes(t) - minutes);
}

function formatDate(dateStr: string): string {
  try {
    return new Date(dateStr + "T12:00:00").toLocaleDateString("fr-FR", {
      weekday: "long", day: "numeric", month: "long",
    });
  } catch { return dateStr; }
}

/** Construit les lignes de triplet à partir d'une demi-journée */
function buildTripletRows(dj: DemiJournee, allMatieres: string[]): TripletRow[] {
  const slotMap = new Map<string, EpreuveCard[]>();
  for (const ep of dj.epreuves) {
    const s = hm(ep.heure_debut);
    if (!slotMap.has(s)) slotMap.set(s, []);
    slotMap.get(s)!.push(ep);
  }
  return [...slotMap.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([slot, epreuves]) => ({
      slot,
      epreuves,
      isComplete: allMatieres.every(m => epreuves.some(e => e.matiere === m)),
      hasAssigned: epreuves.some(e => e.candidat_id != null),
    }));
}

// ── Constantes de style ───────────────────────────────────────────────────────

// Palette T-chip — identique à la matrice du wizard (cycle de 10 teintes)
const TRIPLET_BG   = ["#EFF6FF","#F0FDF4","#FFFBEB","#FFF7ED","#F5F3FF","#ECFEFF","#FFF1F2","#F0FAFA","#FDF4FF","#F7F7F7"];
const TRIPLET_RING = ["#BFDBFE","#BBF7D0","#FDE68A","#FED7AA","#DDD6FE","#A5F3FC","#FECDD3","#99F6E4","#E9D5FF","#E5E7EB"];
const TRIPLET_TEXT = ["#1D4ED8","#15803D","#B45309","#C2410C","#6D28D9","#0E7490","#BE123C","#0F766E","#7E22CE","#374151"];

const STATUT_STYLE: Record<string, { bg: string; border: string; text: string }> = {
  LIBRE:         { bg: "#EFF6FF", border: "#BFDBFE", text: "#1D4ED8" },
  ATTRIBUEE:     { bg: "#F0FDF4", border: "#BBF7D0", text: "#15803D" },
  ANNULEE:       { bg: "#FEF2F2", border: "#FCA5A5", text: "#DC2626" },
  CREE:          { bg: "#FAF5FF", border: "#DDD6FE", text: "#7C3AED" },
  EN_EVALUATION: { bg: "#FEFCE8", border: "#FDE68A", text: "#B45309" },
  FINALISEE:     { bg: "#ECFEFF", border: "#A5F3FC", text: "#0E7490" },
};

// ── Composant : candidat draggable ────────────────────────────────────────────

function DraggableCandidatChip({ candidat }: { candidat: Candidat }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `candidat-${candidat.id}`,
    data: { type: "candidat", candidat },
  });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), opacity: isDragging ? 0.4 : 1, cursor: isDragging ? "grabbing" : "grab" }}
      {...listeners} {...attributes}
      className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg border border-black/10 bg-white hover:border-black/20 hover:shadow-sm text-xs font-medium select-none transition"
    >
      <GripVertical className="h-3 w-3 text-black/20 shrink-0" />
      <User className="h-3 w-3 text-black/40 shrink-0" />
      <span className="truncate">{candidat.nom} {candidat.prenom}</span>
    </div>
  );
}

function CandidatChipGhost({ candidat }: { candidat: Candidat }) {
  return (
    <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg border border-blue-400 bg-blue-50 text-xs font-medium shadow-xl opacity-90 pointer-events-none">
      <GripVertical className="h-3 w-3 text-blue-400 shrink-0" />
      <User className="h-3 w-3 text-blue-500 shrink-0" />
      <span>{candidat.nom} {candidat.prenom}</span>
    </div>
  );
}

// ── Composant : ligne de triplet draggable (Niveau 2) ────────────────────────

function DraggableTripletRowHandle({
  djId, slot, hasAssigned, children
}: {
  djId: number; slot: string; hasAssigned: boolean; children: (isDragging: boolean) => React.ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `triplet-${djId}-${slot}`,
    data: { type: "triplet-row", djId, slot, hasAssigned },
  });
  return (
    <tr
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), opacity: isDragging ? 0.35 : 1 }}
    >
      <td className="px-2 py-1.5 border-b border-black/5">
        <button
          {...listeners} {...attributes}
          className="cursor-grab active:cursor-grabbing p-1 rounded hover:bg-black/5 text-black/25 hover:text-black/50 transition"
          title="Déplacer ce triplet"
        >
          <GripVertical className="h-3.5 w-3.5" />
        </button>
      </td>
      {children(isDragging)}
    </tr>
  );
}

/** Zone de dépôt pour les lignes de triplet */
function TripletRowDropZone({
  djId, slot, isActive, children
}: {
  djId: number; slot: string; isActive: boolean; children: React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: `triplet-drop-${djId}-${slot}`,
    data: { type: "triplet-row-target", djId, slot },
  });
  return (
    <tbody ref={setNodeRef} style={{ outline: isOver ? "2px solid #F59E0B" : undefined, borderRadius: 4 }}>
      {children}
    </tbody>
  );
}

// ── Composant : cellule épreuve droppable (candidat) ─────────────────────────

function DroppableEpreuveCell({ epreuve, onUnassign, pending }: {
  epreuve: EpreuveCard; onUnassign: (id: number) => void; pending: boolean;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: `epreuve-${epreuve.id}`,
    data: { type: "epreuve", epreuve },
    disabled: epreuve.statut === "ANNULEE",
  });
  const s = STATUT_STYLE[epreuve.statut] ?? { bg: "#F9FAFB", border: "#E5E7EB", text: "#374151" };
  return (
    <div
      ref={setNodeRef}
      className="relative rounded-lg border-2 p-2 h-full min-h-[52px] flex flex-col justify-between transition-all duration-150"
      style={{ backgroundColor: isOver ? "#EFF6FF" : s.bg, borderColor: isOver ? "#3B82F6" : s.border, boxShadow: isOver ? "0 0 0 3px rgba(59,130,246,0.15)" : undefined }}
    >
      {pending && (
        <div className="absolute inset-0 z-10 bg-white/70 rounded-lg grid place-items-center">
          <Loader2 className="h-3.5 w-3.5 animate-spin text-black/30" />
        </div>
      )}
      {epreuve.candidat_nom ? (
        <div className="flex items-start justify-between gap-1">
          <div className="flex items-center gap-1 min-w-0">
            <User className="h-3 w-3 shrink-0" style={{ color: s.text }} />
            <span className="text-xs font-semibold truncate" style={{ color: s.text }}>
              {epreuve.candidat_nom} {epreuve.candidat_prenom}
            </span>
          </div>
          <button onClick={() => onUnassign(epreuve.id)} className="shrink-0 text-black/20 hover:text-red-500 transition mt-0.5">
            <X className="h-3 w-3" />
          </button>
        </div>
      ) : (
        <div className={`flex-1 flex items-center justify-center rounded border border-dashed text-[10px] transition min-h-[28px] ${isOver ? "border-blue-400 text-blue-500 bg-blue-50" : "border-black/15 text-black/25"}`}>
          {isOver ? "Déposer ici" : "—"}
        </div>
      )}
      {epreuve.examinateur_nom && (
        <div className="text-[10px] text-black/35 truncate mt-1">
          {epreuve.examinateur_nom} {epreuve.examinateur_prenom}
        </div>
      )}
    </div>
  );
}

function EmptyCell() {
  return (
    <div
      className="rounded-lg h-full min-h-[52px] border border-dashed border-black/10 flex items-center justify-center"
      title="Matière absente à ce créneau (Niveau 3)"
    >
      <span className="text-[10px] text-black/20">—</span>
    </div>
  );
}

// ── Composant : panneau de configuration de session (Niveau 1) ───────────────

type SessionConfig = {
  heure_debut: string;
  heure_fin: string;
  matieres: string;          // comma-separated
  duree_minutes: number;
  pause_minutes: number;
  preparation_minutes: number;
  salles_par_matiere: number;
  nb_slots: string;          // "" = auto N²
  pause_meridienne_debut: string;
  pause_meridienne_fin: string;
};

function SessionConfigPanel({
  djId, planningId, date, type: djType, onSuccess, onCancel,
}: {
  djId: number | null;    // null = nouvelle session
  planningId: number;
  date: string;
  type: string;
  onSuccess: () => void;
  onCancel: () => void;
}) {
  const [cfg, setCfg] = useState<SessionConfig>({
    heure_debut: djType === "MATIN" ? "08:00" : "13:00",
    heure_fin: djType === "MATIN" ? "12:30" : "18:00",
    matieres: "Maths, Anglais, ESH",
    duree_minutes: 20,
    pause_minutes: 0,
    preparation_minutes: 20,
    salles_par_matiere: 6,
    nb_slots: "",
    pause_meridienne_debut: "",
    pause_meridienne_fin: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const set = (k: keyof SessionConfig, v: string | number) =>
    setCfg(prev => ({ ...prev, [k]: v }));

  const handleGenerate = async () => {
    setLoading(true);
    setError("");
    try {
      const matieres = cfg.matieres.split(/[,;]+/).map(m => m.trim()).filter(Boolean);
      if (matieres.length === 0) { setError("Au moins une matière requise"); setLoading(false); return; }

      const skip_ranges: { start: string; end: string }[] = [];
      if (cfg.pause_meridienne_debut && cfg.pause_meridienne_fin) {
        skip_ranges.push({ start: cfg.pause_meridienne_debut, end: cfg.pause_meridienne_fin });
      }

      const body = {
        date,
        type: djType,
        heure_debut: cfg.heure_debut,
        heure_fin: cfg.heure_fin,
        matieres,
        duree_minutes: Number(cfg.duree_minutes),
        pause_minutes: Number(cfg.pause_minutes),
        preparation_minutes: Number(cfg.preparation_minutes),
        salles_par_matiere: Number(cfg.salles_par_matiere),
        nb_slots: cfg.nb_slots ? Number(cfg.nb_slots) : null,
        skip_ranges,
      };

      await apiFetch("POST", `plannings/${planningId}/sessions`, body);
      onSuccess();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  const field = "text-xs border rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-amber-300 w-full";
  const label = "text-[10px] font-semibold text-black/50 uppercase tracking-wide mb-1";

  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50/40 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-amber-700">
          {djId ? "Reconfigurer la session" : `Nouvelle session — ${djType === "MATIN" ? "Matin" : "Après-midi"}`}
        </p>
        <button onClick={onCancel} className="text-black/30 hover:text-black/60"><X className="h-3.5 w-3.5" /></button>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <div>
          <p className={label}>Début</p>
          <input type="time" value={cfg.heure_debut} onChange={e => set("heure_debut", e.target.value)} className={field} />
        </div>
        <div>
          <p className={label}>Fin</p>
          <input type="time" value={cfg.heure_fin} onChange={e => set("heure_fin", e.target.value)} className={field} />
        </div>
        <div>
          <p className={label}>Durée créneau (min)</p>
          <input type="number" min={5} max={240} value={cfg.duree_minutes} onChange={e => set("duree_minutes", e.target.value)} className={field} />
        </div>
        <div>
          <p className={label}>Pause entre créneaux</p>
          <input type="number" min={0} max={120} value={cfg.pause_minutes} onChange={e => set("pause_minutes", e.target.value)} className={field} />
        </div>
        <div>
          <p className={label}>Préparation (min)</p>
          <input type="number" min={0} max={120} value={cfg.preparation_minutes} onChange={e => set("preparation_minutes", e.target.value)} className={field} />
        </div>
        <div>
          <p className={label}>Salles / matière</p>
          <input type="number" min={1} max={50} value={cfg.salles_par_matiere} onChange={e => set("salles_par_matiere", e.target.value)} className={field} />
        </div>
        <div>
          <p className={label}>Nb créneaux (vide=N²)</p>
          <input type="number" min={1} value={cfg.nb_slots} onChange={e => set("nb_slots", e.target.value)} placeholder="auto" className={field} />
        </div>
      </div>

      <div>
        <p className={label}>Matières (séparées par virgule)</p>
        <input type="text" value={cfg.matieres} onChange={e => set("matieres", e.target.value)} placeholder="ex: Maths, Anglais, ESH" className={field} />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <p className={label}>Pause méridienne — début</p>
          <input type="time" value={cfg.pause_meridienne_debut} onChange={e => set("pause_meridienne_debut", e.target.value)} className={field} />
        </div>
        <div>
          <p className={label}>Pause méridienne — fin</p>
          <input type="time" value={cfg.pause_meridienne_fin} onChange={e => set("pause_meridienne_fin", e.target.value)} className={field} />
        </div>
      </div>

      {error && (
        <div className="rounded-lg bg-red-50 border border-red-100 px-3 py-2 text-xs text-red-600">{error}</div>
      )}

      <div className="flex gap-2 justify-end">
        <button onClick={onCancel} className="text-xs text-black/40 hover:text-black/70 px-3 py-1.5">Annuler</button>
        <button
          onClick={handleGenerate}
          disabled={loading}
          className="flex items-center gap-1.5 text-xs font-semibold bg-amber-600 hover:bg-amber-700 text-white px-4 py-1.5 rounded-lg transition disabled:opacity-50"
        >
          {loading && <Loader2 className="h-3 w-3 animate-spin" />}
          {djId ? "Régénérer" : "Générer"}
        </button>
      </div>
    </div>
  );
}

// ── Grille principale d'une demi-journée ──────────────────────────────────────

function DemiJourneeGrid({
  dj, matieres, pendingEpreuveId, pendingSwap, onUnassign, onSwapRows, planningId, date, onRefresh, tripletOffset,
}: {
  dj: DemiJournee;
  matieres: string[];
  pendingEpreuveId: number | null;
  pendingSwap: string | null;
  onUnassign: (id: number) => void;
  onSwapRows: (djId: number, slotA: string, slotB: string) => void;
  planningId: number;
  date: string;
  onRefresh: () => void;
  tripletOffset: number;
}) {
  const isMatin = dj.type === "MATIN";
  const accentColor = isMatin ? "#F59E0B" : "#6366F1";
  const accentBg = isMatin ? "#FFFBEB" : "#EEF2FF";
  const [showConfig, setShowConfig] = useState(false);

  const rows = buildTripletRows(dj, matieres);
  const assigned = dj.epreuves.filter(e => e.candidat_nom).length;
  const total = dj.epreuves.length;

  // Niveau 3 : indicateurs de session
  const hasIncomplete = rows.some(r => !r.isComplete);
  const matiereSlotCounts = matieres.map(m => dj.epreuves.filter(e => e.matiere === m).length);
  const isAsymmetric = new Set(matiereSlotCounts.filter(c => c > 0)).size > 1;

  // Calcul dép. prépa pour la 1ère ligne
  const slotGapMinutes = rows.length > 1
    ? hmToMinutes(rows[1].slot) - hmToMinutes(rows[0].slot)
    : 0;

  return (
    <div className="mb-6">
      {/* En-tête de section */}
      <div
        className="flex items-center gap-3 px-4 py-2.5 rounded-xl mb-2"
        style={{ backgroundColor: accentBg, borderLeft: `4px solid ${accentColor}` }}
      >
        {isMatin ? <Sun className="h-4 w-4 shrink-0" style={{ color: accentColor }} /> : <Sunset className="h-4 w-4 shrink-0" style={{ color: accentColor }} />}
        <div className="flex-1">
          <span className="font-semibold text-sm" style={{ color: accentColor }}>
            {isMatin ? "Matin" : "Après-midi"}
          </span>
          <span className="text-xs text-black/40 ml-2">{hm(dj.heure_debut)} – {hm(dj.heure_fin)}</span>
          {rows.length > 0 && (
            <span className="text-[10px] text-black/30 ml-2">
              {rows.length} positions · {matieres.length} mat. · {dj.epreuves.filter(e => e.candidat_id == null && e.statut !== "ANNULEE").length > 0
                ? <span style={{ color: accentColor }}>{dj.epreuves.filter(e => e.candidat_id == null && e.statut !== "ANNULEE").length} libres</span>
                : "complet ✓"}
            </span>
          )}
        </div>

        {/* Niveau 3 : badges avertissements session */}
        {hasIncomplete && (
          <span title="Certaines lignes n'ont pas toutes les matières (triplets incomplets)" className="text-[10px] px-2 py-0.5 rounded-full bg-orange-100 text-orange-700 border border-orange-200 flex items-center gap-1">
            <AlertTriangle className="h-2.5 w-2.5" /> Incomplets
          </span>
        )}
        {isAsymmetric && (
          <span title="Les matières n'ont pas le même nombre de créneaux (session asymétrique)" className="text-[10px] px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 border border-purple-200 flex items-center gap-1">
            <AlertTriangle className="h-2.5 w-2.5" /> Asymétrique
          </span>
        )}

        <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full" style={{ backgroundColor: accentColor + "20", color: accentColor }}>
          {assigned}/{total} attribués
        </span>

        {/* Bouton configuration (Niveau 1) */}
        <button
          onClick={() => setShowConfig(o => !o)}
          className="h-7 w-7 rounded-lg border grid place-items-center hover:bg-black/5 transition shrink-0"
          style={{ borderColor: accentColor + "40" }}
          title="Configurer / régénérer cette session"
        >
          <Settings2 className="h-3.5 w-3.5" style={{ color: accentColor }} />
        </button>
      </div>

      {/* Panneau de configuration inline (Niveau 1) */}
      {showConfig && (
        <div className="mb-3">
          <SessionConfigPanel
            djId={dj.id}
            planningId={planningId}
            date={date}
            type={dj.type}
            onSuccess={() => { setShowConfig(false); onRefresh(); }}
            onCancel={() => setShowConfig(false)}
          />
        </div>
      )}

      {/* Grille */}
      <div className="overflow-x-auto rounded-xl border border-black/8 bg-white">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr style={{ backgroundColor: accentColor + "10" }}>
              {/* Drag handle column */}
              <th className="w-8 border-b border-black/8" />
              <th className="text-left px-3 py-2 text-xs font-semibold text-black/40 border-b border-black/8 whitespace-nowrap">Dép. prépa</th>
              <th className="text-left px-3 py-2 text-xs font-semibold text-black/60 border-b border-black/8 whitespace-nowrap">Dép. exam</th>
              <th className="text-left px-3 py-2 text-xs font-semibold text-black/40 border-b border-black/8 whitespace-nowrap">Fin</th>
              <th className="px-2 py-2 text-xs font-semibold border-b border-black/8 text-center text-black/30 w-[44px]">Triplet</th>
              {matieres.map(m => (
                <th key={m} className="px-3 py-2 text-xs font-semibold border-b border-black/8 text-center" style={{ color: accentColor }}>{m}</th>
              ))}
            </tr>
          </thead>
          {rows.map((row, idx) => {
            const debExam = row.slot;
            const finExam = row.epreuves[0]?.heure_fin ? hm(row.epreuves[0].heure_fin) : "—";
            const debPrepa = idx > 0 ? rows[idx - 1].slot : slotGapMinutes > 0 ? subtractMinutes(debExam, slotGapMinutes) : debExam;
            const isSwapping = pendingSwap === row.slot;

            return (
              <TripletRowDropZone key={row.slot} djId={dj.id} slot={row.slot} isActive={pendingSwap !== null && pendingSwap !== row.slot}>
                <DraggableTripletRowHandle djId={dj.id} slot={row.slot} hasAssigned={row.hasAssigned}>
                  {(isDragging) => (
                    <>
                      {/* Dép. prépa */}
                      <td className="px-3 py-1.5 border-b border-black/5 whitespace-nowrap">
                        <span className="font-mono text-xs text-black/40">{debPrepa}</span>
                      </td>
                      {/* Dép. exam */}
                      <td className="px-3 py-1.5 border-b border-black/5 whitespace-nowrap">
                        <span className="font-mono text-xs font-semibold text-black/75">{debExam}</span>
                      </td>
                      {/* Fin */}
                      <td className="px-3 py-1.5 border-b border-black/5 whitespace-nowrap">
                        <span className="font-mono text-xs text-black/50">{finExam}</span>
                      </td>
                      {/* Triplet T-chip */}
                      {(() => {
                        const globalIdx = tripletOffset + idx;
                        const bg   = TRIPLET_BG[globalIdx % TRIPLET_BG.length];
                        const ring = TRIPLET_RING[globalIdx % TRIPLET_RING.length];
                        const txt  = TRIPLET_TEXT[globalIdx % TRIPLET_TEXT.length];
                        return (
                          <td className="px-2 py-1.5 border-b border-black/5 text-center">
                            <div className="flex flex-col items-center gap-0.5">
                              <span
                                className="text-[11px] font-mono font-bold rounded-full px-2 py-0.5 leading-tight"
                                style={{ backgroundColor: bg, outline: `1.5px solid ${ring}`, color: txt }}
                              >
                                T{globalIdx + 1}
                              </span>
                              {/* Niveau 3 : indicateurs ligne */}
                              {!row.isComplete && (
                                <span title="Triplet incomplet : matières manquantes" className="text-[8px] text-orange-500">
                                  <AlertTriangle className="h-2.5 w-2.5" />
                                </span>
                              )}
                              {row.hasAssigned && (
                                <span title="Candidat affecté" className="text-[8px] text-green-500">
                                  <CheckCircle2 className="h-2.5 w-2.5" />
                                </span>
                              )}
                            </div>
                          </td>
                        );
                      })()}
                      {/* Cellules matières */}
                      {matieres.map(matiere => {
                        const epreuve = row.epreuves.find(e => e.matiere === matiere);
                        return (
                          <td key={matiere} className={`px-2 py-1.5 border-b border-black/5 ${!row.isComplete && !epreuve ? "bg-orange-50/30" : ""}`}>
                            {epreuve ? (
                              <DroppableEpreuveCell
                                epreuve={epreuve}
                                onUnassign={onUnassign}
                                pending={pendingEpreuveId === epreuve.id || isSwapping}
                              />
                            ) : (
                              <EmptyCell />
                            )}
                          </td>
                        );
                      })}
                    </>
                  )}
                </DraggableTripletRowHandle>
              </TripletRowDropZone>
            );
          })}
          {rows.length === 0 && (
            <tbody>
              <tr>
                <td colSpan={matieres.length + 5} className="text-center text-xs text-black/30 py-6">
                  Aucun créneau — cliquez sur ⚙ pour configurer et générer
                </td>
              </tr>
            </tbody>
          )}
        </table>
      </div>
    </div>
  );
}

// ── Fantôme pour drag de ligne de triplet ─────────────────────────────────────

function TripletRowGhost({ slot, hasAssigned }: { slot: string; hasAssigned: boolean }) {
  return (
    <div className="flex items-center gap-2 px-3 py-2 rounded-lg border-2 border-amber-400 bg-amber-50 text-xs font-medium shadow-xl opacity-90 pointer-events-none">
      <ArrowLeftRight className="h-3.5 w-3.5 text-amber-500 shrink-0" />
      <span className="font-mono font-semibold">{slot}</span>
      {hasAssigned && <span className="text-[10px] text-amber-600 ml-1">(candidat affecté)</span>}
    </div>
  );
}

// ── Composant principal ───────────────────────────────────────────────────────

export default function PlanificationView({ planning, onBack }: { planning: Planning; onBack: () => void }) {
  const [date, setDate] = useState(planning.date_debut);
  const [dayData, setDayData] = useState<DayViewData | null>(null);
  const [candidats, setCandidats] = useState<Candidat[]>([]);
  const [loading, setLoading] = useState(false);

  // Drag candidat
  const [activeDragData, setActiveDragData] = useState<{ type: string; candidat?: Candidat; slot?: string; hasAssigned?: boolean } | null>(null);
  const [pendingEpreuveId, setPendingEpreuveId] = useState<number | null>(null);

  // Drag triplet row (Niveau 2)
  const [pendingSwapSlot, setPendingSwapSlot] = useState<string | null>(null);
  const [swapWarning, setSwapWarning] = useState<string | null>(null);
  // Warning planche (persistant — fermeture manuelle)
  const [plancheWarnings, setPlancheWarnings] = useState<string[]>([]);

  // Nouvelle session (Niveau 1)
  const [newSessionType, setNewSessionType] = useState<"MATIN" | "APRES_MIDI" | null>(null);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const loadDay = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiFetch<DayViewData>("GET", `plannings/${planning.id}/day?date=${date}`);
      setDayData(data);
    } catch {
      setDayData({ planning_id: planning.id, date, demi_journees: [] });
    } finally {
      setLoading(false);
    }
  }, [planning.id, date]);

  useEffect(() => { loadDay(); }, [loadDay]);

  useEffect(() => {
    apiFetch<Candidat[]>("GET", `candidats/?planning_id=${planning.id}`).then(setCandidats).catch(() => {});
  }, [planning.id]);

  // Auto-dismiss swap warning
  useEffect(() => {
    if (!swapWarning) return;
    const t = setTimeout(() => setSwapWarning(null), 5000);
    return () => clearTimeout(t);
  }, [swapWarning]);

  const assignedCandidatIds = new Set(
    (dayData?.demi_journees ?? []).flatMap(dj => dj.epreuves).map(e => e.candidat_id).filter(Boolean) as number[]
  );

  async function assignCandidat(candidatId: number, epreuveId: number) {
    setPendingEpreuveId(epreuveId);
    try {
      const allEpreuves = (dayData?.demi_journees ?? []).flatMap(dj => dj.epreuves);
      const destEp = allEpreuves.find(e => e.id === epreuveId);
      const srcEp = allEpreuves.find(e => e.candidat_id === candidatId);

      await apiFetch("POST", `candidats/epreuves/${epreuveId}/assigner`, { candidat_id: candidatId });
      await loadDay();

      // Avertir si des planches sont concernées par ce mouvement
      const destHasPlanche = destEp?.planche_id != null;
      const srcHasPlanche = srcEp?.planche_id != null;
      if (destHasPlanche || srcHasPlanche) {
        const msgs: string[] = [];
        if (destHasPlanche) msgs.push(`Créneau ${destEp!.heure_debut} ${destEp!.matiere} : la planche « ${destEp!.planche_nom} » peut ne plus correspondre au nouveau candidat.`);
        if (srcHasPlanche) msgs.push(`Créneau ${srcEp!.heure_debut} ${srcEp!.matiere} : la planche « ${srcEp!.planche_nom} » est maintenant sans candidat.`);
        setPlancheWarnings(prev => [...prev, ...msgs]);
      }
    } catch (err) { alert((err as Error).message); }
    finally { setPendingEpreuveId(null); }
  }

  async function unassignCandidat(epreuveId: number) {
    setPendingEpreuveId(epreuveId);
    try {
      await apiFetch("POST", `candidats/epreuves/${epreuveId}/assigner`, { candidat_id: null });
      await loadDay();
    } catch (err) { alert((err as Error).message); }
    finally { setPendingEpreuveId(null); }
  }

  async function swapRows(djId: number, slotA: string, slotB: string) {
    setPendingSwapSlot(slotA);
    try {
      const result = await apiFetch<{ swapped: number; warning: string | null }>(
        "POST", `epreuves/swap-rows`, { demi_journee_id: djId, slot_a: slotA, slot_b: slotB }
      );
      if (result.warning) setSwapWarning(result.warning);
      await loadDay();
    } catch (err) { alert((err as Error).message); }
    finally { setPendingSwapSlot(null); }
  }

  function handleDragStart(event: DragStartEvent) {
    const d = event.active.data.current;
    if (d?.type === "candidat") setActiveDragData({ type: "candidat", candidat: d.candidat });
    if (d?.type === "triplet-row") setActiveDragData({ type: "triplet-row", slot: d.slot, hasAssigned: d.hasAssigned });
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveDragData(null);
    const { active, over } = event;
    if (!over) return;
    const activeData = active.data.current;
    const overData = over.data.current;

    // Cas 1 : candidat → épreuve
    if (activeData?.type === "candidat" && overData?.type === "epreuve") {
      if (overData.epreuve.statut === "ANNULEE") return;
      assignCandidat(activeData.candidat.id, overData.epreuve.id);
      return;
    }

    // Cas 2 : ligne triplet → ligne triplet cible (Niveau 2)
    if (activeData?.type === "triplet-row" && overData?.type === "triplet-row-target") {
      const slotA = activeData.slot;
      const slotB = overData.slot;
      if (slotA === slotB || activeData.djId !== overData.djId) return;
      swapRows(activeData.djId, slotA, slotB);
    }
  }

  const allMatieres = [...new Set(
    (dayData?.demi_journees ?? []).flatMap(dj => dj.epreuves.map(e => e.matiere))
  )].sort();

  const unassigned = candidats.filter(c => !assignedCandidatIds.has(c.id));
  const assigned = candidats.filter(c => assignedCandidatIds.has(c.id));

  const existingTypes = new Set((dayData?.demi_journees ?? []).map(dj => dj.type));

  return (
    <div className="h-screen flex flex-col">
      {/* Barre supérieure */}
      <div className="shrink-0 flex flex-wrap items-center gap-3 px-4 py-3 border-b bg-white/90 backdrop-blur sticky top-0 z-20">
        <button onClick={onBack} className="h-9 w-9 rounded-lg border bg-white shadow-sm grid place-items-center hover:bg-black/[0.02] transition shrink-0">
          <ChevronLeft className="h-4 w-4" />
        </button>

        <div className="flex-1 min-w-0">
          <div className="text-[10px] text-black/40 uppercase tracking-widest font-medium">Planification</div>
          <div className="font-semibold text-sm truncate">{planning.nom}</div>
        </div>

        {/* Navigation date */}
        <div className="flex items-center gap-1.5">
          <button onClick={() => setDate(addDays(date, -1))} disabled={date <= planning.date_debut}
            className="h-8 w-8 rounded-lg border bg-white shadow-sm grid place-items-center disabled:opacity-30 hover:bg-black/[0.02] transition">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <input type="date" value={date} min={planning.date_debut} max={planning.date_fin}
            onChange={e => setDate(e.target.value)}
            className="px-3 py-1.5 rounded-lg border bg-white shadow-sm text-sm focus:outline-none focus:ring-2 focus:ring-black/10" />
          <button onClick={() => setDate(addDays(date, 1))} disabled={date >= planning.date_fin}
            className="h-8 w-8 rounded-lg border bg-white shadow-sm grid place-items-center disabled:opacity-30 hover:bg-black/[0.02] transition">
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>

        <span className="text-sm text-black/50 hidden md:block capitalize">{formatDate(date)}</span>

        <button onClick={loadDay} className="h-8 w-8 rounded-lg border bg-white shadow-sm grid place-items-center hover:bg-black/[0.02] transition">
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {/* Avertissement échange de lignes (Niveau 2 — auto-dismiss) */}
      {swapWarning && (
        <div className="shrink-0 flex items-center gap-2 px-4 py-2 bg-amber-50 border-b border-amber-200 text-xs text-amber-800">
          <AlertTriangle className="h-3.5 w-3.5 text-amber-500 shrink-0" />
          {swapWarning}
          <button onClick={() => setSwapWarning(null)} className="ml-auto text-amber-500 hover:text-amber-700">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Avertissement planches (persistant — fermeture manuelle requise) */}
      {plancheWarnings.length > 0 && (
        <div className="shrink-0 px-4 py-3 bg-orange-50 border-b border-orange-300 text-xs text-orange-900">
          <div className="flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 text-orange-500 shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="font-semibold mb-1">Planches à vérifier après ce déplacement</p>
              <ul className="space-y-0.5">
                {plancheWarnings.map((w, i) => <li key={i}>• {w}</li>)}
              </ul>
              <p className="mt-1.5 text-orange-700">Rendez-vous dans la section <strong>Planches</strong> pour réassigner les sujets PDF.</p>
            </div>
            <button onClick={() => setPlancheWarnings([])} className="text-orange-400 hover:text-orange-600 shrink-0">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Corps */}
      <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <div className="flex-1 flex min-h-0 overflow-hidden">

          {/* Panneau gauche : candidats */}
          <div className="w-[200px] shrink-0 flex flex-col border-r bg-gray-50/80 overflow-y-auto">
            <div className="p-3 border-b bg-white sticky top-0 z-10">
              <div className="text-[10px] font-semibold text-black/50 uppercase tracking-widest mb-0.5">Candidats</div>
              <div className="text-[11px] text-black/35">{unassigned.length} non assigné(s)</div>
            </div>
            <div className="p-2.5 space-y-1.5 flex-1">
              {unassigned.length === 0 && <div className="text-xs text-black/30 text-center py-6">Tous assignés ✓</div>}
              {unassigned.map(c => <DraggableCandidatChip key={c.id} candidat={c} />)}
              {assigned.length > 0 && (
                <>
                  <div className="pt-3 pb-1 text-[10px] font-semibold text-black/30 uppercase tracking-widest">Assignés ({assigned.length})</div>
                  {assigned.map(c => (
                    <div key={c.id} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs text-black/40 bg-black/[0.03]">
                      <User className="h-3 w-3 shrink-0" />
                      <span className="truncate">{c.nom} {c.prenom}</span>
                    </div>
                  ))}
                </>
              )}
            </div>
          </div>

          {/* Contenu principal */}
          <div className="flex-1 overflow-auto p-4 bg-gray-50/50">
            {loading ? (
              <div className="flex items-center justify-center h-full">
                <Loader2 className="h-8 w-8 animate-spin text-black/20" />
              </div>
            ) : (
              <>
                {/* Sessions existantes */}
                {(dayData?.demi_journees ?? []).map((dj, idx) => {
                  // Offset cumulatif : nb de créneaux (slots distincts) dans les demi-journées précédentes
                  const tripletOffset = (dayData?.demi_journees ?? [])
                    .slice(0, idx)
                    .reduce((acc, prev) => {
                      const slots = new Set(prev.epreuves.map(e => hm(e.heure_debut)));
                      return acc + slots.size;
                    }, 0);
                  return (
                  <div key={dj.id}>
                    <DemiJourneeGrid
                      dj={dj}
                      matieres={allMatieres}
                      pendingEpreuveId={pendingEpreuveId}
                      pendingSwap={pendingSwapSlot}
                      onUnassign={unassignCandidat}
                      onSwapRows={swapRows}
                      planningId={planning.id}
                      date={date}
                      onRefresh={loadDay}
                      tripletOffset={tripletOffset}
                    />
                    {idx < (dayData?.demi_journees ?? []).length - 1 && (
                      <div className="flex items-center gap-3 my-4 px-1">
                        <div className="flex-1 border-t border-dashed border-black/15" />
                        <span className="text-[11px] text-black/35 font-medium px-2">Pause méridienne</span>
                        <div className="flex-1 border-t border-dashed border-black/15" />
                      </div>
                    )}
                  </div>
                  );
                })}

                {/* Boutons "Nouvelle session" si la session n'existe pas encore (Niveau 1) */}
                <div className="flex gap-3 mt-2">
                  {!existingTypes.has("MATIN") && newSessionType !== "MATIN" && (
                    <button
                      onClick={() => setNewSessionType("MATIN")}
                      className="flex items-center gap-2 text-xs font-semibold px-4 py-2 rounded-xl border-2 border-dashed border-amber-300 text-amber-600 hover:bg-amber-50 transition"
                    >
                      <Plus className="h-3.5 w-3.5" /> Session Matin
                    </button>
                  )}
                  {!existingTypes.has("APRES_MIDI") && newSessionType !== "APRES_MIDI" && (
                    <button
                      onClick={() => setNewSessionType("APRES_MIDI")}
                      className="flex items-center gap-2 text-xs font-semibold px-4 py-2 rounded-xl border-2 border-dashed border-indigo-300 text-indigo-600 hover:bg-indigo-50 transition"
                    >
                      <Plus className="h-3.5 w-3.5" /> Session Après-midi
                    </button>
                  )}
                </div>

                {/* Formulaire nouvelle session (Niveau 1) */}
                {newSessionType && (
                  <div className="mt-3">
                    <SessionConfigPanel
                      djId={null}
                      planningId={planning.id}
                      date={date}
                      type={newSessionType}
                      onSuccess={() => { setNewSessionType(null); loadDay(); }}
                      onCancel={() => setNewSessionType(null)}
                    />
                  </div>
                )}

                {/* État vide */}
                {(dayData?.demi_journees ?? []).length === 0 && !newSessionType && (
                  <div className="flex flex-col items-center justify-center min-h-[200px] text-center">
                    <div className="text-4xl mb-3">📅</div>
                    <div className="text-sm font-medium text-black/40">Aucune session pour cette date</div>
                    <div className="text-xs text-black/30 mt-1">Cliquez sur "Session Matin" ou "Session Après-midi" ci-dessus</div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* Overlay de drag */}
        <DragOverlay dropAnimation={{ duration: 180, easing: "ease" }}>
          {activeDragData?.type === "candidat" && activeDragData.candidat && (
            <CandidatChipGhost candidat={activeDragData.candidat} />
          )}
          {activeDragData?.type === "triplet-row" && activeDragData.slot && (
            <TripletRowGhost slot={activeDragData.slot} hasAssigned={activeDragData.hasAssigned ?? false} />
          )}
        </DragOverlay>
      </DndContext>
    </div>
  );
}
