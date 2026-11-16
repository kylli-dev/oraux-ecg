"use client";

import React, { useState, useEffect } from "react";
import {
  Users,
  GraduationCap,
  BarChart3,
  BookOpen,
  TrendingUp,
  CheckCircle2,
  Clock,
} from "lucide-react";
import { Planning, STATUT_BADGE, Spinner, get, memoriserPlanning, planningMemorise } from "./commun";

type DashboardData = {
  planning_id: number;
  planning_nom: string;
  total_epreuves: number;
  by_statut: Record<string, number>;
  taux_attribution: number;
  libres: number;
  attribuees: number;
  total_candidats: number;
  candidats_avec_epreuve: number;
  total_examinateurs: number;
  examinateurs_avec_epreuve: number;
  by_matiere: { matiere: string; count: number }[];
  by_date: { date: string; count: number }[];
};
const libelleStatut = (statut: string) => STATUT_BADGE[statut]?.[1] ?? statut;


// ── Tableau de bord ─────────────────────────────────────────────────────────────
function StatCard({
  label,
  value,
  sub,
  icon: Icon,
  color = "black",
}: {
  label: string;
  value: string | number;
  sub?: string;
  icon: React.ElementType;
  color?: string;
}) {
  return (
    <div className="bg-white rounded-xl shadow-sm p-5 flex items-start gap-4">
      <div
        className="h-10 w-10 rounded-lg grid place-items-center shrink-0"
        style={{ backgroundColor: color + "15" }}
      >
        <Icon className="h-5 w-5" style={{ color }} />
      </div>
      <div>
        <div className="text-2xl font-bold tracking-tight">{value}</div>
        <div className="text-xs font-medium text-gray-800 mt-0.5">{label}</div>
        {sub && <div className="text-xs text-gray-700 mt-0.5">{sub}</div>}
      </div>
    </div>
  );
}

function ProgressBar({ value, max, color = "#C62828" }: { value: number; max: number; color?: string }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-black/8 rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
      <span className="text-xs text-gray-700 w-8 text-right">{pct}%</span>
    </div>
  );
}

export function DashboardSection() {
  const [plannings, setPlannings] = useState<Planning[]>([]);
  const [selectedPlanningId, setSelectedPlanningId] = useState<number | null>(null);
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    get<Planning[]>("plannings/").then((ps) => {
      setPlannings(ps);
      if (ps.length > 0) setSelectedPlanningId(planningMemorise(ps) ?? ps[0].id);
    }).catch(() => {});
  }, []);
  useEffect(() => memoriserPlanning(selectedPlanningId), [selectedPlanningId]);

  useEffect(() => {
    if (!selectedPlanningId) return;
    setLoading(true);
    get<DashboardData>(`plannings/${selectedPlanningId}/dashboard`)
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [selectedPlanningId]);

  const STATUT_COLORS: Record<string, string> = {
    LIBRE: "#2563EB",
    ATTRIBUEE: "#16A34A",
    ANNULEE: "#DC2626",
    CREE: "#9333EA",
    EN_EVALUATION: "#D97706",
    FINALISEE: "#0891B2",
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <BarChart3 className="h-5 w-5 text-[#C62828]" />
          <h2 className="text-lg font-semibold">Tableau de bord</h2>
        </div>
        <select
          className="border rounded-lg px-3 py-2 text-sm"
          value={selectedPlanningId ?? ""}
          onChange={(e) => setSelectedPlanningId(e.target.value ? Number(e.target.value) : null)}
        >
          {plannings.map((p) => (
            <option key={p.id} value={p.id}>{p.nom}</option>
          ))}
        </select>
      </div>

      {loading && <div className="text-center py-12"><Spinner /></div>}

      {!loading && data && (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard label="Épreuves totales" value={data.total_epreuves} icon={BookOpen} color="#C62828" />
            <StatCard
              label="Taux d'attribution"
              value={`${data.taux_attribution}%`}
              sub={`${data.attribuees} / ${data.total_epreuves}`}
              icon={TrendingUp}
              color="#16A34A"
            />
            <StatCard
              label="Candidats"
              value={data.total_candidats}
              sub={`${data.candidats_avec_epreuve} inscrits`}
              icon={Users}
              color="#2563EB"
            />
            <StatCard
              label="Examinateurs"
              value={data.total_examinateurs}
              sub={`${data.examinateurs_avec_epreuve} assignés`}
              icon={GraduationCap}
              color="#9333EA"
            />
          </div>

          {/* Statuts + Matières */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Statuts */}
            <div className="bg-white rounded-xl shadow-sm p-5">
              <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-gray-700" />
                Répartition par statut
              </h3>
              <div className="space-y-3">
                {Object.entries(data.by_statut).map(([statut, count]) => (
                  <div key={statut}>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="font-medium">{libelleStatut(statut)}</span>
                      <span className="text-gray-700">{count}</span>
                    </div>
                    <ProgressBar value={count} max={data.total_epreuves} color={STATUT_COLORS[statut] ?? "#666"} />
                  </div>
                ))}
              </div>
            </div>

            {/* Matières */}
            <div className="bg-white rounded-xl shadow-sm p-5">
              <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
                <BookOpen className="h-4 w-4 text-gray-700" />
                Épreuves par matière
              </h3>
              <div className="space-y-3">
                {data.by_matiere.map(({ matiere, count }) => (
                  <div key={matiere}>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="font-medium">{matiere}</span>
                      <span className="text-gray-700">{count}</span>
                    </div>
                    <ProgressBar value={count} max={data.total_epreuves} color="#C62828" />
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Calendrier */}
          {data.by_date.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm p-5">
              <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
                <Clock className="h-4 w-4 text-gray-700" />
                Épreuves par jour
              </h3>
              <div className="flex items-end gap-2 overflow-x-auto pb-2">
                {(() => {
                  const max = Math.max(...data.by_date.map((d) => d.count));
                  return data.by_date.map(({ date, count }) => (
                    <div key={date} className="flex flex-col items-center gap-1 min-w-[48px]">
                      <span className="text-xs text-gray-800 font-medium">{count}</span>
                      <div
                        className="w-8 rounded-t"
                        style={{
                          height: `${Math.max(4, Math.round((count / max) * 80))}px`,
                          backgroundColor: "#C62828",
                          opacity: 0.7 + (count / max) * 0.3,
                        }}
                      />
                      <span className="text-[9px] text-gray-700 rotate-45 origin-left whitespace-nowrap mt-1">
                        {new Date(date + "T12:00:00").toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}
                      </span>
                    </div>
                  ));
                })()}
              </div>
            </div>
          )}

          {data.total_epreuves === 0 && (
            <div className="bg-white rounded-xl shadow-sm p-10 text-center text-sm text-gray-700">
              Aucune épreuve générée pour ce planning.
            </div>
          )}
        </>
      )}
    </div>
  );
}
