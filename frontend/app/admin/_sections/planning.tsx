"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { useToast, useConfirm } from "../Toast";
import { dateApplication, resumeGabarits } from "../gabaritsAppliques";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Plus,
  Trash2,
  Loader2,
  RefreshCw,
  Wand2,
  Download,
  Edit2,
} from "lucide-react";
import {
  ApplyForm,
  BandeauTripletsSansNumero,
  Btn,
  DayViewData,
  DemiJournee,
  EPREUVE_STATUT_LABEL,
  Empty,
  Epreuve,
  EpreuveFlat,
  ErrorMsg,
  Field,
  Input,
  JourneeType,
  LiensManques,
  LigneManque,
  Modal,
  Planning,
  RED,
  Select,
  Spinner,
  StatutBadge,
  TripletDisponible,
  addDays,
  del,
  formatDate,
  formatDateCourte,
  get,
  heurePrepa,
  hm,
  manquesPublication,
  post,
  put,
  statutEpreuveCls,
  useFiltre,
} from "./commun";

// Téléchargement CSV (séparateur « ; » + BOM : s'ouvre directement dans Excel en français)
function telechargerCsv(nomFichier: string, entetes: string[], lignes: (string | number | null | undefined)[][]) {
  const cell = (v: string | number | null | undefined) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const contenu = [entetes, ...lignes].map((l) => l.map(cell).join(";")).join("\r\n");
  const blob = new Blob(["﻿" + contenu], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = nomFichier;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

// Nom de fichier sans caractères problématiques (accents conservés)
function slugFichier(s: string): string {
  return s.trim().replace(/[\\/:*?"<>|\s]+/g, "_");
}

// ── Section : Plannings ────────────────────────────────────────────────────────
export function PlanningsSection({
  onSelect,
}: {
  onSelect: (p: Planning) => void;
}) {
  const toast = useToast();
  const confirm = useConfirm();
  const [plannings, setPlannings] = useState<Planning[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [editPlanning, setEditPlanning] = useState<Planning | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setPlannings(await get<Planning[]>("plannings/"));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleDelete = async (id: number) => {
    if (!await confirm("Supprimer ce planning et toutes ses données ?", { confirmLabel: "Supprimer", danger: true })) return;
    try {
      await del(`plannings/${id}`);
      toast.success("Planning supprimé");
      load();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : String(e));
    }
  };

  const handleExport = (id: number) => {
    const a = document.createElement("a");
    a.href = `/api/backend/plannings/${id}/export`;
    a.download = `planning_${id}.xlsx`;
    a.click();
  };

  const TRANSITIONS: Record<string, { label: string; next: string; color: string }[]> = {
    BROUILLON: [{ label: "Ouvrir", next: "OUVERT", color: "bg-green-600 text-white hover:bg-green-700" }],
    OUVERT:    [
      { label: "Fermer", next: "CLOS", color: "bg-gray-600 text-white hover:bg-gray-700" },
      { label: "Repasser en brouillon", next: "BROUILLON", color: "bg-yellow-500 text-white hover:bg-yellow-600" },
    ],
    CLOS:      [{ label: "Rouvrir", next: "OUVERT", color: "bg-green-600 text-white hover:bg-green-700" }],
  };

  const handleStatut = async (id: number, statut: string) => {
    try {
      await post(`plannings/${id}/statut`, { statut });
      const label = statut === "OUVERT" ? "Planning ouvert" : statut === "CLOS" ? "Planning fermé" : "Statut mis à jour";
      toast.success(label);
      load();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-semibold">Plannings</h2>
          <p className="text-sm text-gray-700 mt-0.5">
            Gérez vos sessions d&apos;oraux
          </p>
        </div>
        <Btn
          label="Créer un planning"
          icon={Plus}
          onClick={() => setShowCreate(true)}
        />
      </div>

      {loading ? (
        <div className="flex justify-center py-16 text-gray-700">
          <Spinner />
        </div>
      ) : error ? (
        <ErrorMsg msg={error} />
      ) : plannings.length === 0 ? (
        <Empty
          message="Aucun planning"
          sub="Créez votre premier planning pour commencer."
        />
      ) : (
        <div className="rounded-xl border bg-white shadow-sm overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[#F5F5F5] text-left">
                {["Nom", "Période", "Statut", "Actions"].map((h) => (
                  <th
                    key={h}
                    className="px-5 py-3.5 text-xs font-semibold text-gray-800 tracking-wide"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {plannings.map((p) => (
                <tr
                  key={p.id}
                  className="border-t border-black/5 hover:bg-black/[0.012] transition"
                >
                  <td className="px-5 py-3.5 font-medium">{p.nom}</td>
                  <td className="px-5 py-3.5 text-gray-800 text-xs whitespace-nowrap">
                    {formatDateCourte(p.date_debut)} &rarr; {formatDateCourte(p.date_fin)}
                  </td>
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <StatutBadge statut={p.statut} />
                      {(TRANSITIONS[p.statut] ?? []).map((t) => (
                        <button
                          key={t.next}
                          onClick={() => handleStatut(p.id, t.next)}
                          className={`text-[11px] font-semibold px-2.5 py-1 rounded-lg transition ${t.color}`}
                        >
                          {t.label}
                        </button>
                      ))}
                    </div>
                  </td>
                  <td className="px-5 py-3.5">
                    {/* Aligné à gauche : le titre « Actions » est au-dessus du bouton « Voir » */}
                    <div className="flex items-center gap-2 whitespace-nowrap">
                      <div className="flex items-center gap-0.5 rounded-lg border border-black/10 p-0.5">
                        <Btn
                          label="Voir"
                          onClick={() => onSelect(p)}
                          small
                          variant="ghost"
                          icon={CalendarDays}
                        />
                        <Btn
                          label="Modifier"
                          onClick={() => setEditPlanning(p)}
                          small
                          variant="ghost"
                          icon={Edit2}
                        />
                        <Btn
                          label="Export"
                          onClick={() => handleExport(p.id)}
                          small
                          variant="ghost"
                          icon={Download}
                        />
                      </div>
                      <Btn
                        label="Supprimer"
                        onClick={() => handleDelete(p.id)}
                        small
                        variant="danger"
                        icon={Trash2}
                      />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        title="Créer un planning"
      >
        <CreatePlanningForm
          onSuccess={() => {
            setShowCreate(false);
            toast.success("Planning créé");
            load();
          }}
        />
      </Modal>

      <Modal
        open={!!editPlanning}
        onClose={() => setEditPlanning(null)}
        title="Modifier le planning"
      >
        {editPlanning && (
          <EditPlanningForm
            planning={editPlanning}
            onSuccess={() => {
              setEditPlanning(null);
              toast.success("Planning modifié");
              load();
            }}
          />
        )}
      </Modal>

    </div>
  );
}

function EditPlanningForm({
  planning,
  onSuccess,
}: {
  planning: Planning;
  onSuccess: () => void;
}) {
  const [form, setForm] = useState({
    nom: planning.nom,
    date_debut: planning.date_debut,
    date_fin: planning.date_fin,
    date_ouverture_inscriptions: (planning.date_ouverture_inscriptions ?? "").slice(0, 16),
    date_fermeture_inscriptions: (planning.date_fermeture_inscriptions ?? "").slice(0, 16),
    statut: planning.statut,
    heure_previs: planning.heure_previs ?? "16:00",
    envoyer_convocations: planning.envoyer_convocations ?? true,
    interdire_modification_candidat: planning.interdire_modification_candidat ?? false,
    interdire_changement_creneau: planning.interdire_changement_creneau ?? false,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const setF = (k: string, v: string | boolean) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async () => {
    setLoading(true);
    setError("");
    try {
      await put(`plannings/${planning.id}`, form);
      onSuccess();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <Field label="Nom du planning">
        <Input value={form.nom} onChange={(e) => setF("nom", e.target.value)} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Date de début">
          <Input type="date" value={form.date_debut} onChange={(e) => setF("date_debut", e.target.value)} />
        </Field>
        <Field label="Date de fin">
          <Input type="date" value={form.date_fin} onChange={(e) => setF("date_fin", e.target.value)} />
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Ouverture inscriptions">
          <Input type="datetime-local" value={form.date_ouverture_inscriptions} onChange={(e) => setF("date_ouverture_inscriptions", e.target.value)} />
        </Field>
        <Field label="Fermeture inscriptions">
          <Input type="datetime-local" value={form.date_fermeture_inscriptions} onChange={(e) => setF("date_fermeture_inscriptions", e.target.value)} />
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Statut">
          <Select value={form.statut} onChange={(e) => setF("statut", e.target.value)}>
            <option value="BROUILLON">BROUILLON</option>
            <option value="OUVERT">OUVERT</option>
            <option value="CLOS">CLOS</option>
          </Select>
        </Field>
        <Field label="Heure de préavis">
          <Input type="time" value={form.heure_previs} onChange={(e) => setF("heure_previs", e.target.value)} />
        </Field>
      </div>
      <div className="space-y-2 rounded-xl border border-black/8 bg-gray-50/60 px-4 py-3">
        <p className="text-[11px] font-semibold text-gray-700 uppercase tracking-wide mb-1">Paramètres</p>
        {([
          { key: "envoyer_convocations", label: "Envoyer les convocations aux candidats" },
          { key: "interdire_modification_candidat", label: "Interdire la modification par le candidat" },
          { key: "interdire_changement_creneau", label: "Interdire le changement de créneau" },
        ] as { key: keyof typeof form; label: string }[]).map(({ key, label }) => (
          <label key={key} className="flex items-center gap-2.5 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={form[key] as boolean}
              onChange={(e) => setF(key, e.target.checked)}
              className="w-4 h-4 rounded border-black/20 accent-black"
            />
            <span className="text-sm text-gray-900">{label}</span>
          </label>
        ))}
      </div>
      <ErrorMsg msg={error} />
      <Btn
        label={loading ? "Enregistrement…" : "Enregistrer"}
        onClick={submit}
        disabled={loading || !form.nom}
      />
    </div>
  );
}

function CreatePlanningForm({ onSuccess }: { onSuccess: () => void }) {
  const today = new Date().toISOString().slice(0, 10);
  const [form, setForm] = useState({
    nom: "",
    date_debut: today,
    date_fin: "",
    date_ouverture_inscriptions: "",
    date_fermeture_inscriptions: "",
    statut: "BROUILLON",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async () => {
    const payload = {
      ...form,
      date_ouverture_inscriptions: form.date_ouverture_inscriptions || `${form.date_debut}T00:00`,
      date_fermeture_inscriptions: form.date_fermeture_inscriptions || `${form.date_fin}T23:59`,
    };
    setLoading(true);
    setError("");
    try {
      await post("plannings/", form);
      onSuccess();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <Field label="Nom du planning">
        <Input
          value={form.nom}
          onChange={(e) => set("nom", e.target.value)}
          placeholder="Oraux ECG 2026"
        />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Date de début">
          <Input
            type="date"
            value={form.date_debut}
            onChange={(e) => set("date_debut", e.target.value)}
          />
        </Field>
        <Field label="Date de fin">
          <Input
            type="date"
            value={form.date_fin}
            onChange={(e) => set("date_fin", e.target.value)}
          />
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Ouverture inscriptions">
          <Input
            type="datetime-local"
            value={form.date_ouverture_inscriptions}
            onChange={(e) => set("date_ouverture_inscriptions", e.target.value)}
          />
        </Field>
        <Field label="Fermeture inscriptions">
          <Input
            type="datetime-local"
            value={form.date_fermeture_inscriptions}
            onChange={(e) =>
              set("date_fermeture_inscriptions", e.target.value)
            }
          />
        </Field>
      </div>
      <Field label="Statut initial">
        <Select
          value={form.statut}
          onChange={(e) => set("statut", e.target.value)}
        >
          <option value="BROUILLON">BROUILLON</option>
          <option value="OUVERT">OUVERT</option>
        </Select>
      </Field>
      <ErrorMsg msg={error} />
      <Btn
        label={loading ? "Création…" : "Créer le planning"}
        onClick={submit}
        disabled={loading || !form.nom || !form.date_debut || !form.date_fin}
      />
    </div>
  );
}

// ── Vue tableau complet du planning ───────────────────────────────────────────
function hmToMin(hm: string): number {
  const [h, m] = hm.split(":").map(Number);
  return h * 60 + m;
}
function minToHm(total: number): string {
  const h = Math.floor(total / 60) % 24;
  const m = total % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function statutBadgeCell(statut: string) {
  if (statut === "LIBRE")
    return <span className="inline-block px-1.5 py-0.5 rounded text-xs font-medium bg-green-100 text-green-700">Libre</span>;
  if (statut === "PRERESERVEE")
    return <span className="inline-block px-1.5 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-700">Prérés.</span>;
  if (statut === "ATTRIBUEE")
    return <span className="inline-block px-1.5 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-700">Réservé</span>;
  if (statut === "EN_EVALUATION")
    return <span className="inline-block px-1.5 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-700">En éval.</span>;
  if (statut === "FINALISEE")
    return <span className="inline-block px-1.5 py-0.5 rounded text-xs font-medium bg-gray-200 text-gray-700">Finalisé</span>;
  return <span className="inline-block px-1.5 py-0.5 rounded text-xs bg-gray-100 text-gray-700">{statut}</span>;
}

function rowStatut(byMat: Record<string, EpreuveFlat[]>): string {
  const all = Object.values(byMat).flat();
  if (all.length === 0) return "CREE";
  const statuts = new Set(all.map((e) => e.statut));
  if (statuts.has("ATTRIBUEE") || statuts.has("FINALISEE") || statuts.has("EN_EVALUATION")) return "ATTRIBUEE";
  if (statuts.has("LIBRE")) return "LIBRE";
  if (statuts.has("PRERESERVEE")) return "PRERESERVEE";
  return all[0].statut;
}

function PlanningTableauView({ planningId, planning }: { planningId: number; planning: Planning }) {
  const toast = useToast();
  const confirm = useConfirm();
  const [epreuves, setEpreuves] = useState<EpreuveFlat[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterDate, setFilterDate] = useFiltre<string>("tableau:date", "", planningId);
  const [filterStatut, setFilterStatut] = useFiltre<string>("tableau:statut", "", planningId);
  // "" = tous, "__sans" = épreuves sans numéro de matrice, sinon « T5 »
  const [filterTriplet, setFilterTriplet] = useFiltre<string>("tableau:triplet", "", planningId);
  const [selectedDates, setSelectedDates] = useState<Set<string>>(new Set());
  const [deletingDays, setDeletingDays] = useState(false);

  // Cliquer-glisser pour défiler horizontalement (curseur "main") — même logique que
  // SyncedScrollX (seuil de 3px pour ne pas interférer avec un simple clic sur une case à
  // cocher / un menu déroulant), appliquée directement au conteneur existant plutôt qu'un
  // wrapper séparé : ce tableau gère déjà son propre défilement vertical au même endroit.
  const scrollRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);
  const drag = useRef({ active: false, startX: 0, startScrollLeft: 0, moved: 0 });
  const onScrollPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    if (target.closest("select, input, button, option, a")) return;
    if (!scrollRef.current) return;
    drag.current = { active: true, startX: e.clientX, startScrollLeft: scrollRef.current.scrollLeft, moved: 0 };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onScrollPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!drag.current.active || !scrollRef.current) return;
    const dx = e.clientX - drag.current.startX;
    drag.current.moved = Math.max(drag.current.moved, Math.abs(dx));
    if (drag.current.moved > 3) setDragging(true);
    scrollRef.current.scrollLeft = drag.current.startScrollLeft - dx;
  };
  const endScrollDrag = () => {
    drag.current.active = false;
    setDragging(false);
  };

  const loadEpreuves = useCallback(() => {
    setLoading(true);
    return get<EpreuveFlat[]>(`plannings/${planningId}/epreuves`)
      .then(setEpreuves)
      .catch(() => setEpreuves([]))
      .finally(() => setLoading(false));
  }, [planningId]);

  useEffect(() => { loadEpreuves(); }, [loadEpreuves]);

  // Suppression d'une ou plusieurs journées déjà affectées (démi-journées + épreuves en
  // cascade côté backend) — avertit explicitement si des candidats sont déjà inscrits sur
  // ces créneaux avant de confirmer, cette inscription (triplet) serait alors incomplète.
  const deleteSelectedDays = async () => {
    if (selectedDates.size === 0) return;
    const concerned = epreuves.filter((e) => selectedDates.has(e.date));
    const avecCandidat = concerned.filter((e) => e.candidat_id != null).length;
    const dateList = Array.from(selectedDates).sort().map((d) => formatDate(d)).join(", ");
    const warning = avecCandidat > 0
      ? ` ⚠ ${avecCandidat} épreuve(s) déjà attribuée(s) à un candidat seront perdues (leur inscription au triplet restera incomplète sur les 2 autres matières).`
      : "";
    const ok = await confirm(
      `Supprimer ${selectedDates.size} journée(s) (${dateList}) — ${concerned.length} épreuve(s) au total ?${warning}`,
      { confirmLabel: "Supprimer", danger: true }
    );
    if (!ok) return;
    setDeletingDays(true);
    try {
      await Promise.all(
        Array.from(selectedDates).map((d) => del(`plannings/${planningId}/day?date=${d}`))
      );
      toast.success(`${selectedDates.size} journée(s) supprimée(s)`);
      setSelectedDates(new Set());
      await loadEpreuves();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Erreur");
    } finally {
      setDeletingDays(false);
    }
  };

  if (loading) return <div className="flex justify-center py-16 text-gray-700"><Spinner /></div>;
  if (epreuves.length === 0)
    return <Empty message="Aucun créneau" sub="Appliquez un gabarit pour générer les créneaux du planning." />;

  // Dates et matières disponibles
  const dates = [...new Set(epreuves.map((e) => e.date))].sort();
  const matieres = [...new Set(epreuves.map((e) => e.matiere))].sort();

  // Filtrage
  const filtered = epreuves
    .filter((e) => !filterDate || e.date === filterDate)
    .filter((e) => !filterStatut || e.statut === filterStatut)
    .filter((e) => !filterTriplet || (filterTriplet === "__sans" ? !e.triplet : e.triplet === filterTriplet));
  const triplets = [...new Set(epreuves.flatMap((e) => (e.triplet ? [e.triplet] : [])))]
    .sort((a, b) => Number(a.slice(1)) - Number(b.slice(1)));

  // Construction des lignes : (date, heure_debut) → byMat
  type SlotRow = { date: string; heure_debut: string; heure_fin: string; byMat: Record<string, EpreuveFlat[]> };
  const slotMap = new Map<string, SlotRow>();
  for (const e of filtered) {
    const key = `${e.date}|${e.heure_debut}`;
    if (!slotMap.has(key))
      slotMap.set(key, { date: e.date, heure_debut: e.heure_debut, heure_fin: e.heure_fin, byMat: {} });
    const row = slotMap.get(key)!;
    if (!row.byMat[e.matiere]) row.byMat[e.matiere] = [];
    row.byMat[e.matiere].push(e);
  }
  const rows = [...slotMap.values()].sort((a, b) =>
    a.date !== b.date ? a.date.localeCompare(b.date) : a.heure_debut.localeCompare(b.heure_debut)
  );

  // Regroupement par date pour affichage
  const rowsByDate = new Map<string, SlotRow[]>();
  for (const row of rows) {
    if (!rowsByDate.has(row.date)) rowsByDate.set(row.date, []);
    rowsByDate.get(row.date)!.push(row);
  }

  // Calcul de dép. prépa à partir des slots consécutifs
  const slotsByDate = new Map<string, SlotRow[]>();
  for (const row of [...slotMap.values()].sort((a, b) =>
    a.date !== b.date ? a.date.localeCompare(b.date) : a.heure_debut.localeCompare(b.heure_debut)
  )) {
    if (!slotsByDate.has(row.date)) slotsByDate.set(row.date, []);
    slotsByDate.get(row.date)!.push(row);
  }
  const debPrepaMap = new Map<string, string>(); // key → "HH:MM"
  for (const [, dateSlots] of slotsByDate) {
    const gap = dateSlots.length >= 2
      ? hmToMin(dateSlots[1].heure_debut) - hmToMin(dateSlots[0].heure_debut)
      : 0;
    dateSlots.forEach((slot, idx) => {
      const key = `${slot.date}|${slot.heure_debut}`;
      const debExam = hmToMin(slot.heure_debut);
      const prep = idx > 0
        ? hmToMin(dateSlots[idx - 1].heure_debut)
        : gap > 0 ? debExam - gap : debExam;
      debPrepaMap.set(key, minToHm(prep));
    });
  }

  // Export : une ligne par épreuve, dans l'ordre et avec les filtres de l'affichage
  const exporter = () => {
    const nomPers = (nom: string | null, prenom: string | null) => (nom ? `${nom} ${prenom ?? ""}`.trim() : "");
    const lignes = rows.flatMap((row) => {
      const key = `${row.date}|${row.heure_debut}`;
      return matieres.flatMap((m) => (row.byMat[m] ?? []).map((e) => [
        formatDateCourte(row.date), debPrepaMap.get(key) ?? "", row.heure_debut, row.heure_fin, m,
        nomPers(e.candidat_nom, e.candidat_prenom),
        [nomPers(e.examinateur_nom, e.examinateur_prenom), nomPers(e.examinateur2_nom, e.examinateur2_prenom)].filter(Boolean).join(" / "),
        e.salle_preparation_intitule, e.salle_intitule,
        [nomPers(e.surveillant_nom, e.surveillant_prenom), nomPers(e.surveillant2_nom, e.surveillant2_prenom)].filter(Boolean).join(" / "),
        EPREUVE_STATUT_LABEL[e.statut] ?? e.statut,
      ]));
    });
    telechargerCsv(
      `planning_${slugFichier(planning.nom)}_tableau${filterDate ? "_" + formatDateCourte(filterDate) : ""}.csv`,
      ["Date", "Dép. prépa", "Dép. exam", "Fin exam", "Matière", "Candidat", "Examinateur", "Salle préparation", "Salle", "Surveillant", "Statut"],
      lignes,
    );
  };

  // Bilan d'attribution (tout le planning, hors filtres) — pour vérifier d'un coup d'œil
  // que toutes les épreuves ont un candidat. « Libre » filtré = la liste de ce qui reste.
  const actives = epreuves.filter((e) => e.statut !== "ANNULEE");
  const nbAttribuees = actives.filter((e) => e.candidat_id != null).length;
  const nbLibres = actives.filter((e) => e.candidat_id == null && e.statut === "LIBRE").length;
  const nbPrereservees = actives.filter((e) => e.candidat_id == null && e.statut === "PRERESERVEE").length;
  const nbAutres = actives.length - nbAttribuees - nbLibres - nbPrereservees;
  const nbNonVisibles = actives.filter((e) => e.candidat_id == null && manquesPublication(e).length > 0).length;
  const horsInscription = actives.filter((e) => e.hors_inscription);
  const libererHorsInscription = async (e: EpreuveFlat) => {
    const ok = await confirm(
      `Libérer l'épreuve de ${e.matiere} du ${formatDateCourte(e.date)} à ${e.heure_debut} attribuée à ${e.candidat_nom} ${e.candidat_prenom ?? ""} ? ` +
      "Elle redevient libre ; le candidat pourra s'inscrire normalement à un triplet.",
      { confirmLabel: "Libérer", danger: true }
    );
    if (!ok) return;
    try {
      await post(`epreuves/${e.id}/liberer-hors-inscription`, {});
      toast.success("Épreuve libérée");
      await loadEpreuves();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Erreur");
    }
  };

  return (
    <div>
      <div className="mb-3">
        <BandeauTripletsSansNumero planningId={planningId} epreuves={epreuves} onFait={loadEpreuves} />
      </div>
      {/* Bilan d'attribution */}
      <div className="flex flex-wrap items-center gap-x-5 gap-y-1 mb-3 text-sm text-gray-900">
        <span>
          <span className="font-semibold">{nbAttribuees} / {actives.length}</span> épreuves attribuées à un candidat
          {nbAttribuees === actives.length && actives.length > 0 && <span className="ml-1.5 text-green-700 font-semibold">✓ tout est attribué</span>}
        </span>
        {nbLibres > 0 && (
          <button onClick={() => setFilterStatut("LIBRE")} className="text-green-800 hover:underline">
            <span className="font-semibold">{nbLibres}</span> libre{nbLibres > 1 ? "s" : ""}
          </button>
        )}
        {nbNonVisibles > 0 && (
          <span
            className="text-orange-800"
            title="Créneaux libres sans salle, examinateur, surveillant ou planche : les candidats ne les voient pas"
          >
            dont <span className="font-semibold">{nbNonVisibles}</span> non visible{nbNonVisibles > 1 ? "s" : ""} des candidats
          </span>
        )}
        {nbPrereservees > 0 && (
          <button onClick={() => setFilterStatut("PRERESERVEE")} className="text-amber-800 hover:underline">
            <span className="font-semibold">{nbPrereservees}</span> préréservée{nbPrereservees > 1 ? "s" : ""}
          </button>
        )}
        {nbAutres > 0 && <span className="text-gray-800"><span className="font-semibold">{nbAutres}</span> autre{nbAutres > 1 ? "s" : ""} (créées, sans candidat)</span>}
      </div>
      {horsInscription.length > 0 && (
        <div className="mb-3 px-4 py-2.5 rounded-xl border border-red-200 bg-red-50 text-sm text-red-800">
          <p className="font-semibold">
            ⚠ {horsInscription.length} épreuve{horsInscription.length > 1 ? "s" : ""} attribuée{horsInscription.length > 1 ? "s" : ""} hors inscription
            (absente{horsInscription.length > 1 ? "s" : ""} de la fiche du candidat, triplet incomplet) :
          </p>
          <ul className="mt-1 space-y-0.5">
            {horsInscription.map((e) => (
              <li key={e.id} className="flex items-center gap-3 flex-wrap">
                <span>{e.candidat_nom} {e.candidat_prenom} — {e.matiere}, {formatDateCourte(e.date)} à {e.heure_debut}</span>
                <button
                  onClick={() => libererHorsInscription(e)}
                  className="text-xs font-semibold px-2.5 py-1 rounded-lg border border-red-300 bg-white text-red-800 hover:bg-red-100 transition"
                >
                  Libérer
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Filtres */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <select
          value={filterDate}
          onChange={(e) => setFilterDate(e.target.value)}
          className="px-3 py-1.5 rounded-lg border bg-white text-sm focus:outline-none focus:ring-2 focus:ring-black/10"
        >
          <option value="">Toutes les dates</option>
          {dates.map((d) => (
            <option key={d} value={d}>{formatDate(d)}</option>
          ))}
        </select>
        <select
          value={filterStatut}
          onChange={(e) => setFilterStatut(e.target.value)}
          className="px-3 py-1.5 rounded-lg border bg-white text-sm focus:outline-none focus:ring-2 focus:ring-black/10"
        >
          <option value="">Tous les statuts</option>
          <option value="LIBRE">Libre</option>
          <option value="PRERESERVEE">Préréservé</option>
          <option value="ATTRIBUEE">Réservé</option>
          <option value="EN_EVALUATION">En évaluation</option>
          <option value="FINALISEE">Finalisé</option>
        </select>
        <select
          value={filterTriplet}
          onChange={(e) => setFilterTriplet(e.target.value)}
          title="Triplet de la matrice de la journée type ; à combiner avec la date"
          className="px-3 py-1.5 rounded-lg border bg-white text-sm focus:outline-none focus:ring-2 focus:ring-black/10"
        >
          <option value="">Tous les triplets</option>
          {triplets.map((tr) => <option key={tr} value={tr}>{tr}</option>)}
          {epreuves.some((e) => !e.triplet) && <option value="__sans">Sans triplet</option>}
        </select>
        <span className="text-xs text-gray-700 ml-auto">{filtered.length} créneau(x)</span>
        <Btn label="Exporter (Excel / CSV)" icon={Download} small variant="ghost" onClick={exporter} disabled={filtered.length === 0} />
      </div>

      {/* Barre de suppression de journées sélectionnées */}
      {selectedDates.size > 0 && (
        <div className="flex items-center gap-3 mb-4 px-4 py-2.5 rounded-xl border border-red-200 bg-red-50">
          <span className="text-xs font-semibold text-red-700">{selectedDates.size} journée(x) sélectionnée(s)</span>
          <button
            onClick={deleteSelectedDays}
            disabled={deletingDays}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-red-600 text-white font-medium hover:bg-red-700 transition disabled:opacity-50"
          >
            {deletingDays ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
            Supprimer
          </button>
          <button onClick={() => setSelectedDates(new Set())} className="text-xs text-gray-700 hover:text-black transition ml-auto">
            Annuler
          </button>
        </div>
      )}

      {/* Tableau croisé — border-separate : avec border-collapse, les bordures des cellules
          figées disparaissent au défilement */}
      <div
        ref={scrollRef}
        onPointerDown={onScrollPointerDown}
        onPointerMove={onScrollPointerMove}
        onPointerUp={endScrollDrag}
        onPointerLeave={endScrollDrag}
        className={`overflow-x-auto rounded-xl border bg-white shadow-sm max-h-[72vh] overflow-y-auto ${dragging ? "cursor-grabbing select-none" : "cursor-grab"}`}
      >
        <table className="text-sm border-separate border-spacing-0 min-w-max">
          <thead className="sticky top-0 z-20">
            {/* Ligne 1 : en-têtes matières (h-10) */}
            <tr className="h-10 bg-gray-100">
              <th rowSpan={2} className="sticky left-0 z-30 bg-gray-100 w-[92px] min-w-[92px] max-w-[92px] px-3 text-left text-xs font-semibold text-gray-900 whitespace-nowrap border-b border-gray-300">Statut</th>
              <th rowSpan={2} className="sticky left-[92px] z-30 bg-gray-100 w-[80px] min-w-[80px] max-w-[80px] px-2 text-left text-xs font-semibold text-gray-900 whitespace-nowrap border-b border-gray-300">Dép. prépa</th>
              <th rowSpan={2} className="sticky left-[172px] z-30 bg-gray-100 w-[80px] min-w-[80px] max-w-[80px] px-2 text-left text-xs font-semibold text-gray-900 whitespace-nowrap border-b border-gray-300">Dép. exam</th>
              <th rowSpan={2} className="sticky left-[252px] z-30 bg-gray-100 w-[80px] min-w-[80px] max-w-[80px] px-2 text-left text-xs font-semibold text-gray-900 whitespace-nowrap border-b border-r-2 border-gray-300">Fin exam</th>
              {matieres.map((m, i) => (
                <th
                  key={m}
                  colSpan={4}
                  className={`px-3 text-center text-sm font-bold text-gray-900 whitespace-nowrap border-b border-gray-200 ${i > 0 ? "border-l-2 border-l-gray-300" : ""}`}
                >
                  {m}
                </th>
              ))}
            </tr>
            {/* Ligne 2 : sous-colonnes par matière (h-8) */}
            <tr className="h-8 bg-gray-50 text-xs text-gray-800">
              {matieres.map((m, i) => (
                <React.Fragment key={m}>
                  <th className={`px-3 min-w-[170px] text-left font-medium border-b border-gray-300 ${i > 0 ? "border-l-2 border-l-gray-300" : ""}`}>Candidat</th>
                  <th className="px-3 min-w-[120px] text-left font-medium border-b border-gray-300">Examinateur</th>
                  <th className="px-3 min-w-[110px] text-left font-medium border-b border-gray-300">Salle</th>
                  <th className="px-3 min-w-[110px] text-left font-medium border-b border-gray-300">Surveillant</th>
                </React.Fragment>
              ))}
            </tr>
          </thead>
          <tbody>
            {[...rowsByDate.entries()].map(([date, dateRows]) => (
              <React.Fragment key={date}>
                {/* En-tête de date, figé sous les deux lignes d'en-tête (40 + 32 px) : la date reste
                    visible en permanence, quel que soit le défilement */}
                <tr>
                  <td
                    colSpan={4 + matieres.length * 4}
                    className="sticky top-[72px] z-[15] h-9 px-3 bg-gray-100 border-b border-gray-300 text-sm font-bold text-gray-900"
                  >
                    <label className="sticky left-3 inline-flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedDates.has(date)}
                        onChange={(e) => {
                          setSelectedDates((prev) => {
                            const next = new Set(prev);
                            e.target.checked ? next.add(date) : next.delete(date);
                            return next;
                          });
                        }}
                        title="Sélectionner cette journée pour suppression"
                        className="cursor-pointer"
                      />
                      {formatDate(date)}
                    </label>
                  </td>
                </tr>
                {dateRows.map((row) => {
                  const key = `${row.date}|${row.heure_debut}`;
                  const rs = rowStatut(row.byMat);
                  // Fond opaque sur toutes les cellules : la teinte du statut reste identique entre
                  // les colonnes figées et le reste de la ligne, survol compris
                  const fond =
                    rs === "LIBRE" ? "bg-green-50 group-hover:bg-green-100"
                    : rs === "PRERESERVEE" ? "bg-amber-50 group-hover:bg-amber-100"
                    : rs === "ATTRIBUEE" ? "bg-blue-50 group-hover:bg-blue-100"
                    : "bg-white group-hover:bg-gray-50";
                  const cellule = `px-3 py-1.5 align-top border-b border-black/10 ${fond}`;
                  // Hauteur fixe : avec plusieurs épreuves dans une matière, les colonnes restent
                  // alignées ligne à ligne
                  const ligne = "h-6 flex items-center whitespace-nowrap";

                  return (
                    <tr key={key} className="group">
                      {/* Statut et horaires — figés */}
                      <td className={`sticky left-0 z-10 w-[92px] min-w-[92px] max-w-[92px] whitespace-nowrap ${cellule}`}>
                        <div className={ligne}>{statutBadgeCell(rs)}</div>
                      </td>
                      <td className={`sticky left-[92px] z-10 w-[80px] min-w-[80px] max-w-[80px] !px-2 text-[13px] text-gray-700 tabular-nums ${cellule}`}>
                        <div className={ligne}>{debPrepaMap.get(key) ?? "—"}</div>
                      </td>
                      <td className={`sticky left-[172px] z-10 w-[80px] min-w-[80px] max-w-[80px] !px-2 text-sm font-semibold text-gray-900 tabular-nums ${cellule}`}>
                        <div className={ligne}>{row.heure_debut}</div>
                      </td>
                      <td className={`sticky left-[252px] z-10 w-[80px] min-w-[80px] max-w-[80px] !px-2 text-[13px] text-gray-700 tabular-nums border-r-2 border-r-gray-300 ${cellule}`}>
                        <div className={ligne}>{row.heure_fin}</div>
                      </td>
                      {/* Par matière */}
                      {matieres.map((m, i) => {
                        const eps = row.byMat[m] ?? [];
                        const separateur = i > 0 ? "border-l-2 border-l-gray-300" : "";
                        if (eps.length === 0) {
                          return (
                            <React.Fragment key={m}>
                              <td className={`text-[13px] text-gray-700 ${separateur} ${cellule}`} colSpan={4}>
                                <div className={ligne}>—</div>
                              </td>
                            </React.Fragment>
                          );
                        }
                        return (
                          <React.Fragment key={m}>
                            {/* Candidat */}
                            <td className={`${separateur} ${cellule}`}>
                              {eps.map((e) => (
                                <div key={e.id} className={ligne}>
                                  {e.candidat_nom ? (
                                    <span className="font-semibold text-sm text-gray-900">
                                      {e.candidat_nom} {e.candidat_prenom}
                                      {/* Pointage du surveillant le jour J */}
                                      {e.statut !== "ABSENT" && e.presence_le && (
                                        <span
                                          className="ml-1.5 text-[11px] font-semibold text-green-800"
                                          title="Pointé présent par le surveillant"
                                        >
                                          ✓ {new Date(e.presence_le).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                                        </span>
                                      )}
                                      {e.incident && (
                                        <span
                                          className="ml-1.5 text-[11px] font-semibold text-amber-800 cursor-help"
                                          title={`Incident signalé${e.incident_par ? ` par ${e.incident_par}` : ""} : ${e.incident}`}
                                        >
                                          ⚠ Incident
                                        </span>
                                      )}
                                    </span>
                                  ) : manquesPublication(e).length > 0 ? (
                                    <span
                                      className="text-[11px] font-semibold text-orange-800"
                                      title="Créneau libre invisible des candidats tant que salle, examinateur, surveillant et planche ne sont pas affectés"
                                    >
                                      Non visible · manque{" "}
                                      <LiensManques manques={manquesPublication(e)} planningId={planningId} date={e.date} matiere={e.matiere} heure={e.heure_debut} />
                                    </span>
                                  ) : (
                                    <span className="text-gray-700 text-[13px]">—</span>
                                  )}
                                </div>
                              ))}
                            </td>
                            {/* Examinateur */}
                            <td className={cellule}>
                              {eps.map((e) => (
                                <div key={e.id} className={`${ligne} text-[13px] text-gray-800`}>
                                  {e.examinateur_nom
                                    ? `${e.examinateur_nom}${e.examinateur_prenom ? " " + e.examinateur_prenom[0] + "." : ""}`
                                    : "—"}
                                </div>
                              ))}
                            </td>
                            {/* Salle */}
                            <td className={cellule}>
                              {eps.map((e) => (
                                <div key={e.id} className={`${ligne} text-[13px] text-gray-800`}>
                                  {e.salle_intitule ? (
                                    <span>
                                      {e.salle_preparation_intitule && (
                                        <span className="text-gray-700" title="Salle préparation">{e.salle_preparation_intitule} → </span>
                                      )}
                                      <span title="Salle oral">{e.salle_intitule}</span>
                                    </span>
                                  ) : "—"}
                                </div>
                              ))}
                            </td>
                            {/* Surveillant(s) — sur une seule ligne, pour garder l'alignement */}
                            <td className={cellule}>
                              {eps.map((e) => (
                                <div key={e.id} className={`${ligne} text-[13px] text-gray-800`}>
                                  {e.surveillant_nom
                                    ? `${e.surveillant_nom}${e.surveillant_prenom ? " " + e.surveillant_prenom[0] + "." : ""}`
                                    : "—"}
                                  {e.surveillant2_nom && ` / ${e.surveillant2_nom}${e.surveillant2_prenom ? " " + e.surveillant2_prenom[0] + "." : ""}`}
                                </div>
                              ))}
                            </td>
                          </React.Fragment>
                        );
                      })}
                    </tr>
                  );
                })}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Section : Vue journée ──────────────────────────────────────────────────────
export function PlanningDaySection({
  planning,
  journeeTypes,
  onBack,
}: {
  planning: Planning;
  journeeTypes: JourneeType[];
  onBack: () => void;
}) {
  const [viewMode, setViewMode] = useFiltre<"journee" | "tableau" | "triplets">("planning:vue", "tableau");
  const [daySubView, setDaySubView] = useState<"triplets" | "creneaux">("triplets");
  const [date, setDate] = useState(planning.date_debut);
  const [dayData, setDayData] = useState<DayViewData | null>(null);
  const [loading, setLoading] = useState(false);
  const [applyModal, setApplyModal] = useState(false);
  const [regenDj, setRegenDj] = useState<DemiJournee | null>(null);

  const loadDay = useCallback(async () => {
    setLoading(true);
    try {
      const data = await get<DayViewData>(
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
    if (viewMode === "journee") loadDay();
  }, [loadDay, viewMode]);

  // Export de la journée affichée, selon le sous-onglet actif
  const exporterJournee = () => {
    if (!dayData) return;
    const eps = dayData.demi_journees.flatMap((dj) => dj.epreuves.map((e) => ({ ...e, session: dj.type === "MATIN" ? "Matin" : "Après-midi" })));
    const ligne = (e: (typeof eps)[number]) => [
      formatDateCourte(date), e.session, e.matiere, heurePrepa(e.heure_debut, e.preparation_minutes) ?? "",
      hm(e.heure_debut), hm(e.heure_fin), e.salle_preparation_intitule, e.salle_intitule,
      EPREUVE_STATUT_LABEL[e.statut] ?? e.statut,
    ];
    const parHeure = (a: (typeof eps)[number], b: (typeof eps)[number]) =>
      hm(a.heure_debut).localeCompare(hm(b.heure_debut)) || a.matiere.localeCompare(b.matiere, "fr");
    const entetes = ["Date", "Session", "Matière", "Dép. prépa", "Dép. exam", "Fin exam", "Salle préparation", "Salle", "Statut"];
    const candidat = (e: (typeof eps)[number]) => (e.candidat_nom ? `${e.candidat_nom} ${e.candidat_prenom ?? ""}`.trim() : "");
    if (daySubView === "triplets") {
      // Une ligne par épreuve, regroupées par candidat (puis les créneaux sans candidat)
      const avec = eps.filter((e) => e.candidat_id != null);
      const premiere = new Map<number, string>();
      for (const e of avec) {
        const h = hm(e.heure_debut);
        if (!premiere.has(e.candidat_id!) || h < premiere.get(e.candidat_id!)!) premiere.set(e.candidat_id!, h);
      }
      avec.sort((a, b) =>
        premiere.get(a.candidat_id!)!.localeCompare(premiere.get(b.candidat_id!)!) ||
        candidat(a).localeCompare(candidat(b), "fr") || parHeure(a, b));
      const sans = eps.filter((e) => e.candidat_id == null && e.statut !== "ANNULEE").sort(parHeure);
      telechargerCsv(
        `planning_${slugFichier(planning.nom)}_association_triplets_${formatDateCourte(date)}.csv`,
        ["Candidat", ...entetes],
        [...avec, ...sans].map((e) => [candidat(e), ...ligne(e)]),
      );
    } else {
      telechargerCsv(
        `planning_${slugFichier(planning.nom)}_creneaux_${formatDateCourte(date)}.csv`,
        [...entetes, "Candidat"],
        // Matin puis après-midi, par heure de début
        [...eps].sort((a, b) => (a.session === b.session ? 0 : a.session === "Matin" ? -1 : 1) || parHeure(a, b))
          .map((e) => [...ligne(e), candidat(e)]),
      );
    }
  };

  return (
    <div className="w-full">
      {/* Header */}
      <div className="flex items-center gap-3 mb-5">
        <button
          onClick={onBack}
          className="h-9 w-9 rounded-lg border bg-white shadow-sm grid place-items-center hover:bg-black/[0.02] transition"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <div>
          <p className="text-xs text-gray-700 uppercase tracking-wide">Planning</p>
          <h2 className="text-xl font-semibold leading-tight">{planning.nom}</h2>
        </div>
        <StatutBadge statut={planning.statut} />
      </div>

      {/* Onglets Vue journée / Vue tableau / Vue triplets */}
      <div className="flex gap-1 mb-5 border-b border-black/10">
        {(["tableau", "journee", "triplets"] as const).map((m) => (
          <button
            key={m}
            onClick={() => setViewMode(m)}
            className={`px-4 py-2 text-sm font-medium rounded-t-lg transition -mb-px border border-b-0 ${
              viewMode === m
                ? "bg-white border-black/10 text-black"
                : "border-transparent text-gray-700 hover:text-black"
            }`}
          >
            {m === "journee" ? "Vue journée" : m === "tableau" ? "Vue tableau" : "Vue triplets"}
          </button>
        ))}
      </div>

      {viewMode === "tableau" ? (
        <PlanningTableauView planningId={planning.id} planning={planning} />
      ) : viewMode === "triplets" ? (
        <TripletsAdminView planningId={planning.id} planningNom={planning.nom} />
      ) : (
        <>
          {/* Date bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setDate(addDays(date, -1))}
                className="h-9 w-9 rounded-lg border bg-white shadow-sm grid place-items-center hover:bg-black/[0.02] transition"
                disabled={date <= planning.date_debut}
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <input
                type="date"
                value={date}
                min={planning.date_debut}
                max={planning.date_fin}
                onChange={(e) => setDate(e.target.value)}
                className="px-3 py-2 rounded-lg border bg-white shadow-sm text-sm focus:outline-none focus:ring-2 focus:ring-black/10"
              />
              <button
                onClick={() => setDate(addDays(date, 1))}
                className="h-9 w-9 rounded-lg border bg-white shadow-sm grid place-items-center hover:bg-black/[0.02] transition"
                disabled={date >= planning.date_fin}
              >
                <ChevronRight className="h-4 w-4" />
              </button>
              <span className="text-sm text-gray-700 hidden sm:block">{formatDate(date)}</span>
            </div>
            <div className="flex gap-2">
              <Btn label="Appliquer un gabarit" icon={Wand2} onClick={() => setApplyModal(true)} />
              <Btn label="Rafraîchir" icon={RefreshCw} onClick={loadDay} variant="ghost" small />
              <Btn label="Exporter (Excel / CSV)" icon={Download} onClick={exporterJournee} variant="ghost" small
                disabled={loading || !dayData || dayData.demi_journees.length === 0} />
            </div>
          </div>

          {/* Sous-onglets Triplets / Créneaux */}
          {!loading && dayData && dayData.demi_journees.length > 0 && (
            <div className="flex gap-1 mb-4 border-b border-black/8">
              {(["triplets", "creneaux"] as const).map(v => (
                <button key={v} onClick={() => setDaySubView(v)}
                  className={`px-4 py-1.5 text-xs font-semibold rounded-t-lg transition -mb-px border border-b-0 ${
                    daySubView === v ? "bg-white border-black/10 text-black" : "border-transparent text-gray-700 hover:text-black"
                  }`}>
                  {v === "triplets" ? "Association triplets" : "Vue créneaux"}
                </button>
              ))}
            </div>
          )}

          {/* Gabarit appliqué à la date */}
          {!loading && dayData && dayData.demi_journees.length > 0 && (
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mb-4 rounded-lg border border-black/10 bg-black/[0.02] px-3 py-2 text-sm text-gray-900">
              <Wand2 className="h-4 w-4 text-gray-800" />
              <span className="font-medium">Gabarit appliqué :</span>
              <span className="font-semibold">{resumeGabarits(dayData.demi_journees)}</span>
              {dateApplication(dayData.demi_journees) && (
                <span className="text-gray-700">· appliqué {dateApplication(dayData.demi_journees)}</span>
              )}
            </div>
          )}

          {/* Day content */}
          {loading ? (
            <div className="flex justify-center py-16 text-gray-700"><Spinner /></div>
          ) : !dayData || dayData.demi_journees.length === 0 ? (
            <div className="rounded-xl border border-dashed border-black/15 p-14 text-center">
              <CalendarDays className="h-8 w-8 mx-auto mb-3 text-gray-700" />
              <p className="text-gray-700 font-medium">Aucune demi-journée</p>
              <p className="text-sm text-gray-700 mt-1">
                Cliquez sur &laquo; Appliquer un gabarit &raquo; pour générer les créneaux de cette journée.
              </p>
            </div>
          ) : daySubView === "triplets" ? (
            <TripletAssociationView dayData={dayData} />
          ) : (
            <div className="space-y-5">
              {dayData.demi_journees.map((dj) => {
                return (
                  <DemiJourneeCard
                    key={dj.id}
                    dj={dj}
                    planningId={planning.id}
                    date={dayData.date}
                    epreuvesJour={dayData.demi_journees.flatMap((d) => d.epreuves)}
                    onRegen={() => setRegenDj(dj)}
                    onRefresh={loadDay}
                  />
                );
              })}
            </div>
          )}

          {/* Modals */}
          <Modal open={applyModal} onClose={() => setApplyModal(false)} title="Appliquer un gabarit" wide>
            {journeeTypes.length === 0 ? (
              <p className="text-sm text-gray-800">
                Aucune journée type disponible. Créez-en une dans la section &laquo; Journées types &raquo;.
              </p>
            ) : (
              <ApplyForm
                planningId={planning.id}
                date={date}
                dateDebut={planning.date_debut}
                dateFin={planning.date_fin}
                journeeTypes={journeeTypes}
                onSuccess={() => { setApplyModal(false); loadDay(); }}
              />
            )}
          </Modal>

          <Modal
            open={!!regenDj}
            onClose={() => setRegenDj(null)}
            title={`Régénérer — ${regenDj?.type === "MATIN" ? "Matin" : "Après-midi"}`}
          >
            {regenDj && (
              <RegenForm
                demiJourneeId={regenDj.id}
                onSuccess={() => { setRegenDj(null); loadDay(); }}
              />
            )}
          </Modal>
        </>
      )}
    </div>
  );
}

// ── Vue association triplets (par candidat, journée complète) ─────────────────

function TripletAssociationView({ dayData }: { dayData: DayViewData }) {
  // Toutes les épreuves de la journée (matin + après-midi fusionnés)
  const allEpreuves = dayData.demi_journees.flatMap(dj =>
    dj.epreuves.map(e => ({ ...e, djType: dj.type }))
  );
  type EpreuveJour = (typeof allEpreuves)[number];

  // Matières présentes, triées alphabétiquement
  const allMatieres = [...new Set(allEpreuves.map(e => e.matiere))].sort((a, b) => a.localeCompare(b, "fr"));
  // Une journée mixte ESH/HGG : chaque candidat ne passe que l'une des deux → N-1 épreuves
  const upper = new Set(allMatieres.map(m => m.toUpperCase()));
  const nbAttendu = upper.has("ESH") && upper.has("HGG") ? allMatieres.length - 1 : allMatieres.length;

  // Un triplet = les épreuves d'UN candidat (à des horaires différents, par rotation) —
  // jamais une ligne horaire : c'est ce qui éparpillait un même candidat sur plusieurs
  // "triplets" T1, T2… dès qu'il s'inscrivait.
  const candidatMap = new Map<number, { nom: string; prenom: string; epreuves: EpreuveJour[] }>();
  for (const ep of allEpreuves) {
    if (ep.candidat_id == null) continue;
    if (!candidatMap.has(ep.candidat_id)) {
      candidatMap.set(ep.candidat_id, { nom: ep.candidat_nom ?? "", prenom: ep.candidat_prenom ?? "", epreuves: [] });
    }
    candidatMap.get(ep.candidat_id)!.epreuves.push(ep);
  }
  const triplets = [...candidatMap.entries()]
    .map(([id, c]) => ({
      id,
      nom: c.nom,
      prenom: c.prenom,
      epreuves: [...c.epreuves].sort((a, b) => hm(a.heure_debut).localeCompare(hm(b.heure_debut))),
    }))
    .sort((a, b) => hm(a.epreuves[0]?.heure_debut ?? "").localeCompare(hm(b.epreuves[0]?.heure_debut ?? "")));

  // Épreuves sans candidat (non annulées) : libres OU préréservées
  const sansCandidat = allEpreuves
    .filter(e => e.candidat_id == null && e.statut !== "ANNULEE")
    .sort((a, b) => hm(a.heure_debut).localeCompare(hm(b.heure_debut)) || a.matiere.localeCompare(b.matiere, "fr"));
  const nbLibres = sansCandidat.filter(e => e.statut === "LIBRE").length;
  const nbPrereservees = sansCandidat.filter(e => e.statut === "PRERESERVEE").length;

  const horaire = (ep: EpreuveJour) => {
    const prepa = heurePrepa(ep.heure_debut, ep.preparation_minutes);
    return (
      <span className="tabular-nums">
        {prepa && <span className="text-gray-700">Prépa {prepa} · </span>}
        <span className="font-semibold text-gray-900">{hm(ep.heure_debut)} – {hm(ep.heure_fin)}</span>
      </span>
    );
  };
  const salles = (ep: EpreuveJour) =>
    ep.salle_intitule || ep.salle_preparation_intitule ? (
      <span className="text-gray-800">
        {ep.salle_preparation_intitule && <>Prépa {ep.salle_preparation_intitule} · </>}
        {ep.salle_intitule ? <>Salle {ep.salle_intitule}</> : <span className="italic">salle non assignée</span>}
      </span>
    ) : (
      <span className="italic text-gray-700">Salle non assignée</span>
    );

  if (triplets.length === 0 && sansCandidat.length === 0) {
    return <p className="text-sm text-gray-800 text-center py-10">Aucune épreuve pour cette date.</p>;
  }

  return (
    <div className="space-y-4">
      {/* Résumé */}
      <div className="flex flex-wrap items-center gap-x-5 gap-y-1 px-1 text-sm text-gray-900">
        <span><span className="font-semibold">{triplets.length}</span> candidat{triplets.length > 1 ? "s" : ""} inscrit{triplets.length > 1 ? "s" : ""}</span>
        <span><span className="font-semibold">{nbLibres}</span> créneau{nbLibres > 1 ? "x" : ""} libre{nbLibres > 1 ? "s" : ""}</span>
        {nbPrereservees > 0 && (
          <span><span className="font-semibold">{nbPrereservees}</span> préréservé{nbPrereservees > 1 ? "s" : ""}</span>
        )}
        <span className="text-gray-700">{allMatieres.join(" · ")}</span>
      </div>

      {/* Triplets attribués : une ligne = un candidat et ses épreuves */}
      {triplets.length > 0 ? (
        <div className="overflow-x-auto rounded-xl border border-black/10 bg-white">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-gray-50">
                <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-900 border-b border-black/10">Candidat</th>
                {allMatieres.map(m => (
                  <th key={m} className="px-3 py-2.5 text-left text-xs font-semibold text-gray-900 border-b border-black/10 whitespace-nowrap">{m}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {triplets.map(t => {
                const incomplet = t.epreuves.length < nbAttendu;
                return (
                  <tr key={t.id} className="border-b border-black/5 last:border-0 align-top">
                    <td className="px-3 py-2.5 whitespace-nowrap">
                      <div className="font-semibold text-gray-900">{t.nom} {t.prenom}</div>
                      {incomplet && (
                        <div className="mt-1 text-xs font-medium text-red-700">
                          Triplet incomplet : {t.epreuves.length}/{nbAttendu} épreuves
                        </div>
                      )}
                    </td>
                    {allMatieres.map(matiere => {
                      const eps = t.epreuves.filter(e => e.matiere === matiere);
                      if (eps.length === 0) return (
                        <td key={matiere} className="px-3 py-2.5 text-gray-700">—</td>
                      );
                      return (
                        <td key={matiere} className="px-2 py-1.5">
                          {eps.map(ep => (
                            <div key={ep.id} className={`rounded-lg border px-2.5 py-1.5 mb-1 last:mb-0 text-xs space-y-0.5 ${statutEpreuveCls(ep.statut)}`}>
                              <div>{horaire(ep)}</div>
                              <div>{salles(ep)}</div>
                              <div className="font-semibold">
                                {ep.djType === "MATIN" ? "Matin" : "Après-midi"} · {EPREUVE_STATUT_LABEL[ep.statut] ?? ep.statut}
                              </div>
                            </div>
                          ))}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="text-sm text-gray-800 px-1">Aucun candidat inscrit sur cette journée pour l&apos;instant.</p>
      )}

      {/* Épreuves sans candidat */}
      {sansCandidat.length > 0 && (
        <div className="rounded-xl border border-black/10 bg-white overflow-hidden">
          <div className="px-4 py-2.5 border-b border-black/10 bg-gray-50 flex items-center gap-2">
            <span className="text-sm font-semibold text-gray-900">Créneaux sans candidat</span>
            <span className="text-xs text-gray-800">{sansCandidat.length} épreuve{sansCandidat.length > 1 ? "s" : ""}</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr>
                  {["Matière", "Session", "Horaire", "Salle", "Statut"].map(h => (
                    <th key={h} className="px-3 py-2 text-left text-xs font-semibold text-gray-900 border-b border-black/10">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sansCandidat.map(ep => (
                  <tr key={ep.id} className="border-b border-black/5 last:border-0">
                    <td className="px-3 py-1.5 font-medium text-gray-900">{ep.matiere}</td>
                    <td className="px-3 py-1.5 text-gray-900">{ep.djType === "MATIN" ? "Matin" : "Après-midi"}</td>
                    <td className="px-3 py-1.5 whitespace-nowrap">{horaire(ep)}</td>
                    <td className="px-3 py-1.5">{salles(ep)}</td>
                    <td className="px-3 py-1.5">
                      <span className={`inline-block px-2 py-0.5 rounded-full border text-[11px] font-semibold ${statutEpreuveCls(ep.statut)}`}>
                        {EPREUVE_STATUT_LABEL[ep.statut] ?? ep.statut}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Vue triplets (édition — préréserver / libérer) ─────────────────────────────
// Distincte de TripletAssociationView (qui montre les triplets déjà ASSIGNÉS d'une
// journée) : celle-ci liste TOUS les triplets de tout le planning avec leur état réel
// (Libre, Préréservé, Attribué à un candidat, ou Incomplet) et permet de préréserver /
// libérer ceux qui sont disponibles.

const TRIPLET_ETAT: Record<string, { label: string; cls: string }> = {
  LIBRE:        { label: "Libre",         cls: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  PRERESERVEE:  { label: "Préréservé",    cls: "bg-amber-50 text-amber-700 border-amber-200" },
  ATTRIBUEE:    { label: "Attribué",      cls: "bg-blue-50 text-blue-700 border-blue-200" },
  INCOMPLET:    { label: "Incomplet",     cls: "bg-red-50 text-red-600 border-red-200" },
  INDISPONIBLE: { label: "Indisponible",  cls: "bg-gray-100 text-gray-700 border-gray-200" },
};

// Ce que signifie chaque état — affiché en légende au-dessus de la liste.
const TRIPLET_ETAT_AIDE: Record<string, string> = {
  LIBRE: "les 3 épreuves sont libres : un candidat peut le choisir, ou vous pouvez le préréserver.",
  PRERESERVEE: "mis de côté sans candidat : invisible pour les candidats jusqu'à ce qu'il soit libéré.",
  ATTRIBUEE: "réservé par un candidat inscrit.",
  INDISPONIBLE: "une partie de ses épreuves est préréservée via un autre triplet : il ne peut plus être complété tel quel.",
  INCOMPLET: "impossible de former les 3 épreuves (créneau manquant dans le planning, épreuve déjà prise, ou attribution hors inscription).",
};

// Couleur d'une pastille d'épreuve selon SON statut propre (pas celui du triplet).
const EPREUVE_STATUT_CLS: Record<string, string> = {
  LIBRE: "bg-emerald-50 border-emerald-200 text-emerald-700",
  PRERESERVEE: "bg-amber-50 border-amber-200 text-amber-700",
  ATTRIBUEE: "bg-blue-50 border-blue-200 text-blue-700",
  MANQUANTE: "bg-white border-dashed border-red-300 text-red-500",
};

function TripletsAdminView({ planningId, planningNom }: { planningId: number; planningNom: string }) {
  const toast = useToast();
  const [triplets, setTriplets] = useState<TripletDisponible[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterDate, setFilterDate] = useState("");
  const [filterEtat, setFilterEtat] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    get<TripletDisponible[]>(`gestion-candidats/${planningId}/triplets?tous=1`)
      .then(setTriplets)
      .catch(() => setTriplets([]))
      .finally(() => setLoading(false));
  }, [planningId]);

  useEffect(() => { load(); }, [load]);

  const tripletKey = (t: TripletDisponible) => `${t.date}|${t.heure_debut}|${t.epreuves.map((e) => e.id).join(",")}`;
  // Ordre de la matrice de la journée type (T1, T2…), sinon par heure
  const ordreTriplet = (a: TripletDisponible, b: TripletDisponible) =>
    (a.numero ?? Infinity) - (b.numero ?? Infinity) || a.heure_debut.localeCompare(b.heure_debut);

  const toggle = async (t: TripletDisponible) => {
    const key = tripletKey(t);
    setBusy(key);
    try {
      const action = t.type_slot === "LIBRE" ? "prereserver" : "liberer";
      await post(`gestion-candidats/${planningId}/triplets/${action}`, { epreuve_ids: t.epreuves.map((e) => e.id) });
      toast.success(t.type_slot === "LIBRE" ? "Triplet préréservé" : "Triplet libéré");
      load();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Erreur");
    } finally {
      setBusy(null);
    }
  };

  const dates = [...new Set(triplets.map((t) => t.date))].sort();
  const filtered = triplets
    .filter((t) => !filterDate || t.date === filterDate)
    .filter((t) => !filterEtat || t.type_slot === filterEtat);
  const byDate = new Map<string, TripletDisponible[]>();
  for (const t of filtered) {
    if (!byDate.has(t.date)) byDate.set(t.date, []);
    byDate.get(t.date)!.push(t);
  }

  // Export : une ligne par triplet, avec les filtres de l'affichage
  const exporter = () => {
    const lignes = [...filtered]
      .sort((a, b) => a.date.localeCompare(b.date) || ordreTriplet(a, b))
      .map((t) => [
        formatDateCourte(t.date), t.numero != null ? `T${t.numero}` : "", t.heure_debut,
        t.epreuves.map((e) => `${e.matiere} ${e.heure_debut}${e.statut === "MANQUANTE" ? " (manquante)" : ""}`).join(" · "),
        TRIPLET_ETAT[t.type_slot]?.label ?? t.type_slot,
        t.candidat_nom ? `${t.candidat_nom} ${t.candidat_prenom ?? ""}`.trim() : "",
        t.motif,
      ]);
    telechargerCsv(
      `planning_${slugFichier(planningNom)}_triplets${filterDate ? "_" + formatDateCourte(filterDate) : ""}.csv`,
      ["Date", "Triplet", "Heure", "Épreuves", "État", "Candidat", "Motif"],
      lignes,
    );
  };

  if (loading) return <div className="flex justify-center py-16 text-gray-700"><Spinner /></div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <p className="text-sm text-gray-800">
          État de chaque triplet du planning — préréservez un triplet Libre pour le mettre de côté sans lui assigner de candidat, ou libérez une pré-réservation.
        </p>
        <div className="flex items-center gap-2 ml-auto">
          {dates.length > 0 && (
            <select
              value={filterDate}
              onChange={(e) => setFilterDate(e.target.value)}
              className="px-3 py-1.5 rounded-lg border bg-white text-sm focus:outline-none focus:ring-2 focus:ring-black/10"
            >
              <option value="">Toutes les dates</option>
              {dates.map((d) => <option key={d} value={d}>{formatDate(d)}</option>)}
            </select>
          )}
          <select
            value={filterEtat}
            onChange={(e) => setFilterEtat(e.target.value)}
            className="px-3 py-1.5 rounded-lg border bg-white text-sm focus:outline-none focus:ring-2 focus:ring-black/10"
          >
            <option value="">Tous les états</option>
            {Object.entries(TRIPLET_ETAT).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
          <Btn label="Exporter (Excel / CSV)" icon={Download} small variant="ghost" onClick={exporter} disabled={filtered.length === 0} />
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-black/5 px-4 py-3 grid gap-1.5 sm:grid-cols-2">
        {Object.entries(TRIPLET_ETAT).map(([k, v]) => {
          const nb = triplets.filter((t) => (!filterDate || t.date === filterDate) && t.type_slot === k).length;
          return (
            <div key={k} className="flex items-start gap-2 text-xs text-gray-800 leading-snug">
              <span className={`shrink-0 text-[11px] px-2 py-0.5 rounded-full font-semibold border ${v.cls}`}>
                {v.label} · {nb}
              </span>
              <span className="pt-0.5">{TRIPLET_ETAT_AIDE[k]}</span>
            </div>
          );
        })}
      </div>

      {filtered.length === 0 ? (
        <Empty message="Aucun triplet" sub="Aucun créneau généré pour cette date, ou filtre trop restrictif." />
      ) : (
        [...byDate.entries()].map(([date, trips]) => (
          <div key={date} className="bg-white rounded-2xl border border-black/5 shadow-sm overflow-hidden">
            <div className="px-4 py-2.5 bg-black/[0.02] border-b border-black/5">
              <span className="text-xs font-semibold text-gray-800">{formatDate(date)}</span>
              <span className="text-xs text-gray-700 ml-2">{trips.length} triplet(s)</span>
            </div>
            <div className="divide-y divide-black/5">
              {[...trips]
                .sort(ordreTriplet)
                .map((t) => {
                  const key = tripletKey(t);
                  const etat = TRIPLET_ETAT[t.type_slot] ?? TRIPLET_ETAT.INCOMPLET;
                  const editable = t.type_slot === "LIBRE" || t.type_slot === "PRERESERVEE";
                  const showCandidat = (t.type_slot === "ATTRIBUEE" || t.type_slot === "INCOMPLET") && t.candidat_nom;
                  return (
                    <div key={key} className="px-4 py-2.5">
                      <div className="flex items-center gap-4">
                        {trips.some((x) => x.numero != null) && (
                          <span className="text-xs font-semibold text-gray-900 w-9" title="Numéro du triplet dans la matrice de la journée type">
                            {t.numero != null ? `T${t.numero}` : ""}
                          </span>
                        )}
                        <span className="font-mono text-sm text-gray-900 w-14">{t.heure_debut}</span>
                        <div className="flex-1 flex flex-wrap gap-2">
                          {t.epreuves.map((e) => (
                            <span
                              key={e.id}
                              title={e.statut === "MANQUANTE" ? "Aucune épreuve à cet horaire dans le planning" : e.statut}
                              className={`text-xs px-2 py-0.5 rounded-full border ${EPREUVE_STATUT_CLS[e.statut ?? ""] ?? "bg-black/[0.03] border-black/10 text-gray-800"}`}
                            >
                              {e.statut === "MANQUANTE" && "✗ "}{e.matiere} <span className="opacity-60">{e.heure_debut}</span>
                            </span>
                          ))}
                        </div>
                        {showCandidat && (
                          <span className="text-xs text-gray-800 font-medium w-40 truncate" title={`${t.candidat_nom} ${t.candidat_prenom ?? ""}`}>
                            {t.candidat_nom} {t.candidat_prenom}
                          </span>
                        )}
                        <span className={`text-[11px] px-2 py-0.5 rounded-full font-semibold border ${etat.cls}`}>
                          {etat.label}
                        </span>
                        {!!t.manques_publication?.length && (
                          <span className="text-[11px] px-2 py-0.5 rounded-full font-semibold border border-orange-300 bg-orange-50 text-orange-800">
                            Non visible candidats
                          </span>
                        )}
                        {editable && (
                          <button
                            onClick={() => toggle(t)}
                            disabled={busy === key}
                            className={`text-xs px-3 py-1.5 rounded-lg font-medium transition disabled:opacity-50 ${
                              t.type_slot === "LIBRE" ? "text-white hover:opacity-90" : "border border-black/15 text-gray-800 hover:bg-black/[0.03]"
                            }`}
                            style={t.type_slot === "LIBRE" ? { backgroundColor: RED } : undefined}
                          >
                            {busy === key ? "…" : t.type_slot === "LIBRE" ? "Préréserver" : "Libérer"}
                          </button>
                        )}
                      </div>
                      {t.motif && (
                        <p className={`text-xs mt-1.5 pl-[4.5rem] pr-2 leading-snug ${
                          t.type_slot === "INCOMPLET" ? "text-red-600/80" : t.type_slot === "INDISPONIBLE" ? "text-gray-800" : "text-gray-700"
                        }`}>
                          {t.motif}
                        </p>
                      )}
                      {!!t.manques_publication?.length && (
                        <ul className="mt-1 pl-[4.5rem] pr-2 space-y-0.5">
                          {t.manques_publication.map((m) => (
                            <li key={m} className="text-[11px] leading-snug text-orange-800">
                              ✗ Manque <LigneManque ligne={m} planningId={planningId} date={t.date} />
                            </li>
                          ))}
                        </ul>
                      )}
                      {t.details && t.details.length > 0 && (
                        <details className="mt-1 pl-[4.5rem] pr-2" open={t.type_slot === "INCOMPLET" || t.type_slot === "INDISPONIBLE"}>
                          <summary className="text-[11px] text-gray-700 cursor-pointer select-none hover:text-black">
                            Détail par épreuve
                          </summary>
                          <ul className="mt-1 space-y-0.5">
                            {t.details.map((d, i) => (
                              <li
                                key={i}
                                className={`text-[11px] leading-snug ${d.startsWith("✗") ? "text-red-600/80" : "text-gray-800"}`}
                              >
                                {d.startsWith("✗") || d.startsWith("✓") ? d : `• ${d}`}
                              </li>
                            ))}
                          </ul>
                        </details>
                      )}
                    </div>
                  );
                })}
            </div>
          </div>
        ))
      )}
    </div>
  );
}

// ── Carte demi-journée (vue créneaux) ─────────────────────────────────────────

function DemiJourneeCard({
  dj,
  planningId,
  date,
  epreuvesJour,
  onRegen,
  onRefresh,
}: {
  dj: DemiJournee;
  planningId: number;
  date: string;
  epreuvesJour: Epreuve[];
  onRegen: () => void;
  onRefresh: () => void;
}) {
  const toast = useToast();
  const confirm = useConfirm();
  const [panneau, setPanneau] = useState<"ajout" | "suppression" | null>(null);
  const [modeles, setModeles] = useState<TripletDisponible[] | null>(null);
  const [modeleKey, setModeleKey] = useState("");
  const [adding, setAdding] = useState(false);

  // « + Triplet » : on ne crée jamais une épreuve isolée — une épreuve à une heure nouvelle
  // changerait la liste des heures de la journée, donc toute la rotation des triplets. On
  // duplique un triplet existant (salle parallèle) : mêmes matières, mêmes heures.
  const debutDj = hm(dj.heure_debut), finDj = hm(dj.heure_fin);
  const compo = (t: TripletDisponible) => t.epreuves.map((e) => `${e.matiere} ${e.heure_debut}`).join(" · ");
  // « Supprimer un triplet » : seulement si chacune de ses (matière, heure) a une épreuve en
  // parallèle libre et sans candidat — le serveur retire cette copie, l'heure reste occupée.
  const supprimable = (t: TripletDisponible) => t.epreuves.every((te) => {
    const par = epreuvesJour.filter((e) => e.matiere === te.matiere && hm(e.heure_debut) === te.heure_debut);
    return par.length >= 2 && par.some((e) => e.statut === "LIBRE" && e.candidat_id == null);
  });
  const ouvrir = async (mode: "ajout" | "suppression") => {
    if (panneau === mode) { setPanneau(null); return; }
    setPanneau(mode);
    setModeles(null);
    try {
      const ts = await get<TripletDisponible[]>(`gestion-candidats/${planningId}/triplets?tous=1`);
      // Triplets réels (pas INCOMPLET) commençant dans cette demi-journée, une fois par composition
      const vus = new Set<string>();
      const liste = ts
        .filter((t) => t.date === date && t.type_slot !== "INCOMPLET" && t.epreuves.every((e) => e.id > 0))
        .filter((t) => t.heure_debut >= debutDj && t.heure_debut < finDj)
        .filter((t) => mode === "ajout" || supprimable(t))
        .filter((t) => { const k = compo(t); if (vus.has(k)) return false; vus.add(k); return true; })
        .sort((a, b) => a.heure_debut.localeCompare(b.heure_debut) || compo(a).localeCompare(compo(b), "fr"));
      setModeles(liste);
      setModeleKey(liste[0] ? compo(liste[0]) : "");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : String(e));
      setModeles([]);
    }
  };

  const handleAddTriplet = async () => {
    const modele = modeles?.find((t) => compo(t) === modeleKey);
    if (!modele) return;
    setAdding(true);
    try {
      await post(`epreuves/dupliquer-triplet`, { epreuve_ids: modele.epreuves.map((e) => e.id) });
      toast.success("Triplet ajouté — attribuez-lui des salles d'examen différentes");
      setPanneau(null);
      onRefresh();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setAdding(false);
    }
  };

  const handleDeleteTriplet = async () => {
    const modele = modeles?.find((t) => compo(t) === modeleKey);
    if (!modele) return;
    if (!await confirm(`Supprimer un triplet en parallèle « ${compo(modele)} » ?`, { confirmLabel: "Supprimer", danger: true })) return;
    setAdding(true);
    try {
      await post(`epreuves/supprimer-triplet`, { epreuve_ids: modele.epreuves.map((e) => e.id) });
      toast.success("Triplet supprimé");
      setPanneau(null);
      onRefresh();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setAdding(false);
    }
  };

  // Suppression d'une ligne horaire entière (ex. restes d'un ajout épreuve par épreuve).
  // Retirer une heure change la liste des heures de la journée → la rotation des triplets
  // libres est recalculée : on le dit explicitement avant de confirmer.
  const supprimerCreneau = async (slot: string, eps: Epreuve[]) => {
    const ok = await confirm(
      `Supprimer le créneau ${slot} (${eps.map((e) => e.matiere).join(", ")}) ? ` +
      "Cette heure disparaît de la journée : les triplets libres seront recalculés (les inscriptions existantes ne bougent pas).",
      { confirmLabel: "Supprimer", danger: true }
    );
    if (!ok) return;
    try {
      await post(`epreuves/supprimer-creneau`, { demi_journee_id: dj.id, heure_debut: slot });
      toast.success(`Créneau ${slot} supprimé`);
      onRefresh();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : String(e));
    }
  };

  // ── Construction de la vue matricielle triplets ──────────────────────────────
  // Grouper les épreuves par heure_debut (= un créneau = une ligne)
  const slotMap = new Map<string, Epreuve[]>();
  for (const ep of dj.epreuves) {
    const key = hm(ep.heure_debut);
    if (!slotMap.has(key)) slotMap.set(key, []);
    slotMap.get(key)!.push(ep);
  }
  const slots = [...slotMap.entries()].sort(([a], [b]) => a.localeCompare(b));

  // Matières présentes dans cette demi-journée, triées
  const djMatieres = [...new Set(dj.epreuves.map(e => e.matiere))].sort();

  // Une ligne = un CRÉNEAU HORAIRE (toutes les matières qui commencent à cette heure),
  // pas un triplet : le triplet d'un candidat combine des épreuves à des heures
  // différentes (rotation) — voir l'onglet « Association triplets ».

  const isMatin = dj.type === "MATIN";
  const accentColor = isMatin ? "#B45309" : "#4338CA";

  return (
    <div className="rounded-xl border bg-white shadow-sm overflow-hidden">
      {/* En-tête */}
      <div className="flex items-center justify-between px-4 py-3 border-b" style={{ backgroundColor: isMatin ? "#FFFBEB" : "#EEF2FF", borderLeftWidth: 4, borderLeftColor: accentColor }}>
        <div className="flex items-center gap-2">
          <span className="font-semibold text-sm" style={{ color: accentColor }}>
            {isMatin ? "Matin" : "Après-midi"}
          </span>
          <span className="text-sm text-gray-900 tabular-nums">{hm(dj.heure_debut)} – {hm(dj.heure_fin)}</span>
          {slots.length > 0 && (
            <span className="text-xs text-gray-800">
              · {slots.length} créneau{slots.length > 1 ? "x" : ""} · {dj.epreuves.length} épreuve{dj.epreuves.length > 1 ? "s" : ""}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <Btn label="+ Triplet" icon={Plus} onClick={() => ouvrir("ajout")} small variant="ghost" />
          <Btn label="Supprimer un triplet" icon={Trash2} onClick={() => ouvrir("suppression")} small variant="ghost" />
          <Btn label="Régénérer" icon={RefreshCw} onClick={onRegen} small variant="ghost" />
        </div>
      </div>

      {/* Matrice créneaux × matières */}
      {dj.epreuves.length === 0 ? (
        <p className="px-4 py-5 text-sm text-gray-800 text-center">Aucune épreuve</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr style={{ backgroundColor: accentColor + "10" }}>
                <th className="px-3 py-2 text-left font-semibold text-gray-900 border-b border-black/10 whitespace-nowrap">Horaire</th>
                {djMatieres.map(m => (
                  <th key={m} className="px-3 py-2 text-center font-semibold border-b border-black/10 whitespace-nowrap" style={{ color: accentColor }}>{m}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {slots.map(([slot, epreuves]) => {
                const ref = epreuves.find(e => e.preparation_minutes) ?? epreuves[0];
                const prepa = ref ? heurePrepa(ref.heure_debut, ref.preparation_minutes) : null;
                const finExam = ref?.heure_fin ? hm(ref.heure_fin) : "—";
                return (
                  <tr key={slot} className="border-b border-black/5 last:border-0 hover:bg-black/[0.012] align-top">
                    {/* Horaire : prépa · début – fin */}
                    <td className="px-3 py-2 whitespace-nowrap tabular-nums">
                      {prepa && <div className="text-gray-800">Prépa {prepa}</div>}
                      <div className="text-gray-900 font-semibold">{slot} – {finExam}</div>
                      {epreuves.every((e) => (e.statut === "LIBRE" || e.statut === "CREE") && e.candidat_id == null) && (
                        <button
                          onClick={() => supprimerCreneau(slot, epreuves)}
                          className="mt-1 inline-flex items-center gap-1 text-[11px] text-red-700 hover:underline"
                          title="Supprimer toutes les épreuves de cette ligne horaire"
                        >
                          <Trash2 className="h-3 w-3" /> Supprimer
                        </button>
                      )}
                    </td>
                    {/* Cellules par matière — toutes les salles en parallèle (dédoublement) */}
                    {djMatieres.map(matiere => {
                      const eps = epreuves.filter(e => e.matiere === matiere);
                      if (eps.length === 0) return (
                        <td key={matiere} className="px-2 py-1.5 text-center">
                          <span className="text-gray-700">—</span>
                        </td>
                      );
                      return (
                        <td key={matiere} className="px-2 py-1.5 space-y-1">
                          {eps.map(ep => (
                            <div key={ep.id} className={`rounded-lg border px-2 py-1.5 text-center min-h-[38px] flex flex-col items-center justify-center gap-0.5 ${statutEpreuveCls(ep.statut)}`}>
                              {ep.candidat_nom ? (
                                <span className="font-semibold leading-tight truncate max-w-[130px] block" title={`${ep.candidat_nom} ${ep.candidat_prenom ?? ""}`}>
                                  {ep.candidat_nom} {ep.candidat_prenom?.charAt(0)}.
                                </span>
                              ) : null}
                              <span className="text-[11px] font-semibold">{EPREUVE_STATUT_LABEL[ep.statut] ?? ep.statut}</span>
                              <span className="text-[11px]">
                                {ep.salle_intitule ? <>Salle {ep.salle_intitule}</> : <span className="italic">Salle non assignée</span>}
                              </span>
                            </div>
                          ))}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Panneau ajout / suppression d'un triplet en parallèle */}
      {panneau && (
        <div className="px-4 py-3 border-t bg-gray-50/60 space-y-2">
          <p className="text-xs font-semibold text-gray-900">
            {panneau === "ajout" ? "Nouveau triplet en parallèle" : "Supprimer un triplet en parallèle"}
          </p>
          {modeles === null ? (
            <Spinner />
          ) : modeles.length === 0 ? (
            <p className="text-xs text-gray-800">
              {panneau === "ajout"
                ? "Aucun triplet ne commence dans cette demi-journée : utilisez « Régénérer » ou un gabarit."
                : "Aucun triplet en parallèle libre à supprimer dans cette demi-journée."}
            </p>
          ) : (
            <>
              <div className="flex items-center gap-2 flex-wrap">
                <select
                  value={modeleKey}
                  onChange={(e) => setModeleKey(e.target.value)}
                  className="text-sm border rounded-lg px-2 py-1.5 bg-white text-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-300"
                >
                  {modeles.map((t) => <option key={compo(t)} value={compo(t)}>{compo(t)}</option>)}
                </select>
                <button
                  onClick={panneau === "ajout" ? handleAddTriplet : handleDeleteTriplet}
                  disabled={adding || !modeleKey}
                  className="text-xs font-semibold px-3 py-1.5 rounded-lg text-white bg-[#C62828] hover:bg-[#B71C1C] disabled:opacity-40 flex items-center gap-1.5"
                >
                  {adding && <Loader2 className="h-3 w-3 animate-spin" />}
                  {panneau === "ajout" ? "Créer" : "Supprimer"}
                </button>
                <button onClick={() => setPanneau(null)} className="text-xs text-gray-700 hover:text-black">
                  Annuler
                </button>
              </div>
              <p className="text-xs text-gray-800">
                {panneau === "ajout" ? (
                  <>Crée une épreuve libre par matière, aux mêmes heures que le triplet choisi : les heures de la journée
                  ne changent pas, donc les autres triplets restent identiques. Pensez ensuite à attribuer des salles
                  d&apos;examen différentes de celles du triplet d&apos;origine.</>
                ) : (
                  <>Retire, pour chaque matière, l&apos;épreuve en parallèle la plus récente (libre, sans candidat ni
                  planche). Il reste toujours au moins une épreuve à chaque heure : les autres triplets ne changent pas.</>
                )}
              </p>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function RegenForm({
  demiJourneeId,
  onSuccess,
}: {
  demiJourneeId: number;
  onSuccess: () => void;
}) {
  const toast = useToast();
  const [form, setForm] = useState({
    matieres: "",
    duree_minutes: 30,
    pause_minutes: 5,
    statut_initial: "CREE",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const set = (k: string, v: any) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async () => {
    setLoading(true);
    setError("");
    try {
      const matieres = form.matieres
        .split(",")
        .map((m) => m.trim())
        .filter(Boolean);
      if (!matieres.length) throw new Error("Au moins une matière requise");
      const res = await post<any>(`demi-journees/${demiJourneeId}/generate`, {
        matieres,
        duree_minutes: form.duree_minutes,
        pause_minutes: form.pause_minutes,
        statut_initial: form.statut_initial,
      });
      onSuccess();
      toast.success(`${res.epreuves_created} épreuve(s) générée(s)`);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <Field label="Matières (séparées par virgules)">
        <Input
          value={form.matieres}
          onChange={(e) => set("matieres", e.target.value)}
          placeholder="Maths, Anglais, Français"
        />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Durée (min)">
          <Input
            type="number"
            value={form.duree_minutes}
            onChange={(e) => set("duree_minutes", Number(e.target.value))}
            min={5}
            max={240}
          />
        </Field>
        <Field label="Pause (min)">
          <Input
            type="number"
            value={form.pause_minutes}
            onChange={(e) => set("pause_minutes", Number(e.target.value))}
            min={0}
            max={120}
          />
        </Field>
      </div>
      <Field label="Statut initial">
        <Select
          value={form.statut_initial}
          onChange={(e) => set("statut_initial", e.target.value)}
        >
          <option value="CREE">CREE</option>
          <option value="LIBRE">LIBRE</option>
        </Select>
      </Field>
      <ErrorMsg msg={error} />
      <Btn
        label={loading ? "Génération…" : "Régénérer"}
        icon={RefreshCw}
        onClick={submit}
        disabled={loading || !form.matieres}
      />
    </div>
  );
}
