"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";
import PlanificationView from "./planification/PlanificationView";
import {
  CalendarDays,
  Settings2,
  ChevronLeft,
  ChevronRight,
  Plus,
  Trash2,
  X,
  Loader2,
  RefreshCw,
  Wand2,
  LayoutGrid,
  Menu,
  Users,
  Download,
  Upload,
  Edit2,
  UserPlus,
  Link2,
  GraduationCap,
  BarChart3,
  BookOpen,
  TrendingUp,
  CheckCircle2,
  Clock,
  AlertTriangle,
  FileSpreadsheet,
  Send,
} from "lucide-react";

// ── Constants ──────────────────────────────────────────────────────────────────
const RED = "#C62828";

// ── Types ──────────────────────────────────────────────────────────────────────
type Planning = {
  id: number;
  nom: string;
  date_debut: string;
  date_fin: string;
  date_ouverture_inscriptions: string;
  date_fermeture_inscriptions: string;
  statut: string;
};

type JourneeType = {
  id: number;
  nom: string;
  duree_defaut_minutes: number;
  pause_defaut_minutes: number;
  preparation_defaut_minutes: number;
  statut_initial: string;
};

type Bloc = {
  id: number;
  journee_type_id: number;
  ordre: number;
  type_bloc: "GENERATION" | "PAUSE";
  heure_debut: string;
  heure_fin: string;
  matieres: string[];
  duree_minutes: number | null;
  pause_minutes: number | null;
  preparation_minutes: number | null;
};

type Epreuve = {
  id: number;
  matiere: string;
  heure_debut: string;
  heure_fin: string;
  statut: string;
  candidat_nom?: string | null;
  candidat_prenom?: string | null;
};

type Candidat = {
  id: number;
  planning_id: number;
  nom: string;
  prenom: string;
  email: string;
  code_acces: string;
  statut: string;
};

type DemiJournee = {
  id: number;
  type: string;
  heure_debut: string;
  heure_fin: string;
  epreuves: Epreuve[];
};

type DayViewData = {
  planning_id: number;
  date: string;
  demi_journees: DemiJournee[];
};

type Examinateur = {
  id: number;
  planning_id: number;
  nom: string;
  prenom: string;
  email: string;
  matieres: string[];
  code_acces: string;
};

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

type SectionKey = "plannings" | "journeeTypes" | "candidats" | "examinateurs" | "dashboard" | "conflits" | "parametrages" | "notes";

type MessageType = {
  code: string;
  sujet: string;
  corps_html: string;
};

type Conflit = {
  epreuve_id: number;
  date: string;
  matiere: string;
  heure_debut: string;
  heure_fin: string;
  candidat_id: number;
  candidat_nom: string;
  candidat_prenom: string;
  examinateur_id: number;
  examinateur_nom: string;
  examinateur_prenom: string;
  code_uai: string;
};

// ── API client ─────────────────────────────────────────────────────────────────
async function apiCall<T = unknown>(
  method: string,
  path: string,
  body?: unknown
): Promise<T> {
  const res = await fetch(`/api/backend/${path}`, {
    method,
    headers: body ? { "Content-Type": "application/json" } : {},
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
  });
  if (res.status === 204) return null as T;
  const data = await res.json();
  if (!res.ok) {
    const detail = data.detail;
    const msg = Array.isArray(detail)
      ? detail.map((e: any) => `${e.loc?.slice(-1)[0] ?? ""}: ${e.msg}`).join(" | ")
      : (detail ?? JSON.stringify(data));
    throw new Error(msg);
  }
  return data;
}

const get = <T,>(p: string) => apiCall<T>("GET", p);
const post = <T,>(p: string, b: unknown) => apiCall<T>("POST", p, b);
const put = <T,>(p: string, b: unknown) => apiCall<T>("PUT", p, b);
const patch = <T,>(p: string, b: unknown) => apiCall<T>("PATCH", p, b);
const del = (p: string) => apiCall("DELETE", p);

// ── Utilities ──────────────────────────────────────────────────────────────────
function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + "T12:00:00");
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function formatDate(dateStr: string): string {
  try {
    return new Date(dateStr + "T12:00:00").toLocaleDateString("fr-FR", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  } catch {
    return dateStr;
  }
}

function hm(t: string) {
  return t?.slice(0, 5) ?? "";
}

// ── UI primitives ──────────────────────────────────────────────────────────────
function Spinner() {
  return <Loader2 className="h-4 w-4 animate-spin inline" />;
}

function Modal({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col"
      >
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <h3 className="font-semibold text-base">{title}</h3>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 hover:bg-black/5 transition"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="p-5 overflow-y-auto flex-1">{children}</div>
      </motion.div>
    </div>
  );
}

// ── ImportExcelModal ────────────────────────────────────────────────────────────
function ImportExcelModal({
  open,
  onClose,
  title,
  templateUrl,
  uploadUrl,
  onSuccess,
  resultRenderer,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  templateUrl: string;
  uploadUrl: string;
  onSuccess: () => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  resultRenderer?: (result: any) => React.ReactNode;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [result, setResult] = useState<any>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  function reset() {
    setFile(null);
    setError("");
    setResult(null);
  }

  function handleClose() {
    reset();
    onClose();
    if (result) onSuccess();
  }

  async function handleUpload() {
    if (!file) return;
    setLoading(true);
    setError("");
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch(uploadUrl, {
        method: "POST",
        body: formData,
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail ?? "Erreur lors de l'import");
      }
      setResult(await res.json());
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal open={open} onClose={handleClose} title={title}>
      <div className="space-y-4">
        {/* Template download */}
        <div className="flex items-center justify-between rounded-xl border border-dashed border-gray-200 bg-gray-50 px-4 py-3">
          <p className="text-sm text-gray-600">Télécharger le modèle Excel</p>
          <a
            href={templateUrl}
            className="flex items-center gap-1.5 text-xs font-semibold text-[#C62828] hover:underline"
          >
            <Download className="h-3.5 w-3.5" />
            Modèle .xlsx
          </a>
        </div>

        {/* File picker */}
        {!result && (
          <div>
            <input
              ref={inputRef}
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
            <div
              onClick={() => inputRef.current?.click()}
              className="cursor-pointer rounded-xl border-2 border-dashed border-gray-200 hover:border-[#C62828] transition p-8 text-center"
            >
              {file ? (
                <div>
                  <p className="text-sm font-semibold text-gray-800">{file.name}</p>
                  <p className="text-xs text-gray-400 mt-1">{(file.size / 1024).toFixed(1)} Ko — cliquer pour changer</p>
                </div>
              ) : (
                <div>
                  <Upload className="h-8 w-8 mx-auto mb-2 text-gray-300" />
                  <p className="text-sm text-gray-500">Cliquer pour sélectionner un fichier Excel</p>
                  <p className="text-xs text-gray-400 mt-1">.xlsx uniquement</p>
                </div>
              )}
            </div>
          </div>
        )}

        {error && <div className="rounded-lg bg-red-50 border border-red-100 px-4 py-3 text-sm text-red-600">{error}</div>}

        {/* Résultat */}
        {result && (
          <div className="rounded-xl bg-green-50 border border-green-100 px-4 py-3">
            <p className="text-sm font-semibold text-green-800 mb-2">
              ✓ Import terminé — {result.created} ligne(s) créée(s)
            </p>
            {result.errors?.length > 0 && (
              <div className="mt-2">
                <p className="text-xs font-medium text-amber-700 mb-1">{result.errors.length} avertissement(s) :</p>
                <ul className="text-xs text-amber-700 space-y-0.5">
                  {result.errors.map((e: string, i: number) => <li key={i}>• {e}</li>)}
                </ul>
              </div>
            )}
            {resultRenderer && resultRenderer(result)}
          </div>
        )}

        {/* Actions */}
        {!result && (
          <div className="flex gap-2 justify-end">
            <button onClick={handleClose} className="text-sm text-gray-500 px-4 py-2 rounded-lg hover:bg-gray-100 transition">
              Annuler
            </button>
            <button
              onClick={handleUpload}
              disabled={!file || loading}
              className="flex items-center gap-2 text-sm font-semibold bg-[#C62828] text-white px-4 py-2 rounded-lg hover:bg-[#b71c1c] transition disabled:opacity-50"
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              Importer
            </button>
          </div>
        )}
        {result && (
          <div className="flex justify-end">
            <button onClick={handleClose} className="text-sm font-semibold bg-[#C62828] text-white px-4 py-2 rounded-lg hover:bg-[#b71c1c] transition">
              Fermer
            </button>
          </div>
        )}
      </div>
    </Modal>
  );
}

function Btn({
  label,
  onClick,
  variant = "primary",
  icon: Icon,
  disabled,
  small,
  type = "button",
}: {
  label: string;
  onClick?: () => void;
  variant?: "primary" | "ghost" | "danger";
  icon?: React.ElementType;
  disabled?: boolean;
  small?: boolean;
  type?: "button" | "submit";
}) {
  const size = small ? "px-3 py-1.5 text-xs gap-1.5" : "px-4 py-2 text-sm gap-2";
  const base = `inline-flex items-center rounded-lg font-medium transition focus:outline-none disabled:opacity-50 ${size}`;
  const vars = {
    primary: `text-white hover:opacity-90`,
    ghost: `text-black/60 hover:bg-black/5`,
    danger: `text-red-600 bg-red-50 hover:bg-red-100`,
  };
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`${base} ${vars[variant]}`}
      style={variant === "primary" ? { backgroundColor: RED } : undefined}
    >
      {Icon && <Icon className={small ? "h-3.5 w-3.5" : "h-4 w-4"} />}
      {label}
    </button>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <label className="block text-xs font-medium text-black/50 uppercase tracking-wide">
        {label}
      </label>
      {children}
    </div>
  );
}

function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className="w-full px-3 py-2 rounded-lg border border-black/10 text-sm focus:outline-none focus:ring-2 focus:ring-black/10 bg-white"
    />
  );
}

function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className="w-full px-3 py-2 rounded-lg border border-black/10 text-sm focus:outline-none bg-white"
    />
  );
}

function ErrorMsg({ msg }: { msg: string }) {
  if (!msg) return null;
  return (
    <p className="text-red-600 text-sm rounded-lg bg-red-50 px-3 py-2">{msg}</p>
  );
}

function StatutBadge({ statut }: { statut: string }) {
  const map: Record<string, string> = {
    BROUILLON: "bg-gray-100 text-gray-500",
    OUVERT: "bg-green-100 text-green-700",
    CLOS: "bg-black/10 text-black/50",
    LIBRE: "bg-green-100 text-green-700",
    CREE: "bg-gray-100 text-gray-500",
    ATTRIBUEE: "bg-blue-100 text-blue-700",
    EN_EVALUATION: "bg-yellow-100 text-yellow-700",
    FINALISEE: "bg-purple-100 text-purple-700",
    ANNULEE: "bg-red-100 text-red-500",
  };
  return (
    <span
      className={`inline-block text-xs px-2 py-0.5 rounded-full font-medium ${map[statut] ?? "bg-gray-100 text-gray-500"}`}
    >
      {statut}
    </span>
  );
}

function Empty({ message, sub }: { message: string; sub?: string }) {
  return (
    <div className="rounded-xl border border-dashed border-black/15 p-14 text-center">
      <p className="text-black/40 font-medium">{message}</p>
      {sub && <p className="text-sm text-black/30 mt-1">{sub}</p>}
    </div>
  );
}

// ── Section : Plannings ────────────────────────────────────────────────────────
function PlanningsSection({
  onSelect,
}: {
  onSelect: (p: Planning) => void;
}) {
  const [plannings, setPlannings] = useState<Planning[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [editPlanning, setEditPlanning] = useState<Planning | null>(null);
  const [importPlanning, setImportPlanning] = useState<Planning | null>(null);

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
    if (!confirm("Supprimer ce planning et toutes ses données ?")) return;
    try {
      await del(`plannings/${id}`);
      load();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : String(e));
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
      load();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-semibold">Plannings</h2>
          <p className="text-sm text-black/40 mt-0.5">
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
        <div className="flex justify-center py-16 text-black/30">
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
        <div className="rounded-xl border bg-white shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[#F5F5F5] text-left">
                {["Nom", "Période", "Statut", ""].map((h) => (
                  <th
                    key={h}
                    className="px-5 py-3.5 text-xs font-semibold text-black/50 tracking-wide"
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
                  <td className="px-5 py-3.5 text-black/50 text-xs">
                    {p.date_debut} &rarr; {p.date_fin}
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
                  <td className="px-5 py-3.5 text-right">
                    <div className="flex items-center justify-end gap-2 flex-wrap">
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
                      <Btn
                        label="Import"
                        onClick={() => setImportPlanning(p)}
                        small
                        variant="ghost"
                        icon={Upload}
                      />
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
              load();
            }}
          />
        )}
      </Modal>

      <Modal
        open={!!importPlanning}
        onClose={() => setImportPlanning(null)}
        title={`Importer Excel — ${importPlanning?.nom ?? ""}`}
      >
        {importPlanning && (
          <ImportPlanningForm
            planningId={importPlanning.id}
            onSuccess={() => {
              setImportPlanning(null);
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
    date_ouverture_inscriptions: planning.date_ouverture_inscriptions ?? "",
    date_fermeture_inscriptions: planning.date_fermeture_inscriptions ?? "",
    statut: planning.statut,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const setF = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

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
      <Field label="Statut">
        <Select value={form.statut} onChange={(e) => setF("statut", e.target.value)}>
          <option value="BROUILLON">BROUILLON</option>
          <option value="OUVERT">OUVERT</option>
          <option value="CLOS">CLOS</option>
        </Select>
      </Field>
      <ErrorMsg msg={error} />
      <Btn
        label={loading ? "Enregistrement…" : "Enregistrer"}
        onClick={submit}
        disabled={loading || !form.nom}
      />
    </div>
  );
}

function ImportPlanningForm({
  planningId,
  onSuccess,
}: {
  planningId: number;
  onSuccess: () => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<string>("");

  const handleDownloadTemplate = () => {
    const a = document.createElement("a");
    a.href = `/api/backend/plannings/template/import`;
    a.download = `template_import.xlsx`;
    a.click();
  };

  const submit = async () => {
    if (!file) return;
    setLoading(true);
    setError("");
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch(`/api/backend/plannings/${planningId}/import`, {
        method: "POST",
        body: fd,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail ?? JSON.stringify(data));
      setResult(JSON.stringify(data, null, 2));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  if (result) {
    return (
      <div className="space-y-4">
        <div className="rounded-xl bg-green-50 border border-green-100 p-4">
          <p className="font-semibold text-green-700 text-sm">Import réussi</p>
          <pre className="text-xs text-green-600 mt-1 whitespace-pre-wrap">{result}</pre>
        </div>
        <Btn label="Fermer" onClick={onSuccess} />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={handleDownloadTemplate}
          className="text-xs text-blue-600 underline hover:no-underline"
        >
          Télécharger le template Excel
        </button>
      </div>
      <Field label="Fichier Excel (.xlsx)">
        <input
          type="file"
          accept=".xlsx,.xls"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          className="w-full text-sm text-black/60 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-medium file:bg-black/5 hover:file:bg-black/10"
        />
      </Field>
      <ErrorMsg msg={error} />
      <Btn
        label={loading ? "Import…" : "Importer"}
        icon={Upload}
        onClick={submit}
        disabled={loading || !file}
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

// ── Section : Vue journée ──────────────────────────────────────────────────────
function PlanningDaySection({
  planning,
  journeeTypes,
  onBack,
}: {
  planning: Planning;
  journeeTypes: JourneeType[];
  onBack: () => void;
}) {
  const [date, setDate] = useState(planning.date_debut);
  const [dayData, setDayData] = useState<DayViewData | null>(null);
  const [loading, setLoading] = useState(false);
  const [applyModal, setApplyModal] = useState(false);
  const [regenDj, setRegenDj] = useState<DemiJournee | null>(null);
  const [dndMode, setDndMode] = useState(false);

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
    loadDay();
  }, [loadDay]);

  if (dndMode) {
    return <PlanificationView planning={planning} onBack={() => setDndMode(false)} />;
  }

  return (
    <div className="max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={onBack}
          className="h-9 w-9 rounded-lg border bg-white shadow-sm grid place-items-center hover:bg-black/[0.02] transition"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <div>
          <p className="text-xs text-black/40 uppercase tracking-wide">
            Planning
          </p>
          <h2 className="text-xl font-semibold leading-tight">{planning.nom}</h2>
        </div>
        <StatutBadge statut={planning.statut} />
      </div>

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
          <span className="text-sm text-black/40 hidden sm:block">
            {formatDate(date)}
          </span>
        </div>
        <div className="flex gap-2">
          <Btn
            label="Planification DnD"
            icon={LayoutGrid}
            onClick={() => setDndMode(true)}
            small
          />
          <Btn
            label="Appliquer un gabarit"
            icon={Wand2}
            onClick={() => setApplyModal(true)}
          />
          <Btn
            label="Rafraîchir"
            icon={RefreshCw}
            onClick={loadDay}
            variant="ghost"
            small
          />
        </div>
      </div>

      {/* Day content */}
      {loading ? (
        <div className="flex justify-center py-16 text-black/30">
          <Spinner />
        </div>
      ) : !dayData || dayData.demi_journees.length === 0 ? (
        <div className="rounded-xl border border-dashed border-black/15 p-14 text-center">
          <CalendarDays className="h-8 w-8 mx-auto mb-3 text-black/20" />
          <p className="text-black/40 font-medium">Aucune demi-journée</p>
          <p className="text-sm text-black/30 mt-1">
            Cliquez sur &laquo; Appliquer un gabarit &raquo; pour générer les
            créneaux de cette journée.
          </p>
        </div>
      ) : (
        <div className="grid gap-5 md:grid-cols-2">
          {dayData.demi_journees.map((dj) => (
            <DemiJourneeCard
              key={dj.id}
              dj={dj}
              planningId={planning.id}
              onRegen={() => setRegenDj(dj)}
              onRefresh={loadDay}
            />
          ))}
        </div>
      )}

      {/* Modals */}
      <Modal
        open={applyModal}
        onClose={() => setApplyModal(false)}
        title="Appliquer un gabarit"
      >
        {journeeTypes.length === 0 ? (
          <p className="text-sm text-black/50">
            Aucune journée type disponible. Créez-en une dans la section
            &laquo; Journées types &raquo;.
          </p>
        ) : (
          <ApplyForm
            planningId={planning.id}
            date={date}
            journeeTypes={journeeTypes}
            onSuccess={() => {
              setApplyModal(false);
              loadDay();
            }}
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
            onSuccess={() => {
              setRegenDj(null);
              loadDay();
            }}
          />
        )}
      </Modal>
    </div>
  );
}

const EPREUVE_STATUTS = ["CREE", "LIBRE", "ATTRIBUEE", "EN_EVALUATION", "FINALISEE", "ANNULEE"];

function EpreuveRow({
  epreuve,
  planningId,
  onRefresh,
}: {
  epreuve: Epreuve;
  planningId: number;
  onRefresh: () => void;
}) {
  const [changing, setChanging] = useState(false);
  const [open, setOpen] = useState(false);

  const statutCls = (s: string) => {
    if (s === "LIBRE") return "bg-green-50 text-green-700";
    if (s === "ATTRIBUEE") return "bg-blue-50 text-blue-700";
    if (s === "CREE") return "bg-gray-50 text-gray-500";
    if (s === "EN_EVALUATION") return "bg-yellow-50 text-yellow-700";
    if (s === "FINALISEE") return "bg-purple-50 text-purple-700";
    if (s === "ANNULEE") return "bg-red-50 text-red-500";
    return "bg-gray-50 text-gray-400";
  };

  const handleStatut = async (newStatut: string) => {
    setOpen(false);
    setChanging(true);
    try {
      await patch(`plannings/${planningId}/epreuves/${epreuve.id}`, { statut: newStatut });
      onRefresh();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : String(e));
    } finally {
      setChanging(false);
    }
  };

  return (
    <div className="flex items-center justify-between px-4 py-2.5 hover:bg-black/[0.01] transition">
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <span className="text-xs text-black/40 font-mono w-24 shrink-0">
          {hm(epreuve.heure_debut)} – {hm(epreuve.heure_fin)}
        </span>
        <div className="flex flex-col min-w-0">
          <span className="text-sm font-medium">{epreuve.matiere}</span>
          {epreuve.candidat_nom && (
            <span className="text-xs text-black/40 truncate">
              {epreuve.candidat_prenom} {epreuve.candidat_nom}
            </span>
          )}
        </div>
      </div>
      <div className="relative">
        {changing ? (
          <Spinner />
        ) : (
          <button
            onClick={() => setOpen((o) => !o)}
            className={`text-xs px-2 py-0.5 rounded-full cursor-pointer hover:opacity-80 transition ${statutCls(epreuve.statut)}`}
          >
            {epreuve.statut}
          </button>
        )}
        {open && (
          <div className="absolute right-0 top-full mt-1 z-10 bg-white rounded-xl border shadow-lg py-1 min-w-[140px]">
            {EPREUVE_STATUTS.map((s) => (
              <button
                key={s}
                onClick={() => handleStatut(s)}
                className={`w-full text-left px-3 py-1.5 text-xs hover:bg-black/5 transition ${s === epreuve.statut ? "font-semibold" : ""}`}
              >
                {s}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function DemiJourneeCard({
  dj,
  planningId,
  onRegen,
  onRefresh,
}: {
  dj: DemiJournee;
  planningId: number;
  onRegen: () => void;
  onRefresh: () => void;
}) {
  return (
    <div className="rounded-xl border bg-white shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 bg-[#FAFAFA] border-b">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-sm">
            {dj.type === "MATIN" ? "Matin" : "Après-midi"}
          </span>
          <span className="text-xs text-black/40">
            {hm(dj.heure_debut)} – {hm(dj.heure_fin)}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-black/30">{dj.epreuves.length} créneaux</span>
          <Btn
            label="Régénérer"
            icon={RefreshCw}
            onClick={onRegen}
            small
            variant="ghost"
          />
        </div>
      </div>

      <div className="divide-y divide-black/5">
        {dj.epreuves.length === 0 ? (
          <p className="px-4 py-3 text-sm text-black/30">Aucune épreuve</p>
        ) : (
          dj.epreuves.map((e) => (
            <EpreuveRow
              key={e.id}
              epreuve={e}
              planningId={planningId}
              onRefresh={onRefresh}
            />
          ))
        )}
      </div>
    </div>
  );
}

function ApplyForm({
  planningId,
  date,
  journeeTypes,
  onSuccess,
}: {
  planningId: number;
  date: string;
  journeeTypes: JourneeType[];
  onSuccess: () => void;
}) {
  const [jtId, setJtId] = useState(journeeTypes[0]?.id ?? 0);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{
    demi_journees_created: number;
    epreuves_created: number;
  } | null>(null);
  const [error, setError] = useState("");

  const submit = async () => {
    setLoading(true);
    setError("");
    try {
      const r = await post<any>(`plannings/${planningId}/apply-journee-type`, {
        journee_type_id: jtId,
        date,
      });
      setResult(r);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  if (result) {
    return (
      <div className="space-y-4">
        <div className="rounded-xl bg-green-50 border border-green-100 p-4">
          <p className="font-semibold text-green-700 text-sm">
            Génération réussie
          </p>
          <p className="text-sm text-green-600 mt-1">
            {result.demi_journees_created} demi-journée(s) créée(s) &bull;{" "}
            {result.epreuves_created} épreuve(s) générée(s)
          </p>
        </div>
        <Btn label="Fermer" onClick={onSuccess} />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Field label="Gabarit de journée type">
        <Select
          value={jtId}
          onChange={(e) => setJtId(Number(e.target.value))}
        >
          {journeeTypes.map((jt) => (
            <option key={jt.id} value={jt.id}>
              {jt.nom} — {jt.duree_defaut_minutes}min / pause{" "}
              {jt.pause_defaut_minutes}min
            </option>
          ))}
        </Select>
      </Field>
      <p className="text-sm text-black/40">
        Date :{" "}
        <strong className="text-black/60">{formatDate(date)}</strong>
      </p>
      <ErrorMsg msg={error} />
      <div className="flex items-center gap-2 pt-1">
        <Btn
          label={loading ? "Génération…" : "Générer"}
          icon={Wand2}
          onClick={submit}
          disabled={loading || !jtId}
        />
        {loading && <Spinner />}
      </div>
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
      alert(`${res.epreuves_created} épreuve(s) générée(s).`);
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

// ── Section : Journées types ───────────────────────────────────────────────────
function JourneeTypesSection() {
  const [jts, setJts] = useState<JourneeType[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [expanded, setExpanded] = useState<number | null>(null);

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
    if (!confirm("Supprimer cette journée type ?")) return;
    try {
      await del(`journee-types/${id}`);
      load();
    } catch (e: any) {
      alert(e.message);
    }
  };

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-semibold">Journées types</h2>
          <p className="text-sm text-black/40 mt-0.5">
            Gabarits de génération des créneaux
          </p>
        </div>
        <Btn
          label="Nouvelle journée type"
          icon={Plus}
          onClick={() => setShowCreate(true)}
        />
      </div>

      {loading ? (
        <div className="flex justify-center py-16 text-black/30">
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
                  <span className="text-xs text-black/30">
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
                    label={
                      expanded === jt.id ? "Fermer" : "Gérer les blocs"
                    }
                    icon={Settings2}
                    onClick={() =>
                      setExpanded(expanded === jt.id ? null : jt.id)
                    }
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
                {expanded === jt.id && (
                  <motion.div
                    key="blocs"
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden border-t"
                  >
                    <BlocsManager
                      jtId={jt.id}
                      dureeDefaut={jt.duree_defaut_minutes}
                      pauseDefaut={jt.pause_defaut_minutes}
                      preparationDefaut={jt.preparation_defaut_minutes}
                    />
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
      >
        <CreateJourneeTypeForm
          onSuccess={() => {
            setShowCreate(false);
            load();
          }}
        />
      </Modal>
    </div>
  );
}

function CreateJourneeTypeForm({ onSuccess }: { onSuccess: () => void }) {
  const [form, setForm] = useState({
    nom: "",
    duree_defaut_minutes: 30,
    pause_defaut_minutes: 5,
    preparation_defaut_minutes: 0,
    statut_initial: "CREE",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const set = (k: string, v: any) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async () => {
    setLoading(true);
    setError("");
    try {
      await post("journee-types/", form);
      onSuccess();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <Field label="Nom">
        <Input
          value={form.nom}
          onChange={(e) => set("nom", e.target.value)}
          placeholder="Journée standard ECG"
        />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Durée défaut (min)">
          <Input
            type="number"
            value={form.duree_defaut_minutes}
            onChange={(e) =>
              set("duree_defaut_minutes", Number(e.target.value))
            }
            min={5}
            max={240}
          />
        </Field>
        <Field label="Pause défaut (min)">
          <Input
            type="number"
            value={form.pause_defaut_minutes}
            onChange={(e) =>
              set("pause_defaut_minutes", Number(e.target.value))
            }
            min={0}
            max={120}
          />
        </Field>
      </div>
      <Field label="Préparation défaut (min)">
        <Input
          type="number"
          value={form.preparation_defaut_minutes}
          onChange={(e) =>
            set("preparation_defaut_minutes", Number(e.target.value))
          }
          min={0}
          max={120}
        />
      </Field>
      <Field label="Statut initial des épreuves">
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
        label={loading ? "Création…" : "Créer"}
        onClick={submit}
        disabled={loading || !form.nom}
      />
    </div>
  );
}

function BlocsManager({
  jtId,
  dureeDefaut,
  pauseDefaut,
  preparationDefaut,
}: {
  jtId: number;
  dureeDefaut: number;
  pauseDefaut: number;
  preparationDefaut: number;
}) {
  const [blocs, setBlocs] = useState<Bloc[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);

  const load = useCallback(async () => {
    try {
      setBlocs(await get<Bloc[]>(`journee-types/${jtId}/blocs`));
    } catch {}
  }, [jtId]);

  useEffect(() => {
    load();
  }, [load]);

  const handleDelete = async (blocId: number) => {
    await del(`journee-types/blocs/${blocId}`);
    if (editingId === blocId) setEditingId(null);
    load();
  };

  return (
    <div className="px-5 py-4 bg-[#FAFAFA]">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-semibold text-black/40 uppercase tracking-wide">
          Blocs ({blocs.length})
        </span>
        <Btn
          label={showAdd ? "Annuler" : "Ajouter un bloc"}
          icon={showAdd ? X : Plus}
          onClick={() => { setShowAdd((s) => !s); setEditingId(null); }}
          small
          variant="ghost"
        />
      </div>

      {blocs.length === 0 && !showAdd && (
        <p className="text-sm text-black/30 mb-3">
          Aucun bloc. Ajoutez des blocs{" "}
          <strong className="text-blue-600">GENERATION</strong> et{" "}
          <strong className="text-orange-500">PAUSE</strong> pour structurer la journée.
        </p>
      )}

      {blocs.length > 0 && (
        <div className="space-y-2 mb-3">
          {blocs.map((b) => (
            <div key={b.id}>
              <AnimatePresence mode="wait">
                {editingId === b.id ? (
                  <motion.div
                    key="edit"
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    className="bg-white rounded-xl border border-blue-200 p-4"
                  >
                    <EditBlocForm
                      bloc={b}
                      dureeDefaut={dureeDefaut}
                      pauseDefaut={pauseDefaut}
                      preparationDefaut={preparationDefaut}
                      onSuccess={() => { setEditingId(null); load(); }}
                      onCancel={() => setEditingId(null)}
                    />
                  </motion.div>
                ) : (
                  <motion.div
                    key="row"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="flex items-center justify-between bg-white rounded-lg px-4 py-2.5 border border-black/5"
                  >
                    <div className="flex items-center gap-3 flex-wrap">
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                          b.type_bloc === "GENERATION"
                            ? "bg-blue-100 text-blue-700"
                            : "bg-orange-100 text-orange-600"
                        }`}
                      >
                        {b.type_bloc}
                      </span>
                      <span className="text-xs font-mono text-black/50">
                        {hm(b.heure_debut)} – {hm(b.heure_fin)}
                      </span>
                      {b.type_bloc === "GENERATION" && (
                        <>
                          <span className="text-xs text-black/40">
                            {b.matieres.join(", ")}
                          </span>
                          <span className="text-xs text-black/30">
                            {b.duree_minutes ?? dureeDefaut}min /{" "}
                            {b.pause_minutes ?? pauseDefaut}min pause /{" "}
                            {b.preparation_minutes ?? preparationDefaut}min prép.
                          </span>
                        </>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => { setEditingId(b.id); setShowAdd(false); }}
                        className="p-1 hover:text-blue-500 text-black/20 transition"
                        title="Modifier"
                      >
                        <Edit2 className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => handleDelete(b.id)}
                        className="p-1 hover:text-red-500 text-black/20 transition"
                        title="Supprimer"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ))}
        </div>
      )}

      <AnimatePresence>
        {showAdd && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="bg-white rounded-xl border border-black/10 p-4"
          >
            <AddBlocForm
              jtId={jtId}
              dureeDefaut={dureeDefaut}
              pauseDefaut={pauseDefaut}
              preparationDefaut={preparationDefaut}
              onSuccess={() => {
                setShowAdd(false);
                load();
              }}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function AddBlocForm({
  jtId,
  dureeDefaut,
  pauseDefaut,
  preparationDefaut,
  onSuccess,
}: {
  jtId: number;
  dureeDefaut: number;
  pauseDefaut: number;
  preparationDefaut: number;
  onSuccess: () => void;
}) {
  const [form, setForm] = useState({
    ordre: 1,
    type_bloc: "GENERATION",
    heure_debut: "08:30",
    heure_fin: "12:00",
    matieres: "",
    duree_minutes: dureeDefaut,
    pause_minutes: pauseDefaut,
    preparation_minutes: preparationDefaut,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const set = (k: string, v: any) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async () => {
    setLoading(true);
    setError("");
    try {
      const body: any = {
        ordre: form.ordre,
        type_bloc: form.type_bloc,
        heure_debut: form.heure_debut + ":00",
        heure_fin: form.heure_fin + ":00",
      };
      if (form.type_bloc === "GENERATION") {
        const matieres = form.matieres
          .split(",")
          .map((m) => m.trim())
          .filter(Boolean);
        if (!matieres.length) throw new Error("Au moins une matière requise");
        body.matieres = matieres;
        body.duree_minutes = form.duree_minutes;
        body.pause_minutes = form.pause_minutes;
        body.preparation_minutes = form.preparation_minutes;
      }
      await post(`journee-types/${jtId}/blocs`, body);
      onSuccess();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-3">
      <p className="text-xs font-semibold text-black/40 uppercase tracking-wide mb-2">
        Nouveau bloc
      </p>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Ordre">
          <Input
            type="number"
            value={form.ordre}
            onChange={(e) => set("ordre", Number(e.target.value))}
            min={1}
          />
        </Field>
        <Field label="Type">
          <Select
            value={form.type_bloc}
            onChange={(e) => set("type_bloc", e.target.value)}
          >
            <option value="GENERATION">GENERATION</option>
            <option value="PAUSE">PAUSE</option>
          </Select>
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Heure début">
          <Input
            type="time"
            value={form.heure_debut}
            onChange={(e) => set("heure_debut", e.target.value)}
          />
        </Field>
        <Field label="Heure fin">
          <Input
            type="time"
            value={form.heure_fin}
            onChange={(e) => set("heure_fin", e.target.value)}
          />
        </Field>
      </div>
      {form.type_bloc === "GENERATION" && (
        <>
          <Field label="Matières (séparées par virgules)">
            <Input
              value={form.matieres}
              onChange={(e) => set("matieres", e.target.value)}
              placeholder="Maths, Anglais, Français"
            />
          </Field>
          <div className="grid grid-cols-3 gap-3">
            <Field label="Durée oral (min)">
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
            <Field label="Préparation (min)">
              <Input
                type="number"
                value={form.preparation_minutes}
                onChange={(e) => set("preparation_minutes", Number(e.target.value))}
                min={0}
                max={120}
              />
            </Field>
          </div>
        </>
      )}
      <ErrorMsg msg={error} />
      <Btn
        label={loading ? "Ajout…" : "Ajouter le bloc"}
        onClick={submit}
        disabled={loading}
        small
      />
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
  onSuccess: () => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState({
    ordre: bloc.ordre,
    heure_debut: hm(bloc.heure_debut),
    heure_fin: hm(bloc.heure_fin),
    matieres: bloc.matieres.join(", "),
    duree_minutes: bloc.duree_minutes ?? dureeDefaut,
    pause_minutes: bloc.pause_minutes ?? pauseDefaut,
    preparation_minutes: bloc.preparation_minutes ?? preparationDefaut,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const set = (k: string, v: any) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async () => {
    setLoading(true);
    setError("");
    try {
      const body: any = {
        ordre: form.ordre,
        heure_debut: form.heure_debut + ":00",
        heure_fin: form.heure_fin + ":00",
      };
      if (bloc.type_bloc === "GENERATION") {
        const matieres = form.matieres.split(",").map((m) => m.trim()).filter(Boolean);
        if (!matieres.length) throw new Error("Au moins une matière requise");
        body.matieres = matieres;
        body.duree_minutes = form.duree_minutes;
        body.pause_minutes = form.pause_minutes;
        body.preparation_minutes = form.preparation_minutes;
      } else {
        body.matieres = [];
      }
      await put(`journee-types/blocs/${bloc.id}`, body);
      onSuccess();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between mb-1">
        <p className="text-xs font-semibold text-black/40 uppercase tracking-wide">
          Modifier le bloc{" "}
          <span className={`px-1.5 py-0.5 rounded-full ${bloc.type_bloc === "GENERATION" ? "bg-blue-100 text-blue-700" : "bg-orange-100 text-orange-600"}`}>
            {bloc.type_bloc}
          </span>
        </p>
        <button onClick={onCancel} className="p-1 hover:text-black/60 text-black/20 transition">
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
          <Field label="Matières (séparées par virgules)">
            <Input value={form.matieres} onChange={(e) => set("matieres", e.target.value)} placeholder="Maths, Anglais, Français" />
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

// ── Section : Candidats ────────────────────────────────────────────────────────
function CandidatsSection() {
  const [plannings, setPlannings] = useState<Planning[]>([]);
  const [candidats, setCandidats] = useState<Candidat[]>([]);
  const [planningId, setPlanningId] = useState<number | "">("");
  const [loading, setLoading] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [tab, setTab] = useState<"liste" | "affectation">("liste");
  const [error, setError] = useState("");

  useEffect(() => {
    get<Planning[]>("plannings/")
      .then(setPlannings)
      .catch(() => {});
  }, []);

  const loadCandidats = useCallback(async () => {
    if (!planningId) return;
    setLoading(true);
    setError("");
    try {
      setCandidats(await get<Candidat[]>(`candidats/?planning_id=${planningId}`));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [planningId]);

  useEffect(() => {
    loadCandidats();
  }, [loadCandidats]);

  const handleDelete = async (id: number) => {
    if (!confirm("Supprimer ce candidat ?")) return;
    try {
      await del(`candidats/${id}`);
      loadCandidats();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-semibold">Candidats</h2>
          <p className="text-sm text-black/40 mt-0.5">Gérez les candidats et leurs inscriptions</p>
        </div>
        <div className="flex items-center gap-2">
          <Btn
            label="Importer Excel"
            icon={Upload}
            onClick={() => setShowImport(true)}
            disabled={!planningId}
            variant="ghost"
            small
          />
          <Btn
            label="Ajouter un candidat"
            icon={UserPlus}
            onClick={() => setShowCreate(true)}
            disabled={!planningId}
          />
        </div>
      </div>

      <div className="mb-5">
        <Field label="Filtrer par planning">
          <Select
            value={planningId}
            onChange={(e) => {
              setPlanningId(e.target.value ? Number(e.target.value) : "");
              setTab("liste");
            }}
          >
            <option value="">-- Sélectionner un planning --</option>
            {plannings.map((p) => (
              <option key={p.id} value={p.id}>{p.nom}</option>
            ))}
          </Select>
        </Field>
      </div>

      {!planningId ? (
        <Empty message="Sélectionnez un planning" sub="Choisissez un planning ci-dessus pour voir ses candidats." />
      ) : (
        <>
          {/* Onglets */}
          <div className="flex border-b border-gray-200 mb-5">
            {(["liste", "affectation"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition ${
                  tab === t
                    ? "border-[#C62828] text-[#C62828]"
                    : "border-transparent text-black/50 hover:text-black"
                }`}
              >
                {t === "liste" ? "Liste" : "Affectation aux épreuves"}
              </button>
            ))}
          </div>

          {tab === "liste" && (
            <>
              {loading ? (
                <div className="flex justify-center py-16 text-black/30"><Spinner /></div>
              ) : error ? (
                <ErrorMsg msg={error} />
              ) : candidats.length === 0 ? (
                <Empty message="Aucun candidat" sub="Ajoutez des candidats à ce planning." />
              ) : (
                <div className="rounded-xl border bg-white shadow-sm overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-[#F5F5F5] text-left">
                        {["Nom", "Prénom", "Email", "Code d'accès", "Statut", ""].map((h) => (
                          <th key={h} className="px-5 py-3.5 text-xs font-semibold text-black/50 tracking-wide">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {candidats.map((c) => (
                        <tr key={c.id} className="border-t border-black/5 hover:bg-black/[0.012] transition">
                          <td className="px-5 py-3.5 font-medium">{c.nom}</td>
                          <td className="px-5 py-3.5">{c.prenom}</td>
                          <td className="px-5 py-3.5 text-black/50">{c.email}</td>
                          <td className="px-5 py-3.5">
                            <code className="text-xs bg-black/5 px-2 py-0.5 rounded font-mono">{c.code_acces}</code>
                          </td>
                          <td className="px-5 py-3.5"><StatutBadge statut={c.statut} /></td>
                          <td className="px-5 py-3.5 text-right">
                            <Btn
                              label="Supprimer"
                              icon={Trash2}
                              onClick={() => handleDelete(c.id)}
                              small
                              variant="danger"
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}

          {tab === "affectation" && (
            <AffectationCandidatsTab planningId={planningId as number} candidats={candidats} />
          )}
        </>
      )}

      <ImportExcelModal
        open={showImport}
        onClose={() => setShowImport(false)}
        title="Importer des candidats"
        templateUrl={`/api/backend/excel/candidats/template`}
        uploadUrl={`/api/backend/excel/plannings/${planningId}/candidats/import`}
        onSuccess={loadCandidats}
        resultRenderer={(r) => r.candidats?.length > 0 && (
          <div className="mt-3 max-h-40 overflow-y-auto">
            <p className="text-xs font-medium text-green-700 mb-1">Mots de passe provisoires :</p>
            <table className="w-full text-xs">
              <thead><tr><th className="text-left text-green-700">Nom</th><th className="text-left text-green-700">Login</th><th className="text-left text-green-700">MDP provisoire</th></tr></thead>
              <tbody>
                {r.candidats.map((c: {id: number; prenom: string; nom: string; login: string; password_provisoire: string}) => (
                  <tr key={c.id}><td>{c.prenom} {c.nom}</td><td className="font-mono">{c.login}</td><td className="font-mono font-bold">{c.password_provisoire}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      />

      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Ajouter un candidat">
        <CreateCandidatForm
          plannings={plannings}
          defaultPlanningId={planningId !== "" ? planningId : undefined}
          onSuccess={() => { setShowCreate(false); loadCandidats(); }}
        />
      </Modal>
    </div>
  );
}

function CreateCandidatForm({
  plannings,
  defaultPlanningId,
  onSuccess,
}: {
  plannings: Planning[];
  defaultPlanningId?: number;
  onSuccess: () => void;
}) {
  const [form, setForm] = useState({
    planning_id: defaultPlanningId ?? (plannings[0]?.id ?? 0),
    nom: "",
    prenom: "",
    email: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const setF = (k: string, v: string | number) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async () => {
    setLoading(true);
    setError("");
    try {
      await post("candidats/", form);
      onSuccess();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <Field label="Planning">
        <Select value={form.planning_id} onChange={(e) => setF("planning_id", Number(e.target.value))}>
          {plannings.map((p) => (
            <option key={p.id} value={p.id}>{p.nom}</option>
          ))}
        </Select>
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Nom">
          <Input value={form.nom} onChange={(e) => setF("nom", e.target.value)} placeholder="DUPONT" />
        </Field>
        <Field label="Prénom">
          <Input value={form.prenom} onChange={(e) => setF("prenom", e.target.value)} placeholder="Alice" />
        </Field>
      </div>
      <Field label="Email">
        <Input type="email" value={form.email} onChange={(e) => setF("email", e.target.value)} placeholder="alice.dupont@exemple.fr" />
      </Field>
      <ErrorMsg msg={error} />
      <Btn
        label={loading ? "Création…" : "Créer le candidat"}
        icon={UserPlus}
        onClick={submit}
        disabled={loading || !form.nom || !form.prenom}
      />
    </div>
  );
}

function AffectationCandidatsTab({ planningId, candidats }: { planningId: number; candidats: Candidat[] }) {
  const [epreuves, setEpreuves] = useState<EpreuveAffectation[]>([]);
  const [loading, setLoading] = useState(true);
  const [assigning, setAssigning] = useState<Record<number, boolean>>({});
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await get<EpreuveAffectation[]>(`plannings/${planningId}/epreuves`);
      setEpreuves(data);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [planningId]);

  useEffect(() => { load(); }, [load]);

  async function assigner(epreuve: EpreuveAffectation, candidatId: number | null) {
    setAssigning((a) => ({ ...a, [epreuve.id]: true }));
    setError("");
    try {
      await post(`candidats/epreuves/${epreuve.id}/assigner`, { candidat_id: candidatId });
      const c = candidatId ? candidats.find((x) => x.id === candidatId) : null;
      setEpreuves((prev) =>
        prev.map((ep) =>
          ep.id === epreuve.id
            ? { ...ep, candidat_id: c?.id ?? null, candidat_nom: c?.nom ?? null, candidat_prenom: c?.prenom ?? null }
            : ep
        )
      );
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setAssigning((a) => ({ ...a, [epreuve.id]: false }));
    }
  }

  const byDate = epreuves.reduce<Record<string, EpreuveAffectation[]>>((acc, e) => {
    (acc[e.date] ??= []).push(e);
    return acc;
  }, {});

  const assigned = epreuves.filter((e) => e.candidat_id !== null).length;
  const total = epreuves.length;

  if (loading) return <div className="p-8 text-center"><Spinner /></div>;

  return (
    <div className="space-y-4">
      {error && <div className="rounded-lg bg-red-50 border border-red-100 px-4 py-3 text-sm text-red-600">{error}</div>}

      {total > 0 && (
        <div className="bg-white rounded-xl shadow-sm p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-black/60">{assigned} / {total} épreuves attribuées</span>
            <span className="text-xs font-semibold text-[#C62828]">{Math.round((assigned / total) * 100)}%</span>
          </div>
          <div className="w-full bg-gray-100 rounded-full h-1.5">
            <div className="bg-[#C62828] h-1.5 rounded-full transition-all" style={{ width: `${(assigned / total) * 100}%` }} />
          </div>
        </div>
      )}

      {Object.entries(byDate).sort(([a], [b]) => a.localeCompare(b)).map(([date, eps]) => (
        <div key={date}>
          <p className="text-xs font-semibold text-black/40 uppercase tracking-wide mb-2 capitalize">
            {new Date(date + "T12:00:00").toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })}
          </p>
          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-black/2">
                  <th className="text-left px-4 py-2 font-medium text-black/40 text-xs">Horaire</th>
                  <th className="text-left px-4 py-2 font-medium text-black/40 text-xs">Matière</th>
                  <th className="text-left px-4 py-2 font-medium text-black/40 text-xs">Examinateur</th>
                  <th className="text-left px-4 py-2 font-medium text-black/40 text-xs">Candidat</th>
                </tr>
              </thead>
              <tbody>
                {eps.map((ep, i) => (
                  <tr key={ep.id} className={`border-b last:border-0 ${i % 2 === 0 ? "" : "bg-black/[0.01]"}`}>
                    <td className="px-4 py-3 font-mono text-xs text-black/50 whitespace-nowrap">
                      {ep.heure_debut} – {ep.heure_fin}
                    </td>
                    <td className="px-4 py-3 font-medium text-gray-800 whitespace-nowrap">{ep.matiere}</td>
                    <td className="px-4 py-3 text-sm text-black/60">
                      {ep.examinateur_id
                        ? `${ep.examinateur_prenom} ${ep.examinateur_nom}`
                        : <span className="text-black/30 italic text-xs">Non assigné</span>}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <select
                          value={ep.candidat_id ?? ""}
                          onChange={(e) => assigner(ep, e.target.value ? Number(e.target.value) : null)}
                          disabled={assigning[ep.id]}
                          className="w-full border rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-300 disabled:opacity-50"
                        >
                          <option value="">— Aucun —</option>
                          {candidats.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.nom} {c.prenom}
                            </option>
                          ))}
                        </select>
                        {assigning[ep.id] && <Loader2 className="h-3.5 w-3.5 animate-spin text-gray-400 shrink-0" />}
                        {ep.candidat_id && !assigning[ep.id] && (
                          <button
                            onClick={() => assigner(ep, null)}
                            className="shrink-0 text-gray-300 hover:text-red-400 transition"
                            title="Désaffecter"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}

      {epreuves.length === 0 && (
        <div className="bg-white rounded-xl shadow-sm p-10 text-center text-sm text-black/40">
          Aucune épreuve dans ce planning.
        </div>
      )}
    </div>
  );
}

// ── Examinateurs ───────────────────────────────────────────────────────────────
function CreateExaminateurForm({
  planningId,
  onCreated,
}: {
  planningId: number;
  onCreated: () => void;
}) {
  const [nom, setNom] = useState("");
  const [prenom, setPrenom] = useState("");
  const [email, setEmail] = useState("");
  const [matieresStr, setMatieresStr] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function submit() {
    setLoading(true);
    setError("");
    try {
      const matieres = matieresStr
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      await post("examinateurs/", {
        planning_id: planningId,
        nom: nom.toUpperCase(),
        prenom,
        email,
        matieres,
      });
      onCreated();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Erreur");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-3">
      <Field label="Nom"><Input value={nom} onChange={(e) => setNom(e.target.value)} placeholder="MARTIN" /></Field>
      <Field label="Prénom"><Input value={prenom} onChange={(e) => setPrenom(e.target.value)} placeholder="Sophie" /></Field>
      <Field label="Email"><Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="s.martin@ensae.fr" /></Field>
      <Field label="Matières (séparées par virgule)">
        <Input value={matieresStr} onChange={(e) => setMatieresStr(e.target.value)} placeholder="Maths, Économie" />
      </Field>
      <ErrorMsg msg={error} />
      <Btn label={loading ? "Création…" : "Créer"} icon={Plus} onClick={submit} disabled={loading || !nom || !prenom || !email} />
    </div>
  );
}

type EpreuveAffectation = {
  id: number;
  date: string;
  demi_journee_type: string;
  matiere: string;
  heure_debut: string;
  heure_fin: string;
  statut: string;
  candidat_id: number | null;
  candidat_nom: string | null;
  candidat_prenom: string | null;
  examinateur_id: number | null;
  examinateur_nom: string | null;
  examinateur_prenom: string | null;
};

function AffectationTab({ planningId, examinateurs }: { planningId: number; examinateurs: Examinateur[] }) {
  const [epreuves, setEpreuves] = useState<EpreuveAffectation[]>([]);
  const [loading, setLoading] = useState(true);
  const [assigning, setAssigning] = useState<Record<number, boolean>>({});
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await get<EpreuveAffectation[]>(`plannings/${planningId}/epreuves`);
      setEpreuves(data);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [planningId]);

  useEffect(() => { load(); }, [load]);

  async function assigner(epreuve: EpreuveAffectation, examinateurId: number | null) {
    setAssigning((a) => ({ ...a, [epreuve.id]: true }));
    setError("");
    try {
      await post(`examinateurs/epreuves/${epreuve.id}/assigner`, { examinateur_id: examinateurId });
      const ex = examinateurId ? examinateurs.find((e) => e.id === examinateurId) : null;
      setEpreuves((prev) =>
        prev.map((ep) =>
          ep.id === epreuve.id
            ? {
                ...ep,
                examinateur_id: ex?.id ?? null,
                examinateur_nom: ex?.nom ?? null,
                examinateur_prenom: ex?.prenom ?? null,
              }
            : ep
        )
      );
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setAssigning((a) => ({ ...a, [epreuve.id]: false }));
    }
  }

  // Group by date
  const byDate = epreuves.reduce<Record<string, EpreuveAffectation[]>>((acc, e) => {
    (acc[e.date] ??= []).push(e);
    return acc;
  }, {});

  const assigned = epreuves.filter((e) => e.examinateur_id !== null).length;
  const total = epreuves.length;

  if (loading) return <div className="p-8 text-center"><Spinner /></div>;

  return (
    <div className="space-y-4">
      {error && <div className="rounded-lg bg-red-50 border border-red-100 px-4 py-3 text-sm text-red-600">{error}</div>}

      {/* Progression */}
      {total > 0 && (
        <div className="bg-white rounded-xl shadow-sm p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-black/60">{assigned} / {total} épreuves affectées</span>
            <span className="text-xs font-semibold text-[#C62828]">{Math.round((assigned / total) * 100)}%</span>
          </div>
          <div className="w-full bg-gray-100 rounded-full h-1.5">
            <div
              className="bg-[#C62828] h-1.5 rounded-full transition-all"
              style={{ width: `${(assigned / total) * 100}%` }}
            />
          </div>
        </div>
      )}

      {Object.entries(byDate).sort(([a], [b]) => a.localeCompare(b)).map(([date, eps]) => (
        <div key={date}>
          <p className="text-xs font-semibold text-black/40 uppercase tracking-wide mb-2 capitalize">
            {new Date(date + "T12:00:00").toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })}
          </p>
          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-black/2">
                  <th className="text-left px-4 py-2 font-medium text-black/40 text-xs">Horaire</th>
                  <th className="text-left px-4 py-2 font-medium text-black/40 text-xs">Matière</th>
                  <th className="text-left px-4 py-2 font-medium text-black/40 text-xs">Candidat</th>
                  <th className="text-left px-4 py-2 font-medium text-black/40 text-xs">Examinateur</th>
                </tr>
              </thead>
              <tbody>
                {eps.map((ep, i) => {
                  // Examinateurs compatibles : même matière ou sans filtre
                  const compatibles = examinateurs.filter(
                    (ex) => ex.matieres.length === 0 || ex.matieres.includes(ep.matiere)
                  );
                  return (
                    <tr key={ep.id} className={`border-b last:border-0 ${i % 2 === 0 ? "" : "bg-black/[0.01]"}`}>
                      <td className="px-4 py-3 font-mono text-xs text-black/50 whitespace-nowrap">
                        {ep.heure_debut} – {ep.heure_fin}
                      </td>
                      <td className="px-4 py-3 font-medium text-gray-800 whitespace-nowrap">{ep.matiere}</td>
                      <td className="px-4 py-3 text-sm text-black/60">
                        {ep.candidat_id
                          ? `${ep.candidat_prenom} ${ep.candidat_nom}`
                          : <span className="text-black/30 italic text-xs">Non assigné</span>}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <select
                            value={ep.examinateur_id ?? ""}
                            onChange={(e) => assigner(ep, e.target.value ? Number(e.target.value) : null)}
                            disabled={assigning[ep.id]}
                            className="w-full border rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-300 disabled:opacity-50"
                          >
                            <option value="">— Aucun —</option>
                            {compatibles.map((ex) => (
                              <option key={ex.id} value={ex.id}>
                                {ex.nom} {ex.prenom}
                              </option>
                            ))}
                          </select>
                          {assigning[ep.id] && <Loader2 className="h-3.5 w-3.5 animate-spin text-gray-400 shrink-0" />}
                          {ep.examinateur_id && !assigning[ep.id] && (
                            <button
                              onClick={() => assigner(ep, null)}
                              className="shrink-0 text-gray-300 hover:text-red-400 transition"
                              title="Désaffecter"
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ))}

      {epreuves.length === 0 && (
        <div className="bg-white rounded-xl shadow-sm p-10 text-center text-sm text-black/40">
          Aucune épreuve dans ce planning.
        </div>
      )}
    </div>
  );
}

function ExaminateursSection() {
  const [plannings, setPlannings] = useState<Planning[]>([]);
  const [selectedPlanningId, setSelectedPlanningId] = useState<number | null>(null);
  const [examinateurs, setExaminateurs] = useState<Examinateur[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [showImportEx, setShowImportEx] = useState(false);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState<"liste" | "affectation">("liste");

  useEffect(() => {
    get<Planning[]>("plannings/").then(setPlannings).catch(() => {});
  }, []);

  const loadExaminateurs = useCallback(async () => {
    if (!selectedPlanningId) return;
    setLoading(true);
    try {
      const data = await get<Examinateur[]>(`examinateurs/?planning_id=${selectedPlanningId}`);
      setExaminateurs(data);
    } finally {
      setLoading(false);
    }
  }, [selectedPlanningId]);

  useEffect(() => {
    loadExaminateurs();
  }, [loadExaminateurs]);

  async function deleteEx(id: number) {
    if (!confirm("Supprimer cet examinateur ?")) return;
    await del(`examinateurs/${id}`);
    loadExaminateurs();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <GraduationCap className="h-5 w-5 text-[#C62828]" />
        <h2 className="text-lg font-semibold">Examinateurs</h2>
      </div>

      {/* Filtre planning */}
      <div className="bg-white rounded-xl shadow-sm p-4">
        <label className="block text-xs font-medium text-black/50 mb-1.5">Filtrer par planning</label>
        <select
          className="w-full border rounded-lg px-3 py-2 text-sm"
          value={selectedPlanningId ?? ""}
          onChange={(e) => {
            setSelectedPlanningId(e.target.value ? Number(e.target.value) : null);
            setExaminateurs([]);
            setShowCreate(false);
            setTab("liste");
          }}
        >
          <option value="">— Sélectionner un planning —</option>
          {plannings.map((p) => (
            <option key={p.id} value={p.id}>{p.nom}</option>
          ))}
        </select>
      </div>

      {selectedPlanningId && (
        <>
          {/* Onglets */}
          <div className="flex border-b border-gray-200">
            {(["liste", "affectation"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition ${
                  tab === t
                    ? "border-[#C62828] text-[#C62828]"
                    : "border-transparent text-black/50 hover:text-black"
                }`}
              >
                {t === "liste" ? "Liste" : "Affectation aux épreuves"}
              </button>
            ))}
          </div>

          {tab === "liste" && (
            <>
              <div className="flex items-center justify-between">
                <span className="text-sm text-black/50">{examinateurs.length} examinateur(s)</span>
                <div className="flex items-center gap-2">
                  <Btn label="Importer Excel" icon={Upload} small variant="ghost" onClick={() => setShowImportEx(true)} />
                  <Btn label="Ajouter" icon={Plus} small onClick={() => setShowCreate(true)} />
                </div>
              </div>

              <div className="bg-white rounded-xl shadow-sm overflow-hidden">
                {loading ? (
                  <div className="p-8 text-center"><Spinner /></div>
                ) : examinateurs.length === 0 ? (
                  <div className="p-8 text-center text-sm text-black/40">Aucun examinateur</div>
                ) : (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-black/2">
                        <th className="text-left px-4 py-3 font-medium text-black/50 text-xs uppercase tracking-wide">Nom</th>
                        <th className="text-left px-4 py-3 font-medium text-black/50 text-xs uppercase tracking-wide">Email</th>
                        <th className="text-left px-4 py-3 font-medium text-black/50 text-xs uppercase tracking-wide">Matières</th>
                        <th className="text-left px-4 py-3 font-medium text-black/50 text-xs uppercase tracking-wide">Code</th>
                        <th className="px-4 py-3" />
                      </tr>
                    </thead>
                    <tbody>
                      {examinateurs.map((ex) => (
                        <tr key={ex.id} className="border-b last:border-0 hover:bg-black/2 transition">
                          <td className="px-4 py-3 font-medium">{ex.nom} {ex.prenom}</td>
                          <td className="px-4 py-3 text-black/60">{ex.email}</td>
                          <td className="px-4 py-3">
                            <div className="flex flex-wrap gap-1">
                              {ex.matieres.map((m) => (
                                <span key={m} className="text-[10px] bg-blue-50 text-blue-700 rounded px-1.5 py-0.5">{m}</span>
                              ))}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <code className="text-xs bg-black/5 rounded px-1.5 py-0.5">{ex.code_acces}</code>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <button onClick={() => deleteEx(ex.id)} className="text-red-400 hover:text-red-600 transition p-1">
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </>
          )}

          {tab === "affectation" && (
            <AffectationTab planningId={selectedPlanningId} examinateurs={examinateurs} />
          )}
        </>
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
            <p className="text-xs font-medium text-green-700 mb-1">Codes d&apos;accès générés :</p>
            <table className="w-full text-xs">
              <thead><tr><th className="text-left text-green-700">Nom</th><th className="text-left text-green-700">Code accès</th><th className="text-left text-green-700">Matières</th></tr></thead>
              <tbody>
                {r.examinateurs.map((e: {id: number; prenom: string; nom: string; code_acces: string; matieres: string[]}) => (
                  <tr key={e.id}><td>{e.prenom} {e.nom}</td><td className="font-mono font-bold">{e.code_acces}</td><td>{e.matieres.join(", ")}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      />

      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Nouvel examinateur">
        <CreateExaminateurForm
          planningId={selectedPlanningId!}
          onCreated={() => { setShowCreate(false); loadExaminateurs(); }}
        />
      </Modal>
    </div>
  );
}

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
        <div className="text-xs font-medium text-black/50 mt-0.5">{label}</div>
        {sub && <div className="text-xs text-black/30 mt-0.5">{sub}</div>}
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
      <span className="text-xs text-black/40 w-8 text-right">{pct}%</span>
    </div>
  );
}

function DashboardSection() {
  const [plannings, setPlannings] = useState<Planning[]>([]);
  const [selectedPlanningId, setSelectedPlanningId] = useState<number | null>(null);
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    get<Planning[]>("plannings/").then((ps) => {
      setPlannings(ps);
      if (ps.length > 0) setSelectedPlanningId(ps[0].id);
    }).catch(() => {});
  }, []);

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
                <CheckCircle2 className="h-4 w-4 text-black/40" />
                Répartition par statut
              </h3>
              <div className="space-y-3">
                {Object.entries(data.by_statut).map(([statut, count]) => (
                  <div key={statut}>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="font-medium">{statut}</span>
                      <span className="text-black/40">{count}</span>
                    </div>
                    <ProgressBar value={count} max={data.total_epreuves} color={STATUT_COLORS[statut] ?? "#666"} />
                  </div>
                ))}
              </div>
            </div>

            {/* Matières */}
            <div className="bg-white rounded-xl shadow-sm p-5">
              <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
                <BookOpen className="h-4 w-4 text-black/40" />
                Épreuves par matière
              </h3>
              <div className="space-y-3">
                {data.by_matiere.map(({ matiere, count }) => (
                  <div key={matiere}>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="font-medium">{matiere}</span>
                      <span className="text-black/40">{count}</span>
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
                <Clock className="h-4 w-4 text-black/40" />
                Épreuves par jour
              </h3>
              <div className="flex items-end gap-2 overflow-x-auto pb-2">
                {(() => {
                  const max = Math.max(...data.by_date.map((d) => d.count));
                  return data.by_date.map(({ date, count }) => (
                    <div key={date} className="flex flex-col items-center gap-1 min-w-[48px]">
                      <span className="text-xs text-black/50 font-medium">{count}</span>
                      <div
                        className="w-8 rounded-t"
                        style={{
                          height: `${Math.max(4, Math.round((count / max) * 80))}px`,
                          backgroundColor: "#C62828",
                          opacity: 0.7 + (count / max) * 0.3,
                        }}
                      />
                      <span className="text-[9px] text-black/30 rotate-45 origin-left whitespace-nowrap mt-1">
                        {new Date(date + "T12:00:00").toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}
                      </span>
                    </div>
                  ));
                })()}
              </div>
            </div>
          )}

          {data.total_epreuves === 0 && (
            <div className="bg-white rounded-xl shadow-sm p-10 text-center text-sm text-black/40">
              Aucune épreuve générée pour ce planning.
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ── NotesSection ───────────────────────────────────────────────────────────────

type NoteAdmin = {
  id: number;
  candidat_id: number;
  candidat_nom: string;
  candidat_prenom: string;
  matiere: string;
  valeur: number | null;
  statut: "BROUILLON" | "PUBLIE";
};

function NotesSection() {
  const [notes, setNotes] = useState<NoteAdmin[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [publishing, setPublishing] = useState<Record<number, boolean>>({});
  const [publishingAll, setPublishingAll] = useState(false);

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

  useEffect(() => { load(); }, [load]);

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

  const brouillons = notes.filter((n) => n.statut === "BROUILLON");
  const publiees = notes.filter((n) => n.statut === "PUBLIE");

  // Group brouillons by candidat
  const byCandidatB = brouillons.reduce<Record<number, NoteAdmin[]>>((acc, n) => {
    (acc[n.candidat_id] ??= []).push(n);
    return acc;
  }, {});

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Publication des notes</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {brouillons.length} note{brouillons.length !== 1 ? "s" : ""} en brouillon · {publiees.length} publiée{publiees.length !== 1 ? "s" : ""}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={load}
            disabled={loading}
            className="flex items-center gap-2 text-sm text-gray-500 border border-gray-200 rounded-lg px-3 py-2 hover:bg-gray-50 transition disabled:opacity-50"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Actualiser
          </button>
          {brouillons.length > 0 && (
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

      {error && (
        <div className="mb-4 rounded-lg bg-red-50 border border-red-100 px-4 py-3 text-sm text-red-600">{error}</div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
        </div>
      ) : notes.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-200 p-16 text-center">
          <FileSpreadsheet className="h-10 w-10 mx-auto mb-3 text-gray-300" />
          <p className="text-base font-medium text-gray-500">Aucune note saisie</p>
          <p className="text-sm text-gray-400 mt-1">Les notes apparaîtront ici dès leur saisie par les examinateurs.</p>
        </div>
      ) : (
        <div className="space-y-8">
          {/* Brouillons */}
          {brouillons.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
                En attente de publication
              </h2>
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                {Object.entries(byCandidatB).map(([candId, ns], gi) => (
                  <div key={candId} className={gi > 0 ? "border-t border-gray-100" : ""}>
                    <div className="px-5 py-3 bg-gray-50 flex items-center justify-between">
                      <p className="text-sm font-semibold text-gray-700">
                        {ns[0].candidat_prenom} {ns[0].candidat_nom}
                      </p>
                      <span className="text-xs text-gray-400">#{candId}</span>
                    </div>
                    {ns.map((note, ni) => (
                      <div key={note.id} className={`px-5 py-3 flex items-center justify-between ${ni > 0 ? "border-t border-gray-50" : ""}`}>
                        <div className="flex items-center gap-3">
                          <span className="text-sm text-gray-700">{note.matiere}</span>
                          <span className="text-sm font-semibold text-gray-900">
                            {note.valeur !== null ? `${note.valeur}/20` : <span className="text-gray-400 italic">—</span>}
                          </span>
                        </div>
                        <button
                          onClick={() => publierNote(note)}
                          disabled={publishing[note.id] || note.valeur === null}
                          className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-green-600 text-white font-semibold hover:bg-green-700 transition disabled:opacity-40"
                        >
                          {publishing[note.id] ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
                          Publier
                        </button>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Publiées */}
          {publiees.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
                Publiées ({publiees.length})
              </h2>
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                {publiees.map((note, i) => (
                  <div key={note.id} className={`px-5 py-3 flex items-center justify-between ${i > 0 ? "border-t border-gray-100" : ""}`}>
                    <div className="flex items-center gap-3">
                      <p className="text-sm font-medium text-gray-700">{note.candidat_prenom} {note.candidat_nom}</p>
                      <span className="text-xs text-gray-400">·</span>
                      <span className="text-sm text-gray-600">{note.matiere}</span>
                      <span className="text-sm font-semibold text-gray-900">
                        {note.valeur !== null ? `${note.valeur}/20` : "—"}
                      </span>
                    </div>
                    <span className="text-xs bg-green-100 text-green-700 rounded-full px-2 py-0.5 font-medium">
                      Publiée
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── ParametragesSection ────────────────────────────────────────────────────────
const MESSAGE_LABELS: Record<string, string> = {
  ADMISSIBILITE:     "Admissibilité (identifiants de connexion)",
  CONVOCATION:       "Convocation aux oraux",
  RAPPEL:            "Rappel (J-2 et J-1)",
  DESINSCRIPTION:    "Confirmation de désinscription",
  LISTE_ATTENTE:     "Enregistrement liste d'attente",
  PUBLICATION_NOTES: "Publication des notes",
};

function ParametragesSection() {
  const [tab, setTab] = useState<"messages" | "mdp">("messages");
  const [messages, setMessages] = useState<MessageType[]>([]);
  const [selected, setSelected] = useState<MessageType | null>(null);
  const [sujet, setSujet] = useState("");
  const [corps, setCorps] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveOk, setSaveOk] = useState(false);
  const [loadingMsg, setLoadingMsg] = useState(true);

  // Reset mdp
  const [candidatId, setCandidatId] = useState("");
  const [resetResult, setResetResult] = useState<{ login: string; new_password: string } | null>(null);
  const [resetting, setResetting] = useState(false);
  const [resetErr, setResetErr] = useState("");

  const loadMessages = useCallback(async () => {
    setLoadingMsg(true);
    try {
      const data = await get<MessageType[]>("parametrages/message-types/");
      setMessages(data);
      if (data.length > 0 && !selected) {
        setSelected(data[0]);
        setSujet(data[0].sujet);
        setCorps(data[0].corps_html);
      }
    } catch { /* ignore */ }
    finally { setLoadingMsg(false); }
  }, [selected]);

  useEffect(() => { loadMessages(); }, [loadMessages]);

  const selectMessage = (mt: MessageType) => {
    setSelected(mt);
    setSujet(mt.sujet);
    setCorps(mt.corps_html);
    setSaveOk(false);
  };

  const saveMessage = async () => {
    if (!selected) return;
    setSaving(true);
    setSaveOk(false);
    try {
      const updated = await put<MessageType>(
        `parametrages/message-types/${selected.code}`,
        { sujet, corps_html: corps }
      );
      setMessages((prev) => prev.map((m) => m.code === updated.code ? updated : m));
      setSelected(updated);
      setSaveOk(true);
    } catch { /* ignore */ }
    finally { setSaving(false); }
  };

  const doResetPassword = async () => {
    const id = parseInt(candidatId);
    if (!id) return;
    setResetting(true);
    setResetErr("");
    setResetResult(null);
    try {
      const res = await post<{ login: string; new_password: string }>(
        `parametrages/candidats/${id}/reset-password`, {}
      );
      setResetResult(res);
    } catch (e: unknown) {
      setResetErr(e instanceof Error ? e.message : "Erreur");
    } finally {
      setResetting(false);
    }
  };

  const tabs = [
    { key: "messages" as const, label: "Messages-type" },
    { key: "mdp" as const, label: "Mots de passe" },
  ];

  return (
    <div>
      <h1 className="text-xl font-bold text-gray-900 mb-1">Paramétrages</h1>
      <p className="text-sm text-gray-500 mb-6">Configuration des messages automatiques et gestion des accès.</p>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 mb-6 w-fit">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
              tab === t.key ? "bg-white shadow-sm text-gray-900" : "text-gray-500 hover:text-gray-700"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Messages-type ── */}
      {tab === "messages" && (
        <div className="flex gap-5 items-start">
          {/* Liste */}
          <div className="w-64 shrink-0 bg-white rounded-2xl border border-black/5 shadow-sm overflow-hidden">
            {loadingMsg ? (
              <div className="p-4 flex justify-center"><Spinner /></div>
            ) : (
              messages.map((mt, i) => (
                <button
                  key={mt.code}
                  onClick={() => selectMessage(mt)}
                  className={`w-full text-left px-4 py-3 text-sm transition ${
                    i > 0 ? "border-t border-gray-100" : ""
                  } ${selected?.code === mt.code ? "bg-red-50 font-semibold" : "hover:bg-gray-50 text-gray-700"}`}
                  style={selected?.code === mt.code ? { color: RED } : undefined}
                >
                  {MESSAGE_LABELS[mt.code] ?? mt.code}
                </button>
              ))
            )}
          </div>

          {/* Éditeur */}
          {selected && (
            <div className="flex-1 bg-white rounded-2xl border border-black/5 shadow-sm p-5 space-y-4">
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">
                  {selected.code}
                </p>
                <h2 className="text-base font-bold text-gray-900">
                  {MESSAGE_LABELS[selected.code] ?? selected.code}
                </h2>
              </div>

              <Field label="Sujet de l'email">
                <Input value={sujet} onChange={(e) => { setSujet(e.target.value); setSaveOk(false); }} />
              </Field>

              <Field label="Corps du message (HTML)">
                <textarea
                  value={corps}
                  onChange={(e) => { setCorps(e.target.value); setSaveOk(false); }}
                  rows={12}
                  className="w-full px-3 py-2 rounded-lg border border-black/10 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-black/10 bg-white resize-y"
                />
              </Field>

              <div className="flex items-center gap-3">
                <Btn label={saving ? "Enregistrement…" : "Enregistrer"} onClick={saveMessage} disabled={saving} />
                {saveOk && <span className="text-sm text-green-600 flex items-center gap-1"><CheckCircle2 className="h-4 w-4" />Enregistré</span>}
              </div>

              <div className="rounded-lg bg-gray-50 border border-gray-100 px-4 py-3 text-xs text-gray-500">
                <p className="font-medium mb-1">Variables disponibles :</p>
                <p className="font-mono">{"{prenom}"} {"{nom}"} {"{login}"} {"{password}"} {"{date}"} {"{epreuves}"} {"{journees}"} {"{url}"} {"{jours}"}</p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Mots de passe ── */}
      {tab === "mdp" && (
        <div className="max-w-md">
          <div className="bg-white rounded-2xl border border-black/5 shadow-sm p-5 space-y-4">
            <h2 className="text-base font-semibold text-gray-900">Réinitialiser le mot de passe d&apos;un candidat</h2>
            <p className="text-sm text-gray-500">
              Saisissez l&apos;ID du candidat. Un nouveau mot de passe temporaire sera généré.
            </p>

            <Field label="ID candidat">
              <Input
                type="number"
                value={candidatId}
                onChange={(e) => { setCandidatId(e.target.value); setResetResult(null); setResetErr(""); }}
                placeholder="ex. 1"
              />
            </Field>

            <Btn
              label={resetting ? "Réinitialisation…" : "Générer un nouveau mot de passe"}
              onClick={doResetPassword}
              disabled={resetting || !candidatId}
              icon={RefreshCw}
            />

            <ErrorMsg msg={resetErr} />

            {resetResult && (
              <div className="rounded-xl bg-green-50 border border-green-100 px-4 py-3 space-y-1">
                <p className="text-sm font-semibold text-green-800">Mot de passe réinitialisé</p>
                <p className="text-sm text-green-700">Login : <span className="font-mono font-semibold">{resetResult.login}</span></p>
                <p className="text-sm text-green-700">Nouveau mdp : <span className="font-mono font-semibold">{resetResult.new_password}</span></p>
                <p className="text-xs text-green-500 mt-1">À communiquer au candidat par email.</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── ConflitsSection ────────────────────────────────────────────────────────────
function ConflitsSection() {
  const [conflits, setConflits] = useState<Conflit[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setErr("");
    try {
      const data = await get<Conflit[]>("conflits/");
      setConflits(data);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const byDate = conflits.reduce<Record<string, Conflit[]>>((acc, c) => {
    (acc[c.date] ??= []).push(c);
    return acc;
  }, {});

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            Conflits établissement
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Épreuves où candidat et examinateur sont issus du même lycée (code UAI identique).
          </p>
        </div>
        <Btn label="Actualiser" icon={RefreshCw} variant="ghost" onClick={load} disabled={loading} />
      </div>

      <ErrorMsg msg={err} />

      {loading ? (
        <div className="flex justify-center py-16"><Spinner /></div>
      ) : conflits.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-gray-200 p-16 text-center">
          <CheckCircle2 className="h-10 w-10 mx-auto mb-3 text-green-400" />
          <p className="text-base font-medium text-gray-500">Aucun conflit détecté</p>
          <p className="text-sm text-gray-400 mt-1">
            Tous les candidats inscrits passent avec un examinateur d&apos;un autre établissement.
          </p>
        </div>
      ) : (
        <>
          <div className="rounded-xl px-4 py-3 mb-6 flex items-center gap-3 bg-amber-50 border-l-4 border-amber-400">
            <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
            <p className="text-sm text-amber-800">
              <strong>{conflits.length} conflit{conflits.length > 1 ? "s" : ""} détecté{conflits.length > 1 ? "s" : ""}</strong>
              {" "}— Ces épreuves nécessitent une intervention manuelle.
            </p>
          </div>

          <div className="space-y-6">
            {Object.entries(byDate).sort(([a], [b]) => a.localeCompare(b)).map(([date, cs]) => (
              <div key={date}>
                <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2 capitalize">
                  {formatDate(date)}
                </h2>
                <div className="bg-white rounded-2xl border border-black/5 shadow-sm overflow-hidden">
                  {cs.map((c, i) => (
                    <div key={c.epreuve_id} className={`px-5 py-4 ${i > 0 ? "border-t border-gray-100" : ""}`}>
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <span className="text-sm font-semibold text-gray-900">{c.matiere}</span>
                            <span className="text-xs text-gray-400 font-mono">{hm(c.heure_debut)} – {hm(c.heure_fin)}</span>
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <div className="rounded-lg bg-blue-50 px-3 py-2">
                              <p className="text-[10px] text-blue-400 font-medium uppercase tracking-wide mb-0.5">Candidat</p>
                              <p className="text-sm font-semibold text-blue-900">{c.candidat_prenom} {c.candidat_nom}</p>
                              <p className="text-xs text-blue-300">#{c.candidat_id}</p>
                            </div>
                            <div className="rounded-lg bg-purple-50 px-3 py-2">
                              <p className="text-[10px] text-purple-400 font-medium uppercase tracking-wide mb-0.5">Examinateur</p>
                              <p className="text-sm font-semibold text-purple-900">{c.examinateur_prenom} {c.examinateur_nom}</p>
                              <p className="text-xs text-purple-300">#{c.examinateur_id}</p>
                            </div>
                          </div>
                        </div>
                        <div className="shrink-0 rounded-lg px-3 py-2 text-center" style={{ backgroundColor: RED + "12" }}>
                          <p className="text-[10px] font-medium mb-0.5" style={{ color: RED }}>UAI</p>
                          <p className="text-sm font-bold font-mono" style={{ color: RED }}>{c.code_uai}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ── EnvBadge ───────────────────────────────────────────────────────────────────
function EnvBadge() {
  const env = process.env.NEXT_PUBLIC_ENV;
  if (!env) return null;
  const styles: Record<string, string> = {
    development: "bg-amber-400 text-amber-900",
    preprod: "bg-orange-400 text-orange-900",
    production: "bg-emerald-400 text-emerald-900",
  };
  const label: Record<string, string> = {
    development: "DEV",
    preprod: "PREPROD",
    production: "PROD",
  };
  return (
    <span
      className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${styles[env] ?? "bg-gray-400 text-gray-900"}`}
    >
      {label[env] ?? env.toUpperCase()}
    </span>
  );
}

// ── Sidebar ────────────────────────────────────────────────────────────────────
function Sidebar({
  active,
  onSelect,
  nbConflits = 0,
}: {
  active: SectionKey;
  onSelect: (k: SectionKey) => void;
  nbConflits?: number;
}) {
  const items: { key: SectionKey; label: string; icon: React.ElementType; badge?: number }[] =
    [
      { key: "plannings", label: "Planning", icon: CalendarDays },
      { key: "journeeTypes", label: "Journées types", icon: Settings2 },
      { key: "candidats", label: "Candidats", icon: Users },
      { key: "examinateurs", label: "Examinateurs", icon: GraduationCap },
      { key: "dashboard", label: "Tableau de bord", icon: BarChart3 },
      { key: "conflits", label: "Conflits", icon: AlertTriangle, badge: nbConflits },
      { key: "notes", label: "Notes", icon: FileSpreadsheet },
      { key: "parametrages", label: "Paramétrages", icon: Settings2 },
    ];

  return (
    <aside
      className="h-full w-[220px] shrink-0 flex flex-col text-white"
      style={{ backgroundColor: RED }}
    >
      <div className="p-5 pb-4">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-full border border-white/30 grid place-items-center">
            <div className="h-5 w-5 rounded-full border border-white/50" />
          </div>
          <div className="leading-tight">
            <div className="flex items-center gap-2">
              <span className="text-white font-semibold tracking-wide text-sm">
                ENSAE
              </span>
              <EnvBadge />
            </div>
            <div className="text-white/60 text-xs">IP Paris</div>
          </div>
        </div>
      </div>

      <nav className="px-3 flex-1">
        <div className="px-3 py-2 text-[10px] uppercase tracking-widest text-white/50 font-medium mb-1">
          Organisation
        </div>
        {items.map(({ key, label, icon: Icon, badge }) => (
          <button
            key={key}
            onClick={() => onSelect(key)}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition text-sm mb-0.5 text-left ${
              active === key
                ? "bg-white/15 font-semibold"
                : "hover:bg-black/10 text-white/80"
            }`}
          >
            <Icon className="h-4 w-4 shrink-0" />
            <span className="flex-1">{label}</span>
            {badge !== undefined && badge > 0 && (
              <span className="text-xs font-bold bg-amber-400 text-amber-900 rounded-full px-1.5 py-0.5 min-w-[20px] text-center">
                {badge}
              </span>
            )}
          </button>
        ))}

        <div className="mt-6 px-3">
          <div className="h-px bg-white/10" />
        </div>
        <div className="mt-4 px-3 flex items-center gap-2 text-xs text-white/40">
          <LayoutGrid className="h-3.5 w-3.5" />
          Back-office
        </div>
      </nav>
    </aside>
  );
}

// ── Main ───────────────────────────────────────────────────────────────────────
export default function AdminPage() {
  const [section, setSection] = useState<SectionKey>("plannings");
  const [selectedPlanning, setSelectedPlanning] = useState<Planning | null>(null);
  const [journeeTypes, setJourneeTypes] = useState<JourneeType[]>([]);
  const [mobileSidebar, setMobileSidebar] = useState(false);
  const [nbConflits, setNbConflits] = useState(0);

  useEffect(() => {
    get<JourneeType[]>("journee-types/").then(setJourneeTypes).catch(() => {});
  }, [section]);

  // Badge conflits — rechargé au démarrage
  useEffect(() => {
    get<{ count: number }>("conflits/count")
      .then((d) => setNbConflits(d.count))
      .catch(() => {});
  }, []);

  const switchSection = (k: SectionKey) => {
    setSection(k);
    setSelectedPlanning(null);
    setMobileSidebar(false);
  };

  return (
    <div className="flex min-h-screen bg-[#F5F5F5]">
      {/* Sidebar desktop */}
      <div className="hidden md:block h-screen sticky top-0">
        <Sidebar active={section} onSelect={switchSection} nbConflits={nbConflits} />
      </div>

      {/* Sidebar mobile overlay */}
      <AnimatePresence>
        {mobileSidebar && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 md:hidden"
          >
            <div
              className="absolute inset-0 bg-black/40"
              onClick={() => setMobileSidebar(false)}
            />
            <motion.div
              initial={{ x: -240 }}
              animate={{ x: 0 }}
              exit={{ x: -240 }}
              transition={{ type: "spring", stiffness: 280, damping: 26 }}
              className="absolute left-0 top-0 h-full"
            >
              <Sidebar active={section} onSelect={switchSection} nbConflits={nbConflits} />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile top bar */}
        <div className="md:hidden sticky top-0 z-20 bg-white/80 backdrop-blur border-b border-black/5 px-4 py-3 flex items-center gap-3">
          <button
            onClick={() => setMobileSidebar(true)}
            className="h-9 w-9 rounded-lg border bg-white shadow-sm grid place-items-center"
          >
            <Menu className="h-4 w-4" />
          </button>
          <span className="text-sm font-semibold text-black/70">
            ENSAE — Admin
          </span>
        </div>

        <main className="flex-1 overflow-auto">
          <div className="max-w-6xl mx-auto px-4 md:px-8 py-8">
            {section === "plannings" && !selectedPlanning && (
              <PlanningsSection onSelect={setSelectedPlanning} />
            )}
            {section === "plannings" && selectedPlanning && (
              <PlanningDaySection
                planning={selectedPlanning}
                journeeTypes={journeeTypes}
                onBack={() => setSelectedPlanning(null)}
              />
            )}
            {section === "journeeTypes" && <JourneeTypesSection />}
            {section === "candidats" && <CandidatsSection />}
            {section === "examinateurs" && <ExaminateursSection />}
            {section === "dashboard" && <DashboardSection />}
            {section === "conflits" && <ConflitsSection />}
            {section === "notes" && <NotesSection />}
            {section === "parametrages" && <ParametragesSection />}
          </div>
        </main>
      </div>
    </div>
  );
}
