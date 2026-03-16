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

// ── Statut color maps ─────────────────────────────────────────────────────────
const STATUT_BG: Record<string, string> = {
  LIBRE: "#DBEAFE",
  ATTRIBUEE: "#DCFCE7",
  ANNULEE: "#FEE2E2",
  CREE: "#F3E8FF",
  EN_EVALUATION: "#FEF9C3",
  FINALISEE: "#CFFAFE",
};
const STATUT_BORDER: Record<string, string> = {
  LIBRE: "#BFDBFE",
  ATTRIBUEE: "#BBF7D0",
  ANNULEE: "#FCA5A5",
  CREE: "#DDD6FE",
  EN_EVALUATION: "#FDE68A",
  FINALISEE: "#A5F3FC",
};
const STATUT_TEXT: Record<string, string> = {
  LIBRE: "#1D4ED8",
  ATTRIBUEE: "#15803D",
  ANNULEE: "#DC2626",
  CREE: "#7C3AED",
  EN_EVALUATION: "#B45309",
  FINALISEE: "#0E7490",
};

// ── Draggable candidat chip ───────────────────────────────────────────────────
function DraggableCandidatChip({ candidat }: { candidat: Candidat }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({
      id: `candidat-${candidat.id}`,
      data: { type: "candidat", candidat },
    });

  const style = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.4 : 1,
    cursor: isDragging ? "grabbing" : "grab",
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className="flex items-center gap-2 px-3 py-2 rounded-lg border border-black/10 bg-white hover:border-black/20 hover:shadow-sm text-sm font-medium select-none transition"
    >
      <GripVertical className="h-3.5 w-3.5 text-black/20 shrink-0" />
      <User className="h-3.5 w-3.5 text-black/40 shrink-0" />
      <span className="truncate">
        {candidat.nom} {candidat.prenom}
      </span>
    </div>
  );
}

// Ghost shown while dragging
function CandidatChipGhost({ candidat }: { candidat: Candidat }) {
  return (
    <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-blue-400 bg-blue-50 text-sm font-medium shadow-xl opacity-90 pointer-events-none">
      <GripVertical className="h-3.5 w-3.5 text-blue-400 shrink-0" />
      <User className="h-3.5 w-3.5 text-blue-500 shrink-0" />
      <span>
        {candidat.nom} {candidat.prenom}
      </span>
    </div>
  );
}

// ── Droppable épreuve card ────────────────────────────────────────────────────
function DroppableEpreuveCard({
  epreuve,
  onUnassign,
}: {
  epreuve: EpreuveCard;
  onUnassign: (epreuveId: number) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: `epreuve-${epreuve.id}`,
    data: { type: "epreuve", epreuve },
    disabled: epreuve.statut === "ANNULEE",
  });

  const bg = STATUT_BG[epreuve.statut] ?? "#F9FAFB";
  const border = STATUT_BORDER[epreuve.statut] ?? "#E5E7EB";
  const textColor = STATUT_TEXT[epreuve.statut] ?? "#374151";

  return (
    <div
      ref={setNodeRef}
      className="relative rounded-xl border-2 p-3 transition-all duration-150"
      style={{
        backgroundColor: isOver ? "#EFF6FF" : bg,
        borderColor: isOver ? "#3B82F6" : border,
        boxShadow: isOver ? "0 0 0 3px rgba(59,130,246,0.15)" : undefined,
      }}
    >
      {/* Time */}
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[11px] font-mono font-semibold text-black/40">
          {hm(epreuve.heure_debut)} – {hm(epreuve.heure_fin)}
        </span>
        <span
          className="text-[10px] font-semibold rounded-full px-2 py-0.5"
          style={{
            color: textColor,
            backgroundColor: bg,
            border: `1px solid ${border}`,
          }}
        >
          {epreuve.statut}
        </span>
      </div>

      {/* Matière */}
      <div className="font-semibold text-sm text-black/80 mb-2">
        {epreuve.matiere}
      </div>

      {/* Candidat assigned */}
      {epreuve.candidat_nom ? (
        <div className="flex items-center gap-1.5 bg-white/70 rounded-lg px-2.5 py-1.5">
          <User className="h-3 w-3 text-green-600 shrink-0" />
          <span className="text-xs font-medium text-green-800 flex-1 truncate">
            {epreuve.candidat_nom} {epreuve.candidat_prenom}
          </span>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onUnassign(epreuve.id);
            }}
            className="shrink-0 text-black/20 hover:text-red-500 transition"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      ) : (
        <div
          className={`flex items-center justify-center h-7 rounded-lg border border-dashed text-[11px] transition ${
            isOver
              ? "border-blue-400 text-blue-500 bg-blue-50"
              : "border-black/15 text-black/30"
          }`}
        >
          {isOver ? "Assigner ce candidat" : "Déposer un candidat ici"}
        </div>
      )}

      {/* Examinateur (display only) */}
      {epreuve.examinateur_nom && (
        <div className="flex items-center gap-1.5 mt-1.5 text-[11px] text-black/40">
          <span className="truncate">
            Exam.: {epreuve.examinateur_nom} {epreuve.examinateur_prenom}
          </span>
        </div>
      )}
    </div>
  );
}

// ── Droppable demi-journée column ─────────────────────────────────────────────
function DemiJourneeColumn({
  dj,
  children,
}: {
  dj: DemiJournee;
  children: React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: `dj-${dj.id}`,
    data: { type: "dj", dj },
  });

  const typeLabel = dj.type === "MATIN" ? "Matin" : "Après-midi";
  const typeColor = dj.type === "MATIN" ? "#F59E0B" : "#6366F1";

  return (
    <div className="flex flex-col min-h-0">
      {/* Column header */}
      <div
        className="sticky top-0 z-10 rounded-xl mb-3 px-4 py-3 flex items-center justify-between"
        style={{
          backgroundColor: typeColor + "18",
          borderBottom: `2px solid ${typeColor}30`,
        }}
      >
        <div>
          <div className="font-semibold text-sm" style={{ color: typeColor }}>
            {typeLabel}
          </div>
          <div className="text-xs text-black/40">
            {hm(dj.heure_debut)} – {hm(dj.heure_fin)} · {dj.epreuves.length}{" "}
            créneaux
          </div>
        </div>
        <div
          className="h-7 w-7 rounded-full grid place-items-center text-xs font-bold"
          style={{
            backgroundColor: typeColor + "30",
            color: typeColor,
          }}
        >
          {dj.epreuves.filter((e) => e.candidat_nom).length}/
          {dj.epreuves.length}
        </div>
      </div>

      {/* Epreuves */}
      <div
        ref={setNodeRef}
        className={`flex-1 space-y-2.5 rounded-xl p-3 transition-colors min-h-[120px] ${
          isOver
            ? "bg-blue-50/50 ring-2 ring-blue-200 ring-dashed"
            : "bg-black/[0.02]"
        }`}
      >
        {children}
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

  useEffect(() => {
    loadDay();
  }, [loadDay]);

  useEffect(() => {
    apiFetch<Candidat[]>("GET", `candidats/?planning_id=${planning.id}`)
      .then(setCandidats)
      .catch(() => {});
  }, [planning.id]);

  // Candidats already assigned to any épreuve on this day
  const assignedCandidatIds = new Set(
    (dayData?.demi_journees
      .flatMap((dj) => dj.epreuves)
      .map((e) => e.candidat_id)
      .filter(Boolean) as number[]) ?? []
  );

  async function assignCandidat(candidatId: number, epreuveId: number) {
    setPendingEpreuveId(epreuveId);
    try {
      await apiFetch(
        "POST",
        `candidats/epreuves/${epreuveId}/assigner`,
        { candidat_id: candidatId }
      );
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
      await apiFetch(
        "POST",
        `candidats/epreuves/${epreuveId}/assigner`,
        { candidat_id: null }
      );
      await loadDay();
    } catch (err) {
      alert((err as Error).message);
    } finally {
      setPendingEpreuveId(null);
    }
  }

  function handleDragStart(event: DragStartEvent) {
    const d = event.active.data.current;
    if (d?.type === "candidat") {
      setActiveDragData({ type: "candidat", candidat: d.candidat });
    }
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveDragData(null);
    const { active, over } = event;
    if (!over) return;

    const activeData = active.data.current;
    const overData = over.data.current;

    if (activeData?.type === "candidat" && overData?.type === "epreuve") {
      const candidat: Candidat = activeData.candidat;
      const epreuve: EpreuveCard = overData.epreuve;
      if (epreuve.statut === "ANNULEE") return;
      assignCandidat(candidat.id, epreuve.id);
    }
  }

  const unassigned = candidats.filter((c) => !assignedCandidatIds.has(c.id));
  const assigned = candidats.filter((c) => assignedCandidatIds.has(c.id));

  return (
    <div className="h-screen flex flex-col">
      {/* Top bar */}
      <div className="shrink-0 flex flex-wrap items-center gap-3 px-4 py-3 border-b bg-white/80 backdrop-blur sticky top-0 z-20">
        <button
          onClick={onBack}
          className="h-9 w-9 rounded-lg border bg-white shadow-sm grid place-items-center hover:bg-black/[0.02] transition shrink-0"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>

        <div className="flex-1 min-w-0">
          <div className="text-xs text-black/40 uppercase tracking-wide">
            Planification DnD
          </div>
          <div className="font-semibold text-sm truncate">{planning.nom}</div>
        </div>

        {/* Date nav */}
        <div className="flex items-center gap-2">
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

        <span className="text-sm text-black/40 hidden md:block">
          {formatDate(date)}
        </span>

        <button
          onClick={loadDay}
          className="h-8 w-8 rounded-lg border bg-white shadow-sm grid place-items-center hover:bg-black/[0.02] transition"
        >
          <RefreshCw
            className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`}
          />
        </button>
      </div>

      {/* Body */}
      <DndContext
        sensors={sensors}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="flex-1 flex min-h-0 overflow-hidden">
          {/* Left panel: candidats */}
          <div className="w-[220px] shrink-0 flex flex-col border-r bg-gray-50 overflow-y-auto">
            <div className="p-3 border-b bg-white sticky top-0 z-10">
              <div className="text-xs font-semibold text-black/50 uppercase tracking-wide mb-0.5">
                Candidats
              </div>
              <div className="text-[11px] text-black/30">
                {unassigned.length} non assigné(s)
              </div>
            </div>

            <div className="p-3 space-y-1.5 flex-1">
              {unassigned.length === 0 && (
                <div className="text-xs text-black/30 text-center py-6">
                  Tous les candidats sont assignés
                </div>
              )}
              {unassigned.map((c) => (
                <DraggableCandidatChip key={c.id} candidat={c} />
              ))}

              {assigned.length > 0 && (
                <>
                  <div className="pt-3 pb-1 text-[10px] font-semibold text-black/30 uppercase tracking-wide">
                    Assignés
                  </div>
                  {assigned.map((c) => (
                    <div
                      key={c.id}
                      className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-black/40 bg-black/[0.03]"
                    >
                      <User className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate">
                        {c.nom} {c.prenom}
                      </span>
                    </div>
                  ))}
                </>
              )}
            </div>
          </div>

          {/* Main: demi-journées grid */}
          <div className="flex-1 overflow-auto p-4">
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
                  Appliquez un gabarit depuis la vue journée
                </div>
              </div>
            ) : (
              <div
                className="grid gap-4"
                style={{
                  gridTemplateColumns: `repeat(${dayData.demi_journees.length}, minmax(280px, 1fr))`,
                }}
              >
                {dayData.demi_journees.map((dj) => (
                  <DemiJourneeColumn key={dj.id} dj={dj}>
                    {dj.epreuves.map((epreuve) => (
                      <div key={epreuve.id} className="relative">
                        {pendingEpreuveId === epreuve.id && (
                          <div className="absolute inset-0 z-10 bg-white/70 rounded-xl grid place-items-center">
                            <Loader2 className="h-4 w-4 animate-spin text-black/30" />
                          </div>
                        )}
                        <DroppableEpreuveCard
                          epreuve={epreuve}
                          onUnassign={unassignCandidat}
                        />
                      </div>
                    ))}
                    {dj.epreuves.length === 0 && (
                      <div className="text-center text-xs text-black/25 py-4">
                        Aucun créneau
                      </div>
                    )}
                  </DemiJourneeColumn>
                ))}
              </div>
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
