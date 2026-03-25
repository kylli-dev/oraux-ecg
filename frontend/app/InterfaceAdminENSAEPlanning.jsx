"use client";

import React, { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronLeft, ChevronRight, LayoutGrid, Wand2, RefreshCw,
  Sun, Sunset, CheckCircle2, Lock, EyeOff,
  Plus, Trash2, ChevronUp, ChevronDown, Pencil, Check, X,
} from "lucide-react";

const ENSAE_RED = "#C62828";

// ── API ────────────────────────────────────────────────────────────────────────
async function apiFetch(method, path, body) {
  const res = await fetch(`/api/backend/${path}`, {
    method,
    headers: body ? { "Content-Type": "application/json" } : {},
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
  });
  if (res.status === 204) return null;
  const data = await res.json();
  if (!res.ok) throw new Error(data.detail ?? JSON.stringify(data));
  return data;
}

// ── Helpers ────────────────────────────────────────────────────────────────────
function minutesToHM(total) {
  const h = Math.floor(((total % 1440) + 1440) % 1440 / 60);
  const m = ((total % 60) + 60) % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function hmToMinutes(t) {
  if (!t) return 0;
  const [h, m] = t.slice(0, 5).split(":").map(Number);
  return h * 60 + m;
}

function buildMatrix(bloc, jtDefaults = {}, tripletOffset = 0) {
  const { matieres, duree_minutes, preparation_minutes, pause_minutes, heure_debut, heure_fin } = bloc;
  const N = matieres.length;
  if (N === 0) return [];
  const Nsq = N * N;
  const duree = duree_minutes ?? jtDefaults.duree_defaut_minutes ?? 20;
  const prep = preparation_minutes ?? jtDefaults.preparation_defaut_minutes ?? 0;
  const pause = pause_minutes ?? jtDefaults.pause_defaut_minutes ?? 0;
  const start = hmToMinutes(heure_debut);
  const end = heure_fin ? hmToMinutes(heure_fin) : Infinity;

  const rows = [];
  for (let i = 0; i < Nsq; i++) {
    const dPrepa = start + i * (duree + pause);
    if (dPrepa >= end) break;
    const dExam = dPrepa + prep;
    const fExam = dExam + duree;
    rows.push({
      index: i,
      deb_prepa: minutesToHM(dPrepa),
      deb_exam: minutesToHM(dExam),
      fin_exam: minutesToHM(fExam),
      overflow: fExam > end,
      // offset décale les indices pour que chaque bloc ait ses propres triplets
      candidates: matieres.map((_, j) => tripletOffset + ((i - j * N) % Nsq + Nsq) % Nsq),
    });
  }
  return rows;
}

const TRIPLET_BG = [
  "#FEF9C3","#DCFCE7","#DBEAFE","#FCE7F3","#FEE2E2",
  "#FFEDD5","#F3E8FF","#ECFDF5","#E0F2FE","#F0FDF4",
  "#FFF7ED","#EFF6FF","#FDF4FF","#F0FDFA","#FAFAFA",
];
const TRIPLET_RING = [
  "#FDE047","#86EFAC","#93C5FD","#F9A8D4","#FCA5A5",
  "#FDBA74","#D8B4FE","#6EE7B7","#7DD3FC","#4ADE80",
  "#FB923C","#60A5FA","#C084FC","#2DD4BF","#A1A1AA",
];

const STATUT_OPTIONS = [
  { value: "LIBRE",      label: "Libre",       icon: CheckCircle2, color: "#15803D", bg: "#F0FDF4" },
  { value: "PRERESERVE", label: "Préréservé",   icon: Lock,         color: "#B45309", bg: "#FFFBEB" },
  { value: "CREE",       label: "Créé",         icon: EyeOff,       color: "#7C3AED", bg: "#FAF5FF" },
];

// ── Cellule triplet ────────────────────────────────────────────────────────────
function TripletCell({ k, statut, onClick }) {
  const statutOpt = STATUT_OPTIONS.find((s) => s.value === statut) ?? STATUT_OPTIONS[0];
  return (
    <button
      onClick={() => onClick(k)}
      title={`Triplet T${k + 1} — ${statutOpt.label}`}
      className="inline-flex flex-col items-center gap-0.5 px-2.5 py-1 rounded-lg font-semibold text-[11px] text-gray-700 transition hover:scale-105 active:scale-95"
      style={{
        backgroundColor: statut !== "LIBRE" ? statutOpt.bg : TRIPLET_BG[k % TRIPLET_BG.length],
        outline: `1.5px solid ${statut !== "LIBRE" ? statutOpt.color + "60" : TRIPLET_RING[k % TRIPLET_RING.length]}`,
        color: statut !== "LIBRE" ? statutOpt.color : "#374151",
        minWidth: 48,
      }}
    >
      <span>T{k + 1}</span>
      {statut !== "LIBRE" && (
        <span className="text-[9px] font-medium opacity-80">{statutOpt.label}</span>
      )}
    </button>
  );
}

// ── Matrice journée type ───────────────────────────────────────────────────────
function MatriceJourneeType({ bloc, jt, tripletStatuts, onTripletClick, tripletOffset = 0 }) {
  const matrix = buildMatrix(bloc, jt, tripletOffset);
  const N = bloc.matieres.length;
  const Nsq = N * N;
  const isMatin = hmToMinutes(bloc.heure_debut) < 12 * 60;
  const accentColor = isMatin ? "#F59E0B" : "#6366F1";
  const accentBg = isMatin ? "#FFFBEB" : "#EEF2FF";

  if (matrix.length === 0) return null;

  return (
    <div className="mb-6">
      <div
        className="flex items-center gap-3 px-4 py-2.5 rounded-xl mb-3"
        style={{ backgroundColor: accentBg, borderLeft: `4px solid ${accentColor}` }}
      >
        {isMatin
          ? <Sun className="h-4 w-4 shrink-0" style={{ color: accentColor }} />
          : <Sunset className="h-4 w-4 shrink-0" style={{ color: accentColor }} />
        }
        <span className="font-semibold text-sm" style={{ color: accentColor }}>
          {isMatin ? "Matin" : "Après-midi"}
        </span>
        <span className="text-xs text-black/40 ml-1">
          {bloc.heure_debut?.slice(0, 5)} → {matrix[Nsq - 1]?.fin_exam}
        </span>
        <span className="ml-auto text-xs text-black/40">
          {N} matière(s) · {Nsq} créneaux · {Nsq * (bloc.salles_par_matiere ?? 1)} candidats/session
        </span>
      </div>

      <div className="overflow-x-auto rounded-xl border border-black/8 bg-white">
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr style={{ backgroundColor: accentColor + "10" }}>
              <th className="text-left px-3 py-2 text-black/40 font-medium border-b border-black/8 whitespace-nowrap">Dép. prépa</th>
              <th className="text-left px-3 py-2 text-black/60 font-semibold border-b border-black/8 whitespace-nowrap">Dép. exam</th>
              <th className="text-left px-3 py-2 text-black/40 font-medium border-b border-black/8 whitespace-nowrap">Fin exam</th>
              <th className="px-2 py-2 text-black/30 font-medium border-b border-black/8 text-center w-8">N°</th>
              {bloc.matieres.map((m) => (
                <th key={m} className="text-center px-3 py-2 font-semibold border-b border-black/8 whitespace-nowrap" style={{ color: accentColor }}>
                  {m}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {matrix.map((row, idx) => (
              <tr key={idx} className={`border-b border-black/5 last:border-0 ${idx % 2 === 0 ? "bg-white" : "bg-black/[0.012]"}`}>
                <td className="px-3 py-1.5 font-mono text-black/35">{row.deb_prepa}</td>
                <td className="px-3 py-1.5 font-mono font-semibold text-black/80">{row.deb_exam}</td>
                <td className="px-3 py-1.5 font-mono text-black/45">{row.fin_exam}</td>
                <td className="px-2 py-1.5 text-center">
                  <span className="text-[10px] font-mono font-bold text-black/25 bg-black/5 rounded px-1.5 py-0.5">
                    {idx + 1}
                  </span>
                </td>
                {row.candidates.map((k, j) => (
                  <td key={j} className="px-2 py-1.5 text-center">
                    <TripletCell k={k} statut={tripletStatuts[k] ?? "LIBRE"} onClick={onTripletClick} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Légende statuts ────────────────────────────────────────────────────────────
function LegendeStatuts({ tripletStatuts, onTripletClick, totalNsq }) {
  const groupes = STATUT_OPTIONS.map((opt) => ({
    ...opt,
    triplets: Array.from({ length: totalNsq }, (_, k) => k).filter(
      (k) => (tripletStatuts[k] ?? "LIBRE") === opt.value
    ),
  })).filter((g) => g.triplets.length > 0);

  return (
    <div className="space-y-3">
      <p className="text-xs font-semibold text-black/40 uppercase tracking-wide">
        Statut par triplet — cliquez pour changer
      </p>
      <div className="flex flex-wrap gap-2">
        {groupes.map((g) => {
          const Icon = g.icon;
          return (
            <div key={g.value} className="flex items-center gap-2 rounded-lg border px-3 py-1.5" style={{ borderColor: g.color + "40", backgroundColor: g.bg }}>
              <Icon className="h-3 w-3" style={{ color: g.color }} />
              <span className="text-xs font-medium" style={{ color: g.color }}>{g.label}</span>
              <span className="text-xs text-black/40">({g.triplets.length})</span>
            </div>
          );
        })}
      </div>
      <p className="text-[11px] text-black/35">
        Cliquez sur un triplet dans la matrice pour le basculer : Libre → Préréservé → Créé → Libre
      </p>
    </div>
  );
}

// ── Éditeur de blocs ───────────────────────────────────────────────────────────
function BlocsEditor({ jtId, blocs, onReload }) {
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [addForm, setAddForm] = useState({
    type_bloc: "GENERATION",
    heure_debut: "08:00",
    heure_fin: "12:00",
    matieres: [],
  });
  const [adding, setAdding] = useState(false);
  const [addErr, setAddErr] = useState("");
  const [allMatieres, setAllMatieres] = useState([]);

  useEffect(() => {
    apiFetch("GET", "parametrages/matieres/")
      .then((ms) => setAllMatieres((ms ?? []).filter((m) => m.active)))
      .catch(() => {});
  }, []);

  const sorted = [...blocs].sort((a, b) => a.ordre - b.ordre);

  function startEdit(bloc) {
    setEditingId(bloc.id);
    setEditForm({
      heure_debut: bloc.heure_debut?.slice(0, 5) ?? "",
      heure_fin: bloc.heure_fin?.slice(0, 5) ?? "",
      duree_minutes: bloc.duree_minutes ?? "",
      preparation_minutes: bloc.preparation_minutes ?? "",
      pause_minutes: bloc.pause_minutes ?? "",
      matieres: bloc.matieres ?? [],
    });
    setErr("");
  }

  function cancelEdit() {
    setEditingId(null);
    setErr("");
  }

  async function saveEdit(bloc) {
    setSaving(true); setErr("");
    try {
      await apiFetch("PUT", `journee-types/blocs/${bloc.id}`, {
        ordre: bloc.ordre,
        heure_debut: editForm.heure_debut,
        heure_fin: editForm.heure_fin,
        matieres: editForm.matieres ?? bloc.matieres,
        duree_minutes: editForm.duree_minutes !== "" ? Number(editForm.duree_minutes) : null,
        pause_minutes: editForm.pause_minutes !== "" ? Number(editForm.pause_minutes) : null,
        preparation_minutes: editForm.preparation_minutes !== "" ? Number(editForm.preparation_minutes) : null,
        salles_par_matiere: bloc.salles_par_matiere ?? 1,
      });
      setEditingId(null);
      onReload();
    } catch (e) { setErr(e.message); }
    finally { setSaving(false); }
  }

  async function moveBloc(bloc, direction) {
    const idx = sorted.findIndex((b) => b.id === bloc.id);
    const target = sorted[idx + direction];
    if (!target) return;
    // Swap les ordres
    await Promise.all([
      apiFetch("PUT", `journee-types/blocs/${bloc.id}`, {
        ordre: target.ordre,
        heure_debut: bloc.heure_debut?.slice(0, 5),
        heure_fin: bloc.heure_fin?.slice(0, 5),
        matieres: bloc.matieres,
        duree_minutes: bloc.duree_minutes,
        pause_minutes: bloc.pause_minutes,
        preparation_minutes: bloc.preparation_minutes,
        salles_par_matiere: bloc.salles_par_matiere ?? 1,
      }),
      apiFetch("PUT", `journee-types/blocs/${target.id}`, {
        ordre: bloc.ordre,
        heure_debut: target.heure_debut?.slice(0, 5),
        heure_fin: target.heure_fin?.slice(0, 5),
        matieres: target.matieres,
        duree_minutes: target.duree_minutes,
        pause_minutes: target.pause_minutes,
        preparation_minutes: target.preparation_minutes,
        salles_par_matiere: target.salles_par_matiere ?? 1,
      }),
    ]);
    onReload();
  }

  async function deleteBloc(bloc) {
    if (!confirm(`Supprimer ce créneau (${bloc.type_bloc} ${bloc.heure_debut?.slice(0,5)}–${bloc.heure_fin?.slice(0,5)}) ?`)) return;
    await apiFetch("DELETE", `journee-types/blocs/${bloc.id}`);
    onReload();
  }

  async function addBloc() {
    setAdding(true); setAddErr("");
    const matieres = addForm.type_bloc === "GENERATION" ? addForm.matieres : [];
    const maxOrdre = blocs.length > 0 ? Math.max(...blocs.map((b) => b.ordre)) : 0;
    try {
      await apiFetch("POST", `journee-types/${jtId}/blocs`, {
        type_bloc: addForm.type_bloc,
        ordre: maxOrdre + 1,
        heure_debut: addForm.heure_debut,
        heure_fin: addForm.heure_fin,
        matieres,
        salles_par_matiere: 1,
      });
      setShowAdd(false);
      setAddForm({ type_bloc: "GENERATION", heure_debut: "08:00", heure_fin: "12:00", matieres: [] });
      onReload();
    } catch (e) { setAddErr(e.message); }
    finally { setAdding(false); }
  }

  return (
    <div className="bg-white rounded-2xl border border-black/5 shadow-sm p-5 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-black/40 uppercase tracking-wide">Créneaux du gabarit</p>
        <button
          onClick={() => { setShowAdd(true); setAddErr(""); }}
          className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border transition hover:bg-black/[0.03]"
          style={{ borderColor: ENSAE_RED + "40", color: ENSAE_RED }}
        >
          <Plus className="h-3.5 w-3.5" /> Ajouter un créneau
        </button>
      </div>

      {/* Liste des blocs */}
      <div className="divide-y divide-black/5 rounded-xl border border-black/8 overflow-hidden">
        {sorted.length === 0 && (
          <p className="text-sm text-black/30 text-center py-6">Aucun créneau. Cliquez sur "Ajouter un créneau".</p>
        )}
        {sorted.map((bloc, idx) => {
          const isEditing = editingId === bloc.id;
          const isPause = bloc.type_bloc === "PAUSE";
          return (
            <div key={bloc.id} className={`px-4 py-3 ${isEditing ? "bg-amber-50/60 space-y-2" : "bg-white hover:bg-black/[0.01] flex items-center gap-3"}`}>
              {/* Ligne supérieure en mode édition */}
              {isEditing ? (
                <div className="flex items-center justify-between">
                  <span className={`shrink-0 text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wide ${isPause ? "bg-gray-100 text-gray-500" : "bg-blue-50 text-blue-700"}`}>
                    {isPause ? "Pause" : "Génération"}
                  </span>
                </div>
              ) : (
                <span className={`shrink-0 text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wide ${isPause ? "bg-gray-100 text-gray-500" : "bg-blue-50 text-blue-700"}`}>
                  {isPause ? "Pause" : "Génération"}
                </span>
              )}

              {/* Champs — affichage ou édition */}
              {isEditing ? (
                <div className="flex-1 space-y-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <input
                      type="time"
                      value={editForm.heure_debut}
                      onChange={(e) => setEditForm((f) => ({ ...f, heure_debut: e.target.value }))}
                      className="border rounded px-2 py-1 text-sm font-mono w-28 focus:outline-none focus:ring-1 focus:ring-amber-400"
                    />
                    <span className="text-black/30">→</span>
                    <input
                      type="time"
                      value={editForm.heure_fin}
                      onChange={(e) => setEditForm((f) => ({ ...f, heure_fin: e.target.value }))}
                      className="border rounded px-2 py-1 text-sm font-mono w-28 focus:outline-none focus:ring-1 focus:ring-amber-400"
                    />
                  </div>
                  {!isPause && (
                    <div className="flex items-center gap-3 flex-wrap">
                      <label className="flex items-center gap-1.5 text-xs text-black/50">
                        Examen
                        <input
                          type="number" min="5" max="240"
                          value={editForm.duree_minutes}
                          onChange={(e) => setEditForm((f) => ({ ...f, duree_minutes: e.target.value }))}
                          placeholder="défaut"
                          className="border rounded px-2 py-0.5 text-sm w-20 font-mono focus:outline-none focus:ring-1 focus:ring-amber-400"
                        />
                        min
                      </label>
                      <label className="flex items-center gap-1.5 text-xs text-black/50">
                        Prépa
                        <input
                          type="number" min="0" max="120"
                          value={editForm.preparation_minutes}
                          onChange={(e) => setEditForm((f) => ({ ...f, preparation_minutes: e.target.value }))}
                          placeholder="défaut"
                          className="border rounded px-2 py-0.5 text-sm w-20 font-mono focus:outline-none focus:ring-1 focus:ring-amber-400"
                        />
                        min
                      </label>
                      <label className="flex items-center gap-1.5 text-xs text-black/50">
                        Transition
                        <input
                          type="number" min="0" max="120"
                          value={editForm.pause_minutes}
                          onChange={(e) => setEditForm((f) => ({ ...f, pause_minutes: e.target.value }))}
                          placeholder="défaut"
                          className="border rounded px-2 py-0.5 text-sm w-20 font-mono focus:outline-none focus:ring-1 focus:ring-amber-400"
                        />
                        min
                      </label>
                    </div>
                  )}
                  {!isPause && allMatieres.length > 0 && (
                    <div>
                      <label className="text-[11px] text-black/40 mb-1 block">
                        Matières ({(editForm.matieres ?? []).length})
                      </label>
                      <div className="flex flex-wrap gap-1.5">
                        {allMatieres.map((m) => {
                          const sel = (editForm.matieres ?? []).includes(m.intitule);
                          return (
                            <button
                              key={m.id}
                              type="button"
                              onClick={() => setEditForm((f) => ({
                                ...f,
                                matieres: sel
                                  ? (f.matieres ?? []).filter((x) => x !== m.intitule)
                                  : [...(f.matieres ?? []), m.intitule],
                              }))}
                              className="px-2.5 py-1 rounded-lg text-xs font-medium border-2 transition"
                              style={{
                                borderColor: sel ? ENSAE_RED : "transparent",
                                backgroundColor: sel ? ENSAE_RED + "12" : "#F3F4F6",
                                color: sel ? ENSAE_RED : "#666",
                              }}
                            >
                              {m.intitule}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                  {err && <span className="text-xs text-red-500">{err}</span>}
                </div>
              ) : (
                <div className="flex-1">
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className="font-mono text-sm font-semibold text-black/80">
                      {bloc.heure_debut?.slice(0, 5)} → {bloc.heure_fin?.slice(0, 5)}
                    </span>
                    {!isPause && (
                      <span className="text-xs text-black/35 flex gap-2">
                        {bloc.duree_minutes != null && <span>exam {bloc.duree_minutes}min</span>}
                        {bloc.preparation_minutes != null && <span>· prépa {bloc.preparation_minutes}min</span>}
                        {bloc.pause_minutes != null && <span>· transition {bloc.pause_minutes}min</span>}
                      </span>
                    )}
                  </div>
                  {!isPause && bloc.matieres.length > 0 && (
                    <span className="text-xs text-black/40">{bloc.matieres.join(" · ")}</span>
                  )}
                </div>
              )}

              {/* Actions */}
              <div className={`flex items-center gap-1 ${isEditing ? "self-end" : "shrink-0"}`}>
                {isEditing ? (
                  <>
                    <button
                      onClick={() => saveEdit(bloc)}
                      disabled={saving}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white transition disabled:opacity-40"
                      style={{ backgroundColor: ENSAE_RED }}
                    >
                      <Check className="h-3.5 w-3.5" /> Enregistrer
                    </button>
                    <button
                      onClick={cancelEdit}
                      className="px-3 py-1.5 rounded-lg text-xs text-black/50 hover:bg-black/5 transition"
                    >
                      Annuler
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={() => startEdit(bloc)}
                      className="p-1.5 rounded text-black/30 hover:text-black/60 hover:bg-black/5 transition"
                      title="Modifier l'heure"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => moveBloc(bloc, -1)}
                      disabled={idx === 0}
                      className="p-1.5 rounded text-black/30 hover:text-black/60 hover:bg-black/5 transition disabled:opacity-20"
                      title="Monter"
                    >
                      <ChevronUp className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => moveBloc(bloc, 1)}
                      disabled={idx === sorted.length - 1}
                      className="p-1.5 rounded text-black/30 hover:text-black/60 hover:bg-black/5 transition disabled:opacity-20"
                      title="Descendre"
                    >
                      <ChevronDown className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => deleteBloc(bloc)}
                      className="p-1.5 rounded text-red-300 hover:text-red-500 hover:bg-red-50 transition"
                      title="Supprimer"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Formulaire d'ajout */}
      <AnimatePresence>
        {showAdd && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="rounded-xl border border-dashed border-black/15 bg-black/[0.015] p-4 space-y-3">
              <p className="text-xs font-semibold text-black/50">Nouveau créneau</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] text-black/40 mb-1 block">Type</label>
                  <select
                    value={addForm.type_bloc}
                    onChange={(e) => setAddForm((f) => ({ ...f, type_bloc: e.target.value }))}
                    className="w-full border rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-black/10"
                  >
                    <option value="GENERATION">Génération</option>
                    <option value="PAUSE">Pause</option>
                  </select>
                </div>
                <div className="flex gap-2 items-end">
                  <div className="flex-1">
                    <label className="text-[11px] text-black/40 mb-1 block">Début</label>
                    <input
                      type="time"
                      value={addForm.heure_debut}
                      onChange={(e) => setAddForm((f) => ({ ...f, heure_debut: e.target.value }))}
                      className="w-full border rounded-lg px-2 py-1.5 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-black/10"
                    />
                  </div>
                  <div className="flex-1">
                    <label className="text-[11px] text-black/40 mb-1 block">Fin</label>
                    <input
                      type="time"
                      value={addForm.heure_fin}
                      onChange={(e) => setAddForm((f) => ({ ...f, heure_fin: e.target.value }))}
                      className="w-full border rounded-lg px-2 py-1.5 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-black/10"
                    />
                  </div>
                </div>
              </div>

              {addForm.type_bloc === "GENERATION" && (
                <div>
                  <label className="text-[11px] text-black/40 mb-1 block">
                    Matières sélectionnées ({addForm.matieres.length})
                  </label>
                  {allMatieres.length === 0 ? (
                    <p className="text-xs text-black/30 italic">Aucune matière configurée (voir Paramètres → Matières)</p>
                  ) : (
                    <div className="flex flex-wrap gap-1.5">
                      {allMatieres.map((m) => {
                        const sel = addForm.matieres.includes(m.intitule);
                        return (
                          <button
                            key={m.id}
                            type="button"
                            onClick={() => setAddForm((f) => ({
                              ...f,
                              matieres: sel
                                ? f.matieres.filter((x) => x !== m.intitule)
                                : [...f.matieres, m.intitule],
                            }))}
                            className="px-2.5 py-1 rounded-lg text-xs font-medium border-2 transition"
                            style={{
                              borderColor: sel ? ENSAE_RED : "transparent",
                              backgroundColor: sel ? ENSAE_RED + "12" : "#F3F4F6",
                              color: sel ? ENSAE_RED : "#666",
                            }}
                          >
                            {m.intitule}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {addErr && <p className="text-xs text-red-500">{addErr}</p>}

              <div className="flex gap-2">
                <button
                  onClick={addBloc}
                  disabled={adding || (addForm.type_bloc === "GENERATION" && addForm.matieres.length === 0)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-white transition disabled:opacity-40"
                  style={{ backgroundColor: ENSAE_RED }}
                >
                  {adding ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                  Ajouter
                </button>
                <button
                  onClick={() => { setShowAdd(false); setAddErr(""); }}
                  className="px-3 py-1.5 rounded-lg text-sm text-black/50 hover:bg-black/5 transition"
                >
                  Annuler
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Composant principal ────────────────────────────────────────────────────────
export default function InterfaceAdminENSAEPlanning() {
  const [journeeTypes, setJourneeTypes] = useState([]);
  const [plannings, setPlannings] = useState([]);
  const [selectedJT, setSelectedJT] = useState(null);
  const [blocs, setBlocs] = useState([]);
  const [loading, setLoading] = useState(false);

  const [tripletStatuts, setTripletStatuts] = useState({});
  const [selPlanningId, setSelPlanningId] = useState("");
  const [applyDate, setApplyDate] = useState("");
  const [applying, setApplying] = useState(false);
  const [applyResult, setApplyResult] = useState(null);
  const [applyError, setApplyError] = useState("");

  useEffect(() => {
    apiFetch("GET", "journee-types/").then(setJourneeTypes).catch(() => {});
    apiFetch("GET", "plannings/").then(setPlannings).catch(() => {});
  }, []);

  const loadBlocs = useCallback(async (jt) => {
    if (!jt) { setBlocs([]); setTripletStatuts({}); return; }
    setLoading(true);
    try {
      const b = await apiFetch("GET", `journee-types/${jt.id}/blocs`);
      setBlocs(b ?? []);
      setTripletStatuts({});
    } catch {
      setBlocs([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleSelectJT = (jt) => {
    setSelectedJT(jt);
    setApplyResult(null);
    setApplyError("");
    loadBlocs(jt);
  };

  const handleTripletClick = useCallback((k) => {
    setTripletStatuts((prev) => {
      const current = prev[k] ?? "LIBRE";
      const next = current === "LIBRE" ? "PRERESERVE" : current === "PRERESERVE" ? "CREE" : "LIBRE";
      if (next === "LIBRE") {
        const { [k]: _, ...rest } = prev;
        return rest;
      }
      return { ...prev, [k]: next };
    });
  }, []);

  const handleApply = async () => {
    if (!selectedJT || !selPlanningId || !applyDate) return;
    setApplying(true);
    setApplyResult(null);
    setApplyError("");
    try {
      const res = await apiFetch("POST", `plannings/${selPlanningId}/apply-journee-type`, {
        journee_type_id: selectedJT.id,
        date: applyDate,
      });
      setApplyResult(res);
    } catch (e) {
      setApplyError(e.message);
    } finally {
      setApplying(false);
    }
  };

  const blocGeneration = blocs.filter((b) => b.type_bloc === "GENERATION");
  const selPlanning = plannings.find((p) => p.id === Number(selPlanningId)) ?? null;
  const N = blocGeneration[0]?.matieres?.length ?? 0;
  // Nsq total = somme des N² de chaque bloc (chaque bloc a ses propres triplets)
  const Nsq = blocGeneration.reduce((s, b) => s + b.matieres.length ** 2, 0) || N * N;

  return (
    <div className="min-h-screen bg-[#F5F5F5] text-black">
      <div className="max-w-6xl mx-auto px-4 md:px-8 py-8 space-y-6">

        {/* En-tête */}
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl grid place-items-center text-white" style={{ backgroundColor: ENSAE_RED }}>
            <LayoutGrid className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-black/90">Journée type — Vue matricielle</h1>
            <p className="text-xs text-black/40">Sélectionnez un gabarit pour visualiser et modifier les créneaux</p>
          </div>
        </div>

        {/* Sélection journée type */}
        <div className="bg-white rounded-2xl border border-black/5 shadow-sm p-5">
          <p className="text-xs font-semibold text-black/40 uppercase tracking-wide mb-3">Gabarit de journée</p>
          {journeeTypes.length === 0 ? (
            <p className="text-sm text-black/30">Aucune journée type disponible. Créez-en une dans l'onglet "Journées types".</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {journeeTypes.map((jt) => {
                const isActive = selectedJT?.id === jt.id;
                return (
                  <button
                    key={jt.id}
                    onClick={() => handleSelectJT(isActive ? null : jt)}
                    className="flex flex-col items-start px-4 py-2.5 rounded-xl border-2 transition text-left"
                    style={{
                      borderColor: isActive ? ENSAE_RED : "transparent",
                      backgroundColor: isActive ? ENSAE_RED + "08" : "#F9FAFB",
                    }}
                  >
                    <span className="text-sm font-semibold text-black/80">{jt.nom}</span>
                    <span className="text-[11px] text-black/40 mt-0.5">
                      {jt.duree_defaut_minutes}min · prép. {jt.preparation_defaut_minutes}min
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Matrice + panneau droite */}
        <AnimatePresence>
          {selectedJT && (
            <motion.div
              key={selectedJT.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              className="flex gap-5 items-start"
            >
              {/* Gauche : matrice + éditeur */}
              <div className="flex-1 min-w-0 space-y-4">
                {loading ? (
                  <div className="flex items-center justify-center py-20">
                    <RefreshCw className="h-6 w-6 animate-spin text-black/20" />
                  </div>
                ) : (
                  <>
                    {/* Matrice */}
                    {blocGeneration.length === 0 ? (
                      <div className="bg-white rounded-2xl border border-black/5 shadow-sm p-10 text-center">
                        <LayoutGrid className="h-8 w-8 mx-auto mb-3 text-black/15" />
                        <p className="text-sm text-black/40">Ce gabarit n'a pas de bloc GENERATION.</p>
                        <p className="text-xs text-black/25 mt-1">Ajoutez un créneau ci-dessous.</p>
                      </div>
                    ) : (
                      <>
                        {blocGeneration.reduce((acc, bloc) => {
                          const offset = acc.offset;
                          const Nb = bloc.matieres.length;
                          acc.els.push(
                            <MatriceJourneeType
                              key={bloc.id}
                              bloc={bloc}
                              jt={selectedJT}
                              tripletStatuts={tripletStatuts}
                              onTripletClick={handleTripletClick}
                              tripletOffset={offset}
                            />
                          );
                          acc.offset += Nb * Nb;
                          return acc;
                        }, { els: [], offset: 0 }).els}
                        {Nsq > 0 && (
                          <div className="bg-white rounded-2xl border border-black/5 shadow-sm p-5">
                            <LegendeStatuts tripletStatuts={tripletStatuts} onTripletClick={handleTripletClick} totalNsq={Nsq} />
                          </div>
                        )}
                      </>
                    )}

                    {/* Éditeur de créneaux */}
                    <BlocsEditor
                      jtId={selectedJT.id}
                      blocs={blocs}
                      onReload={() => loadBlocs(selectedJT)}
                    />
                  </>
                )}
              </div>

              {/* Droite : appliquer au planning */}
              <div className="w-72 shrink-0 bg-white rounded-2xl border border-black/5 shadow-sm p-5 space-y-4 sticky top-6">
                <p className="text-xs font-semibold text-black/40 uppercase tracking-wide">
                  Appliquer au planning
                </p>

                <div className="space-y-3">
                  <div>
                    <label className="text-xs text-black/50 mb-1 block">Planning</label>
                    <select
                      value={selPlanningId}
                      onChange={(e) => { setSelPlanningId(e.target.value); setApplyResult(null); setApplyError(""); }}
                      className="w-full rounded-lg border border-black/15 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black/10 bg-white"
                    >
                      <option value="">— Choisir —</option>
                      {plannings.map((p) => (
                        <option key={p.id} value={p.id}>{p.nom}</option>
                      ))}
                    </select>
                  </div>

                  {selPlanning && (
                    <div>
                      <label className="text-xs text-black/50 mb-1 block">Date</label>
                      <input
                        type="date"
                        value={applyDate}
                        min={selPlanning.date_debut}
                        max={selPlanning.date_fin}
                        onChange={(e) => { setApplyDate(e.target.value); setApplyResult(null); setApplyError(""); }}
                        className="w-full rounded-lg border border-black/15 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black/10"
                      />
                    </div>
                  )}

                  <button
                    onClick={handleApply}
                    disabled={applying || !selPlanningId || !applyDate || !selectedJT}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium text-white transition disabled:opacity-40"
                    style={{ backgroundColor: ENSAE_RED }}
                  >
                    {applying ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
                    {applying ? "Application…" : "Appliquer ce gabarit"}
                  </button>

                  {applyResult && (
                    <div className="flex flex-col gap-1">
                      <div className="rounded-lg bg-emerald-50 border border-emerald-200 px-3 py-2 text-xs text-emerald-700">
                        ✓ {applyResult.demi_journees_created} demi-journée(s) — {applyResult.epreuves_created} épreuve(s) créée(s)
                      </div>
                      {applyResult.warnings?.map((w, i) => (
                        <div key={i} className="rounded-lg bg-amber-50 border border-amber-300 px-3 py-2 text-xs text-amber-800">
                          ⚠ {w}
                        </div>
                      ))}
                    </div>
                  )}
                  {applyError && (
                    <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-600">
                      {applyError}
                    </div>
                  )}
                </div>

                {/* Résumé JT */}
                {selectedJT && N > 0 && (
                  <div className="pt-4 border-t border-black/5 space-y-1.5">
                    <p className="text-[10px] text-black/30 font-semibold uppercase tracking-wide">Résumé</p>
                    <div className="text-xs text-black/50 space-y-1">
                      <div className="flex justify-between">
                        <span>Matières</span>
                        <span className="font-medium text-black/70">{N}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Créneaux / session</span>
                        <span className="font-medium text-black/70">{Nsq}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Salles / matière</span>
                        <span className="font-medium text-black/70">{blocGeneration[0]?.salles_par_matiere ?? 1}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Capacité / session</span>
                        <span className="font-medium text-black/70">{Nsq * (blocGeneration[0]?.salles_par_matiere ?? 1)} candidats</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Triplets libres</span>
                        <span className="font-medium text-emerald-600">{Nsq - Object.keys(tripletStatuts).length}</span>
                      </div>
                      {Object.keys(tripletStatuts).length > 0 && (
                        <div className="flex justify-between">
                          <span>Triplets non-libres</span>
                          <span className="font-medium text-amber-600">{Object.keys(tripletStatuts).length}</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Nav journée */}
                {selPlanning && applyDate && (
                  <div className="pt-3 border-t border-black/5">
                    <p className="text-[10px] text-black/30 font-semibold uppercase tracking-wide mb-2">Navigation</p>
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => {
                          const d = new Date(applyDate + "T12:00:00");
                          d.setDate(d.getDate() - 1);
                          const s = d.toISOString().slice(0, 10);
                          if (s >= selPlanning.date_debut) setApplyDate(s);
                        }}
                        disabled={applyDate <= selPlanning.date_debut}
                        className="h-7 w-7 rounded border grid place-items-center disabled:opacity-30 hover:bg-black/[0.03] transition"
                      >
                        <ChevronLeft className="h-3.5 w-3.5" />
                      </button>
                      <span className="flex-1 text-center text-xs text-black/60 font-medium">{applyDate}</span>
                      <button
                        onClick={() => {
                          const d = new Date(applyDate + "T12:00:00");
                          d.setDate(d.getDate() + 1);
                          const s = d.toISOString().slice(0, 10);
                          if (s <= selPlanning.date_fin) setApplyDate(s);
                        }}
                        disabled={applyDate >= selPlanning.date_fin}
                        className="h-7 w-7 rounded border grid place-items-center disabled:opacity-30 hover:bg-black/[0.03] transition"
                      >
                        <ChevronRight className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
