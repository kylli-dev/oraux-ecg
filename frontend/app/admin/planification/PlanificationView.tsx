"use client";

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
  candidat_id?: number | null;
  candidat_nom?: string | null;
  candidat_prenom?: string | null;
  examinateur_id?: number | null;
  examinateur_nom?: string | null;
  examinateur_prenom?: string | null;
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

// ── API helpers ───────────────────────────────────────────────────────────────
async function apiFetch<T = unknown>(
  method: string,
  path: string,
  body?: unknown
): Promise<T> {
  const res = await fetch(`/api/backend/${path}`, {
    method,
    headers:
      body instanceof FormData
        ? {}
        : body
        ? { "Content-Type": "application/json" }
        : {},
    body: body
      ? body instanceof FormData
        ? body
        : JSON.stringify(body)
      : undefined,
    cache: "no-store",
  });
  if (res.status === 204) return null as T;
  const data = await res.json();
  if (!res.ok) throw new Error(data.detail ?? JSON.stringify(data));
  return data;
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + "T12:00:00");
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function hm(t: string) {
  return t?.slice(0, 5) ?? "";
}

function formatDate(dateStr: string): string {
  try {
    return new Date(dateStr + "T12:00:00").toLocaleDateString("fr-FR", {
      weekday: "long",
      day: "numeric",
      month: "long",
    });
  } catch {
    return dateStr;
  }
}

// ── Statut styles ─────────────────────────────────────────────────────────────
const STATUT_STYLE: Record<string, { bg: string; border: string; text: string }> = {
  LIBRE:         { bg: "#EFF6FF", border: "#BFDBFE", text: "#1D4ED8" },
  ATTRIBUEE:     { bg: "#F0FDF4", border: "#BBF7D0", text: "#15803D" },
  ANNULEE:       { bg: "#FEF2F2", border: "#FCA5A5", text: "#DC2626" },
  CREE:          { bg: "#FAF5FF", border: "#DDD6FE", text: "#7C3AED" },
  EN_EVALUATION: { bg: "#FEFCE8", border: "#FDE68A", text: "#B45309" },
  FINALISEE:     { bg: "#ECFEFF", border: "#A5F3FC", text: "#0E7490" },
};

// ── Draggable candidat chip ───────────────────────────────────────────────────
function DraggableCandidatChip({ candidat }: { candidat: Candidat }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({
      id: `candidat-${candidat.id}`,
      data: { type: "candidat", candidat },
    });

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Translate.toString(transform),
        opacity: isDragging ? 0.4 : 1,
        cursor: isDragging ? "grabbing" : "grab",
      }}
      {...listeners}
      {...attributes}
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

// ── Droppable cell (grid) ─────────────────────────────────────────────────────
function DroppableEpreuveCell({
  epreuve,
  onUnassign,
  pending,
}: {
  epreuve: EpreuveCard;
  onUnassign: (id: number) => void;
  pending: boolean;
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
      className="relative rounded-lg border-2 p-2 h-full min-h-[56px] flex flex-col justify-between transition-all duration-150"
      style={{
        backgroundColor: isOver ? "#EFF6FF" : s.bg,
        borderColor: isOver ? "#3B82F6" : s.border,
        boxShadow: isOver ? "0 0 0 3px rgba(59,130,246,0.15)" : undefined,
      }}
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
          <button
            onClick={() => onUnassign(epreuve.id)}
            className="shrink-0 text-black/20 hover:text-red-500 transition mt-0.5"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      ) : (
        <div
          className={`flex-1 flex items-center justify-center rounded border border-dashed text-[10px] transition min-h-[32px] ${
            isOver
              ? "border-blue-400 text-blue-500 bg-blue-50"
              : "border-black/15 text-black/25"
          }`}
        >
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

// ── Empty cell (no épreuve for this matière at this time) ─────────────────────
function EmptyCell() {
  return (
    <div className="rounded-lg h-full min-h-[56px] bg-black/[0.02] border border-dashed border-black/10" />
  );
}

// ── Timeline grid for one demi-journée ────────────────────────────────────────
function DemiJourneeGrid({
  dj,
  matieres,
  pendingEpreuveId,
  onUnassign,
}: {
  dj: DemiJournee;
  matieres: string[];
  pendingEpreuveId: number | null;
  onUnassign: (id: number) => void;
}) {
  const isMatin = dj.type === "MATIN";
  const accentColor = isMatin ? "#F59E0B" : "#6366F1";
  const accentBg = isMatin ? "#FFFBEB" : "#EEF2FF";

  const timeSlots = [...new Set(dj.epreuves.map((e) => e.heure_debut))].sort();
  const assigned = dj.epreuves.filter((e) => e.candidat_nom).length;

  return (
    <div className="mb-6">
      {/* Section header */}
      <div
        className="flex items-center gap-3 px-4 py-2.5 rounded-xl mb-2"
        style={{ backgroundColor: accentBg, borderLeft: `4px solid ${accentColor}` }}
      >
        {isMatin ? (
          <Sun className="h-4 w-4 shrink-0" style={{ color: accentColor }} />
        ) : (
          <Sunset className="h-4 w-4 shrink-0" style={{ color: accentColor }} />
        )}
        <div className="flex-1">
          <span className="font-semibold text-sm" style={{ color: accentColor }}>
            {isMatin ? "Matin" : "Après-midi"}
          </span>
          <span className="text-xs text-black/40 ml-2">
            {hm(dj.heure_debut)} – {hm(dj.heure_fin)}
          </span>
        </div>
        <span
          className="text-xs font-semibold px-2.5 py-0.5 rounded-full"
          style={{ backgroundColor: accentColor + "20", color: accentColor }}
        >
          {assigned}/{dj.epreuves.length} attribués
        </span>
      </div>

      {/* Grid table */}
      <div className="overflow-x-auto rounded-xl border border-black/8 bg-white">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr style={{ backgroundColor: accentColor + "10" }}>
              <th
                className="text-left px-3 py-2 text-xs font-semibold text-black/50 border-b border-black/8 w-[90px]"
              >
                Horaire
              </th>
              {matieres.map((m) => (
                <th
                  key={m}
                  className="px-3 py-2 text-xs font-semibold border-b border-black/8 text-center"
                  style={{ color: accentColor }}
                >
                  {m}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {timeSlots.map((slot, idx) => {
              const rowEpreuves = dj.epreuves.filter((e) => e.heure_debut === slot);
              const finExam = rowEpreuves[0]?.heure_fin ?? "";
              return (
                <tr
                  key={slot}
                  className={idx % 2 === 0 ? "bg-white" : "bg-black/[0.015]"}
                >
                  {/* Time column */}
                  <td className="px-3 py-2 border-b border-black/5 whitespace-nowrap">
                    <span className="font-mono text-xs font-semibold text-black/60">
                      {hm(slot)}
                    </span>
                    {finExam && (
                      <span className="font-mono text-[10px] text-black/30 block">
                        → {hm(finExam)}
                      </span>
                    )}
                  </td>

                  {/* Matière cells */}
                  {matieres.map((matiere) => {
                    const epreuve = rowEpreuves.find((e) => e.matiere === matiere);
                    return (
                      <td key={matiere} className="px-2 py-1.5 border-b border-black/5">
                        {epreuve ? (
                          <DroppableEpreuveCell
                            epreuve={epreuve}
                            onUnassign={onUnassign}
                            pending={pendingEpreuveId === epreuve.id}
                          />
                        ) : (
                          <EmptyCell />
                        )}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
            {timeSlots.length === 0 && (
              <tr>
                <td
                  colSpan={matieres.length + 1}
                  className="text-center text-xs text-black/30 py-6"
                >
                  Aucun créneau
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function PlanificationView({
  planning,
  onBack,
}: {
  planning: Planning;
  onBack: () => void;
}) {
  const [date, setDate] = useState(planning.date_debut);
  const [dayData, setDayData] = useState<DayViewData | null>(null);
  const [candidats, setCandidats] = useState<Candidat[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeDragData, setActiveDragData] = useState<{
    type: string;
    candidat?: Candidat;
  } | null>(null);
  const [pendingEpreuveId, setPendingEpreuveId] = useState<number | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } })
  );

  const loadDay = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiFetch<DayViewData>(
        "GET",
        `plannings/${planning.id}/day?date=${date}`
      );
      setDayData(data);
    } catch {
      setDayData({ planning_id: planning.id, date, demi_journees: [] });
    } finally {
      setLoading(false);
    }
  }, [planning.id, date]);

  useEffect(() => { loadDay(); }, [loadDay]);

  useEffect(() => {
    apiFetch<Candidat[]>("GET", `candidats/?planning_id=${planning.id}`)
      .then(setCandidats)
      .catch(() => {});
  }, [planning.id]);

  const assignedCandidatIds = new Set(
    (dayData?.demi_journees
      .flatMap((dj) => dj.epreuves)
      .map((e) => e.candidat_id)
      .filter(Boolean) as number[]) ?? []
  );

  async function assignCandidat(candidatId: number, epreuveId: number) {
    setPendingEpreuveId(epreuveId);
    try {
      await apiFetch("POST", `candidats/epreuves/${epreuveId}/assigner`, { candidat_id: candidatId });
      await loadDay();
    } catch (err) {
      alert((err as Error).message);
    } finally {
      setPendingEpreuveId(null);
    }
  }

  async function unassignCandidat(epreuveId: number) {
    setPendingEpreuveId(epreuveId);
    try {
      await apiFetch("POST", `candidats/epreuves/${epreuveId}/assigner`, { candidat_id: null });
      await loadDay();
    } catch (err) {
      alert((err as Error).message);
    } finally {
      setPendingEpreuveId(null);
    }
  }

  function handleDragStart(event: DragStartEvent) {
    const d = event.active.data.current;
    if (d?.type === "candidat") setActiveDragData({ type: "candidat", candidat: d.candidat });
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveDragData(null);
    const { active, over } = event;
    if (!over) return;
    const activeData = active.data.current;
    const overData = over.data.current;
    if (activeData?.type === "candidat" && overData?.type === "epreuve") {
      const epreuve: EpreuveCard = overData.epreuve;
      if (epreuve.statut === "ANNULEE") return;
      assignCandidat(activeData.candidat.id, epreuve.id);
    }
  }

  // All unique matieres across the day, sorted
  const allMatieres = [
    ...new Set(
      (dayData?.demi_journees ?? []).flatMap((dj) => dj.epreuves.map((e) => e.matiere))
    ),
  ].sort();

  const unassigned = candidats.filter((c) => !assignedCandidatIds.has(c.id));
  const assigned = candidats.filter((c) => assignedCandidatIds.has(c.id));

  return (
    <div className="h-screen flex flex-col">
      {/* Top bar */}
      <div className="shrink-0 flex flex-wrap items-center gap-3 px-4 py-3 border-b bg-white/90 backdrop-blur sticky top-0 z-20">
        <button
          onClick={onBack}
          className="h-9 w-9 rounded-lg border bg-white shadow-sm grid place-items-center hover:bg-black/[0.02] transition shrink-0"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>

        <div className="flex-1 min-w-0">
          <div className="text-[10px] text-black/40 uppercase tracking-widest font-medium">Planification</div>
          <div className="font-semibold text-sm truncate">{planning.nom}</div>
        </div>

        {/* Date nav */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setDate(addDays(date, -1))}
            disabled={date <= planning.date_debut}
            className="h-8 w-8 rounded-lg border bg-white shadow-sm grid place-items-center disabled:opacity-30 hover:bg-black/[0.02] transition"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <input
            type="date"
            value={date}
            min={planning.date_debut}
            max={planning.date_fin}
            onChange={(e) => setDate(e.target.value)}
            className="px-3 py-1.5 rounded-lg border bg-white shadow-sm text-sm focus:outline-none focus:ring-2 focus:ring-black/10"
          />
          <button
            onClick={() => setDate(addDays(date, 1))}
            disabled={date >= planning.date_fin}
            className="h-8 w-8 rounded-lg border bg-white shadow-sm grid place-items-center disabled:opacity-30 hover:bg-black/[0.02] transition"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>

        <span className="text-sm text-black/50 hidden md:block capitalize">{formatDate(date)}</span>

        <button
          onClick={loadDay}
          className="h-8 w-8 rounded-lg border bg-white shadow-sm grid place-items-center hover:bg-black/[0.02] transition"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {/* Body */}
      <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <div className="flex-1 flex min-h-0 overflow-hidden">

          {/* Left panel: candidats */}
          <div className="w-[200px] shrink-0 flex flex-col border-r bg-gray-50/80 overflow-y-auto">
            <div className="p-3 border-b bg-white sticky top-0 z-10">
              <div className="text-[10px] font-semibold text-black/50 uppercase tracking-widest mb-0.5">
                Candidats
              </div>
              <div className="text-[11px] text-black/35">
                {unassigned.length} non assigné(s)
              </div>
            </div>

            <div className="p-2.5 space-y-1.5 flex-1">
              {unassigned.length === 0 && (
                <div className="text-xs text-black/30 text-center py-6">
                  Tous assignés ✓
                </div>
              )}
              {unassigned.map((c) => (
                <DraggableCandidatChip key={c.id} candidat={c} />
              ))}

              {assigned.length > 0 && (
                <>
                  <div className="pt-3 pb-1 text-[10px] font-semibold text-black/30 uppercase tracking-widest">
                    Assignés ({assigned.length})
                  </div>
                  {assigned.map((c) => (
                    <div
                      key={c.id}
                      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs text-black/40 bg-black/[0.03]"
                    >
                      <User className="h-3 w-3 shrink-0" />
                      <span className="truncate">{c.nom} {c.prenom}</span>
                    </div>
                  ))}
                </>
              )}
            </div>
          </div>

          {/* Main: timeline grid */}
          <div className="flex-1 overflow-auto p-4 bg-gray-50/50">
            {loading ? (
              <div className="flex items-center justify-center h-full">
                <Loader2 className="h-8 w-8 animate-spin text-black/20" />
              </div>
            ) : !dayData || dayData.demi_journees.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center">
                <div className="text-4xl mb-3">📅</div>
                <div className="text-sm font-medium text-black/40">
                  Aucune demi-journée pour cette date
                </div>
                <div className="text-xs text-black/30 mt-1">
                  Appliquez un gabarit depuis la vue planning
                </div>
              </div>
            ) : (
              <>
                {dayData.demi_journees.map((dj, idx) => (
                  <div key={dj.id}>
                    <DemiJourneeGrid
                      dj={dj}
                      matieres={allMatieres}
                      pendingEpreuveId={pendingEpreuveId}
                      onUnassign={unassignCandidat}
                    />
                    {/* Pause separator between matin and après-midi */}
                    {idx < dayData.demi_journees.length - 1 && (
                      <div className="flex items-center gap-3 my-4 px-1">
                        <div className="flex-1 border-t border-dashed border-black/15" />
                        <span className="text-[11px] text-black/35 font-medium px-2">
                          Pause méridienne
                        </span>
                        <div className="flex-1 border-t border-dashed border-black/15" />
                      </div>
                    )}
                  </div>
                ))}
              </>
            )}
          </div>
        </div>

        {/* Drag overlay */}
        <DragOverlay dropAnimation={{ duration: 180, easing: "ease" }}>
          {activeDragData?.type === "candidat" && activeDragData.candidat && (
            <CandidatChipGhost candidat={activeDragData.candidat} />
          )}
        </DragOverlay>
      </DndContext>
    </div>
  );
}
