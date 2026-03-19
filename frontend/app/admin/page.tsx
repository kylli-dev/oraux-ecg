"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";
import PlanificationView from "./planification/PlanificationView";
import InterfaceAdminENSAEPlanning from "../InterfaceAdminENSAEPlanning";
import { useRouter } from "next/navigation";
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
  LogOut,
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
  salles_par_matiere: number;
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

type EpreuveFlat = {
  id: number;
  date: string;
  demi_journee_type: string;
  matiere: string;
  heure_debut: string;
  heure_fin: string;
  preparation_minutes: number | null;
  statut: string;
  candidat_id: number | null;
  candidat_nom: string | null;
  candidat_prenom: string | null;
  examinateur_id: number | null;
  examinateur_nom: string | null;
  examinateur_prenom: string | null;
};

type Examinateur = {
  id: number;
  planning_id: number;
  nom: string;
  prenom: string;
  email: string;
  matieres: string[];
  code_uai: string | null;
  etablissement: string | null;
  telephone: string | null;
  commentaire: string | null;
  actif: boolean;
  code_acces: string;
};

type Indisponibilite = {
  id: number;
  examinateur_id: number;
  debut: string;
  fin: string;
  commentaire: string | null;
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

type BlocPreview = {
  heure_debut: string;
  heure_fin: string;
  matieres: string[];
  duree_minutes: number;
  pause_minutes: number;
  preparation_minutes: number;
};

type PeriodePreview = {
  type_dj: string;
  heure_debut: string;
  heure_fin: string;
  blocs: BlocPreview[];
};

type JourneeTypePreview = {
  journee_type_id: number;
  periodes: PeriodePreview[];
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
  wide,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  wide?: boolean;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        className={`bg-white rounded-2xl shadow-2xl w-full max-h-[90vh] flex flex-col ${wide ? "max-w-3xl" : "max-w-lg"}`}
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
            download
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
    return <span className="inline-block px-1.5 py-0.5 rounded text-[11px] font-medium bg-green-100 text-green-700">Libre</span>;
  if (statut === "PRERESERVE")
    return <span className="inline-block px-1.5 py-0.5 rounded text-[11px] font-medium bg-amber-100 text-amber-700">Prérés.</span>;
  if (statut === "ATTRIBUEE")
    return <span className="inline-block px-1.5 py-0.5 rounded text-[11px] font-medium bg-blue-100 text-blue-700">Réservé</span>;
  if (statut === "EN_EVALUATION")
    return <span className="inline-block px-1.5 py-0.5 rounded text-[11px] font-medium bg-purple-100 text-purple-700">En éval.</span>;
  if (statut === "FINALISEE")
    return <span className="inline-block px-1.5 py-0.5 rounded text-[11px] font-medium bg-gray-200 text-gray-600">Finalisé</span>;
  return <span className="inline-block px-1.5 py-0.5 rounded text-[11px] bg-gray-100 text-gray-500">{statut}</span>;
}

function rowStatut(byMat: Record<string, EpreuveFlat[]>): string {
  const all = Object.values(byMat).flat();
  if (all.length === 0) return "CREE";
  const statuts = new Set(all.map((e) => e.statut));
  if (statuts.has("ATTRIBUEE") || statuts.has("FINALISEE") || statuts.has("EN_EVALUATION")) return "ATTRIBUEE";
  if (statuts.has("LIBRE")) return "LIBRE";
  if (statuts.has("PRERESERVE")) return "PRERESERVE";
  return all[0].statut;
}

function PlanningTableauView({ planningId, planning }: { planningId: number; planning: Planning }) {
  const [epreuves, setEpreuves] = useState<EpreuveFlat[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterDate, setFilterDate] = useState<string>("");
  const [filterStatut, setFilterStatut] = useState<string>("");

  useEffect(() => {
    setLoading(true);
    get<EpreuveFlat[]>(`plannings/${planningId}/epreuves`)
      .then(setEpreuves)
      .catch(() => setEpreuves([]))
      .finally(() => setLoading(false));
  }, [planningId]);

  if (loading) return <div className="flex justify-center py-16 text-black/30"><Spinner /></div>;
  if (epreuves.length === 0)
    return <Empty message="Aucun créneau" sub="Appliquez un gabarit pour générer les créneaux du planning." />;

  // Dates et matières disponibles
  const dates = [...new Set(epreuves.map((e) => e.date))].sort();
  const matieres = [...new Set(epreuves.map((e) => e.matiere))].sort();

  // Filtrage
  const filtered = epreuves
    .filter((e) => !filterDate || e.date === filterDate)
    .filter((e) => !filterStatut || e.statut === filterStatut);

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

  // Calcul de dép. prépa à partir des slots consécutifs (même logique que PlanificationView)
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

  return (
    <div>
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
          <option value="PRERESERVE">Préréservé</option>
          <option value="ATTRIBUEE">Réservé</option>
          <option value="EN_EVALUATION">En évaluation</option>
          <option value="FINALISEE">Finalisé</option>
        </select>
        <span className="text-xs text-black/30 ml-auto">{filtered.length} créneau(x)</span>
      </div>

      {/* Tableau croisé */}
      <div className="overflow-x-auto rounded-xl border bg-white shadow-sm">
        <table className="w-full text-sm border-collapse min-w-max">
          <thead>
            {/* Ligne 1 : en-têtes matières */}
            <tr className="bg-black/[0.04] border-b">
              <th className="px-3 py-2.5 text-left text-xs font-medium text-black/50 whitespace-nowrap">Statut</th>
              <th className="px-3 py-2.5 text-left text-xs font-medium text-black/50 whitespace-nowrap">Dép. prépa</th>
              <th className="px-3 py-2.5 text-left text-xs font-medium text-black/50 whitespace-nowrap">Dép. exam</th>
              <th className="px-3 py-2.5 text-left text-xs font-medium text-black/50 whitespace-nowrap">Fin exam</th>
              {matieres.map((m) => (
                <th
                  key={m}
                  colSpan={2}
                  className="px-3 py-2.5 text-center text-xs font-semibold whitespace-nowrap border-l border-black/10"
                >
                  {m}
                </th>
              ))}
            </tr>
            {/* Ligne 2 : sous-colonnes par matière */}
            <tr className="bg-black/[0.02] border-b text-[11px] text-black/40">
              <th colSpan={4} />
              {matieres.map((m) => (
                <React.Fragment key={m}>
                  <th className="px-3 py-1.5 text-left font-normal border-l border-black/10">Candidat</th>
                  <th className="px-3 py-1.5 text-left font-normal">Examinateur</th>
                </React.Fragment>
              ))}
            </tr>
          </thead>
          <tbody>
            {[...rowsByDate.entries()].map(([date, dateRows]) => (
              <React.Fragment key={date}>
                {/* En-tête de date */}
                <tr>
                  <td
                    colSpan={4 + matieres.length * 2}
                    className="px-4 py-2 bg-black/[0.05] font-semibold text-black/60 text-xs uppercase tracking-widest sticky left-0"
                  >
                    {formatDate(date)}
                  </td>
                </tr>
                {dateRows.map((row) => {
                  const key = `${row.date}|${row.heure_debut}`;
                  const rs = rowStatut(row.byMat);
                  const rowBg =
                    rs === "LIBRE" ? "bg-green-50/50"
                    : rs === "PRERESERVE" ? "bg-amber-50/50"
                    : rs === "ATTRIBUEE" ? "bg-blue-50/30"
                    : "";

                  return (
                    <tr key={key} className={`border-b border-black/[0.06] hover:bg-black/[0.02] transition ${rowBg}`}>
                      {/* Statut */}
                      <td className="px-3 py-2 whitespace-nowrap">{statutBadgeCell(rs)}</td>
                      {/* Dép. prépa */}
                      <td className="px-3 py-2 text-black/40 font-mono text-xs whitespace-nowrap">
                        {debPrepaMap.get(key) ?? "—"}
                      </td>
                      {/* Dép. exam */}
                      <td className="px-3 py-2 font-mono text-xs whitespace-nowrap">{row.heure_debut}</td>
                      {/* Fin exam */}
                      <td className="px-3 py-2 text-black/40 font-mono text-xs whitespace-nowrap">{row.heure_fin}</td>
                      {/* Par matière */}
                      {matieres.map((m) => {
                        const eps = row.byMat[m] ?? [];
                        if (eps.length === 0) {
                          return (
                            <React.Fragment key={m}>
                              <td className="px-3 py-2 text-black/20 text-xs border-l border-black/[0.06]" colSpan={2}>—</td>
                            </React.Fragment>
                          );
                        }
                        return (
                          <React.Fragment key={m}>
                            {/* Candidat */}
                            <td className="px-3 py-2 border-l border-black/[0.06]">
                              {eps.map((e) => (
                                <div key={e.id}>
                                  {e.candidat_nom ? (
                                    <span className="font-medium text-sm">
                                      {e.candidat_nom} {e.candidat_prenom}
                                    </span>
                                  ) : (
                                    <span className="text-black/25 text-xs italic">—</span>
                                  )}
                                </div>
                              ))}
                            </td>
                            {/* Examinateur */}
                            <td className="px-3 py-2">
                              {eps.map((e) => (
                                <div key={e.id} className="text-xs text-black/50">
                                  {e.examinateur_nom
                                    ? `${e.examinateur_nom}${e.examinateur_prenom ? " " + e.examinateur_prenom[0] + "." : ""}`
                                    : <span className="text-black/20 italic">—</span>}
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
function PlanningDaySection({
  planning,
  journeeTypes,
  onBack,
}: {
  planning: Planning;
  journeeTypes: JourneeType[];
  onBack: () => void;
}) {
  const [viewMode, setViewMode] = useState<"journee" | "tableau">("journee");
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
    if (viewMode === "journee") loadDay();
  }, [loadDay, viewMode]);

  if (dndMode) {
    return <PlanificationView planning={planning} onBack={() => setDndMode(false)} />;
  }

  return (
    <div className="max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-5">
        <button
          onClick={onBack}
          className="h-9 w-9 rounded-lg border bg-white shadow-sm grid place-items-center hover:bg-black/[0.02] transition"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <div>
          <p className="text-xs text-black/40 uppercase tracking-wide">Planning</p>
          <h2 className="text-xl font-semibold leading-tight">{planning.nom}</h2>
        </div>
        <StatutBadge statut={planning.statut} />
      </div>

      {/* Onglets Vue journée / Vue tableau */}
      <div className="flex gap-1 mb-5 border-b border-black/10">
        {(["journee", "tableau"] as const).map((m) => (
          <button
            key={m}
            onClick={() => setViewMode(m)}
            className={`px-4 py-2 text-sm font-medium rounded-t-lg transition -mb-px border border-b-0 ${
              viewMode === m
                ? "bg-white border-black/10 text-black"
                : "border-transparent text-black/40 hover:text-black/60"
            }`}
          >
            {m === "journee" ? "Vue journée" : "Vue tableau"}
          </button>
        ))}
      </div>

      {viewMode === "tableau" ? (
        <PlanningTableauView planningId={planning.id} planning={planning} />
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
              <span className="text-sm text-black/40 hidden sm:block">{formatDate(date)}</span>
            </div>
            <div className="flex gap-2">
              <Btn label="Planification DnD" icon={LayoutGrid} onClick={() => setDndMode(true)} small />
              <Btn label="Appliquer un gabarit" icon={Wand2} onClick={() => setApplyModal(true)} />
              <Btn label="Rafraîchir" icon={RefreshCw} onClick={loadDay} variant="ghost" small />
            </div>
          </div>

          {/* Day content */}
          {loading ? (
            <div className="flex justify-center py-16 text-black/30"><Spinner /></div>
          ) : !dayData || dayData.demi_journees.length === 0 ? (
            <div className="rounded-xl border border-dashed border-black/15 p-14 text-center">
              <CalendarDays className="h-8 w-8 mx-auto mb-3 text-black/20" />
              <p className="text-black/40 font-medium">Aucune demi-journée</p>
              <p className="text-sm text-black/30 mt-1">
                Cliquez sur &laquo; Appliquer un gabarit &raquo; pour générer les créneaux de cette journée.
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
          <Modal open={applyModal} onClose={() => setApplyModal(false)} title="Appliquer un gabarit">
            {journeeTypes.length === 0 ? (
              <p className="text-sm text-black/50">
                Aucune journée type disponible. Créez-en une dans la section &laquo; Journées types &raquo;.
              </p>
            ) : (
              <ApplyForm
                planningId={planning.id}
                date={date}
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
            className="absolute right-1 text-[10px] font-mono text-black/25 -translate-y-1/2"
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
          className="absolute left-1.5 text-[9px] font-medium text-black/25 -translate-y-1/2"
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
                </div>
              </div>
            </div>
          );
        })}

        {blocs.length === 0 && (
          <div className="flex items-center justify-center h-full text-xs text-black/20">
            Aucun bloc — ajoutez-en un pour commencer
          </div>
        )}
      </div>
    </div>
  );
}

// ── JourneeTypeEditor ─────────────────────────────────────────────────────────
function JourneeTypeEditor({ jt }: { jt: JourneeType }) {
  const [blocs, setBlocs] = useState<Bloc[]>([]);
  const [selectedBlocId, setSelectedBlocId] = useState<number | null>(null);
  const [showAdd, setShowAdd] = useState(false);

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
    if (!confirm("Supprimer ce bloc ?")) return;
    await del(`journee-types/blocs/${blocId}`);
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
        <div className="flex items-center justify-between mb-4">
          <span className="text-xs font-semibold text-black/40 uppercase tracking-wide">
            Blocs ({blocs.length})
          </span>
          <Btn
            label={showAdd ? "Annuler" : "Ajouter un bloc"}
            icon={showAdd ? X : Plus}
            onClick={() => { setShowAdd((s) => !s); setSelectedBlocId(null); }}
            small
            variant="ghost"
          />
        </div>

        <BlocTimeline
          blocs={blocs}
          selectedBlocId={selectedBlocId}
          onSelect={(id) => { setSelectedBlocId(id); if (id) setShowAdd(false); }}
        />

        <AnimatePresence>
          {showAdd && (
            <motion.div
              key="add"
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="mt-4 rounded-xl border border-black/10 bg-gray-50 p-4"
            >
              <AddBlocForm
                jtId={jt.id}
                dureeDefaut={jt.duree_defaut_minutes}
                pauseDefaut={jt.pause_defaut_minutes}
                preparationDefaut={jt.preparation_defaut_minutes}
                onSuccess={() => { setShowAdd(false); load(); }}
              />
            </motion.div>
          )}

          {selectedBloc && !showAdd && (
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

        {blocs.length > 0 && !selectedBloc && !showAdd && (
          <p className="mt-3 text-xs text-black/25 text-center">
            Cliquez sur un bloc pour le modifier
          </p>
        )}
      </div>

      {/* ── Panneau droit : Appliquer au planning ── */}
      <div className="w-72 shrink-0 p-5 bg-gray-50/60">
        <p className="text-xs font-semibold text-black/40 uppercase tracking-wide mb-4">
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
            <p className="text-[10px] text-black/30 font-medium uppercase tracking-wide mb-1">
              Plage du planning
            </p>
            <p className="text-xs text-black/50">
              {selPlanning.date_debut} → {selPlanning.date_fin}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Section : Journées types ───────────────────────────────────────────────────
function JourneeTypesSection() {
  const [tab, setTab] = useState<"gabarits" | "matrice">("gabarits");
  const [jts, setJts] = useState<JourneeType[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState<number | null>(null);

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
      if (editing === id) setEditing(null);
      load();
    } catch (e: any) {
      alert(e.message);
    }
  };

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-xl font-semibold">Journées types</h2>
          <p className="text-sm text-black/40 mt-0.5">
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
                : "border-transparent text-black/40 hover:text-black/60"
            }`}
          >
            {t === "gabarits" ? "Gabarits" : "Matrice oraux"}
          </button>
        ))}
      </div>

      {tab === "matrice" ? (
        <InterfaceAdminENSAEPlanning />
      ) : loading ? (
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
                    label={editing === jt.id ? "Fermer" : "Éditer"}
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
                    <JourneeTypeEditor jt={jt} />
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
            load();
          }}
        />
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

const TRIPLET_BG = [
  "#FEF9C3","#DCFCE7","#DBEAFE","#FCE7F3","#FEE2E2",
  "#FFEDD5","#F3E8FF","#ECFDF5","#E0F2FE",
];
const TRIPLET_RING = [
  "#FDE047","#86EFAC","#93C5FD","#F9A8D4","#FCA5A5",
  "#FDBA74","#D8B4FE","#6EE7B7","#7DD3FC",
];

type WizardParams = {
  nom: string;
  matieres: string[];
  salles_par_matiere: number;
  duree_minutes: number;
  preparation_minutes: number;
  pause_minutes: number;
  heure_debut: string;
  statut_initial: string;
};

type MatrixRow = {
  deb_prepa: string;
  deb_exam: string;
  fin_exam: string;
  candidates: number[]; // candidat k pour chaque colonne matière
};

function buildMatrix(p: WizardParams): MatrixRow[] {
  const N = p.matieres.length;
  const Nsq = N * N;
  const [hh, mm] = p.heure_debut.split(":").map(Number);
  const start = hh * 60 + mm;
  return Array.from({ length: Nsq }, (_, i) => {
    const dPrepa = start + i * (p.duree_minutes + p.pause_minutes);
    const dExam = dPrepa + p.preparation_minutes;
    const fExam = dExam + p.duree_minutes;
    // cell (i, j) → candidat k = (i - j*N + Nsq*N) % Nsq  (garantit ≥ 0)
    return {
      deb_prepa: minutesToHM(dPrepa),
      deb_exam: minutesToHM(dExam),
      fin_exam: minutesToHM(fExam),
      candidates: p.matieres.map((_, j) => ((i - j * N) % Nsq + Nsq) % Nsq),
    };
  });
}

// ── Wizard création journée type (2 étapes) ────────────────────────────────────
function CreateJourneeTypeForm({ onSuccess }: { onSuccess: () => void }) {
  const [step, setStep] = useState<1 | 2>(1);
  const [p, setP] = useState<WizardParams>({
    nom: "",
    matieres: [],
    salles_par_matiere: 1,
    duree_minutes: 30,
    preparation_minutes: 30,
    pause_minutes: 0,
    heure_debut: "08:00",
    statut_initial: "LIBRE",
  });
  const [matrix, setMatrix] = useState<MatrixRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const set = (k: keyof WizardParams, v: any) =>
    setP((prev) => ({ ...prev, [k]: v }));

  const N = p.matieres.length;
  const Nsq = N * N;

  const handleGenerate = () => {
    if (!p.nom.trim()) { setError("Nom requis"); return; }
    if (!N) { setError("Sélectionnez au moins une matière"); return; }
    setError("");
    setMatrix(buildMatrix(p));
    setStep(2);
  };

  const handleSave = async () => {
    setLoading(true);
    setError("");
    try {
      const heureFinStr = matrix[Nsq - 1].fin_exam + ":00";
      const jt = await post<{ id: number }>("journee-types/", {
        nom: p.nom,
        duree_defaut_minutes: p.duree_minutes,
        pause_defaut_minutes: p.pause_minutes,
        preparation_defaut_minutes: p.preparation_minutes,
        statut_initial: p.statut_initial,
      });
      await post(`journee-types/${jt.id}/blocs`, {
        ordre: 1,
        type_bloc: "GENERATION",
        heure_debut: p.heure_debut + ":00",
        heure_fin: heureFinStr,
        matieres: p.matieres,
        duree_minutes: p.duree_minutes,
        pause_minutes: p.pause_minutes,
        preparation_minutes: p.preparation_minutes,
        salles_par_matiere: p.salles_par_matiere,
      });
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
        className={`text-[11px] font-bold px-2 py-0.5 rounded-full transition ${step === 1 ? "bg-black text-white" : "border border-black/20 text-black/40 hover:border-black/50"}`}
        onClick={() => step === 2 && setStep(1)}
      >1</button>
      <button
        className={`text-xs transition ${step === 1 ? "font-semibold text-black/80" : "text-black/40 hover:text-black/60"}`}
        onClick={() => step === 2 && setStep(1)}
      >Paramétrage</button>
      <span className="text-black/20 text-xs mx-1">→</span>
      <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${step === 2 ? "bg-black text-white" : "border border-black/20 text-black/30"}`}>2</span>
      <span className={`text-xs ${step === 2 ? "font-semibold text-black/80" : "text-black/30"}`}>Matrice & enregistrement</span>
    </div>
  );

  // ── Étape 1 ─────────────────────────────────────────────────────────────────
  if (step === 1) {
    return (
      <div className="space-y-4">
        <StepPills />
        <Field label="Nom">
          <Input value={p.nom} onChange={(e) => set("nom", e.target.value)} placeholder="Journée standard ECG" />
        </Field>
        <Field label="Matières">
          <MatieresSelector selected={p.matieres} onChange={(v) => set("matieres", v)} />
          {N > 0 && (
            <p className="text-xs text-black/40 mt-1.5">
              {N} matière(s) → <strong>{Nsq} créneaux</strong> par session
            </p>
          )}
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Heure de début">
            <Input type="time" value={p.heure_debut} onChange={(e) => set("heure_debut", e.target.value)} />
          </Field>
          <Field label="Salles / matière">
            <Input type="number" value={p.salles_par_matiere} onChange={(e) => set("salles_par_matiere", Number(e.target.value))} min={1} max={50} />
          </Field>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <Field label="Durée oral (min)">
            <Input type="number" value={p.duree_minutes} onChange={(e) => set("duree_minutes", Number(e.target.value))} min={5} max={240} />
          </Field>
          <Field label="Préparation (min)">
            <Input type="number" value={p.preparation_minutes} onChange={(e) => set("preparation_minutes", Number(e.target.value))} min={0} max={120} />
          </Field>
          <Field label="Pause (min)">
            <Input type="number" value={p.pause_minutes} onChange={(e) => set("pause_minutes", Number(e.target.value))} min={0} max={120} />
          </Field>
        </div>
        <ErrorMsg msg={error} />
        <Btn label="Générer la matrice →" icon={LayoutGrid} onClick={handleGenerate} disabled={!p.nom.trim() || !N} />
      </div>
    );
  }

  // ── Étape 2 ─────────────────────────────────────────────────────────────────
  const heureFinAuto = matrix.length ? matrix[Nsq - 1].fin_exam : "";
  const capacite = Nsq * p.salles_par_matiere;

  return (
    <div className="space-y-4">
      <StepPills />

      {/* Récapitulatif */}
      <div className="rounded-lg bg-gray-50 border border-black/8 px-4 py-2.5 text-xs text-black/60 flex flex-wrap gap-x-5 gap-y-1">
        <span className="font-semibold text-black/80">{p.nom}</span>
        <span>{p.matieres.join(" · ")}</span>
        <span>⏱ {p.duree_minutes} min oral · {p.preparation_minutes} min prép.</span>
        <span>🕐 {p.heure_debut} → {heureFinAuto}</span>
        <span className="font-medium text-black/70">{capacite} candidat(s) / session</span>
      </div>

      {/* Matrice */}
      <div className="overflow-x-auto rounded-xl border border-black/8">
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr className="bg-gray-50">
              <th className="text-left px-3 py-2 text-black/40 font-medium border-b border-black/8 whitespace-nowrap">Dép. prépa</th>
              <th className="text-left px-3 py-2 text-black/40 font-medium border-b border-black/8 whitespace-nowrap">Dép. exam</th>
              <th className="text-left px-3 py-2 text-black/40 font-medium border-b border-black/8 whitespace-nowrap">Fin exam</th>
              {p.matieres.map((m) => (
                <th key={m} className="text-center px-3 py-2 font-semibold border-b border-black/8 text-black/70 whitespace-nowrap">{m}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {matrix.map((row, i) => (
              <tr key={i} className="border-b border-black/5 last:border-0 hover:bg-black/[0.015]">
                <td className="px-3 py-1.5 font-mono text-black/40">{row.deb_prepa}</td>
                <td className="px-3 py-1.5 font-mono font-medium text-black/80">{row.deb_exam}</td>
                <td className="px-3 py-1.5 font-mono text-black/50">{row.fin_exam}</td>
                {row.candidates.map((k, j) => (
                  <td key={j} className="px-3 py-1 text-center">
                    <span
                      className="inline-block px-2 py-0.5 rounded-full font-semibold text-[11px] text-gray-700"
                      style={{
                        backgroundColor: TRIPLET_BG[k % TRIPLET_BG.length],
                        outline: `1.5px solid ${TRIPLET_RING[k % TRIPLET_RING.length]}`,
                      }}
                    >
                      T{k + 1}
                    </span>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-black/40 leading-relaxed">
        Chaque triplet T<em>k</em> représente un candidat passant {N} épreuve(s) à des horaires décalés (offset de {N} créneaux).
        {p.salles_par_matiere > 1 && (
          <> Avec {p.salles_par_matiere} salle(s) par matière, {capacite} candidats peuvent être accueillis par session.</>
        )}
      </p>

      {/* Statut initial */}
      <Field label="Statut initial des créneaux">
        <Select value={p.statut_initial} onChange={(e) => set("statut_initial", e.target.value)}>
          <option value="LIBRE">Libre (inscription ouverte)</option>
          <option value="PRERESERVE">Préréservé</option>
          <option value="CREE">Créé (non publié)</option>
        </Select>
      </Field>

      <ErrorMsg msg={error} />
      <div className="flex gap-2">
        <Btn label="← Retour" onClick={() => setStep(1)} variant="ghost" />
        <Btn label={loading ? "Enregistrement…" : "Enregistrer la journée type"} onClick={handleSave} disabled={loading} />
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
    return <p className="text-xs text-black/40 italic">Aucune matière configurée — ajoutez-en dans Paramétrages → Matières.</p>;

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
                : "bg-white text-black/50 border-black/20 hover:border-black/40 hover:text-black/70"
            }`}
          >
            {m.intitule}
          </button>
        );
      })}
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
    matieres: [] as string[],
    duree_minutes: dureeDefaut,
    pause_minutes: pauseDefaut,
    preparation_minutes: preparationDefaut,
    salles_par_matiere: 1,
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
        if (!form.matieres.length) throw new Error("Au moins une matière requise");
        body.matieres = form.matieres;
        body.duree_minutes = form.duree_minutes;
        body.pause_minutes = form.pause_minutes;
        body.preparation_minutes = form.preparation_minutes;
        body.salles_par_matiere = form.salles_par_matiere;
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
          <Field label="Matières">
            <MatieresSelector
              selected={form.matieres}
              onChange={(v) => set("matieres", v)}
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
          <Field label="Salles / matière">
            <Input
              type="number"
              value={form.salles_par_matiere}
              onChange={(e) => set("salles_par_matiere", Number(e.target.value))}
              min={1}
              max={50}
            />
          </Field>
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
        if (!form.matieres.length) throw new Error("Au moins une matière requise");
        body.matieres = form.matieres;
        body.duree_minutes = form.duree_minutes;
        body.pause_minutes = form.pause_minutes;
        body.preparation_minutes = form.preparation_minutes;
        body.salles_par_matiere = form.salles_par_matiere;
      } else {
        body.matieres = [];
      }
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
          <Field label="Salles / matière">
            <Input type="number" value={form.salles_par_matiere} onChange={(e) => set("salles_par_matiere", Number(e.target.value))} min={1} max={50} />
          </Field>
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
            label="Importer"
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
        templateUrl={`/api/backend/excel/candidats/template-complet`}
        uploadUrl={`/api/backend/excel/plannings/${planningId}/candidats/import-complet`}
        onSuccess={loadCandidats}
        resultRenderer={(r) => r.candidats?.length > 0 && (
          <div className="mt-3 max-h-40 overflow-y-auto">
            <p className="text-xs font-medium text-green-700 mb-1">Candidats importés ({r.candidats.length}) — mots de passe provisoires :</p>
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

// ── AffectationTab (examinateurs) ─────────────────────────────────────────────

function AffectationTab({ planningId, examinateurs }: { planningId: number; examinateurs: Examinateur[] }) {
  const [epreuves, setEpreuves] = useState<EpreuveFlat[]>([]);
  const [loading, setLoading] = useState(true);
  const [assigning, setAssigning] = useState<Record<number, boolean>>({});
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await get<EpreuveFlat[]>(`plannings/${planningId}/epreuves`);
      setEpreuves(data);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [planningId]);

  useEffect(() => { load(); }, [load]);

  async function assigner(epreuveId: number, examinateurId: number | null) {
    setAssigning((a) => ({ ...a, [epreuveId]: true }));
    setError("");
    try {
      await post(`examinateurs/epreuves/${epreuveId}/assigner`, { examinateur_id: examinateurId });
      const ex = examinateurId ? examinateurs.find((x) => x.id === examinateurId) : null;
      setEpreuves((prev) =>
        prev.map((ep) =>
          ep.id === epreuveId
            ? { ...ep, examinateur_id: ex?.id ?? null, examinateur_nom: ex?.nom ?? null, examinateur_prenom: ex?.prenom ?? null }
            : ep
        )
      );
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setAssigning((a) => ({ ...a, [epreuveId]: false }));
    }
  }

  const byDate = epreuves.reduce<Record<string, EpreuveFlat[]>>((acc, e) => {
    (acc[e.date] ??= []).push(e);
    return acc;
  }, {});

  const assigned = epreuves.filter((e) => e.examinateur_id !== null).length;
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
          <p className="text-xs font-semibold text-black/40 uppercase tracking-wide mb-2">
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
                {eps.map((ep, i) => (
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
                          onChange={(e) => assigner(ep.id, e.target.value ? Number(e.target.value) : null)}
                          disabled={assigning[ep.id]}
                          className="w-full border rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-300 disabled:opacity-50"
                        >
                          <option value="">— Aucun —</option>
                          {examinateurs.map((ex) => (
                            <option key={ex.id} value={ex.id}>
                              {ex.nom} {ex.prenom} {ex.matieres.length ? `(${ex.matieres.join(", ")})` : ""}
                            </option>
                          ))}
                        </select>
                        {assigning[ep.id] && <Loader2 className="h-3.5 w-3.5 animate-spin text-gray-400 shrink-0" />}
                        {ep.examinateur_id && !assigning[ep.id] && (
                          <button
                            onClick={() => assigner(ep.id, null)}
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

type MatiereItem = { id: number; intitule: string; active: boolean };

function useMatieres() {
  const [matieres, setMatieres] = useState<MatiereItem[]>([]);
  useEffect(() => {
    get<MatiereItem[]>("parametrages/matieres/").then(setMatieres).catch(() => {});
  }, []);
  return matieres;
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
    return <p className="text-xs text-black/40 italic">Aucune matière configurée dans Paramétrages.</p>;
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
              : "bg-white text-black/60 border-black/15 hover:border-black/30"
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
    if (!confirm("Supprimer cette indisponibilité ?")) return;
    await del(`examinateurs/${examinateurId}/indisponibilites/${id}`);
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
        <span className="text-black/30 text-xs">{open ? "▲" : "▼"}</span>
      </button>

      {open && (
        <div className="p-4 space-y-3">
          {loading ? <div className="text-center py-4"><Spinner /></div> : items.length === 0 ? (
            <p className="text-sm text-black/40 text-center py-2">Aucune indisponibilité enregistrée.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-xs text-black/40">
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
                    <td className="py-2 text-black/50 text-sm">{item.commentaire ?? "—"}</td>
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
    return <p className="text-sm text-black/40 text-center py-4">Aucun créneau dans ce planning pour ces matières.</p>;

  return (
    <div className="overflow-x-auto rounded-xl border">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-black/[0.03] border-b text-xs text-black/50">
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
          {epreuves.map((e) => {
            const indispo = isIndispo(e.date, e.heure_debut);
            return (
              <tr key={e.id} className={`border-b last:border-0 ${indispo ? "bg-red-50/60" : "hover:bg-black/[0.01]"}`}>
                <td className="px-3 py-2 text-center">
                  <span className={`inline-block h-2 w-2 rounded-full ${indispo ? "bg-red-400" : "bg-green-400"}`} />
                </td>
                <td className="px-3 py-2 font-medium">{e.matiere}</td>
                <td className="px-3 py-2 whitespace-nowrap text-black/60">{formatDate(e.date)}</td>
                <td className="px-3 py-2 font-mono">{e.heure_debut}</td>
                <td className="px-3 py-2 text-black/60">
                  {e.examinateur_nom
                    ? `${e.examinateur_nom} ${e.examinateur_prenom ?? ""}`
                    : <span className="text-black/25 italic">—</span>}
                </td>
                <td className="px-3 py-2">
                  {e.candidat_nom
                    ? <span>{e.candidat_nom} {e.candidat_prenom}</span>
                    : <span className="text-black/25 italic">—</span>}
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
  const [indisponibilites, setIndisponibilites] = useState<Indisponibilite[]>([]);

  useEffect(() => {
    setNom(ex.nom); setPrenom(ex.prenom); setEmail(ex.email);
    setTelephone(ex.telephone ?? ""); setEtablissement(ex.etablissement ?? "");
    setCodeUai(ex.code_uai ?? ""); setCommentaire(ex.commentaire ?? "");
    setSelectedMatieres(ex.matieres); setErr("");
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
      onUpdated(updated);
    } catch (e: unknown) { setErr(e instanceof Error ? e.message : "Erreur"); }
    finally { setSaving(false); }
  }

  async function toggleActif() {
    try {
      const updated = await patch<Examinateur>(`examinateurs/${ex.id}/actif`, { actif: !ex.actif });
      onUpdated(updated);
    } catch (e: unknown) { alert(e instanceof Error ? e.message : "Erreur"); }
  }

  async function deleteEx() {
    if (!confirm(`Supprimer ${ex.prenom} ${ex.nom} ?`)) return;
    try { await del(`examinateurs/${ex.id}`); onDeleted(); }
    catch (e: unknown) { alert(e instanceof Error ? e.message : "Erreur"); }
  }

  return (
    <div className="overflow-y-auto h-full">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 px-6 pt-5 pb-4 border-b sticky top-0 bg-white z-10">
        <div>
          <p className="text-xs text-black/40 uppercase tracking-wide mb-0.5">Examinateur</p>
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
              ex.actif
                ? "bg-green-50 text-green-700 border-green-200 hover:bg-green-100"
                : "bg-black/5 text-black/40 border-black/10 hover:bg-black/10"
            }`}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${ex.actif ? "bg-green-500" : "bg-black/30"}`} />
            {ex.actif ? "Actif" : "Inactif"}
          </button>
          <button
            onClick={() => setShowIdentifiants(true)}
            className="text-xs px-2.5 py-1.5 rounded-lg border border-blue-200 text-blue-600 hover:bg-blue-50 transition font-medium flex items-center gap-1"
          >
            <Send className="h-3 w-3" /> Identifiants
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
        <div className="grid grid-cols-2 gap-3">
          <Field label="Établissement"><Input value={etablissement} onChange={(e) => setEtablissement(e.target.value)} placeholder="Lycée Henri IV" /></Field>
          <Field label="Code UAI"><Input value={codeUai} onChange={(e) => setCodeUai(e.target.value)} placeholder="0750001A" /></Field>
        </div>
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
          <p className="text-xs font-semibold text-black/40 uppercase tracking-widest mb-3">Créneaux</p>
          <CreneauxExaminateur planningId={planningId} examinateur={ex} indisponibilites={indisponibilites} />
        </div>
      </div>

      {/* Modal identifiants */}
      <Modal open={showIdentifiants} onClose={() => setShowIdentifiants(false)} title="Identifiants examinateur">
        <div className="space-y-4">
          <p className="text-sm text-black/60">
            Communiquez ces informations à <strong>{ex.prenom} {ex.nom}</strong> pour accéder à son espace.
          </p>
          <div className="rounded-lg bg-black/[0.03] p-4 space-y-2.5 font-mono text-sm border">
            <div className="flex justify-between gap-4 items-center">
              <span className="text-black/50 text-xs uppercase tracking-wide">Login</span>
              <span className="font-semibold select-all">{ex.email}</span>
            </div>
            <div className="h-px bg-black/5" />
            <div className="flex justify-between gap-4 items-center">
              <span className="text-black/50 text-xs uppercase tracking-wide">Code d&apos;accès</span>
              <span className="font-semibold select-all tracking-widest text-lg">{ex.code_acces}</span>
            </div>
          </div>
          <p className="text-xs text-black/40">
            Pour réinitialiser le code d&apos;accès, utilisez Paramétrages → Réinitialisation.
          </p>
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
  const [actif, setActif] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function submit() {
    setLoading(true); setError("");
    try {
      await post("examinateurs/", {
        planning_id: planningId,
        nom: nom.trim().toUpperCase(), prenom: prenom.trim(), email: email.trim(),
        telephone: telephone.trim() || null,
        matieres: selectedMatieres,
        code_uai: codeUai.trim() || null,
        etablissement: etablissement.trim() || null,
        actif,
      });
      onCreated();
    } catch (e: unknown) { setError(e instanceof Error ? e.message : "Erreur"); }
    finally { setLoading(false); }
  }

  return (
    <div className="overflow-y-auto h-full">
      <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b sticky top-0 bg-white z-10">
        <h3 className="text-lg font-semibold">Nouvel examinateur</h3>
        <button onClick={onCancel} className="p-1 text-black/40 hover:text-black/70 transition"><X className="h-4 w-4" /></button>
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
        <div className="grid grid-cols-2 gap-3">
          <Field label="Établissement"><Input value={etablissement} onChange={(e) => setEtablissement(e.target.value)} placeholder="Lycée Henri IV" /></Field>
          <Field label="Code UAI"><Input value={codeUai} onChange={(e) => setCodeUai(e.target.value)} placeholder="0750001A" /></Field>
        </div>
        <Field label="Matière(s) *">
          <MatieresCheckboxes selected={selectedMatieres} onChange={setSelectedMatieres} matieres={matieres} />
        </Field>
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={actif} onChange={(e) => setActif(e.target.checked)} className="rounded" />
          <span className="text-sm">Actif (mobilisable dans le planning)</span>
        </label>
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

function ExaminateursSection() {
  const [plannings, setPlannings] = useState<Planning[]>([]);
  const [selectedPlanningId, setSelectedPlanningId] = useState<number | null>(null);
  const [examinateurs, setExaminateurs] = useState<Examinateur[]>([]);
  const [selectedEx, setSelectedEx] = useState<Examinateur | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [showImportEx, setShowImportEx] = useState(false);
  const [loading, setLoading] = useState(false);
  const [filterActif, setFilterActif] = useState<"tous" | "actif" | "inactif">("tous");
  const [tab, setTab] = useState<"fiche" | "affectation">("fiche");

  useEffect(() => {
    get<Planning[]>("plannings/").then((ps) => {
      setPlannings(ps);
      if (ps.length > 0) setSelectedPlanningId(ps[0].id);
    }).catch(() => {});
  }, []);

  const loadExaminateurs = useCallback(async () => {
    if (!selectedPlanningId) return;
    setLoading(true);
    try {
      const data = await get<Examinateur[]>(`examinateurs/?planning_id=${selectedPlanningId}`);
      setExaminateurs(data);
      setSelectedEx((prev) => prev ? (data.find((e) => e.id === prev.id) ?? null) : null);
    } finally { setLoading(false); }
  }, [selectedPlanningId]);

  useEffect(() => { loadExaminateurs(); }, [loadExaminateurs]);

  const filtered = examinateurs.filter((ex) =>
    filterActif === "tous" ? true : filterActif === "actif" ? ex.actif : !ex.actif
  );

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
                tab === t ? "bg-white border-black/10 text-black" : "border-transparent text-black/40 hover:text-black/60"
              }`}
            >
              {t === "fiche" ? "Fiches" : "Affectation aux épreuves"}
            </button>
          ))}
        </div>
      )}

      {selectedPlanningId && tab === "affectation" && (
        <AffectationTab planningId={selectedPlanningId} examinateurs={examinateurs} />
      )}

      {selectedPlanningId && tab === "fiche" && (
        <div className="flex bg-white rounded-xl shadow-sm overflow-hidden border" style={{ minHeight: 560 }}>
          {/* Colonne gauche : liste */}
          <div className="w-56 shrink-0 border-r flex flex-col">
            <div className="p-3 border-b">
              <div className="flex rounded-lg border overflow-hidden text-xs w-full">
                {(["tous", "actif", "inactif"] as const).map((f) => (
                  <button key={f} onClick={() => setFilterActif(f)}
                    className={`flex-1 py-1.5 transition ${filterActif === f ? "bg-black text-white" : "bg-white text-black/50 hover:bg-black/5"}`}
                  >
                    {f === "tous" ? "Tous" : f === "actif" ? "Actifs" : "Inact."}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex-1 overflow-y-auto divide-y">
              {loading ? <div className="p-4 text-center"><Spinner /></div> :
               filtered.length === 0 ? <p className="text-xs text-black/40 text-center p-4">Aucun examinateur</p> :
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
                  <span className={`h-2 w-2 rounded-full shrink-0 ${ex.actif ? "bg-green-500" : "bg-black/20"}`} />
                  <div className="min-w-0">
                    <p className="truncate font-medium text-sm">{ex.prenom} {ex.nom}</p>
                    <p className="truncate text-xs text-black/40">{ex.matieres.join(", ") || "—"}</p>
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
                onCreated={() => { setShowCreate(false); loadExaminateurs(); }}
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
              <div className="flex flex-col items-center justify-center h-full text-black/20 gap-3 py-16">
                <GraduationCap className="h-12 w-12" />
                <p className="text-sm text-black/30">Sélectionnez un examinateur ou créez-en un nouveau</p>
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
            <p className="text-xs font-medium text-green-700 mb-1">Codes d&apos;accès générés :</p>
            <table className="w-full text-xs">
              <thead><tr>
                <th className="text-left text-green-700">Nom</th>
                <th className="text-left text-green-700">Code accès</th>
                <th className="text-left text-green-700">Matières</th>
              </tr></thead>
              <tbody>
                {r.examinateurs.map((e: {id: number; prenom: string; nom: string; code_acces: string; matieres: string[]}) => (
                  <tr key={e.id}>
                    <td>{e.prenom} {e.nom}</td>
                    <td className="font-mono font-bold">{e.code_acces}</td>
                    <td>{e.matieres.join(", ")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      />
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

// ── ReferentielSection : générique Matières / Salles ──────────────────────────
type ReferentielItem = { id: number; intitule: string; active: boolean };

function ReferentielSection({
  entite,
  label,
  labelPlural,
}: {
  entite: "matieres" | "salles";
  label: string;
  labelPlural: string;
}) {
  const [items, setItems] = useState<ReferentielItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [newIntitule, setNewIntitule] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setItems(await get<ReferentielItem[]>(`parametrages/${entite}/`));
    } finally {
      setLoading(false);
    }
  }, [entite]);

  useEffect(() => { load(); }, [load]);

  const handleCreate = async () => {
    if (!newIntitule.trim()) return;
    setCreating(true);
    setError("");
    try {
      await post(`parametrages/${entite}/`, { intitule: newIntitule.trim(), active: true });
      setNewIntitule("");
      load();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setCreating(false);
    }
  };

  const toggleActive = async (item: ReferentielItem) => {
    try {
      const updated = await patch<ReferentielItem>(
        `parametrages/${entite}/${item.id}`,
        { active: !item.active }
      );
      setItems((prev) => prev.map((i) => (i.id === updated.id ? updated : i)));
    } catch (e: any) {
      alert(e.message);
    }
  };

  const handleDelete = async (item: ReferentielItem) => {
    if (!confirm(`Supprimer « ${item.intitule} » ?`)) return;
    try {
      await del(`parametrages/${entite}/${item.id}`);
      load();
    } catch (e: any) {
      alert(e.message);
    }
  };

  const actives = items.filter((i) => i.active);
  const inactives = items.filter((i) => !i.active);

  return (
    <div className="max-w-xl">
      <div className="bg-white rounded-2xl border border-black/5 shadow-sm overflow-hidden">
        {/* Formulaire d'ajout */}
        <div className="p-5 border-b border-black/5">
          <p className="text-xs font-semibold text-black/40 uppercase tracking-wide mb-3">
            Nouvelle {label.toLowerCase()}
          </p>
          <div className="flex gap-2">
            <input
              type="text"
              value={newIntitule}
              onChange={(e) => setNewIntitule(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCreate()}
              placeholder={`Intitulé de la ${label.toLowerCase()}…`}
              className="flex-1 rounded-lg border border-black/15 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black/10"
            />
            <Btn
              label={creating ? "…" : "Ajouter"}
              icon={Plus}
              onClick={handleCreate}
              disabled={creating || !newIntitule.trim()}
              small
            />
          </div>
          {error && <p className="text-xs text-red-500 mt-2">{error}</p>}
        </div>

        {/* Liste */}
        {loading ? (
          <div className="flex justify-center py-10"><Spinner /></div>
        ) : items.length === 0 ? (
          <div className="py-10 text-center text-sm text-black/30">
            Aucune {labelPlural} enregistrée
          </div>
        ) : (
          <div className="divide-y divide-black/5">
            {actives.map((item) => (
              <div key={item.id} className="flex items-center gap-3 px-5 py-3">
                <span className="flex-1 text-sm font-medium text-black/80">{item.intitule}</span>
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 font-medium">
                  Actif
                </span>
                <button
                  onClick={() => toggleActive(item)}
                  className="text-xs text-black/40 hover:text-amber-600 transition px-2 py-1 rounded border border-black/10 hover:border-amber-300"
                >
                  Désactiver
                </button>
                <button
                  onClick={() => handleDelete(item)}
                  className="text-black/20 hover:text-red-500 transition"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
            {inactives.length > 0 && (
              <>
                <div className="px-5 py-2 bg-black/[0.02]">
                  <span className="text-[10px] font-semibold text-black/30 uppercase tracking-wide">
                    Inactives ({inactives.length})
                  </span>
                </div>
                {inactives.map((item) => (
                  <div key={item.id} className="flex items-center gap-3 px-5 py-3 opacity-50">
                    <span className="flex-1 text-sm text-black/60 line-through">{item.intitule}</span>
                    <span className="text-[11px] px-2 py-0.5 rounded-full bg-gray-100 text-black/40 border border-black/10 font-medium">
                      Inactif
                    </span>
                    <button
                      onClick={() => toggleActive(item)}
                      className="text-xs text-black/40 hover:text-emerald-600 transition px-2 py-1 rounded border border-black/10 hover:border-emerald-300"
                    >
                      Activer
                    </button>
                    <button
                      onClick={() => handleDelete(item)}
                      className="text-black/20 hover:text-red-500 transition"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function ParametragesSection() {
  const [tab, setTab] = useState<"matieres" | "salles" | "messages" | "mdp">("matieres");
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
    { key: "matieres" as const, label: "Matières" },
    { key: "salles" as const, label: "Salles" },
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

      {/* ── Matières ── */}
      {tab === "matieres" && <ReferentielSection entite="matieres" label="Matière" labelPlural="matières" />}

      {/* ── Salles ── */}
      {tab === "salles" && <ReferentielSection entite="salles" label="Salle" labelPlural="salles" />}

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

      <div className="p-4 border-t border-white/10">
        <LogoutButton />
      </div>
    </aside>
  );
}

function LogoutButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const handleLogout = async () => {
    setLoading(true);
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/admin/login");
    router.refresh();
  };

  return (
    <button
      onClick={handleLogout}
      disabled={loading}
      className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-white/50 hover:bg-white/10 hover:text-white/80 transition text-xs"
    >
      <LogOut className="h-3.5 w-3.5" />
      {loading ? "Déconnexion…" : "Se déconnecter"}
    </button>
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
