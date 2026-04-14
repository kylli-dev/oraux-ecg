"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";
import PlanificationView from "./planification/PlanificationView";
import InterfaceAdminENSAEPlanning from "../InterfaceAdminENSAEPlanning";
import { useRouter } from "next/navigation";
import { ToastProvider, useToast, useConfirm } from "./Toast";
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
  Building2,
  Shield,
  Key,
  Copy,
  Mail,
  FileText,
  Save,
  Pencil,
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
  heure_previs: string | null;
  envoyer_convocations: boolean;
  interdire_modification_candidat: boolean;
  interdire_changement_creneau: boolean;
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
  salle_intitule?: string | null;
  salle_preparation_intitule?: string | null;
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
  examinateur2_id: number | null;
  examinateur2_nom: string | null;
  examinateur2_prenom: string | null;
  salle_id: number | null;
  salle_intitule: string | null;
  salle_preparation_id: number | null;
  salle_preparation_intitule: string | null;
  surveillant_id: number | null;
  surveillant_nom: string | null;
  surveillant_prenom: string | null;
  planche_id: number | null;
  planche_nom: string | null;
};

type PlancheItem = {
  id: number;
  nom: string;
  fichier_path: string;
  matiere_id: number | null;
  matiere_intitule: string | null;
  examinateur_id: number | null;
  examinateur_nom: string | null;
  statut: string;
  assignee: boolean;
  created_at: string;
};

type Examinateur = {
  id: number;
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
  actif_planning: boolean | null;
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

type SectionKey = "plannings" | "journeeTypes" | "candidats" | "examinateurs" | "surveillants" | "dashboard" | "conflits" | "parametrages" | "notes" | "salles" | "planches";

type Surveillant = {
  id: number;
  planning_id: number;
  nom: string;
  prenom: string;
  email: string;
  actif: boolean;
  code_acces: string;
};

type Salle = {
  id: number;
  intitule: string;
  active: boolean;
};

type CandidatListeItem = {
  id: number;
  nom: string;
  prenom: string;
  email: string;
  code_candidat: string | null;
  civilite: string | null;
  is_inscrit: boolean;
  inscription_id: number | null;
  is_liste_attente: boolean;
  statut: string;
};

type TripletEpreuveGestion = {
  id: number;
  matiere: string;
  heure_debut: string;
  heure_fin: string;
};

type TripletDisponible = {
  date: string;
  heure_debut: string;
  epreuves: TripletEpreuveGestion[];
  type_slot: "LIBRE" | "PRERESERVEE";
};

type InscriptionGestion = {
  id: number;
  date: string;
  epreuves: TripletEpreuveGestion[];
};

type FicheCandidat = {
  id: number;
  nom: string;
  prenom: string;
  email: string;
  civilite: string | null;
  code_candidat: string | null;
  numero_ine: string | null;
  profil: string | null;
  tel_portable: string | null;
  handicape: boolean | null;
  classe: string | null;
  etablissement: string | null;
  ville_etablissement: string | null;
  qualite: string | null;
  inscription: InscriptionGestion | null;
  liste_attente: { date: string }[];
};

type JourneeInscritItem = {
  candidat_id: number;
  candidat_nom: string;
  candidat_prenom: string;
  candidat_code: string | null;
  inscription_id: number;
  epreuves: TripletEpreuveGestion[];
};

type ListeAttenteAdminDate = {
  date: string;
  created_at: string;
};

type ListeAttenteAdminItem = {
  id: number;
  nom: string;
  prenom: string;
  email: string;
  code_candidat: string | null;
  civilite: string | null;
  profil: string | null;
  dates: ListeAttenteAdminDate[];
  premier_enregistrement: string;
};

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
  const text = await res.text();
  let data: any;
  try { data = JSON.parse(text); } catch { data = { detail: text || `Erreur ${res.status}` }; }
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

        {/* File picker — visible si pas encore de résultat OU si erreurs bloquantes */}
        {(!result || (result.errors?.length > 0 && result.created === 0)) && (
          <div>
            <input
              ref={inputRef}
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              onChange={(e) => { setFile(e.target.files?.[0] ?? null); setResult(null); }}
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
        {result && result.errors?.length > 0 && result.created === 0 && (
          <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3">
            <p className="text-sm font-semibold text-red-700 mb-2">
              ✗ Import bloqué — {result.errors.length} erreur(s) détectée(s). Aucune ligne créée.
            </p>
            <p className="text-xs text-red-600 mb-2">Corrigez le fichier puis réessayez.</p>
            <ul className="text-xs text-red-600 space-y-1 max-h-64 overflow-y-auto">
              {result.errors.map((e: string, i: number) => (
                <li key={i} className="flex gap-1.5">
                  <span className="shrink-0 font-bold">•</span>
                  <span>{e}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
        {result && result.created > 0 && (
          <div className="rounded-xl bg-green-50 border border-green-100 px-4 py-3">
            <p className="text-sm font-semibold text-green-800 mb-2">
              ✓ Import terminé — {result.created} candidat(s) créé(s)
            </p>
            {resultRenderer && resultRenderer(result)}
          </div>
        )}

        {/* Actions */}
        {(!result || (result.errors?.length > 0 && result.created === 0)) && (
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
              {result?.errors?.length > 0 ? "Réessayer" : "Importer"}
            </button>
          </div>
        )}
        {result && result.created > 0 && (
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
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <label className="block text-xs font-medium text-black/50 uppercase tracking-wide">{label}</label>
      {hint && <p className="text-[10px] text-black/30 -mt-0.5">{hint}</p>}
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
  const map: Record<string, [string, string]> = {
    BROUILLON:     ["bg-gray-100 text-gray-500",   "Brouillon"],
    OUVERT:        ["bg-green-100 text-green-700",  "Ouvert"],
    CLOS:          ["bg-black/10 text-black/50",    "Clos"],
    LIBRE:         ["bg-green-100 text-green-700",  "Libre"],
    CREE:          ["bg-gray-100 text-gray-500",    "Créé"],
    ATTRIBUEE:     ["bg-blue-100 text-blue-700",    "Réservé"],
    EN_EVALUATION: ["bg-yellow-100 text-yellow-700","En éval."],
    FINALISEE:     ["bg-purple-100 text-purple-700","Finalisé"],
    ANNULEE:       ["bg-red-100 text-red-500",      "Annulé"],
    IMPORTE:       ["bg-gray-100 text-gray-400",    "À placer"],
    INSCRIT:       ["bg-green-100 text-green-700",  "Inscrit"],
    CONFIRME:      ["bg-blue-100 text-blue-700",    "Confirmé"],
    ANNULE:        ["bg-red-100 text-red-500",      "Annulé"],
  };
  const [cls, label] = map[statut] ?? ["bg-gray-100 text-gray-500", statut];
  return (
    <span className={`inline-block text-xs px-2 py-0.5 rounded-full font-medium ${cls}`}>
      {label}
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
    date_ouverture_inscriptions: planning.date_ouverture_inscriptions ?? "",
    date_fermeture_inscriptions: planning.date_fermeture_inscriptions ?? "",
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
        <p className="text-[11px] font-semibold text-black/40 uppercase tracking-wide mb-1">Paramètres</p>
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
            <span className="text-sm text-black/70">{label}</span>
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
  if (statut === "PRERESERVEE")
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
  if (statuts.has("PRERESERVEE")) return "PRERESERVEE";
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
          <option value="PRERESERVEE">Préréservé</option>
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
                    : rs === "PRERESERVEE" ? "bg-amber-50/50"
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
  const matieres = useMatieres();
  const [viewMode, setViewMode] = useState<"journee" | "tableau">("tableau");
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
        {(["tableau", "journee"] as const).map((m) => (
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
                  matieres={matieres}
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

const EPREUVE_STATUTS = ["CREE", "LIBRE", "PRERESERVEE", "ATTRIBUEE", "EN_EVALUATION", "FINALISEE", "ANNULEE"];
const EPREUVE_STATUT_LABEL: Record<string, string> = {
  CREE: "Créé", LIBRE: "Libre", PRERESERVEE: "Préréservé",
  ATTRIBUEE: "Réservé", EN_EVALUATION: "En évaluation", FINALISEE: "Finalisé", ANNULEE: "Annulé",
};

function EpreuveRow({
  epreuve,
  planningId,
  onRefresh,
}: {
  epreuve: Epreuve;
  planningId: number;
  onRefresh: () => void;
}) {
  const toast = useToast();
  const confirm = useConfirm();
  const [changing, setChanging] = useState(false);
  const [open, setOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editMatiere, setEditMatiere] = useState(epreuve.matiere);
  const [editDebut, setEditDebut] = useState(hm(epreuve.heure_debut));
  const [editFin, setEditFin] = useState(hm(epreuve.heure_fin));
  const [saving, setSaving] = useState(false);

  const statutCls = (s: string) => {
    if (s === "LIBRE") return "bg-green-50 text-green-700";
    if (s === "PRERESERVEE") return "bg-amber-50 text-amber-700";
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
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setChanging(false);
    }
  };

  const openEdit = () => {
    setEditMatiere(epreuve.matiere);
    setEditDebut(hm(epreuve.heure_debut));
    setEditFin(hm(epreuve.heure_fin));
    setEditOpen(true);
  };

  const handleSaveEdit = async () => {
    setSaving(true);
    try {
      await put(`epreuves/${epreuve.id}`, { matiere: editMatiere, heure_debut: editDebut, heure_fin: editFin });
      setEditOpen(false);
      onRefresh();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!await confirm(`Supprimer le créneau ${epreuve.matiere} (${hm(epreuve.heure_debut)} – ${hm(epreuve.heure_fin)}) ?`, { confirmLabel: "Supprimer", danger: true })) return;
    try {
      await del(`epreuves/${epreuve.id}`);
      onRefresh();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <>
      <div className="flex items-center justify-between px-4 py-2.5 hover:bg-black/[0.01] transition group">
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
            {epreuve.salle_intitule && (
              <span className="text-[10px] text-black/30 font-mono">{epreuve.salle_intitule}</span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            onClick={openEdit}
            className="p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-black/5 text-black/40 hover:text-black/70 transition"
            title="Modifier"
          >
            <Edit2 className="h-3 w-3" />
          </button>
          {!epreuve.candidat_nom && (
            <button
              onClick={handleDelete}
              className="p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-red-50 text-black/30 hover:text-red-500 transition"
              title="Supprimer"
            >
              <Trash2 className="h-3 w-3" />
            </button>
          )}
          <div className="relative">
            {changing ? (
              <Spinner />
            ) : (
              <button
                onClick={() => setOpen((o) => !o)}
                className={`text-xs px-2 py-0.5 rounded-full cursor-pointer hover:opacity-80 transition ${statutCls(epreuve.statut)}`}
              >
                {EPREUVE_STATUT_LABEL[epreuve.statut] ?? epreuve.statut}
              </button>
            )}
            {open && (
              <div className="absolute right-0 top-full mt-1 z-50 bg-white rounded-xl border shadow-lg py-1 min-w-[140px]">
                {EPREUVE_STATUTS.map((s) => (
                  <button
                    key={s}
                    onClick={() => handleStatut(s)}
                    className={`w-full text-left px-3 py-1.5 text-xs hover:bg-black/5 transition ${s === epreuve.statut ? "font-semibold" : ""}`}
                  >
                    {EPREUVE_STATUT_LABEL[s] ?? s}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
      {editOpen && (
        <div className="px-4 py-3 bg-blue-50/40 border-t border-blue-100 flex items-center gap-2 flex-wrap">
          <input
            value={editMatiere}
            onChange={(e) => setEditMatiere(e.target.value)}
            className="text-sm border rounded-lg px-2 py-1 w-28 focus:outline-none focus:ring-1 focus:ring-blue-300"
            placeholder="Matière"
          />
          <input
            type="time"
            value={editDebut}
            onChange={(e) => setEditDebut(e.target.value)}
            className="text-sm border rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-300"
          />
          <span className="text-xs text-black/30">–</span>
          <input
            type="time"
            value={editFin}
            onChange={(e) => setEditFin(e.target.value)}
            className="text-sm border rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-300"
          />
          <button
            onClick={handleSaveEdit}
            disabled={saving}
            className="text-xs bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-1.5"
          >
            {saving && <Loader2 className="h-3 w-3 animate-spin" />}
            Enregistrer
          </button>
          <button onClick={() => setEditOpen(false)} className="text-xs text-black/40 hover:text-black/70">
            Annuler
          </button>
        </div>
      )}
    </>
  );
}

function DemiJourneeCard({
  dj,
  planningId,
  matieres,
  onRegen,
  onRefresh,
}: {
  dj: DemiJournee;
  planningId: number;
  matieres: MatiereItem[];
  onRegen: () => void;
  onRefresh: () => void;
}) {
  const toast = useToast();
  const [addOpen, setAddOpen] = useState(false);
  const [newMatiere, setNewMatiere] = useState("");
  const [newDebut, setNewDebut] = useState("");
  const [adding, setAdding] = useState(false);

  // Durée en minutes déduite des épreuves existantes de la même matière
  function dureeMatiere(matiere: string): number | null {
    const ep = dj.epreuves.find((e) => e.matiere === matiere);
    if (!ep) return null;
    const [dh, dm] = ep.heure_debut.split(":").map(Number);
    const [fh, fm] = ep.heure_fin.split(":").map(Number);
    return (fh * 60 + fm) - (dh * 60 + dm);
  }

  function addMinutes(hhmm: string, mins: number): string {
    const [h, m] = hhmm.split(":").map(Number);
    const total = h * 60 + m + mins;
    return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
  }

  const duree = newMatiere ? dureeMatiere(newMatiere) : null;
  const newFin = duree !== null && newDebut ? addMinutes(newDebut, duree) : "";

  const handleAddEpreuve = async () => {
    if (!newMatiere || !newDebut || !newFin) return;
    setAdding(true);
    try {
      await post(`epreuves/`, { demi_journee_id: dj.id, matiere: newMatiere, heure_debut: newDebut, heure_fin: newFin, statut: "LIBRE" });
      setNewMatiere(""); setNewDebut("");
      setAddOpen(false);
      onRefresh();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setAdding(false);
    }
  };

  return (
    <div className="rounded-xl border bg-white shadow-sm">
      <div className="flex items-center justify-between px-4 py-3 bg-[#FAFAFA] border-b rounded-t-xl">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-sm">
            {dj.type === "MATIN" ? "Matin" : "Après-midi"}
          </span>
          <span className="text-xs text-black/40">
            {hm(dj.heure_debut)} – {hm(dj.heure_fin)}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-black/30">{dj.epreuves.length} créneaux</span>
          <Btn
            label="+ Créneau"
            icon={Plus}
            onClick={() => setAddOpen((o) => !o)}
            small
            variant="ghost"
          />
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

      {addOpen && (
        <div className="px-4 py-3 border-t bg-gray-50/60">
          <p className="text-xs font-semibold text-black/50 mb-2">Nouveau créneau</p>
          <div className="flex items-center gap-2 flex-wrap">
            <select
              value={newMatiere}
              onChange={(e) => setNewMatiere(e.target.value)}
              className="text-sm border rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-gray-300"
            >
              <option value="">Matière…</option>
              {matieres.filter((m) => m.active).map((m) => (
                <option key={m.id} value={m.intitule}>{m.intitule}</option>
              ))}
            </select>
            <input
              type="time"
              value={newDebut}
              onChange={(e) => setNewDebut(e.target.value)}
              className="text-sm border rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-gray-300"
            />
            {newFin ? (
              <span className="text-xs text-black/40 font-mono">→ {newFin} <span className="text-black/25">({duree} min)</span></span>
            ) : newMatiere && !duree ? (
              <span className="text-xs text-amber-500">Aucune épreuve de référence — durée inconnue</span>
            ) : null}
            <button
              onClick={handleAddEpreuve}
              disabled={adding || !newMatiere || !newDebut || !newFin}
              className="text-xs font-semibold px-3 py-1.5 rounded-lg text-white bg-[#C62828] hover:bg-[#B71C1C] disabled:opacity-40 flex items-center gap-1.5"
            >
              {adding && <Loader2 className="h-3 w-3 animate-spin" />}
              Créer
            </button>
            <button onClick={() => setAddOpen(false)} className="text-xs text-black/40 hover:text-black/70">
              Annuler
            </button>
          </div>
        </div>
      )}
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
function JourneeTypeEditor({ jt, onRename }: { jt: JourneeType; onRename?: (newNom: string) => void }) {
  const toast = useToast();
  const confirm = useConfirm();
  const [blocs, setBlocs] = useState<Bloc[]>([]);
  const [selectedBlocId, setSelectedBlocId] = useState<number | null>(null);
  const [showAdd, setShowAdd] = useState(false);

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
              <button onClick={() => { setEditingNom(false); setNomValue(jt.nom); }} className="text-xs text-black/40 hover:text-black/70 px-2 py-1">
                Annuler
              </button>
            </>
          ) : (
            <button
              onClick={() => setEditingNom(true)}
              className="text-sm font-medium text-black/70 hover:text-black flex items-center gap-1.5 group"
              title="Modifier le nom"
            >
              {nomValue}
              <Pencil className="h-3 w-3 text-black/20 group-hover:text-black/50 transition" />
            </button>
          )}
        </div>

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
  const toast = useToast();
  const confirm = useConfirm();
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

type MatiereConfig = {
  nom: string;
  duree_minutes: number;
  preparation_minutes: number;
};

type BlocWizard = {
  heure_debut: string;
  heure_fin: string;
  pause_minutes: number;
  nb_slots: number | null;        // null → N² automatique (créneaux ORAL)
  matieres_config: MatiereConfig[];
  pause_midi_slots: number;       // 0 = pas de pause ; >0 = créneaux de pause (journée complète)
  pause_midi_after: number | null; // null = auto (moitié des créneaux oraux)
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
  bloc_idx: number;
  isPause?: boolean;
};

function buildBlocRows(bloc: BlocWizard, configs: MatiereConfig[] | undefined, bloc_idx: number, oralOffset = 0): MatrixRow[] {
  configs = configs ?? bloc.matieres_config;
  const N = configs.length;
  if (!N) return [];
  const Nsq = N * N;
  const maxDuree = Math.max(...configs.map(c => c.duree_minutes));
  const maxPrep = Math.max(...configs.map(c => c.preparation_minutes));
  const [hh, mm] = bloc.heure_debut.split(":").map(Number);
  const [efh, efm] = bloc.heure_fin.split(":").map(Number);
  const start = hh * 60 + mm;
  const end = efh * 60 + efm;
  const interval = maxDuree + bloc.pause_minutes;
  const slotDuration = maxPrep + maxDuree;
  const pauseSlots = bloc.pause_midi_slots ?? 0;
  // Available time for oral only (subtract pause duration)
  const availableOral = (end - start) - pauseSlots * interval;
  const maxSlots = interval > 0 ? Math.floor((availableOral - slotDuration) / interval) + 1 : Nsq;
  const nbOral = bloc.nb_slots !== null ? bloc.nb_slots : Math.max(1, Math.floor(maxSlots / Nsq)) * Nsq;
  const pauseAfter = bloc.pause_midi_after ?? Math.ceil(nbOral / 2);

  const rows: MatrixRow[] = [];
  let t = start;
  let oral = 0;
  while (oral < nbOral) {
    if (pauseSlots > 0 && oral === pauseAfter) {
      for (let p = 0; p < pauseSlots; p++) {
        rows.push({ deb_prepa: minutesToHM(t), deb_exam: minutesToHM(t + maxPrep), fin_exam: minutesToHM(t + maxPrep + maxDuree), candidates: [], bloc_idx, isPause: true });
        t += interval;
      }
    }
    const local_i = oral % Nsq;
    rows.push({
      deb_prepa: minutesToHM(t),
      deb_exam: minutesToHM(t + maxPrep),
      fin_exam: minutesToHM(t + maxPrep + maxDuree),
      candidates: Array.from({ length: N }, (_, j) => ((local_i - j * N) % Nsq + Nsq) % Nsq + oralOffset),
      bloc_idx,
      isPause: false,
    });
    t += interval;
    oral++;
  }
  return rows;
}

function buildMatrix(p: WizardParams): MatrixRow[] {
  let oralOffset = 0;
  return p.blocs.flatMap((bloc, idx) => {
    const rows = buildBlocRows(bloc, bloc.matieres_config, idx, oralOffset);
    oralOffset += rows.filter(r => !r.isPause).length;
    return rows;
  });
}

// ── Wizard création journée type (2 étapes) ────────────────────────────────────
function CreateJourneeTypeForm({ onSuccess }: { onSuccess: () => void }) {
  const [step, setStep] = useState<1 | 2>(1);
  const allMatieres = useMatieres();
  const DEFAULT_BLOC: BlocWizard = { heure_debut: "08:00", heure_fin: "13:00", pause_minutes: 0, nb_slots: null, matieres_config: [], pause_midi_slots: 0, pause_midi_after: null };
  const [p, setP] = useState<WizardParams>({
    nom: "",
    salles_par_matiere: 1,
    statut_initial: "LIBRE",
    mode: "demi-journee",
    blocs: [
      { heure_debut: "08:00", heure_fin: "13:00", pause_minutes: 0, nb_slots: null, matieres_config: [], pause_midi_slots: 0, pause_midi_after: null },
      { heure_debut: "14:00", heure_fin: "18:00", pause_minutes: 0, nb_slots: null, matieres_config: [], pause_midi_slots: 0, pause_midi_after: null },
    ],
  });
  const [matrix, setMatrix] = useState<MatrixRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [editMode, setEditMode] = useState(false);
  const [dragSrc, setDragSrc] = useState<{ rowIdx: number; matIdx: number } | null>(null);
  const [dragOver, setDragOver] = useState<{ rowIdx: number; matIdx: number } | null>(null);

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
  const addBloc = () => setP((prev) => ({
    ...prev,
    blocs: [...prev.blocs, { ...DEFAULT_BLOC, heure_debut: "14:00", heure_fin: "18:00" }],
  }));
  const removeBloc = (idx: number) => setP((prev) => ({ ...prev, blocs: prev.blocs.filter((_, i) => i !== idx) }));

  const handleGenerate = () => {
    if (!p.nom.trim()) { setError("Nom requis"); return; }
    if (p.blocs.every(b => b.matieres_config.length === 0)) {
      setError("Sélectionnez au moins une matière dans un bloc"); return;
    }
    setError("");
    setMatrix(buildMatrix(p));
    setStep(2);
  };

  const handleSave = async () => {
    setLoading(true);
    setError("");
    try {
      const allConfigs = p.blocs.flatMap(b => b.matieres_config);
      const maxDuree = allConfigs.length ? Math.max(...allConfigs.map(c => c.duree_minutes)) : 30;
      const maxPrep = allConfigs.length ? Math.max(...allConfigs.map(c => c.preparation_minutes)) : 30;
      const jt = await post<{ id: number }>("journee-types/", {
        nom: p.nom,
        duree_defaut_minutes: maxDuree,
        pause_defaut_minutes: p.blocs[0].pause_minutes,
        preparation_defaut_minutes: maxPrep,
        statut_initial: p.statut_initial,
      });
      let ordre = 1;
      for (let idx = 0; idx < p.blocs.length; idx++) {
        const bloc = p.blocs[idx];
        if (!bloc.matieres_config.length) continue;
        const blocRows = matrix.filter(r => r.bloc_idx === idx);
        if (!blocRows.length) continue;
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
        };

        if (p.mode === "journee-complete" && (bloc.pause_midi_slots ?? 0) > 0) {
          // Journée complète : split en 2 blocs (Matin + Après-midi) autour de la pause
          const oralBefore = blocRows.filter(r => !r.isPause).slice(0, bloc.pause_midi_after ?? Math.ceil(blocRows.filter(r => !r.isPause).length / 2));
          const oralAfter = blocRows.filter(r => !r.isPause).slice(oralBefore.length);
          if (oralBefore.length) {
            await post(`journee-types/${jt.id}/blocs`, { ...blocPayload, ordre: ordre++, heure_debut: oralBefore[0].deb_prepa + ":00", heure_fin: oralBefore[oralBefore.length - 1].fin_exam + ":00", nb_slots: oralBefore.length });
          }
          if (oralAfter.length) {
            await post(`journee-types/${jt.id}/blocs`, { ...blocPayload, ordre: ordre++, heure_debut: oralAfter[0].deb_prepa + ":00", heure_fin: oralAfter[oralAfter.length - 1].fin_exam + ":00", nb_slots: oralAfter.length });
          }
        } else {
          await post(`journee-types/${jt.id}/blocs`, { ...blocPayload, ordre: ordre++, heure_debut: bloc.heure_debut + ":00", heure_fin: blocRows[blocRows.length - 1].fin_exam + ":00", nb_slots: bloc.nb_slots ?? null });
        }
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
    const activeMatieres = allMatieres.filter(m => m.active);
    const blocLabel = (heure_debut: string) => parseInt(heure_debut) < 13 ? "Matin" : "Après-midi";

    const isJC = p.mode === "journee-complete";

    // Quand on bascule en journée complète, forcer 1 seul bloc avec pause_midi_slots=2
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
            pause_midi_slots: 2,
            pause_midi_after: null,
          }],
        }));
      } else {
        setP(prev => ({
          ...prev,
          mode: m,
          blocs: [
            { ...prev.blocs[0], pause_midi_slots: 0, pause_midi_after: null },
            { heure_debut: "14:00", heure_fin: "18:00", pause_minutes: prev.blocs[0].pause_minutes, nb_slots: null, matieres_config: [], pause_midi_slots: 0, pause_midi_after: null },
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
                p.mode === m ? "bg-black text-white border-black" : "bg-white text-black/50 border-black/15 hover:border-black/30"
              }`}
            >
              {m === "demi-journee" ? "Demi-journée" : "Journée complète"}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Nom">
            <Input value={p.nom} onChange={(e) => set("nom", e.target.value)} placeholder="Journée standard ECG" />
          </Field>
          <Field label="Salles par matière">
            <Input type="number" value={p.salles_par_matiere} onChange={(e) => set("salles_par_matiere", Number(e.target.value))} min={1} max={50} />
          </Field>
        </div>

        {/* ── Blocs horaires ── */}
        <div className="space-y-3">
          {p.blocs.map((bloc, idx) => {
            const N = bloc.matieres_config.length;
            const Nsq = N * N;
            const bMaxDuree = N > 0 ? Math.max(...bloc.matieres_config.map(c => c.duree_minutes)) : 0;
            const bMaxPrep = N > 0 ? Math.max(...bloc.matieres_config.map(c => c.preparation_minutes)) : 0;
            const interval = bMaxDuree + bloc.pause_minutes;
            const slotDuration = bMaxPrep + bMaxDuree;
            const [bh, bm] = bloc.heure_debut.split(":").map(Number);
            const [eh, em] = bloc.heure_fin.split(":").map(Number);
            const available = (eh * 60 + em) - (bh * 60 + bm);
            const maxSlots = N > 0 && interval > 0 ? Math.floor((available - slotDuration) / interval) + 1 : Nsq;
            const autoTotal = N > 0 ? Math.max(1, Math.floor(maxSlots / Nsq)) * Nsq : 0;
            const total = bloc.nb_slots !== null ? bloc.nb_slots : autoTotal;
            return (
              <div key={idx} className="rounded-xl border border-black/10 bg-gray-50/60 p-4 space-y-3">
                {/* En-tête du bloc */}
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-black/70">Bloc {idx + 1} — {blocLabel(bloc.heure_debut)}</span>
                  <div className="flex items-center gap-3">
                    {N > 0 && (
                      <span className="text-xs text-green-700 font-medium">
                        {bloc.nb_slots !== null ? `${total} créneaux (manuel)` : `${autoTotal} créneaux (N²=${Nsq})`}
                      </span>
                    )}
                    {p.blocs.length > 1 && (
                      <button onClick={() => removeBloc(idx)} className="text-black/25 hover:text-red-500 transition">
                        <X className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Matières du bloc */}
                <div className="space-y-1.5">
                  <p className="text-[11px] font-semibold text-black/40 uppercase tracking-wide">Matières</p>
                  {activeMatieres.length === 0 ? (
                    <p className="text-xs text-amber-600">Aucune matière active — Paramétrages → Matières.</p>
                  ) : (
                    <div className="flex flex-wrap gap-1.5">
                      {activeMatieres.map(m => {
                        const checked = bloc.matieres_config.some(c => c.nom === m.intitule);
                        return (
                          <button key={m.id} type="button" onClick={() => toggleBlocMatiere(idx, m.intitule)}
                            className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition ${
                              checked ? "bg-black text-white border-black" : "bg-white text-black/50 border-black/15 hover:border-black/30"
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
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="bg-white border-b border-black/5">
                          <th className="text-left px-3 py-1.5 text-black/40 font-medium">Matière</th>
                          <th className="text-center px-3 py-1.5 text-black/40 font-medium">Oral (min)</th>
                          <th className="text-center px-3 py-1.5 text-black/40 font-medium">Prépa (min)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {bloc.matieres_config.map((mc) => (
                          <tr key={mc.nom} className="border-b border-black/5 last:border-0 bg-white">
                            <td className="px-3 py-1.5 font-medium text-black/70">{mc.nom}</td>
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
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Horaires du bloc */}
                {(() => {
                  const slotAdvance = bMaxDuree + bloc.pause_minutes;
                  const [sdh, sdm] = bloc.heure_debut.split(":").map(Number);
                  const startMin = sdh * 60 + sdm;
                  const pauseMidi = bloc.pause_midi_slots ?? 0;
                  // heure_fin inclut les créneaux de pause midi
                  const nbOralForFin = bloc.nb_slots ?? autoTotal;
                  const computedFinMin = nbOralForFin > 0 && slotAdvance > 0
                    ? startMin + bMaxPrep + (nbOralForFin + pauseMidi) * slotAdvance
                    : null;
                  const toHM = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
                  const computedFin = computedFinMin !== null ? toHM(computedFinMin) : null;

                  const updateNbSlots = (val: number | null) => {
                    setP(prev => ({
                      ...prev,
                      blocs: prev.blocs.map((b, i) => {
                        if (i !== idx) return b;
                        const sAdv = bMaxDuree + b.pause_minutes;
                        const pm = b.pause_midi_slots ?? 0;
                        const [sh, sm] = b.heure_debut.split(":").map(Number);
                        const finMin = val !== null && sAdv > 0 ? (sh * 60 + sm) + bMaxPrep + (val + pm) * sAdv : null;
                        return { ...b, nb_slots: val, heure_fin: finMin !== null ? toHM(finMin) : b.heure_fin };
                      }),
                    }));
                  };

                  const updatePauseMidi = (pm: number) => {
                    setP(prev => ({
                      ...prev,
                      blocs: prev.blocs.map((b, i) => {
                        if (i !== idx) return b;
                        const sAdv = bMaxDuree + b.pause_minutes;
                        const nb = b.nb_slots ?? autoTotal;
                        const [sh, sm] = b.heure_debut.split(":").map(Number);
                        const finMin = nb > 0 && sAdv > 0 ? (sh * 60 + sm) + bMaxPrep + (nb + pm) * sAdv : null;
                        return { ...b, pause_midi_slots: pm, heure_fin: finMin !== null ? toHM(finMin) : b.heure_fin };
                      }),
                    }));
                  };

                  return (
                    <div className="space-y-2">
                      <div className="grid grid-cols-3 gap-3">
                        <Field label="Début du bloc">
                          <Input type="time" value={bloc.heure_debut} onChange={(e) => setBloc(idx, "heure_debut", e.target.value)} />
                        </Field>
                        <Field label="Pause entre créneaux (min)">
                          <Input type="number" value={bloc.pause_minutes} onChange={(e) => setBloc(idx, "pause_minutes", Number(e.target.value))} min={0} max={120} />
                        </Field>
                        <Field label="Nb créneaux oraux" hint={computedFin ? `→ fin à ${computedFin}` : autoTotal > 0 ? `vide = ${autoTotal} calculé` : ""}>
                          <Input
                            type="number"
                            value={bloc.nb_slots ?? ""}
                            placeholder={autoTotal > 0 ? String(autoTotal) : "—"}
                            onChange={(e) => updateNbSlots(e.target.value === "" ? null : Math.max(1, Number(e.target.value)))}
                            min={1}
                          />
                        </Field>
                      </div>

                      {/* Pause de midi — visible seulement en mode journée complète */}
                      {isJC && (
                        <div className="rounded-lg border border-orange-100 bg-orange-50/50 px-3 py-2.5 flex items-center gap-4">
                          <span className="text-[11px] font-semibold text-orange-700 uppercase tracking-wide shrink-0">Pause déjeuner</span>
                          <Field label="Nb créneaux de pause">
                            <Input
                              type="number"
                              value={pauseMidi}
                              onChange={(e) => updatePauseMidi(Math.max(0, Number(e.target.value)))}
                              min={0} max={10}
                              className="w-16"
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
                              {(bloc.nb_slots ?? autoTotal) + pauseMidi} créneaux · fin à {computedFin}
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

        {!isJC && (
          <button
            onClick={addBloc}
            className="w-full py-2 rounded-xl border border-dashed border-black/20 text-xs text-black/40 hover:border-black/40 hover:text-black/60 transition flex items-center justify-center gap-1.5"
          >
            <Plus className="h-3.5 w-3.5" /> Ajouter un bloc
          </button>
        )}

        <ErrorMsg msg={error} />
        <Btn label="Générer la matrice →" icon={LayoutGrid} onClick={handleGenerate} disabled={!p.nom.trim() || p.blocs.every(b => b.matieres_config.length === 0)} />
      </div>
    );
  }

  // ── Étape 2 ─────────────────────────────────────────────────────────────────
  const maxBlocN = Math.max(...p.blocs.map(b => b.matieres_config.length), 0);
  const capacite = matrix.length * p.salles_par_matiere;

  const swapCells = (a: { rowIdx: number; matIdx: number }, b: { rowIdx: number; matIdx: number }) => {
    if (a.rowIdx === b.rowIdx && a.matIdx === b.matIdx) return;
    setMatrix(prev => {
      const next = prev.map(r => ({ ...r, candidates: [...r.candidates] }));
      const va = next[a.rowIdx].candidates[a.matIdx];
      const vb = next[b.rowIdx].candidates[b.matIdx];
      next[a.rowIdx].candidates[a.matIdx] = vb;
      next[b.rowIdx].candidates[b.matIdx] = va;
      return next;
    });
  };

  const blocLabel = (heure_debut: string) => parseInt(heure_debut) < 13 ? "Matin" : "Après-midi";

  return (
    <div className="space-y-4">
      <StepPills />

      {/* Récapitulatif */}
      <div className="rounded-lg bg-gray-50 border border-black/8 px-4 py-2.5 text-xs text-black/60 flex flex-wrap gap-x-5 gap-y-1">
        <span className="font-semibold text-black/80">{p.nom}</span>
        <span>{p.blocs.map((b, i) => b.matieres_config.length ? `Bloc ${i+1}: ${b.matieres_config.map(mc => mc.nom).join(", ")}` : null).filter(Boolean).join(" · ")}</span>
        {p.blocs.map((bloc, idx) => {
          const blocRows = matrix.filter(r => r.bloc_idx === idx);
          return (
            <span key={idx}>
              Bloc {idx + 1} : {bloc.heure_debut} → {blocRows.length ? blocRows[blocRows.length - 1].fin_exam : "?"} ({blocRows.length} créneaux)
            </span>
          );
        })}
        <span className="font-medium text-black/70">{matrix.length} créneaux · {capacite} candidat(s)</span>
      </div>

      {/* Barre d'outils matrice */}
      <div className="flex items-center justify-between">
        <p className="text-xs text-black/40">
          Chaque triplet T<em>k</em> = un candidat passant {maxBlocN} épreuve(s) à des horaires décalés.
          {p.salles_par_matiere > 1 && <> · {capacite} candidats au total.</>}
        </p>
        <button
          type="button"
          onClick={() => { setEditMode(e => !e); setDragSrc(null); setDragOver(null); }}
          className={`text-xs px-3 py-1.5 rounded-lg border font-medium transition ${
            editMode ? "bg-black text-white border-black" : "bg-white text-black/50 border-black/15 hover:border-black/30"
          }`}
        >
          {editMode ? "✓ Mode édition actif" : "Modifier manuellement"}
        </button>
      </div>
      {editMode && (
        <p className="text-[11px] text-black/30 -mt-2">
          Glissez un triplet vers une autre cellule pour l'échanger.
        </p>
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
              <th className="text-left px-3 py-2 text-black/40 font-medium border-b border-black/8 whitespace-nowrap">Dép. prépa</th>
              <th className="text-left px-3 py-2 text-black/40 font-medium border-b border-black/8 whitespace-nowrap">Dép. exam</th>
              <th className="text-left px-3 py-2 text-black/40 font-medium border-b border-black/8 whitespace-nowrap">Fin exam</th>
              {allMC.map((mc) => (
                <th key={mc.nom} className="text-center px-3 py-2 font-semibold border-b border-black/8 text-black/70 whitespace-nowrap">
                  {mc.nom}
                  <span className="block text-[10px] font-normal text-black/35">{mc.duree_minutes}' · {mc.preparation_minutes}' prépa</span>
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
                  {isNewBloc && (
                    <tr>
                      <td colSpan={totalCols} className="px-3 py-1.5 bg-black/[0.04] text-[11px] font-semibold text-black/50 uppercase tracking-wide">
                        Bloc {row.bloc_idx + 1} — {blocLabel(p.blocs[row.bloc_idx].heure_debut)} · {p.blocs[row.bloc_idx].heure_debut} → {p.blocs[row.bloc_idx].heure_fin}
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
                  <tr className="border-b border-black/5 last:border-0 hover:bg-black/[0.015]">
                    <td className="px-3 py-1.5 font-mono text-black/40">{row.deb_prepa}</td>
                    <td className="px-3 py-1.5 font-mono font-medium text-black/80">{row.deb_exam}</td>
                    <td className="px-3 py-1.5 font-mono text-black/50">{row.fin_exam}</td>
                    {allMC.map((mc, globalJ) => {
                      const localJ = blocMatieres.findIndex(c => c.nom === mc.nom);
                      if (localJ === -1) {
                        return <td key={globalJ} className="px-3 py-1 text-center text-black/15">—</td>;
                      }
                      const k = row.candidates[localJ];
                      const isOver = dragOver?.rowIdx === i && dragOver?.matIdx === localJ;
                      const isDragging = dragSrc?.rowIdx === i && dragSrc?.matIdx === localJ;
                      return (
                        <td
                          key={globalJ}
                          className={`px-3 py-1 text-center transition ${isOver ? "bg-blue-50" : ""}`}
                          onDragOver={editMode ? (e) => { e.preventDefault(); setDragOver({ rowIdx: i, matIdx: localJ }); } : undefined}
                          onDragLeave={editMode ? () => setDragOver(null) : undefined}
                          onDrop={editMode ? (e) => {
                            e.preventDefault();
                            if (dragSrc) swapCells(dragSrc, { rowIdx: i, matIdx: localJ });
                            setDragSrc(null); setDragOver(null);
                          } : undefined}
                        >
                          <span
                            draggable={editMode}
                            onDragStart={editMode ? () => setDragSrc({ rowIdx: i, matIdx: localJ }) : undefined}
                            onDragEnd={editMode ? () => { setDragSrc(null); setDragOver(null); } : undefined}
                            className={`inline-block px-2 py-0.5 rounded-full font-semibold text-[11px] text-gray-700 transition ${
                              editMode ? "cursor-grab active:cursor-grabbing" : ""
                            } ${isDragging ? "opacity-40 scale-95" : ""} ${isOver ? "ring-2 ring-blue-400" : ""}`}
                            style={{
                              backgroundColor: TRIPLET_BG[k % TRIPLET_BG.length],
                              outline: isOver ? "none" : `1.5px solid ${TRIPLET_RING[k % TRIPLET_RING.length]}`,
                            }}
                          >
                            T{k + 1}
                          </span>
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
  const toast = useToast();
  const confirm = useConfirm();
  const [plannings, setPlannings] = useState<Planning[]>([]);
  const [candidats, setCandidats] = useState<Candidat[]>([]);
  const [planningId, setPlanningId] = useState<number | "">("");
  const [loading, setLoading] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [tab, setTab] = useState<"liste" | "affectation" | "gestion" | "liste_attente" | "compactage">("liste");
  const [error, setError] = useState("");
  const [searchCand, setSearchCand] = useState("");
  const [selectedCandId, setSelectedCandId] = useState<number | null>(null);

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
    if (!await confirm("Supprimer ce candidat ?", { confirmLabel: "Supprimer", danger: true })) return;
    try {
      await del(`candidats/${id}`);
      toast.success("Candidat supprimé");
      loadCandidats();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : String(e));
    }
  };

  const handleDeleteAll = async () => {
    if (!planningId || candidats.length === 0) return;
    if (!await confirm(`Supprimer les ${candidats.length} candidat(s) de ce planning ? Cette action est irréversible.`, { confirmLabel: "Tout supprimer", danger: true })) return;
    await Promise.allSettled(candidats.map((c) => del(`candidats/${c.id}`)));
    toast.success(`${candidats.length} candidat(s) supprimé(s)`);
    loadCandidats();
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
            label="Tout supprimer"
            icon={Trash2}
            onClick={handleDeleteAll}
            disabled={!planningId || candidats.length === 0}
            variant="danger"
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
            {(["liste", "gestion", "liste_attente", "compactage", "affectation"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition ${
                  tab === t
                    ? "border-[#C62828] text-[#C62828]"
                    : "border-transparent text-black/50 hover:text-black"
                }`}
              >
                {t === "liste" ? "Liste"
                  : t === "gestion" ? "Gestion inscriptions"
                  : t === "liste_attente" ? "Liste d'attente"
                  : t === "compactage" ? "Compactage"
                  : "Affectation aux épreuves"}
              </button>
            ))}
          </div>

          {tab === "liste" && (
            <>
              <div className="mb-3">
                <input
                  type="text"
                  placeholder="Rechercher par nom ou prénom…"
                  value={searchCand}
                  onChange={(e) => setSearchCand(e.target.value)}
                  className="w-full max-w-sm border border-black/15 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-300"
                />
              </div>
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
                        {["Nom", "Prénom", "Email", "Statut", ""].map((h) => (
                          <th key={h} className="px-5 py-3.5 text-xs font-semibold text-black/50 tracking-wide">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {candidats.filter((c) => {
                        if (!searchCand.trim()) return true;
                        const q = searchCand.trim().toLowerCase();
                        return c.nom.toLowerCase().includes(q) || c.prenom.toLowerCase().includes(q);
                      }).map((c) => (
                        <tr
                          key={c.id}
                          onClick={() => setSelectedCandId(c.id)}
                          className={`border-t border-black/5 cursor-pointer hover:bg-black/[0.02] transition ${selectedCandId === c.id ? "bg-red-50 border-l-2 border-l-[#C62828]" : ""}`}
                        >
                          <td className="px-5 py-3.5 font-medium">{c.nom}</td>
                          <td className="px-5 py-3.5">{c.prenom}</td>
                          <td className="px-5 py-3.5 text-black/50">{c.email}</td>
                          <td className="px-5 py-3.5"><StatutBadge statut={c.statut} /></td>
                          <td className="px-5 py-3.5 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <button
                                onClick={(e) => { e.stopPropagation(); setSelectedCandId(c.id); }}
                                className="text-xs px-2.5 py-1 text-[#C62828] border border-[#C62828]/30 rounded-lg hover:bg-red-50 transition"
                              >
                                Gérer
                              </button>
                              <button
                                onClick={(e) => { e.stopPropagation(); handleDelete(c.id); }}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition text-red-600 bg-red-50 hover:bg-red-100"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                                Supprimer
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}

          {tab === "gestion" && (
            <GestionCandidatsTab planningId={planningId as number} />
          )}

          {tab === "liste_attente" && (
            <ListeAttenteTab planningId={planningId as number} />
          )}

          {tab === "compactage" && (
            <CompactageTab
              planningId={planningId as number}
              planning={plannings.find(p => p.id === planningId) ?? null}
            />
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
          onSuccess={() => { setShowCreate(false); toast.success("Candidat ajouté"); loadCandidats(); }}
        />
      </Modal>

      <AnimatePresence>
        {selectedCandId !== null && planningId !== "" && (
          <CandidatGestionDrawer
            key={selectedCandId}
            candidatId={selectedCandId}
            planningId={planningId as number}
            onClose={() => setSelectedCandId(null)}
            onRefreshList={loadCandidats}
          />
        )}
      </AnimatePresence>
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

// ── CandidatGestionDrawer ─────────────────────────────────────────────────────
function CandidatGestionDrawer({
  candidatId,
  planningId,
  onClose,
  onRefreshList,
}: {
  candidatId: number;
  planningId: number;
  onClose: () => void;
  onRefreshList: () => void;
}) {
  const toast = useToast();
  const confirm = useConfirm();
  const [fiche, setFiche] = useState<FicheCandidat | null>(null);
  const [triplets, setTriplets] = useState<TripletDisponible[]>([]);
  const [loadingAction, setLoadingAction] = useState(false);
  const [credsResult, setCredsResult] = useState<{ login: string; password: string } | null>(null);
  // Mode assignation libre
  const [modeLibre, setModeLibre] = useState(false);
  const [libresDate, setLibresDate] = useState("");
  const [libresData, setLibresData] = useState<Record<string, { id: number; heure_debut: string; heure_fin: string; statut: string }[]>>({});
  const [selection, setSelection] = useState<Record<string, number>>({});
  const [loadingLibres, setLoadingLibres] = useState(false);

  const loadData = useCallback(() => {
    get<FicheCandidat>(`gestion-candidats/candidat/${candidatId}/fiche`).then(setFiche).catch(() => {});
    get<TripletDisponible[]>(`gestion-candidats/${planningId}/triplets`).then(setTriplets).catch(() => {});
  }, [candidatId, planningId]);

  useEffect(() => { loadData(); }, [loadData]);

  const refresh = () => { loadData(); onRefreshList(); };

  const doInscrire = async (t: TripletDisponible) => {
    setLoadingAction(true);
    try {
      await post(`gestion-candidats/candidat/${candidatId}/inscrire`, { date: t.date, heure_debut: t.heure_debut });
      toast.success(fiche?.inscription ? "Réinscription effectuée" : "Candidat inscrit");
      refresh();
    } catch (e) { toast.error(e instanceof Error ? e.message : String(e)); }
    finally { setLoadingAction(false); }
  };

  const doAction = async (endpoint: string, confirmMsg: string, successMsg: string, danger = false) => {
    if (!await confirm(confirmMsg, { confirmLabel: "Confirmer", danger })) return;
    setLoadingAction(true);
    try {
      await post(`gestion-candidats/candidat/${candidatId}/${endpoint}`, {});
      toast.success(successMsg);
      refresh();
    } catch (e) { toast.error(e instanceof Error ? e.message : String(e)); }
    finally { setLoadingAction(false); }
  };

  const doEnvoyerIdentifiants = async () => {
    setLoadingAction(true);
    try {
      const r = await post<{ login: string; new_password: string }>(`parametrages/candidats/${candidatId}/reset-password`, {});
      setCredsResult({ login: r.login, password: r.new_password });
    } catch (e) { toast.error(e instanceof Error ? e.message : String(e)); }
    finally { setLoadingAction(false); }
  };

  const loadLibres = async (date: string) => {
    if (!date) { setLibresData({}); return; }
    setLoadingLibres(true);
    try {
      const eps = await get<{ id: number; matiere: string; heure_debut: string; heure_fin: string; statut: string }[]>(
        `gestion-candidats/${planningId}/epreuves-disponibles?date=${date}`
      );
      const grouped: Record<string, { id: number; heure_debut: string; heure_fin: string; statut: string }[]> = {};
      for (const ep of eps) {
        if (!grouped[ep.matiere]) grouped[ep.matiere] = [];
        grouped[ep.matiere].push({ id: ep.id, heure_debut: ep.heure_debut, heure_fin: ep.heure_fin, statut: ep.statut });
      }
      setLibresData(grouped);
      setSelection({});
    } catch (e) { toast.error(e instanceof Error ? e.message : String(e)); }
    finally { setLoadingLibres(false); }
  };

  const doInscrireDirect = async () => {
    const ids = Object.values(selection).filter(Boolean);
    if (ids.length === 0) return;
    setLoadingAction(true);
    try {
      await post(`gestion-candidats/candidat/${candidatId}/inscrire-direct`, { epreuve_ids: ids });
      toast.success("Assignation libre effectuée");
      setModeLibre(false);
      setSelection({});
      setLibresData({});
      setLibresDate("");
      refresh();
    } catch (e) { toast.error(e instanceof Error ? e.message : String(e)); }
    finally { setLoadingAction(false); }
  };

  const fmt_date = (d: string) =>
    new Date(d + "T12:00:00").toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });

  const PROFIL_EXCLUSION: Record<string, string> = { HGG: "ESH", ESH: "HGG" };
  const classeUp = (fiche?.classe || "").toUpperCase();
  const profilUpper = (fiche?.profil || "").toUpperCase() ||
    (classeUp.includes("ESH") ? "ESH" : classeUp.includes("HGG") ? "HGG" : "");
  const matiereExclue = PROFIL_EXCLUSION[profilUpper];

  const tripletsByDate: Record<string, TripletDisponible[]> = {};
  for (const t of triplets) {
    if (matiereExclue) {
      const matieres = t.epreuves.map(e => e.matiere.toUpperCase());
      if (matieres.includes(matiereExclue)) continue;
    }
    if (!tripletsByDate[t.date]) tripletsByDate[t.date] = [];
    tripletsByDate[t.date].push(t);
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />

      {/* Panel */}
      <motion.div
        initial={{ x: "100%" }}
        animate={{ x: 0 }}
        exit={{ x: "100%" }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
        className="relative w-full max-w-3xl bg-white shadow-2xl flex flex-col h-full"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b bg-white shrink-0">
          <div>
            {fiche ? (
              <>
                {fiche.civilite && <p className="text-xs text-black/40">{fiche.civilite}</p>}
                <h3 className="font-bold text-base leading-tight">{fiche.nom} {fiche.prenom}</h3>
                {fiche.code_candidat && <p className="text-xs font-mono text-black/40 mt-0.5">{fiche.code_candidat}</p>}
              </>
            ) : (
              <div className="h-5 w-40 bg-black/5 rounded animate-pulse" />
            )}
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 hover:bg-black/5 transition ml-4">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body: two columns */}
        <div className="flex flex-1 overflow-hidden min-h-0">
          {/* Left: identity card */}
          <div className="w-56 shrink-0 border-r flex flex-col overflow-y-auto bg-gray-50/50">
            {!fiche ? (
              <div className="flex justify-center p-6"><Spinner /></div>
            ) : (
              <div className="p-4 space-y-4">
                {/* Identity */}
                <div>
                  <p className="text-[10px] font-semibold text-black/40 uppercase tracking-wide mb-2">Identité</p>
                  <dl className="space-y-1.5 text-xs">
                    <div className="flex gap-1.5 flex-wrap"><dt className="text-black/40 w-12 shrink-0">Email</dt><dd className="break-all min-w-0">{fiche.email}</dd></div>
                    {fiche.tel_portable && <div className="flex gap-1.5"><dt className="text-black/40 w-12 shrink-0">Tél.</dt><dd>{fiche.tel_portable}</dd></div>}
                    {fiche.profil && <div className="flex gap-1.5"><dt className="text-black/40 w-12 shrink-0">Profil</dt><dd className="font-medium text-blue-700">{fiche.profil}</dd></div>}
                    {fiche.classe && <div className="flex gap-1.5"><dt className="text-black/40 w-12 shrink-0">Classe</dt><dd>{fiche.classe}</dd></div>}
                    {fiche.etablissement && <div className="flex gap-1.5 flex-wrap"><dt className="text-black/40 w-12 shrink-0">Établ.</dt><dd className="break-words min-w-0">{fiche.etablissement}</dd></div>}
                    {fiche.qualite && <div className="flex gap-1.5"><dt className="text-black/40 w-12 shrink-0">Qualité</dt><dd>{fiche.qualite}</dd></div>}
                    {fiche.numero_ine && <div className="flex gap-1.5"><dt className="text-black/40 w-12 shrink-0">INE</dt><dd className="font-mono">{fiche.numero_ine}</dd></div>}
                    {fiche.handicape !== null && fiche.handicape !== undefined && (
                      <div className="flex gap-1.5"><dt className="text-black/40 w-12 shrink-0">Handicap</dt>
                        <dd className={fiche.handicape ? "text-amber-700 font-semibold" : ""}>{fiche.handicape ? "Oui" : "Non"}</dd>
                      </div>
                    )}
                  </dl>
                </div>

                {/* Liste d'attente */}
                {fiche.liste_attente.length > 0 && (
                  <div>
                    <p className="text-[10px] font-semibold text-black/40 uppercase tracking-wide mb-2">Liste d&apos;attente</p>
                    <div className="flex flex-col gap-1">
                      {fiche.liste_attente.map(la => (
                        <span key={la.date} className="text-[10px] bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded">
                          {new Date(la.date + "T12:00:00").toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" })}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Envoyer identifiants */}
                <div className="pt-2 border-t">
                  <button
                    onClick={doEnvoyerIdentifiants}
                    disabled={loadingAction}
                    className="w-full text-xs px-3 py-2 bg-white border border-black/15 rounded-lg hover:bg-black/[0.03] transition disabled:opacity-50 flex items-center justify-center gap-1.5"
                  >
                    <Key className="h-3 w-3" />
                    Envoyer les identifiants
                  </button>

                  {/* Inline creds display */}
                  {credsResult && (
                    <div className="mt-2 p-2 bg-gray-50 border rounded-lg space-y-1.5">
                      {[
                        { label: "Login", val: credsResult.login },
                        { label: "MDP", val: credsResult.password },
                      ].map(({ label, val }) => (
                        <div key={label} className="flex items-center justify-between gap-1">
                          <div>
                            <p className="text-[9px] text-black/40 uppercase">{label}</p>
                            <p className="text-xs font-mono font-medium truncate max-w-[100px]">{val}</p>
                          </div>
                          <button
                            onClick={() => navigator.clipboard.writeText(val)}
                            className="text-black/30 hover:text-[#C62828] transition shrink-0"
                          >
                            <Copy className="h-3 w-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Right: inscription + triplets */}
          <div className="flex-1 overflow-y-auto p-5 space-y-4 min-w-0">
            <p className="text-sm font-bold text-black/70 uppercase tracking-wide">Inscription aux oraux</p>

            {/* Inscription courante */}
            {fiche?.inscription ? (
              <div className="rounded-xl border bg-white shadow-sm p-4">
                <p className="text-xs font-semibold text-green-700 mb-3">✓ Inscrit(e) pour les créneaux suivants</p>
                <div className="rounded-lg border overflow-hidden text-xs mb-3">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-gray-50 text-left">
                        <th className="px-3 py-2 text-black/40 font-semibold">Jour</th>
                        {fiche.inscription.epreuves.map(e => (
                          <th key={e.id} className="px-3 py-2 text-black/40 font-semibold">{e.matiere}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td className="px-3 py-2 font-medium capitalize">{fmt_date(fiche.inscription.date)}</td>
                        {fiche.inscription.epreuves.map(e => (
                          <td key={e.id} className="px-3 py-2">{e.heure_debut}</td>
                        ))}
                      </tr>
                    </tbody>
                  </table>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => doAction("desinscrire", `Désinscrire ${fiche.nom} ${fiche.prenom} ?`, "Candidat désinscrit", true)}
                    disabled={loadingAction}
                    className="text-xs px-3 py-1.5 bg-red-50 text-red-700 border border-red-200 rounded-lg hover:bg-red-100 transition disabled:opacity-50"
                  >
                    Désinscrire
                  </button>
                  <button
                    onClick={() => doAction("desinscrire-prereserver", "Désinscrire et préréserver les créneaux ?", "Désinscrit et créneaux préréservés", true)}
                    disabled={loadingAction}
                    className="text-xs px-3 py-1.5 bg-amber-50 text-amber-700 border border-amber-200 rounded-lg hover:bg-amber-100 transition disabled:opacity-50"
                  >
                    Désinscrire + Préréserver
                  </button>
                  <button
                    onClick={() => doAction("casser-triplet", `Casser le triplet de ${fiche.nom} ${fiche.prenom} ?`, "Triplet cassé")}
                    disabled={loadingAction}
                    className="text-xs px-3 py-1.5 bg-gray-100 text-gray-700 border border-gray-200 rounded-lg hover:bg-gray-200 transition disabled:opacity-50"
                  >
                    Casser le triplet
                  </button>
                </div>
              </div>
            ) : fiche ? (
              <div className="rounded-xl border border-dashed bg-gray-50 p-4 text-xs text-black/40 text-center">
                Non inscrit(e) à ce jour
              </div>
            ) : null}

            {/* Triplets disponibles / Assignation libre */}
            <div className="rounded-xl border bg-white shadow-sm p-4">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-semibold text-black/50">
                  {modeLibre ? "Assignation libre" : "Créneaux disponibles (rotation N²)"}
                </p>
                <button
                  onClick={() => { setModeLibre(o => !o); setLibresDate(""); setLibresData({}); setSelection({}); }}
                  className={`text-[10px] px-2.5 py-1 rounded-lg border transition ${modeLibre ? "bg-orange-50 text-orange-700 border-orange-200 hover:bg-orange-100" : "bg-gray-50 text-black/50 border-gray-200 hover:bg-gray-100"}`}
                >
                  {modeLibre ? "← Rotation N²" : "Assignation libre →"}
                </button>
              </div>

              {!modeLibre ? (
                Object.keys(tripletsByDate).length === 0 ? (
                  <p className="text-xs text-black/40">Aucun créneau disponible</p>
                ) : (
                  <div className="space-y-4">
                    {Object.entries(tripletsByDate).map(([date, trips]) => {
                      const allMatieres = trips[0]?.epreuves.map(e => e.matiere) ?? [];
                      return (
                        <div key={date}>
                          <p className="text-xs font-semibold text-black/50 mb-2 capitalize">{fmt_date(date)}</p>
                          <div className="rounded-lg border overflow-hidden">
                            <table className="w-full text-xs">
                              <thead>
                                <tr className="bg-gray-50 text-left">
                                  <th className="px-3 py-2 text-black/40 font-semibold">Heure</th>
                                  {allMatieres.map(m => (
                                    <th key={m} className="px-3 py-2 text-black/40 font-semibold">{m}</th>
                                  ))}
                                  <th className="px-3 py-2"></th>
                                </tr>
                              </thead>
                              <tbody>
                                {trips.map((t, idx) => (
                                  <tr
                                    key={idx}
                                    className={`border-t border-black/5 ${t.type_slot === "PRERESERVEE" ? "bg-amber-50/60" : ""}`}
                                  >
                                    <td className="px-3 py-2 font-medium">{t.heure_debut}</td>
                                    {t.epreuves.map(e => (
                                      <td key={e.id} className="px-3 py-2">{e.heure_debut}</td>
                                    ))}
                                    <td className="px-3 py-2 text-right whitespace-nowrap">
                                      {t.type_slot === "PRERESERVEE" && (
                                        <span className="mr-2 text-[10px] text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded">
                                          Préréservé
                                        </span>
                                      )}
                                      <button
                                        onClick={() => doInscrire(t)}
                                        disabled={loadingAction}
                                        className="text-[10px] px-2.5 py-1 rounded-lg text-white transition disabled:opacity-50 bg-[#C62828] hover:bg-[#B71C1C]"
                                      >
                                        Inscrire
                                      </button>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )
              ) : (
                /* Mode assignation libre */
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <label className="text-xs text-black/50 shrink-0">Date</label>
                    <input
                      type="date"
                      value={libresDate}
                      onChange={(e) => { setLibresDate(e.target.value); loadLibres(e.target.value); }}
                      className="text-xs border rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-orange-200"
                    />
                    {loadingLibres && <Loader2 className="h-3 w-3 animate-spin text-black/30" />}
                  </div>

                  {libresDate && Object.keys(libresData).length === 0 && !loadingLibres && (
                    <p className="text-xs text-black/40">Aucun créneau libre pour cette date.</p>
                  )}

                  {Object.keys(libresData).length > 0 && (
                    <div className="space-y-2">
                      <p className="text-[10px] text-black/40">Choisir un créneau par matière (★ = préréservé)</p>
                      {Object.entries(libresData).map(([matiere, eps]) => (
                        <div key={matiere} className="flex items-center gap-2">
                          <span className="text-xs font-semibold w-24 shrink-0 truncate" title={matiere}>{matiere}</span>
                          <select
                            value={selection[matiere] ?? ""}
                            onChange={(e) => setSelection(prev => ({ ...prev, [matiere]: Number(e.target.value) }))}
                            className="text-xs border rounded-lg px-2 py-1.5 flex-1 focus:outline-none focus:ring-1 focus:ring-orange-200"
                          >
                            <option value="">-- Choisir --</option>
                            {eps.map(ep => (
                              <option key={ep.id} value={ep.id}>
                                {ep.heure_debut} – {ep.heure_fin}{ep.statut === "PRERESERVEE" ? " ★" : ""}
                              </option>
                            ))}
                          </select>
                        </div>
                      ))}
                      <button
                        onClick={doInscrireDirect}
                        disabled={loadingAction || Object.keys(libresData).length === 0 || Object.keys(libresData).some(m => !selection[m])}
                        className="text-xs px-3 py-1.5 rounded-lg text-white bg-[#C62828] hover:bg-[#B71C1C] disabled:opacity-40 flex items-center gap-1.5"
                      >
                        {loadingAction && <Loader2 className="h-3 w-3 animate-spin" />}
                        Inscrire ({Object.values(selection).filter(Boolean).length}/{Object.keys(libresData).length} matières sélectionnées)
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

// ── CompactageTab ─────────────────────────────────────────────────────────────
function CompactageTab({
  planningId,
  planning,
}: {
  planningId: number;
  planning: Planning | null;
}) {
  const toast = useToast();
  const [selectedDate, setSelectedDate] = useState(planning?.date_debut ?? "");
  const [inscrits, setInscrits] = useState<JourneeInscritItem[]>([]);
  const [triplets, setTriplets] = useState<TripletDisponible[]>([]);
  const [loading, setLoading] = useState(false);
  const [drawerCandidatId, setDrawerCandidatId] = useState<number | null>(null);

  const loadDay = useCallback(() => {
    if (!selectedDate) return;
    setLoading(true);
    Promise.all([
      get<JourneeInscritItem[]>(`gestion-candidats/${planningId}/journee?date=${selectedDate}`),
      get<TripletDisponible[]>(`gestion-candidats/${planningId}/triplets`),
    ])
      .then(([i, t]) => { setInscrits(i); setTriplets(t); })
      .catch(() => toast.error("Erreur lors du chargement"))
      .finally(() => setLoading(false));
  }, [planningId, selectedDate]);

  useEffect(() => { loadDay(); }, [loadDay]);

  // All subjects for that day (for column headers)
  const allMatieres = [...new Set(inscrits.flatMap(c => c.epreuves.map(e => e.matiere)))].sort();

  // Free triplets for the selected date
  const freeTriplets = triplets.filter(t => t.date === selectedDate);

  const fmt_date = (d: string) =>
    new Date(d + "T12:00:00").toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h3 className="text-sm font-semibold">Compactage du planning</h3>
          <p className="text-xs text-black/40 mt-0.5">
            Visualisez les candidats inscrits par journée et réaffectez-les pour combler les trous créés par des absences.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs text-black/50 shrink-0">Journée :</label>
          <input
            type="date"
            value={selectedDate}
            onChange={e => setSelectedDate(e.target.value)}
            min={planning?.date_debut}
            max={planning?.date_fin}
            className="border border-black/15 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-300"
          />
        </div>
      </div>

      {!selectedDate ? (
        <Empty message="Choisissez une journée" sub="Sélectionnez une date pour voir les candidats inscrits." />
      ) : loading ? (
        <div className="flex justify-center py-16"><Spinner /></div>
      ) : (
        <>
          {/* Créneaux libres */}
          {freeTriplets.length > 0 && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 flex items-center gap-3">
              <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
              <div className="text-xs text-amber-800">
                <span className="font-semibold">{freeTriplets.length} triplet(s) libre(s)</span> ce jour — à attribuer pour combler les trous.
                <span className="ml-2 text-amber-600">
                  Heures de départ : {freeTriplets.map(t => t.heure_debut).join(", ")}
                </span>
              </div>
            </div>
          )}

          {inscrits.length === 0 ? (
            <Empty
              message="Aucun candidat inscrit ce jour"
              sub={freeTriplets.length > 0
                ? `${freeTriplets.length} créneau(x) libre(s) disponible(s) pour d'autres journées.`
                : "Aucune inscription ni créneau libre ce jour."}
            />
          ) : (
            <>
              <p className="text-xs text-black/40">
                {inscrits.length} candidat(s) inscrit(s) le{" "}
                <span className="font-medium text-black/60 capitalize">{fmt_date(selectedDate)}</span>
                {freeTriplets.length > 0 && (
                  <span className="ml-1 text-amber-600">— {freeTriplets.length} triplet(s) libre(s) à boucher</span>
                )}
              </p>

              <div className="rounded-xl border bg-white shadow-sm overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 text-left border-b">
                      <th className="px-4 py-3 text-xs font-semibold text-black/40">Candidat</th>
                      {allMatieres.map(m => (
                        <th key={m} className="px-4 py-3 text-xs font-semibold text-black/40">{m}</th>
                      ))}
                      <th className="px-4 py-3 text-xs font-semibold text-black/40"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {inscrits.map((c, i) => {
                      const slotByMatiere: Record<string, TripletEpreuveGestion> = {};
                      for (const e of c.epreuves) slotByMatiere[e.matiere] = e;

                      // Check if any of this candidate's slots overlap with free slots
                      const hasConflict = c.epreuves.some(ep =>
                        freeTriplets.some(t => t.epreuves.some(te => te.heure_debut === ep.heure_debut && te.matiere === ep.matiere))
                      );

                      return (
                        <tr
                          key={c.candidat_id}
                          className={`border-t border-black/5 ${i % 2 === 0 ? "" : "bg-black/[0.01]"}`}
                        >
                          <td className="px-4 py-3">
                            <div className="font-medium">{c.candidat_nom} {c.candidat_prenom}</div>
                            {c.candidat_code && (
                              <div className="text-xs font-mono text-black/30">{c.candidat_code}</div>
                            )}
                          </td>
                          {allMatieres.map(m => {
                            const ep = slotByMatiere[m];
                            return (
                              <td key={m} className="px-4 py-3 font-mono text-xs text-black/60">
                                {ep ? ep.heure_debut : <span className="text-black/20">—</span>}
                              </td>
                            );
                          })}
                          <td className="px-4 py-3 text-right">
                            <button
                              onClick={() => setDrawerCandidatId(c.candidat_id)}
                              className={`text-xs px-3 py-1.5 rounded-lg border font-medium transition ${
                                hasConflict
                                  ? "text-amber-700 border-amber-300 bg-amber-50 hover:bg-amber-100"
                                  : "text-[#C62828] border-[#C62828]/30 hover:bg-red-50"
                              }`}
                            >
                              {hasConflict ? "⚠ Réaffecter" : "Réaffecter"}
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Legend */}
              <p className="text-[11px] text-black/30 flex items-center gap-1.5">
                <span className="inline-block w-3 h-3 bg-amber-100 border border-amber-300 rounded-sm" />
                Le bouton <strong>⚠ Réaffecter</strong> indique que ce candidat occupe un créneau dont l&apos;heure est aussi libre — potentiellement réaffectable.
              </p>
            </>
          )}
        </>
      )}

      {/* Gestion drawer for reassignment */}
      <AnimatePresence>
        {drawerCandidatId !== null && (
          <CandidatGestionDrawer
            key={drawerCandidatId}
            candidatId={drawerCandidatId}
            planningId={planningId}
            onClose={() => setDrawerCandidatId(null)}
            onRefreshList={loadDay}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// ── ListeAttenteTab ──────────────────────────────────────────────────────────
function ListeAttenteTab({ planningId }: { planningId: number }) {
  const toast = useToast();
  const confirm = useConfirm();
  const [liste, setListe] = useState<ListeAttenteAdminItem[]>([]);
  const [triplets, setTriplets] = useState<TripletDisponible[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [loadingAction, setLoadingAction] = useState(false);
  const [loading, setLoading] = useState(true);

  const loadAll = useCallback(() => {
    setLoading(true);
    Promise.all([
      get<ListeAttenteAdminItem[]>(`gestion-candidats/${planningId}/liste-attente`),
      get<TripletDisponible[]>(`gestion-candidats/${planningId}/triplets`),
    ]).then(([l, t]) => { setListe(l); setTriplets(t); }).catch(() => {}).finally(() => setLoading(false));
  }, [planningId]);

  useEffect(() => { loadAll(); }, [loadAll]);

  const selected = liste.find(c => c.id === selectedId) ?? null;

  // Triplets filtered to the candidate's available dates
  const candidatDates = new Set(selected?.dates.map(d => d.date) ?? []);
  const tripletsFiltered = selected
    ? triplets.filter(t => candidatDates.has(t.date))
    : [];
  const tripletsByDate: Record<string, TripletDisponible[]> = {};
  for (const t of tripletsFiltered) {
    if (!tripletsByDate[t.date]) tripletsByDate[t.date] = [];
    tripletsByDate[t.date].push(t);
  }

  const doInscrire = async (c: ListeAttenteAdminItem, t: TripletDisponible) => {
    if (!await confirm(`Inscrire ${c.nom} ${c.prenom} sur le créneau du ${fmt_date(t.date)} à ${t.heure_debut} ?`, { confirmLabel: "Inscrire" })) return;
    setLoadingAction(true);
    try {
      await post(`gestion-candidats/candidat/${c.id}/inscrire`, { date: t.date, heure_debut: t.heure_debut });
      toast.success(`${c.prenom} ${c.nom} inscrit(e) — sorti(e) de la liste d'attente`);
      setSelectedId(null);
      loadAll();
    } catch (e) { toast.error(e instanceof Error ? e.message : String(e)); }
    finally { setLoadingAction(false); }
  };

  const fmt_date = (d: string) =>
    new Date(d + "T12:00:00").toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });

  const fmt_datetime = (s: string) =>
    new Date(s).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" });

  const filtered = liste.filter(c => {
    const q = search.toLowerCase();
    return !q || `${c.nom} ${c.prenom} ${c.email} ${c.code_candidat ?? ""}`.toLowerCase().includes(q);
  });

  if (loading) return <div className="flex justify-center py-16 text-black/30"><Spinner /></div>;

  if (liste.length === 0) {
    return (
      <Empty
        message="Aucun candidat en liste d'attente"
        sub="Les candidats qui s'inscrivent sur liste d'attente apparaîtront ici."
      />
    );
  }

  return (
    <div className="flex gap-4" style={{ height: "calc(100vh - 220px)" }}>
      {/* ── Colonne gauche : liste candidats en L.A. ── */}
      <div className="w-64 flex-shrink-0 flex flex-col border rounded-xl bg-white shadow-sm overflow-hidden">
        <div className="p-2.5 border-b">
          <input
            type="text"
            placeholder="Rechercher…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full text-xs px-2.5 py-1.5 border rounded-lg bg-gray-50 focus:outline-none focus:ring-1 focus:ring-[#C62828]"
          />
        </div>
        <div className="overflow-y-auto flex-1 divide-y divide-black/5">
          {filtered.map(c => (
            <button
              key={c.id}
              onClick={() => setSelectedId(c.id === selectedId ? null : c.id)}
              className={`w-full text-left px-3 py-2.5 text-xs hover:bg-black/[0.03] transition ${
                selectedId === c.id ? "bg-amber-50 border-l-2 border-amber-500" : ""
              }`}
            >
              <div className="font-medium truncate">{c.nom} {c.prenom}</div>
              <div className="flex items-center gap-1 mt-0.5 flex-wrap">
                {c.code_candidat && <span className="font-mono text-black/30">{c.code_candidat}</span>}
                {c.profil && <span className="bg-blue-100 text-blue-700 px-1 rounded text-[10px]">{c.profil}</span>}
                <span className="bg-amber-100 text-amber-700 px-1 rounded text-[10px]">{c.dates.length} date(s)</span>
              </div>
              <div className="text-[10px] text-black/30 mt-0.5">depuis le {fmt_datetime(c.premier_enregistrement)}</div>
            </button>
          ))}
          {filtered.length === 0 && (
            <p className="p-4 text-xs text-black/30 text-center">Aucun résultat</p>
          )}
        </div>
        <div className="px-3 py-2 border-t bg-black/[0.02] text-[10px] text-black/40">
          {liste.length} candidat(s) en liste d&apos;attente
        </div>
      </div>

      {/* ── Zone principale ── */}
      {!selected ? (
        <div className="flex-1 flex items-center justify-center text-sm text-black/30">
          Sélectionnez un candidat pour voir ses disponibilités et l&apos;inscrire
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto min-w-0 space-y-4">
          {/* En-tête candidat */}
          <div className="rounded-xl border bg-white shadow-sm p-4 flex items-start justify-between">
            <div>
              {selected.civilite && <p className="text-xs text-black/40">{selected.civilite}</p>}
              <h3 className="text-base font-bold leading-tight">{selected.nom} {selected.prenom}</h3>
              <p className="text-xs text-black/50 mt-0.5">{selected.email}</p>
              {selected.code_candidat && (
                <p className="text-xs font-mono text-black/30 mt-0.5">{selected.code_candidat}</p>
              )}
            </div>
            <div className="flex flex-col items-end gap-1">
              {selected.profil && (
                <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded font-medium">{selected.profil}</span>
              )}
              <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded">
                L.A. depuis le {fmt_datetime(selected.premier_enregistrement)}
              </span>
            </div>
          </div>

          {/* Dates disponibles */}
          <div className="rounded-xl border bg-white shadow-sm p-4">
            <p className="text-xs font-semibold text-black/50 mb-2">
              Journées pour lesquelles {selected.prenom} a indiqué des disponibilités
            </p>
            <div className="flex flex-wrap gap-2">
              {selected.dates.map(d => {
                const hasTriplets = tripletsByDate[d.date]?.length > 0;
                return (
                  <span
                    key={d.date}
                    className={`text-xs px-2.5 py-1 rounded-lg border font-medium ${
                      hasTriplets
                        ? "bg-green-50 text-green-700 border-green-200"
                        : "bg-gray-50 text-gray-400 border-gray-200"
                    }`}
                  >
                    {new Date(d.date + "T12:00:00").toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "long" })}
                    {hasTriplets && <span className="ml-1 text-[10px]">({tripletsByDate[d.date].length} dispo.)</span>}
                    {!hasTriplets && <span className="ml-1 text-[10px]">(complet)</span>}
                  </span>
                );
              })}
            </div>
          </div>

          {/* Créneaux disponibles */}
          {Object.keys(tripletsByDate).length === 0 ? (
            <div className="rounded-xl border border-dashed bg-gray-50 p-6 text-sm text-black/40 text-center">
              Aucun créneau disponible sur les journées indiquées par ce candidat
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-xs font-semibold text-black/50">
                Créneaux disponibles sur les journées de disponibilité
              </p>
              {Object.entries(tripletsByDate).map(([date, trips]) => {
                const allMatieres = trips[0]?.epreuves.map(e => e.matiere) ?? [];
                return (
                  <div key={date} className="rounded-xl border bg-white shadow-sm overflow-hidden">
                    <div className="px-4 py-2.5 border-b bg-gray-50">
                      <p className="text-xs font-semibold capitalize">{fmt_date(date)}</p>
                    </div>
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="text-left border-b">
                          <th className="px-4 py-2 text-black/40 font-semibold">Heure</th>
                          {allMatieres.map(m => (
                            <th key={m} className="px-4 py-2 text-black/40 font-semibold">{m}</th>
                          ))}
                          <th className="px-4 py-2"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {trips.map((t, idx) => (
                          <tr
                            key={idx}
                            className={`border-t border-black/5 ${t.type_slot === "PRERESERVEE" ? "bg-amber-50/50" : ""}`}
                          >
                            <td className="px-4 py-2.5 font-medium">{t.heure_debut}</td>
                            {t.epreuves.map(e => (
                              <td key={e.id} className="px-4 py-2.5">{e.heure_debut}</td>
                            ))}
                            <td className="px-4 py-2.5 text-right whitespace-nowrap">
                              {t.type_slot === "PRERESERVEE" && (
                                <span className="mr-2 text-[10px] text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded">
                                  Préréservé
                                </span>
                              )}
                              <button
                                onClick={() => doInscrire(selected, t)}
                                disabled={loadingAction}
                                className="text-[10px] px-3 py-1.5 rounded-lg text-white transition disabled:opacity-50 bg-[#C62828] hover:bg-[#B71C1C] font-medium"
                              >
                                Inscrire
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── GestionCandidatsTab ────────────────────────────────────────────────────────
function GestionCandidatsTab({ planningId }: { planningId: number }) {
  const toast = useToast();
  const confirm = useConfirm();
  const [liste, setListe] = useState<CandidatListeItem[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [fiche, setFiche] = useState<FicheCandidat | null>(null);
  const [triplets, setTriplets] = useState<TripletDisponible[]>([]);
  const [search, setSearch] = useState("");
  const [loadingAction, setLoadingAction] = useState(false);

  const loadListe = useCallback(() => {
    get<CandidatListeItem[]>(`gestion-candidats/${planningId}/candidats`)
      .then(setListe)
      .catch(() => {});
  }, [planningId]);

  const loadTriplets = useCallback(() => {
    get<TripletDisponible[]>(`gestion-candidats/${planningId}/triplets`)
      .then(setTriplets)
      .catch(() => {});
  }, [planningId]);

  const loadFiche = useCallback(() => {
    if (!selectedId) { setFiche(null); return; }
    get<FicheCandidat>(`gestion-candidats/candidat/${selectedId}/fiche`)
      .then(setFiche)
      .catch(() => {});
  }, [selectedId]);

  useEffect(() => { loadListe(); loadTriplets(); }, [loadListe, loadTriplets]);
  useEffect(() => { loadFiche(); }, [loadFiche]);

  const refresh = () => { loadListe(); loadTriplets(); loadFiche(); };

  const doInscrire = async (t: TripletDisponible) => {
    if (!selectedId) return;
    setLoadingAction(true);
    try {
      await post(`gestion-candidats/candidat/${selectedId}/inscrire`, { date: t.date, heure_debut: t.heure_debut });
      toast.success("Candidat inscrit");
      refresh();
    } catch (e) { toast.error(e instanceof Error ? e.message : String(e)); }
    finally { setLoadingAction(false); }
  };

  const doAction = async (endpoint: string, confirm_msg: string, successMsg?: string) => {
    if (!selectedId) return;
    if (!await confirm(confirm_msg, { confirmLabel: "Confirmer", danger: endpoint.includes("desinscrire") || endpoint.includes("annuler") })) return;
    setLoadingAction(true);
    try {
      await post(`gestion-candidats/candidat/${selectedId}/${endpoint}`, {});
      if (successMsg) toast.success(successMsg);
      refresh();
    } catch (e) { toast.error(e instanceof Error ? e.message : String(e)); }
    finally { setLoadingAction(false); }
  };

  const fmt_date = (d: string) =>
    new Date(d + "T12:00:00").toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });

  const filtered = liste.filter(c => {
    const q = search.toLowerCase();
    return !q || `${c.nom} ${c.prenom} ${c.email} ${c.code_candidat ?? ""}`.toLowerCase().includes(q);
  });

  // Group triplets by date
  const tripletsByDate: Record<string, TripletDisponible[]> = {};
  for (const t of triplets) {
    if (!tripletsByDate[t.date]) tripletsByDate[t.date] = [];
    tripletsByDate[t.date].push(t);
  }
  const matieres = fiche?.inscription?.epreuves.map(e => e.matiere) ?? (triplets[0]?.epreuves.map(e => e.matiere) ?? []);

  return (
    <div className="flex gap-4" style={{ height: "calc(100vh - 220px)" }}>
      {/* ── Colonne gauche : liste candidats ── */}
      <div className="w-60 flex-shrink-0 flex flex-col border rounded-xl bg-white shadow-sm overflow-hidden">
        <div className="p-2.5 border-b">
          <input
            type="text"
            placeholder="Rechercher…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full text-xs px-2.5 py-1.5 border rounded-lg bg-gray-50 focus:outline-none focus:ring-1 focus:ring-[#C62828]"
          />
        </div>
        <div className="overflow-y-auto flex-1 divide-y divide-black/5">
          {filtered.map(c => (
            <button
              key={c.id}
              onClick={() => setSelectedId(c.id === selectedId ? null : c.id)}
              className={`w-full text-left px-3 py-2.5 text-xs hover:bg-black/[0.03] transition ${
                selectedId === c.id ? "bg-red-50 border-l-2 border-[#C62828]" : ""
              }`}
            >
              <div className="font-medium truncate">{c.nom} {c.prenom}</div>
              <div className="flex items-center gap-1 mt-0.5 flex-wrap">
                {c.code_candidat && <span className="font-mono text-black/30">{c.code_candidat}</span>}
                {c.is_inscrit && <span className="bg-green-100 text-green-700 px-1 py-0 rounded text-[10px]">Inscrit</span>}
                {c.is_liste_attente && <span className="bg-amber-100 text-amber-700 px-1 py-0 rounded text-[10px]">L.A.</span>}
              </div>
            </button>
          ))}
          {filtered.length === 0 && (
            <p className="p-4 text-xs text-black/30 text-center">Aucun candidat</p>
          )}
        </div>
        <div className="px-3 py-2 border-t bg-black/[0.02] text-[10px] text-black/40 flex justify-between">
          <span>{liste.filter(c => c.is_inscrit).length} inscrit(s)</span>
          <span>{liste.filter(c => c.is_liste_attente).length} en L.A.</span>
        </div>
      </div>

      {/* ── Zone principale ── */}
      {!selectedId || !fiche ? (
        <div className="flex-1 flex items-center justify-center text-sm text-black/30">
          Sélectionnez un candidat dans la liste
        </div>
      ) : (
        <div className="flex-1 flex gap-4 overflow-hidden min-w-0">
          {/* ── Fiche candidat ── */}
          <div className="w-64 flex-shrink-0 flex flex-col gap-3 overflow-y-auto">
            <div className="rounded-xl border bg-white shadow-sm p-5">
              <div className="flex items-start justify-between mb-4">
                <div>
                  {fiche.civilite && <p className="text-xs text-black/40">{fiche.civilite}</p>}
                  <h3 className="text-base font-bold leading-tight">{fiche.nom}</h3>
                  <p className="text-sm">{fiche.prenom}</p>
                </div>
                {fiche.profil && (
                  <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded font-medium">{fiche.profil}</span>
                )}
              </div>
              <dl className="space-y-1.5 text-xs">
                {fiche.code_candidat && (
                  <div className="flex gap-1"><dt className="text-black/40 shrink-0">N°</dt><dd className="font-mono">{fiche.code_candidat}</dd></div>
                )}
                <div className="flex gap-1"><dt className="text-black/40 shrink-0">Email</dt><dd className="truncate">{fiche.email}</dd></div>
                {fiche.tel_portable && (
                  <div className="flex gap-1"><dt className="text-black/40 shrink-0">Tél.</dt><dd>{fiche.tel_portable}</dd></div>
                )}
                {fiche.handicape !== null && fiche.handicape !== undefined && (
                  <div className="flex gap-1"><dt className="text-black/40 shrink-0">Handicap</dt><dd>{fiche.handicape ? "Oui" : "Non"}</dd></div>
                )}
                {fiche.classe && (
                  <div className="flex gap-1"><dt className="text-black/40 shrink-0">Classe</dt><dd>{fiche.classe}</dd></div>
                )}
                {fiche.etablissement && (
                  <div className="flex gap-1"><dt className="text-black/40 shrink-0">Établ.</dt><dd className="truncate">{fiche.etablissement}</dd></div>
                )}
                {fiche.qualite && (
                  <div className="flex gap-1"><dt className="text-black/40 shrink-0">Qualité</dt><dd>{fiche.qualite}</dd></div>
                )}
                {fiche.numero_ine && (
                  <div className="flex gap-1"><dt className="text-black/40 shrink-0">INE</dt><dd className="font-mono">{fiche.numero_ine}</dd></div>
                )}
              </dl>
            </div>

            {/* Liste d'attente */}
            {fiche.liste_attente.length > 0 && (
              <div className="rounded-xl border bg-white shadow-sm p-4">
                <p className="text-xs font-semibold text-black/50 mb-2">Liste d&apos;attente</p>
                <div className="flex flex-wrap gap-1">
                  {fiche.liste_attente.map(la => (
                    <span key={la.date} className="text-[10px] bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded">
                      {new Date(la.date + "T12:00:00").toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" })}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* ── Panneau inscription ── */}
          <div className="flex-1 overflow-y-auto min-w-0 space-y-4">
            {/* Inscription courante */}
            {fiche.inscription && (
              <div className="rounded-xl border bg-white shadow-sm p-5">
                <p className="text-sm font-semibold text-green-700 mb-3">✓ Inscrit(e) aux créneaux suivants</p>
                <div className="rounded-lg border overflow-hidden text-sm mb-4">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-gray-50 text-left">
                        <th className="px-3 py-2 text-xs font-semibold text-black/40">Jour</th>
                        {fiche.inscription.epreuves.map(e => (
                          <th key={e.id} className="px-3 py-2 text-xs font-semibold text-black/40">{e.matiere}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td className="px-3 py-2 font-medium capitalize">{fmt_date(fiche.inscription.date)}</td>
                        {fiche.inscription.epreuves.map(e => (
                          <td key={e.id} className="px-3 py-2">{e.heure_debut}</td>
                        ))}
                      </tr>
                    </tbody>
                  </table>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => doAction("desinscrire", `Désinscrire ${fiche.nom} ${fiche.prenom} ?`, "Candidat désinscrit")}
                    disabled={loadingAction}
                    className="text-xs px-3 py-1.5 bg-red-50 text-red-700 border border-red-200 rounded-lg hover:bg-red-100 transition disabled:opacity-50"
                  >
                    Désinscrire
                  </button>
                  <button
                    onClick={() => doAction("desinscrire-prereserver", `Désinscrire et préréserver les créneaux ?`, "Désinscrit et créneaux préréservés")}
                    disabled={loadingAction}
                    className="text-xs px-3 py-1.5 bg-amber-50 text-amber-700 border border-amber-200 rounded-lg hover:bg-amber-100 transition disabled:opacity-50"
                  >
                    Désinscrire + Préréserver
                  </button>
                  <button
                    onClick={() => doAction("casser-triplet", `Casser le triplet de ${fiche.nom} ${fiche.prenom} ? Les 3 créneaux seront libérés individuellement.`, "Triplet cassé")}
                    disabled={loadingAction}
                    className="text-xs px-3 py-1.5 bg-gray-100 text-gray-700 border border-gray-200 rounded-lg hover:bg-gray-200 transition disabled:opacity-50"
                  >
                    Casser le triplet
                  </button>
                </div>
              </div>
            )}

            {/* Triplets disponibles */}
            <div className="rounded-xl border bg-white shadow-sm p-5">
              <p className="text-sm font-semibold mb-3">Créneaux disponibles à l&apos;inscription</p>
              {Object.keys(tripletsByDate).length === 0 ? (
                <p className="text-sm text-black/40">Aucun créneau disponible</p>
              ) : (
                <div className="space-y-5">
                  {Object.entries(tripletsByDate).map(([date, trips]) => {
                    const allMatieres = trips[0]?.epreuves.map(e => e.matiere) ?? matieres;
                    return (
                      <div key={date}>
                        <p className="text-xs font-semibold text-black/50 mb-2 capitalize">{fmt_date(date)}</p>
                        <div className="rounded-lg border overflow-hidden">
                          <table className="w-full text-xs">
                            <thead>
                              <tr className="bg-gray-50 text-left">
                                <th className="px-3 py-2 text-black/40 font-semibold">Heure</th>
                                {allMatieres.map(m => (
                                  <th key={m} className="px-3 py-2 text-black/40 font-semibold">{m}</th>
                                ))}
                                <th className="px-3 py-2"></th>
                              </tr>
                            </thead>
                            <tbody>
                              {trips.map((t, idx) => (
                                <tr
                                  key={idx}
                                  className={`border-t border-black/5 ${t.type_slot === "PRERESERVEE" ? "bg-amber-50/60" : ""}`}
                                >
                                  <td className="px-3 py-2 font-medium">{t.heure_debut}</td>
                                  {t.epreuves.map(e => (
                                    <td key={e.id} className="px-3 py-2">{e.heure_debut}</td>
                                  ))}
                                  <td className="px-3 py-2 text-right whitespace-nowrap">
                                    {t.type_slot === "PRERESERVEE" && (
                                      <span className="mr-2 text-[10px] text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded">
                                        Préréservé
                                      </span>
                                    )}
                                    <button
                                      onClick={() => doInscrire(t)}
                                      disabled={loadingAction}
                                      className="text-[10px] px-2.5 py-1 rounded-lg text-white transition disabled:opacity-50 bg-[#C62828] hover:bg-[#B71C1C]"
                                    >
                                      Inscrire
                                    </button>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function AffectationCandidatsTab({ planningId, candidats }: { planningId: number; candidats: Candidat[] }) {
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

  async function assigner(epreuve: EpreuveFlat, candidatId: number | null) {
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

  const byDate = epreuves.reduce<Record<string, EpreuveFlat[]>>((acc, e) => {
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

type IndispoItem = { id: number; debut: string; fin: string };

function AffectationTab({ planningId, examinateurs }: { planningId: number; examinateurs: Examinateur[] }) {
  const toast = useToast();
  const [epreuves, setEpreuves] = useState<EpreuveFlat[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedExId, setSelectedExId] = useState<number | "">("");
  const [filterDate, setFilterDate] = useState("");
  const [filterMatiere, setFilterMatiere] = useState("");
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

  const filtered = epreuves.filter((ep) => {
    if (filterMatiere && ep.matiere !== filterMatiere) return false;
    if (filterDate && ep.date !== filterDate) return false;
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
      {/* Controls */}
      <div className="bg-white rounded-xl border shadow-sm p-4 space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <label className="block text-xs font-medium text-black/50 mb-1">Examinateur</label>
            <select
              value={selectedExId}
              onChange={(e) => { setSelectedExId(e.target.value ? Number(e.target.value) : ""); setFilterMatiere(""); }}
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
            <label className="block text-xs font-medium text-black/50 mb-1">Matière</label>
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
            <label className="block text-xs font-medium text-black/50 mb-1">Date</label>
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

        {filtered.length > 0 && (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-xs text-black/50">{assigned}/{filtered.length} attribué(s)</span>
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
          <p className="text-black/40 font-medium">{selectedExId ? "Aucun créneau pour les matières de cet examinateur" : "Aucun créneau"}</p>
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
                <p className="text-xs font-semibold text-black/40 uppercase tracking-wide">
                  {new Date(date + "T12:00:00").toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })}
                </p>
              </div>
              <div className="bg-white rounded-xl shadow-sm overflow-hidden border border-black/5">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-black/[0.02]">
                      {selectedExId && <th className="w-8 px-3 py-2" />}
                      <th className="text-left px-4 py-2 font-medium text-black/40 text-xs">Horaire</th>
                      <th className="text-left px-4 py-2 font-medium text-black/40 text-xs">Matière</th>
                      <th className="text-left px-4 py-2 font-medium text-black/40 text-xs">Candidat</th>
                      <th className="text-left px-4 py-2 font-medium text-black/40 text-xs">Exam. 1</th>
                      <th className="text-left px-4 py-2 font-medium text-black/40 text-xs">Exam. 2</th>
                      <th className="text-left px-4 py-2 font-medium text-black/40 text-xs">Statut</th>
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
                          <td className="px-4 py-3 font-mono text-xs text-black/50 whitespace-nowrap">
                            {ep.heure_debut.slice(0,5)} – {ep.heure_fin.slice(0,5)}
                            {indispo && (
                              <span className="ml-1.5 text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded font-medium">Indisponible</span>
                            )}
                          </td>
                          <td className="px-4 py-3 font-medium text-xs text-gray-700 whitespace-nowrap">{ep.matiere}</td>
                          <td className="px-4 py-3 text-xs text-black/60">
                            {ep.candidat_id
                              ? `${ep.candidat_prenom ?? ""} ${ep.candidat_nom ?? ""}`.trim()
                              : <span className="text-black/25 italic">—</span>}
                          </td>
                          <td className="px-4 py-3 text-xs" onClick={(e) => e.stopPropagation()}>
                            {ep.examinateur_id ? (
                              <span className={`flex items-center gap-1 ${isMine1 ? "text-[#C62828] font-semibold" : "text-black/60"}`}>
                                {ep.examinateur_nom} {ep.examinateur_prenom?.charAt(0)}.
                                {isMine1 && (
                                  <button
                                    onClick={() => handleDeassign(ep.id, 1)}
                                    disabled={isDead}
                                    className="text-black/25 hover:text-red-500 transition ml-0.5"
                                    title="Désaffecter"
                                  >
                                    <X className="h-3 w-3" />
                                  </button>
                                )}
                              </span>
                            ) : <span className="text-black/25">—</span>}
                          </td>
                          <td className="px-4 py-3 text-xs" onClick={(e) => e.stopPropagation()}>
                            {ep.examinateur2_id ? (
                              <span className={`flex items-center gap-1 ${isMine2 ? "text-[#C62828] font-semibold" : "text-black/60"}`}>
                                {ep.examinateur2_nom} {ep.examinateur2_prenom?.charAt(0)}.
                                {isMine2 && (
                                  <button
                                    onClick={() => handleDeassign(ep.id, 2)}
                                    disabled={isDead}
                                    className="text-black/25 hover:text-red-500 transition ml-0.5"
                                    title="Désaffecter"
                                  >
                                    <X className="h-3 w-3" />
                                  </button>
                                )}
                              </span>
                            ) : <span className="text-black/25">—</span>}
                          </td>
                          <td className="px-4 py-3">
                            <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                              ep.statut === "LIBRE" ? "bg-green-100 text-green-700" :
                              ep.statut === "ATTRIBUEE" ? "bg-blue-100 text-blue-700" :
                              ep.statut === "PRERESERVEE" ? "bg-purple-100 text-purple-700" :
                              ep.statut === "CREE" ? "bg-gray-100 text-gray-500" :
                              "bg-gray-100 text-gray-400"
                            }`}>{ep.statut}</span>
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
              ex.actif_planning === true
                ? "bg-green-50 text-green-700 border-green-200 hover:bg-green-100"
                : ex.actif_planning === false
                  ? "bg-orange-50 text-orange-700 border-orange-200 hover:bg-orange-100"
                  : "bg-black/5 text-black/40 border-black/10 hover:bg-black/10"
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
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

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
      // Associer automatiquement au planning courant
      await patch(`examinateurs/${created.id}/plannings/${planningId}`, { actif: true });
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
  const toast = useToast();
  const [plannings, setPlannings] = useState<Planning[]>([]);
  const [selectedPlanningId, setSelectedPlanningId] = useState<number | null>(null);
  const [examinateurs, setExaminateurs] = useState<Examinateur[]>([]);
  const [selectedEx, setSelectedEx] = useState<Examinateur | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [showImportEx, setShowImportEx] = useState(false);
  const [loading, setLoading] = useState(false);
  const [filterActif, setFilterActif] = useState<"tous" | "actif" | "inactif">("tous");
  const [searchEx, setSearchEx] = useState("");
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

  const filtered = examinateurs.filter((ex) => {
    const actifOk = filterActif === "tous" ? true
      : filterActif === "actif" ? ex.actif_planning === true
      : ex.actif_planning !== true;
    if (!actifOk) return false;
    if (!searchEx.trim()) return true;
    const q = searchEx.trim().toLowerCase();
    return ex.nom.toLowerCase().includes(q) || ex.prenom.toLowerCase().includes(q);
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
            <div className="p-3 border-b space-y-2">
              <div className="flex rounded-lg border overflow-hidden text-xs w-full">
                {(["tous", "actif", "inactif"] as const).map((f) => (
                  <button key={f} onClick={() => setFilterActif(f)}
                    className={`flex-1 py-1.5 transition ${filterActif === f ? "bg-black text-white" : "bg-white text-black/50 hover:bg-black/5"}`}
                  >
                    {f === "tous" ? "Tous" : f === "actif" ? "Actifs" : "Inact."}
                  </button>
                ))}
              </div>
              <input
                type="text"
                placeholder="Rechercher…"
                value={searchEx}
                onChange={(e) => setSearchEx(e.target.value)}
                className="w-full border border-black/15 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-red-300"
              />
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
                  <span className={`h-2 w-2 rounded-full shrink-0 ${ex.actif_planning === true ? "bg-green-500" : ex.actif_planning === false ? "bg-orange-400" : "bg-black/15"}`} />
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
  note_harmonisee: number | null;
  commentaire: string | null;
  statut: "BROUILLON" | "PUBLIE";
};

type NoteCell = {
  note_id: number;
  valeur: number | null;
  note_harmonisee: number | null;
  ecart: number | null;
  commentaire: string | null;
  statut: string;
};

type TableauCandidat = {
  id: number;
  nom: string;
  prenom: string;
  code_candidat: string | null;
  handicape: boolean | null;
  date: string;
  notes: Record<string, NoteCell>;
};

type TableauData = {
  matieres: string[];
  candidats: TableauCandidat[];
};

function NotesSection() {
  const toast = useToast();
  const [tab, setTab] = useState<"tableau" | "publication" | "saisie">("tableau");

  // ── Tableau tab state ────────────────────────────────────────────────────────
  const [plannings, setPlannings] = useState<Planning[]>([]);
  const [planningId, setPlanningId] = useState<number | "">("");
  const [tableau, setTableau] = useState<TableauData | null>(null);
  const [loadingT, setLoadingT] = useState(false);
  // Inline edit: note_id → draft value
  const [editHarm, setEditHarm] = useState<Record<number, string>>({});
  const [savingHarm, setSavingHarm] = useState<Record<number, boolean>>({});

  useEffect(() => {
    get<Planning[]>("plannings/").then(setPlannings).catch(() => {});
  }, []);

  useEffect(() => {
    if (!planningId) { setTableau(null); return; }
    setLoadingT(true);
    get<TableauData>(`notes/tableau?planning_id=${planningId}`)
      .then(setTableau)
      .catch(() => {})
      .finally(() => setLoadingT(false));
  }, [planningId]);

  async function saveHarm(noteId: number, raw: string) {
    const val = raw === "" ? null : parseFloat(raw);
    if (raw !== "" && (isNaN(val!) || val! < 0 || val! > 20)) {
      toast.error("Note harmonisée invalide (0–20)");
      return;
    }
    setSavingHarm((s) => ({ ...s, [noteId]: true }));
    try {
      await patch(`notes/${noteId}/harmoniser`, { note_harmonisee: val });
      // Update tableau in place
      setTableau((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          candidats: prev.candidats.map((c) => ({
            ...c,
            notes: Object.fromEntries(
              Object.entries(c.notes).map(([mat, n]) => {
                if (n.note_id !== noteId) return [mat, n];
                const nh = val;
                const ecart = nh !== null && n.valeur !== null ? Math.round((nh - n.valeur) * 100) / 100 : null;
                return [mat, { ...n, note_harmonisee: nh, ecart }];
              })
            ),
          })),
        };
      });
      setEditHarm((e) => { const next = { ...e }; delete next[noteId]; return next; });
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : String(err));
    } finally {
      setSavingHarm((s) => ({ ...s, [noteId]: false }));
    }
  }

  function doExport() {
    if (!planningId) return;
    const a = document.createElement("a");
    a.href = `/api/backend/notes/tableau/export?planning_id=${planningId}`;
    a.download = `notes_planning_${planningId}.xlsx`;
    a.click();
  }

  // ── Publication tab state ─────────────────────────────────────────────────
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

  useEffect(() => { if (tab === "publication") load(); }, [load, tab]);

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

  // ── Saisie tab state ──────────────────────────────────────────────────────
  type SaisieEpreuve = {
    epreuve_id: number;
    date: string;
    matiere: string;
    heure_debut: string;
    heure_fin: string;
    preparation_minutes: number | null;
    candidat_id: number | null;
    candidat_nom: string | null;
    candidat_prenom: string | null;
    note_id: number | null;
    valeur: number | null;
    commentaire: string | null;
    statut: string | null;
  };

  const [saisiePlanningId, setSaisiePlanningId] = useState<number | "">("");
  const [saisieExamId, setSaisieExamId] = useState<number | "">("");
  const [saisieExams, setSaisieExams] = useState<Examinateur[]>([]);
  const [saisieRows, setSaisieRows] = useState<SaisieEpreuve[]>([]);
  const [saisieLoading, setSaisieLoading] = useState(false);
  // Draft edits: epreuve_id → {valeur, commentaire}
  const [saisieDraft, setSaisieDraft] = useState<Record<number, { valeur: string; commentaire: string }>>({});
  const [saisieSaving, setSaisieSaving] = useState<Record<number, boolean>>({});

  useEffect(() => {
    if (tab !== "saisie") return;
    const q = saisiePlanningId ? `?planning_id=${saisiePlanningId}` : "";
    get<Examinateur[]>(`examinateurs/${q}`).then(setSaisieExams).catch(() => {});
  }, [tab, saisiePlanningId]);

  useEffect(() => {
    if (tab !== "saisie" || !saisieExamId) { setSaisieRows([]); return; }
    setSaisieLoading(true);
    const q = saisiePlanningId ? `&planning_id=${saisiePlanningId}` : "";
    get<SaisieEpreuve[]>(`notes/saisie?examinateur_id=${saisieExamId}${q}`)
      .then((rows) => {
        setSaisieRows(rows);
        // Init drafts with existing values
        const drafts: Record<number, { valeur: string; commentaire: string }> = {};
        rows.forEach((r) => {
          drafts[r.epreuve_id] = {
            valeur: r.valeur !== null ? String(r.valeur) : "",
            commentaire: r.commentaire ?? "",
          };
        });
        setSaisieDraft(drafts);
      })
      .catch(() => {})
      .finally(() => setSaisieLoading(false));
  }, [tab, saisieExamId, saisiePlanningId]);

  async function saveSaisie(epId: number) {
    const draft = saisieDraft[epId];
    if (!draft) return;
    const valNum = draft.valeur === "" ? null : parseFloat(draft.valeur);
    if (draft.valeur !== "" && (isNaN(valNum!) || valNum! < 0 || valNum! > 20)) {
      toast.error("Note invalide (0–20)");
      return;
    }
    setSaisieSaving((s) => ({ ...s, [epId]: true }));
    try {
      await post("notes/saisir", {
        epreuve_id: epId,
        valeur: valNum,
        commentaire: draft.commentaire || null,
      });
      setSaisieRows((prev) =>
        prev.map((r) =>
          r.epreuve_id === epId
            ? { ...r, valeur: valNum, commentaire: draft.commentaire || null, statut: r.statut ?? "BROUILLON" }
            : r
        )
      );
      toast.success("Note enregistrée");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setSaisieSaving((s) => ({ ...s, [epId]: false }));
    }
  }

  return (
    <div className="max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-semibold">Notes</h2>
          <p className="text-sm text-black/40 mt-0.5">Consultation du tableau de notes et publication</p>
        </div>
        <div className="flex items-center gap-2">
        {tab === "tableau" && planningId !== "" && (
          <Btn label="Exporter .xlsx" icon={Download} variant="ghost" onClick={doExport} />
        )}
        {tab === "publication" && brouillons.length > 0 && (
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

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-black/5 p-1 rounded-xl w-fit">
        {(["tableau", "saisie", "publication"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition ${
              tab === t ? "bg-white shadow text-black" : "text-black/50 hover:text-black/70"
            }`}
          >
            {t === "tableau" ? "Tableau des notes" : t === "saisie" ? "Saisie" : "Publication"}
          </button>
        ))}
      </div>

      {/* ── Tableau des notes ────────────────────────────────────────────────── */}
      {tab === "tableau" && (
        <div className="space-y-5">
          <div className="flex items-end gap-4">
            <Field label="Planning">
              <Select value={planningId} onChange={(e) => setPlanningId(e.target.value === "" ? "" : Number(e.target.value))}>
                <option value="">— Sélectionner un planning</option>
                {plannings.map((p) => <option key={p.id} value={p.id}>{p.nom}</option>)}
              </Select>
            </Field>
          </div>

          {!planningId ? (
            <Empty message="Sélectionnez un planning" />
          ) : loadingT ? (
            <div className="flex justify-center py-12 text-black/30"><Spinner /></div>
          ) : !tableau || tableau.candidats.length === 0 ? (
            <Empty message="Aucune note disponible pour ce planning" sub="Les notes apparaîtront ici dès leur saisie par les examinateurs." />
          ) : (
            <div className="overflow-x-auto rounded-xl border bg-white shadow-sm">
              <table className="text-xs border-collapse min-w-full">
                <thead>
                  {/* Row 1 : fixed cols + matière headers */}
                  <tr className="bg-[#1A237E]">
                    {["Nom", "Prénom", "N° Cand.", "Date"].map((h) => (
                      <th key={h} rowSpan={2} className="px-3 py-2.5 text-left text-white font-semibold border border-[#283593] align-bottom whitespace-nowrap">{h}</th>
                    ))}
                    {tableau.matieres.map((mat) => (
                      <th key={mat} colSpan={3} className="px-3 py-2 text-center text-white font-semibold border border-[#283593] whitespace-nowrap">{mat}</th>
                    ))}
                  </tr>
                  {/* Row 2 : sub-headers */}
                  <tr className="bg-[#E8EAF6]">
                    {tableau.matieres.flatMap((mat) => (
                      ["Note", "Harm.", "Écart"].map((sub) => (
                        <th key={`${mat}-${sub}`} className="px-2 py-1.5 text-center text-[#1A237E] font-semibold border border-[#C5CAE9] whitespace-nowrap">{sub}</th>
                      ))
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {tableau.candidats.map((cand, ri) => (
                    <tr key={cand.id} className={ri % 2 === 0 ? "bg-white" : "bg-[#FAFAFA]"}>
                      <td className="px-3 py-2 font-semibold border border-black/8 whitespace-nowrap">{cand.nom.toUpperCase()}</td>
                      <td className="px-3 py-2 border border-black/8 whitespace-nowrap">{cand.prenom}</td>
                      <td className="px-3 py-2 text-black/50 border border-black/8">{cand.code_candidat ?? "—"}</td>
                      <td className="px-3 py-2 text-black/50 border border-black/8 whitespace-nowrap">{cand.date}</td>
                      {tableau.matieres.map((mat) => {
                        const n = cand.notes[mat];
                        if (!n) {
                          return (
                            <React.Fragment key={mat}>
                              <td className="px-2 py-2 text-center text-black/20 border border-black/8" colSpan={3}>—</td>
                            </React.Fragment>
                          );
                        }
                        const isEditingH = editHarm[n.note_id] !== undefined;
                        const ecartColor = n.ecart === null ? "" : n.ecart > 0 ? "text-green-600" : n.ecart < 0 ? "text-red-500" : "text-black/40";
                        return (
                          <React.Fragment key={mat}>
                            <td className="px-2 py-2 text-center border border-black/8 font-medium">
                              {n.valeur !== null ? n.valeur.toFixed(1) : <span className="text-black/25">—</span>}
                            </td>
                            <td className="px-1 py-1 text-center border border-black/8 min-w-[64px]">
                              {isEditingH ? (
                                <div className="flex items-center gap-1">
                                  <input
                                    autoFocus
                                    type="number"
                                    min={0} max={20} step={0.5}
                                    value={editHarm[n.note_id]}
                                    onChange={(e) => setEditHarm((prev) => ({ ...prev, [n.note_id]: e.target.value }))}
                                    onKeyDown={(e) => {
                                      if (e.key === "Enter") saveHarm(n.note_id, editHarm[n.note_id]);
                                      if (e.key === "Escape") setEditHarm((prev) => { const next = { ...prev }; delete next[n.note_id]; return next; });
                                    }}
                                    className="w-14 px-1 py-0.5 rounded border border-blue-300 text-xs text-center"
                                  />
                                  {savingHarm[n.note_id] && <Loader2 className="h-3 w-3 animate-spin text-blue-500 shrink-0" />}
                                </div>
                              ) : (
                                <button
                                  onClick={() => setEditHarm((prev) => ({ ...prev, [n.note_id]: n.note_harmonisee !== null ? String(n.note_harmonisee) : "" }))}
                                  className="w-full text-center hover:bg-blue-50 rounded px-1 py-0.5 transition group"
                                  title="Cliquer pour saisir la note harmonisée"
                                >
                                  {n.note_harmonisee !== null
                                    ? <span className="font-semibold text-blue-700">{n.note_harmonisee.toFixed(1)}</span>
                                    : <span className="text-black/20 group-hover:text-blue-400">—</span>}
                                </button>
                              )}
                            </td>
                            <td className={`px-2 py-2 text-center border border-black/8 text-xs font-medium ${ecartColor}`}>
                              {n.ecart !== null ? (n.ecart > 0 ? `+${n.ecart.toFixed(1)}` : n.ecart.toFixed(1)) : "—"}
                            </td>
                          </React.Fragment>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── Saisie admin ──────────────────────────────────────────────────────── */}
      {tab === "saisie" && (
        <div className="space-y-5">
          <div className="flex items-end gap-4 flex-wrap">
            <Field label="Planning (optionnel)">
              <Select value={saisiePlanningId} onChange={(e) => { setSaisiePlanningId(e.target.value === "" ? "" : Number(e.target.value)); setSaisieExamId(""); }}>
                <option value="">— Tous les plannings</option>
                {plannings.map((p) => <option key={p.id} value={p.id}>{p.nom}</option>)}
              </Select>
            </Field>
            <Field label="Examinateur">
              <Select value={saisieExamId} onChange={(e) => setSaisieExamId(e.target.value === "" ? "" : Number(e.target.value))}>
                <option value="">— Sélectionner un examinateur</option>
                {saisieExams.map((ex) => (
                  <option key={ex.id} value={ex.id}>{ex.nom.toUpperCase()} {ex.prenom}</option>
                ))}
              </Select>
            </Field>
          </div>

          {!saisieExamId ? (
            <Empty message="Sélectionnez un examinateur" sub="Choisissez éventuellement un planning pour filtrer la liste." />
          ) : saisieLoading ? (
            <div className="flex justify-center py-12 text-black/30"><Spinner /></div>
          ) : saisieRows.length === 0 ? (
            <Empty message="Aucune épreuve trouvée pour cet examinateur" />
          ) : (
            <div className="overflow-x-auto rounded-xl border bg-white shadow-sm">
              <table className="text-sm border-collapse min-w-full">
                <thead>
                  <tr className="bg-[#1A237E] text-white text-xs">
                    {["Date", "Matière", "Prép.", "Passage", "Candidat", "Note /20", "Commentaire", "Statut", ""].map((h) => (
                      <th key={h} className="px-3 py-2.5 text-left font-semibold whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {saisieRows.map((row, ri) => {
                    const draft = saisieDraft[row.epreuve_id] ?? { valeur: "", commentaire: "" };
                    const saving = saisieSaving[row.epreuve_id] ?? false;
                    return (
                      <tr key={row.epreuve_id} className={ri % 2 === 0 ? "bg-white" : "bg-[#FAFAFA]"}>
                        <td className="px-3 py-2 border border-black/8 whitespace-nowrap text-xs text-black/60">{row.date}</td>
                        <td className="px-3 py-2 border border-black/8 font-medium whitespace-nowrap">{row.matiere}</td>
                        <td className="px-3 py-2 border border-black/8 text-xs text-black/50 whitespace-nowrap">
                          {row.preparation_minutes ? `${row.heure_debut.slice(0,5)} (−${row.preparation_minutes}′)` : "—"}
                        </td>
                        <td className="px-3 py-2 border border-black/8 text-xs font-medium whitespace-nowrap">{row.heure_debut.slice(0,5)}–{row.heure_fin.slice(0,5)}</td>
                        <td className="px-3 py-2 border border-black/8 whitespace-nowrap">
                          {row.candidat_nom
                            ? <span>{row.candidat_nom.toUpperCase()} <span className="text-black/50">{row.candidat_prenom}</span></span>
                            : <span className="text-black/25 italic">Non assigné</span>}
                        </td>
                        <td className="px-2 py-1.5 border border-black/8">
                          <input
                            type="number"
                            min={0} max={20} step={0.5}
                            value={draft.valeur}
                            onChange={(e) => setSaisieDraft((prev) => ({ ...prev, [row.epreuve_id]: { ...draft, valeur: e.target.value } }))}
                            placeholder="—"
                            className="w-16 px-2 py-1 rounded border border-black/15 text-sm text-center focus:outline-none focus:border-[#1A237E]"
                          />
                        </td>
                        <td className="px-2 py-1.5 border border-black/8">
                          <input
                            type="text"
                            value={draft.commentaire}
                            onChange={(e) => setSaisieDraft((prev) => ({ ...prev, [row.epreuve_id]: { ...draft, commentaire: e.target.value } }))}
                            placeholder="Commentaire…"
                            className="w-48 px-2 py-1 rounded border border-black/15 text-sm focus:outline-none focus:border-[#1A237E]"
                          />
                        </td>
                        <td className="px-3 py-2 border border-black/8 text-xs">
                          {row.statut === "PUBLIE" ? (
                            <span className="bg-green-100 text-green-700 rounded-full px-2 py-0.5 font-medium">Publiée</span>
                          ) : row.statut === "BROUILLON" ? (
                            <span className="bg-amber-100 text-amber-700 rounded-full px-2 py-0.5 font-medium">Brouillon</span>
                          ) : (
                            <span className="text-black/30">—</span>
                          )}
                        </td>
                        <td className="px-3 py-2 border border-black/8">
                          <button
                            onClick={() => saveSaisie(row.epreuve_id)}
                            disabled={saving || !row.candidat_id}
                            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-[#1A237E] text-white font-semibold hover:bg-[#283593] transition disabled:opacity-40 whitespace-nowrap"
                            title={!row.candidat_id ? "Aucun candidat assigné à cette épreuve" : "Enregistrer"}
                          >
                            {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
                            Enregistrer
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── Publication ───────────────────────────────────────────────────────── */}
      {tab === "publication" && (
      <div className="space-y-4">
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
  const toast = useToast();
  const confirm = useConfirm();
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
      toast.success(`${label} ajouté(e)`);
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
      toast.error(e.message);
    }
  };

  const handleDelete = async (item: ReferentielItem) => {
    if (!await confirm(`Supprimer « ${item.intitule} » ?`, { confirmLabel: "Supprimer", danger: true })) return;
    try {
      await del(`parametrages/${entite}/${item.id}`);
      toast.success(`${label} supprimé(e)`);
      load();
    } catch (e: any) {
      toast.error(e.message);
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
  const [candidatEmail, setCandidatEmail] = useState("");
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
    if (!candidatEmail.trim()) return;
    setResetting(true);
    setResetErr("");
    setResetResult(null);
    try {
      const res = await post<{ login: string; new_password: string }>(
        `parametrages/candidats/reset-password-by-email`,
        { email: candidatEmail.trim() }
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
              Saisissez l&apos;adresse email du candidat. Un nouveau mot de passe temporaire sera généré.
            </p>

            <Field label="Email candidat">
              <Input
                type="email"
                value={candidatEmail}
                onChange={(e) => { setCandidatEmail(e.target.value); setResetResult(null); setResetErr(""); }}
                placeholder="ex. prenom.nom@example.com"
              />
            </Field>

            <Btn
              label={resetting ? "Réinitialisation…" : "Générer un nouveau mot de passe"}
              onClick={doResetPassword}
              disabled={resetting || !candidatEmail.trim()}
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

// ── Section : Surveillants ────────────────────────────────────────────────────

function CredentialsModal({
  nom, prenom, email, code_acces, plainPassword, emailSent,
  onClose,
}: {
  nom: string; prenom: string; email: string; code_acces: string;
  plainPassword: string; emailSent: boolean; onClose: () => void;
}) {
  const [copied, setCopied] = useState<string | null>(null);
  const copy = (text: string, key: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(key);
      setTimeout(() => setCopied(null), 1500);
    });
  };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6"
      >
        <div className="flex items-center gap-2 mb-4">
          <Key className="h-5 w-5 text-[#C62828]" />
          <h3 className="text-base font-semibold">Identifiants générés</h3>
        </div>
        <p className="text-sm text-black/60 mb-4">
          {prenom} {nom} — <span className="font-mono text-xs">{email}</span>
        </p>

        {emailSent ? (
          <div className="flex items-center gap-2 text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2 mb-4">
            <Mail className="h-4 w-4 shrink-0" />
            Email envoyé à {email}
          </div>
        ) : (
          <div className="flex items-center gap-2 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-4">
            <Mail className="h-4 w-4 shrink-0" />
            Email non envoyé (SMTP non configuré) — communiquez ces identifiants manuellement.
          </div>
        )}

        <div className="space-y-2 mb-5">
          {[
            { label: "Login (email)", value: email, key: "login" },
            { label: "Mot de passe", value: plainPassword, key: "pwd" },
          ].map(({ label, value, key }) => (
            <div key={key} className="flex items-center justify-between bg-gray-50 rounded-lg border px-3 py-2">
              <div>
                <p className="text-[10px] text-black/40 uppercase tracking-wide">{label}</p>
                <p className="text-sm font-mono font-medium">{value}</p>
              </div>
              <button
                onClick={() => copy(value, key)}
                className="text-black/30 hover:text-[#C62828] transition"
                title="Copier"
              >
                {copied === key
                  ? <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                  : <Copy className="h-4 w-4" />}
              </button>
            </div>
          ))}
        </div>

        <button
          onClick={onClose}
          className="w-full py-2 bg-black text-white text-sm font-semibold rounded-lg hover:bg-black/80 transition"
        >
          Fermer
        </button>
      </motion.div>
    </div>
  );
}

function SurveillantsSection() {
  const toast = useToast();
  const confirm = useConfirm();
  const [plannings, setPlannings] = useState<Planning[]>([]);
  const [selectedPlanningId, setSelectedPlanningId] = useState<number | null>(null);
  const [surveillants, setSurvaillants] = useState<Surveillant[]>([]);
  const [loading, setLoading] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [credentials, setCredentials] = useState<{
    nom: string; prenom: string; email: string; code_acces: string;
    plainPassword: string; emailSent: boolean;
  } | null>(null);
  const [filterActif, setFilterActif] = useState<"tous" | "actif" | "inactif">("tous");
  const [search, setSearch] = useState("");
  const [view, setView] = useState<"annuaire" | "planning">("annuaire");
  const [epreuves, setEpreuves] = useState<EpreuveFlat[]>([]);
  const [loadingEp, setLoadingEp] = useState(false);
  const [filterDate, setFilterDate] = useState("");
  const [filterSurv, setFilterSurv] = useState<string>("");

  useEffect(() => {
    get<Planning[]>("plannings/").then((ps) => {
      setPlannings(ps);
      if (ps.length > 0) setSelectedPlanningId(ps[0].id);
    }).catch(() => {});
  }, []);

  const load = useCallback(async () => {
    if (!selectedPlanningId) return;
    setLoading(true);
    try {
      setSurvaillants(await get<Surveillant[]>(`surveillants/?planning_id=${selectedPlanningId}`));
    } finally {
      setLoading(false);
    }
  }, [selectedPlanningId]);

  const loadEpreuves = useCallback(async () => {
    if (!selectedPlanningId) return;
    setLoadingEp(true);
    try {
      setEpreuves(await get<EpreuveFlat[]>(`plannings/${selectedPlanningId}/epreuves`));
    } finally {
      setLoadingEp(false);
    }
  }, [selectedPlanningId]);

  useEffect(() => {
    if (view === "planning") loadEpreuves();
  }, [view, loadEpreuves]);

  useEffect(() => { load(); }, [load]);

  const handleToggleActif = async (s: Surveillant) => {
    try {
      const updated = await patch<Surveillant>(`surveillants/${s.id}/actif`, { actif: !s.actif });
      toast.success(updated.actif ? "Surveillant activé" : "Surveillant désactivé");
      setSurvaillants((prev) => prev.map((x) => (x.id === updated.id ? updated : x)));
    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : String(e)); }
  };

  const handleDelete = async (s: Surveillant) => {
    if (!await confirm(`Supprimer ${s.prenom} ${s.nom} ?`, { confirmLabel: "Supprimer", danger: true })) return;
    try {
      await del(`surveillants/${s.id}`);
      toast.success("Surveillant supprimé");
      load();
    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : String(e)); }
  };

  const handleSendCredentials = async (s: Surveillant) => {
    try {
      const res = await post<Surveillant & { plain_password: string; email_sent: boolean }>(
        `surveillants/${s.id}/envoyer-identifiants`, {}
      );
      setCredentials({
        nom: res.nom, prenom: res.prenom, email: res.email,
        code_acces: res.code_acces, plainPassword: res.plain_password, emailSent: res.email_sent,
      });
      if (res.email_sent) toast.success("Identifiants envoyés par email");
      else toast.info("Nouveau mot de passe généré (SMTP non configuré)");
    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : String(e)); }
  };

  const filtered = surveillants.filter((s) => {
    if (filterActif === "actif" && !s.actif) return false;
    if (filterActif === "inactif" && s.actif) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      if (!`${s.nom} ${s.prenom} ${s.email}`.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  // ── Vue planning ─────────────────────────────────────────────────────────────
  const dates = Array.from(new Set(epreuves.map((e) => e.date))).sort();
  const epFiltered = epreuves
    .filter((e) => !filterDate || e.date === filterDate)
    .filter((e) => !filterSurv || String(e.surveillant_id ?? "") === filterSurv);

  const epByDate = dates
    .filter((d) => !filterDate || d === filterDate)
    .map((d) => ({
      date: d,
      rows: epFiltered.filter((e) => e.date === d)
        .sort((a, b) => a.heure_debut.localeCompare(b.heure_debut) || a.matiere.localeCompare(b.matiere)),
    }))
    .filter((g) => g.rows.length > 0);

  const fmtDate = (d: string) => new Date(d + "T12:00:00").toLocaleDateString("fr-FR", {
    weekday: "long", day: "numeric", month: "long",
  });

  return (
    <div className="max-w-5xl mx-auto space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Shield className="h-5 w-5 text-[#C62828]" />
          <div>
            <h2 className="text-xl font-semibold">Surveillants</h2>
            <p className="text-sm text-black/40">Gestion et planning des surveillants</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <select
            className="border rounded-lg px-3 py-2 text-sm"
            value={selectedPlanningId ?? ""}
            onChange={(e) => setSelectedPlanningId(e.target.value ? Number(e.target.value) : null)}
          >
            <option value="">— Planning —</option>
            {plannings.map((p) => <option key={p.id} value={p.id}>{p.nom}</option>)}
          </select>
          {selectedPlanningId && view === "annuaire" && (
            <Btn label="Nouveau surveillant" icon={Plus} onClick={() => setShowCreate(true)} />
          )}
        </div>
      </div>

      {/* Onglets */}
      {selectedPlanningId && (
        <div className="flex rounded-xl border overflow-hidden w-fit text-xs font-medium">
          {(["annuaire", "planning"] as const).map((v) => (
            <button key={v} onClick={() => setView(v)}
              className={`px-4 py-2 transition ${view === v ? "bg-black text-white" : "bg-white text-black/50 hover:bg-black/5"}`}
            >
              {v === "annuaire" ? "Annuaire" : "Planning des créneaux"}
            </button>
          ))}
        </div>
      )}

      {/* ── Vue Annuaire ── */}
      {view === "annuaire" && (
        <>
          {selectedPlanningId && (
            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex rounded-lg border overflow-hidden text-xs">
                {(["tous", "actif", "inactif"] as const).map((f) => (
                  <button key={f} onClick={() => setFilterActif(f)}
                    className={`px-3 py-1.5 transition ${filterActif === f ? "bg-black text-white" : "bg-white text-black/50 hover:bg-black/5"}`}
                  >
                    {f === "tous" ? "Tous" : f === "actif" ? "Actifs" : "Inactifs"}
                  </button>
                ))}
              </div>
              <input
                type="text"
                placeholder="Rechercher…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#C62828]/30 w-52"
              />
            </div>
          )}

          {loading ? (
            <div className="p-8 text-center"><Spinner /></div>
          ) : !selectedPlanningId ? (
            <Empty message="Sélectionnez un planning" />
          ) : filtered.length === 0 ? (
            <Empty message="Aucun surveillant" sub="Créez le premier surveillant pour ce planning." />
          ) : (
            <div className="rounded-xl border bg-white shadow-sm overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-[#F5F5F5] border-b">
                    {["Nom", "Email", "Statut", ""].map((h) => (
                      <th key={h} className="text-left px-5 py-3 text-xs font-semibold text-black/50 tracking-wide">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((s) => (
                    <tr key={s.id} className="border-t border-black/5 hover:bg-black/[0.012] transition">
                      <td className="px-5 py-3">
                        <p className="font-medium">{s.prenom} {s.nom}</p>
                      </td>
                      <td className="px-5 py-3 text-black/50 text-xs font-mono">{s.email}</td>
                      <td className="px-5 py-3">
                        <button
                          onClick={() => handleToggleActif(s)}
                          className={`text-xs px-2.5 py-1 rounded-full font-semibold transition ${
                            s.actif ? "bg-green-100 text-green-700 hover:bg-green-200" : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                          }`}
                        >
                          {s.actif ? "Actif" : "Inactif"}
                        </button>
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <Btn label="Identifiants" icon={Key} onClick={() => handleSendCredentials(s)} small variant="ghost" />
                          <Btn label="Supprimer" icon={Trash2} onClick={() => handleDelete(s)} small variant="danger" />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* ── Vue Planning ── */}
      {view === "planning" && (
        <>
          {/* Filtres */}
          <div className="flex items-center gap-2 flex-wrap">
            <select
              value={filterDate}
              onChange={(e) => setFilterDate(e.target.value)}
              className="border rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-black/15"
            >
              <option value="">Toutes les journées</option>
              {dates.map((d) => (
                <option key={d} value={d}>{fmtDate(d)}</option>
              ))}
            </select>
            <select
              value={filterSurv}
              onChange={(e) => setFilterSurv(e.target.value)}
              className="border rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-black/15"
            >
              <option value="">Tous les surveillants</option>
              <option value="0">— Non assignés —</option>
              {surveillants.filter((s) => s.actif).map((s) => (
                <option key={s.id} value={String(s.id)}>{s.nom} {s.prenom}</option>
              ))}
            </select>
          </div>

          {loadingEp ? (
            <div className="p-8 text-center"><Spinner /></div>
          ) : !selectedPlanningId ? (
            <Empty message="Sélectionnez un planning" />
          ) : epByDate.length === 0 ? (
            <Empty message="Aucun créneau" sub="Appliquez un gabarit pour générer les créneaux." />
          ) : (
            <div className="space-y-4">
              {epByDate.map(({ date, rows }) => {
                const nonAssignes = rows.filter((r) => !r.surveillant_id).length;
                return (
                  <div key={date} className="bg-white rounded-2xl border border-black/5 shadow-sm overflow-hidden">
                    <div className="px-4 py-2.5 bg-black/[0.02] border-b border-black/5 flex items-center justify-between">
                      <span className="text-xs font-semibold text-black/60 capitalize">{fmtDate(date)}</span>
                      {nonAssignes > 0 && (
                        <span className="flex items-center gap-1.5 text-xs text-amber-600 font-medium">
                          <AlertTriangle className="h-3.5 w-3.5" />
                          {nonAssignes} créneau(x) sans surveillant
                        </span>
                      )}
                    </div>
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-black/5 bg-black/[0.01]">
                          <th className="text-left px-4 py-2 text-black/40 font-medium w-28">Matière</th>
                          <th className="text-left px-4 py-2 text-black/40 font-medium w-24">Heure</th>
                          <th className="text-left px-4 py-2 text-black/40 font-medium">Surveillant</th>
                          <th className="text-left px-4 py-2 text-black/40 font-medium">Candidat</th>
                          <th className="text-left px-4 py-2 text-black/40 font-medium w-20">Statut</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rows.map((ep) => (
                          <tr key={ep.id} className={`border-b border-black/[0.04] last:border-0 ${!ep.surveillant_id ? "bg-amber-50/40" : "hover:bg-black/[0.01]"}`}>
                            <td className="px-4 py-2.5 font-medium text-black/70">{ep.matiere}</td>
                            <td className="px-4 py-2.5 font-mono text-black/50">{ep.heure_debut} – {ep.heure_fin}</td>
                            <td className="px-4 py-2.5">
                              {ep.surveillant_nom ? (
                                <span className="text-black/70">{ep.surveillant_nom} {ep.surveillant_prenom}</span>
                              ) : (
                                <span className="flex items-center gap-1 text-amber-500">
                                  <AlertTriangle className="h-3 w-3" /> Non assigné
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-2.5 text-black/50">
                              {ep.candidat_nom ? `${ep.candidat_nom} ${ep.candidat_prenom}` : <span className="text-black/25">—</span>}
                            </td>
                            <td className="px-4 py-2.5">
                              <span className={`inline-block px-2 py-0.5 rounded-full font-medium text-[10px] ${
                                ep.statut === "ATTRIBUEE" ? "bg-green-100 text-green-700" :
                                ep.statut === "LIBRE" ? "bg-gray-100 text-gray-500" :
                                ep.statut === "PRERESERVEE" ? "bg-amber-100 text-amber-700" :
                                "bg-gray-50 text-gray-400"
                              }`}>
                                {ep.statut}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* Modal création */}
      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Nouveau surveillant">
        <CreateSurveillantForm
          planningId={selectedPlanningId!}
          onSuccess={(res) => {
            setShowCreate(false);
            toast.success("Surveillant créé");
            setCredentials({
              nom: res.nom, prenom: res.prenom, email: res.email,
              code_acces: res.code_acces, plainPassword: res.plain_password, emailSent: res.email_sent,
            });
            load();
          }}
        />
      </Modal>

      {/* Modal identifiants */}
      {credentials && (
        <CredentialsModal
          {...credentials}
          onClose={() => setCredentials(null)}
        />
      )}
    </div>
  );
}

function CreateSurveillantForm({
  planningId,
  onSuccess,
}: {
  planningId: number;
  onSuccess: (res: Surveillant & { plain_password: string; email_sent: boolean }) => void;
}) {
  const [form, setForm] = useState({ nom: "", prenom: "", email: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async () => {
    if (!form.nom.trim() || !form.prenom.trim() || !form.email.trim()) {
      setError("Tous les champs sont obligatoires");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = await post<Surveillant & { plain_password: string; email_sent: boolean }>(
        "surveillants/",
        { planning_id: planningId, ...form }
      );
      onSuccess(res);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <Field label="Prénom">
        <Input value={form.prenom} onChange={(e) => set("prenom", e.target.value)} placeholder="Prénom" />
      </Field>
      <Field label="NOM">
        <Input value={form.nom} onChange={(e) => set("nom", e.target.value)} placeholder="NOM" />
      </Field>
      <Field label="Email">
        <Input type="email" value={form.email} onChange={(e) => set("email", e.target.value)} placeholder="prenom.nom@exemple.fr" />
      </Field>
      <ErrorMsg msg={error} />
      <Btn
        label={loading ? "Création…" : "Créer et générer identifiants"}
        icon={loading ? undefined : Key}
        onClick={submit}
        disabled={loading || !form.nom || !form.prenom || !form.email}
      />
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
      { key: "surveillants", label: "Surveillants", icon: Shield },
      { key: "dashboard", label: "Tableau de bord", icon: BarChart3 },
      { key: "conflits", label: "Conflits", icon: AlertTriangle, badge: nbConflits },
      { key: "planches", label: "Planches", icon: FileText },
      { key: "salles", label: "Salles", icon: Building2 },
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
              <span className="h-2 w-2 rounded-full bg-amber-400 shrink-0" />
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

// ── Gestion des planches ───────────────────────────────────────────────────────
function PlanchesSection() {
  const toast = useToast();
  const confirm = useConfirm();
  const matieres = useMatieres();
  const [tab, setTab] = useState<"sujets" | "assignation" | "impression">("sujets");

  // ── Onglet Sujets ────────────────────────────────────────────────────────────
  const [planches, setPlanches] = useState<PlancheItem[]>([]);
  const [loadingP, setLoadingP] = useState(true);
  const [showUpload, setShowUpload] = useState(false);

  // Upload state
  const [uploadFiles, setUploadFiles] = useState<File[]>([]);
  const [uploadMatiereId, setUploadMatiereId] = useState<number | "">("");
  const [uploadExamId, setUploadExamId] = useState<number | "">("");
  const [uploading, setUploading] = useState(false);
  const [uploadErr, setUploadErr] = useState("");
  const uploadRef = useRef<HTMLInputElement>(null);

  // Inline edit
  const [editRow, setEditRow] = useState<number | null>(null);
  const [editNom, setEditNom] = useState("");
  const [editMatiereId, setEditMatiereId] = useState<number | "">("");
  const [editExamId, setEditExamId] = useState<number | "">("");
  const [editStatut, setEditStatut] = useState("ACTIF");
  const [savingRow, setSavingRow] = useState(false);

  // Examinateurs list
  const [examinateurs, setExaminateurs] = useState<Examinateur[]>([]);

  // ── Onglet Impression ────────────────────────────────────────────────────────
  const [impPlanningId, setImpPlanningId] = useState<number | "">("");
  const [impDate, setImpDate] = useState("");
  const [impMatiere, setImpMatiere] = useState("");
  const [impEpreuves, setImpEpreuves] = useState<EpreuveFlat[]>([]);
  const [impLoading, setImpLoading] = useState(false);
  const [impSelected, setImpSelected] = useState<Set<number>>(new Set());
  const [impDownloading, setImpDownloading] = useState(false);

  // ── Onglet Assignation ───────────────────────────────────────────────────────
  const [plannings, setPlannings] = useState<Planning[]>([]);
  const [planningId, setPlanningId] = useState<number | "">("");
  const [epreuves, setEpreuves] = useState<EpreuveFlat[]>([]);
  const [loadingEp, setLoadingEp] = useState(false);
  const [assignModal, setAssignModal] = useState<EpreuveFlat | null>(null);
  const [filterMatAss, setFilterMatAss] = useState("");
  const [assigning, setAssigning] = useState(false);

  const loadPlanches = useCallback(() => {
    setLoadingP(true);
    get<PlancheItem[]>("planches/")
      .then(setPlanches)
      .catch(() => {})
      .finally(() => setLoadingP(false));
  }, []);

  useEffect(() => {
    loadPlanches();
    get<Planning[]>("plannings/").then(setPlannings).catch(() => {});
    get<Examinateur[]>("examinateurs/").then(setExaminateurs).catch(() => {});
  }, [loadPlanches]);

  useEffect(() => {
    if (!planningId) { setEpreuves([]); return; }
    setLoadingEp(true);
    get<EpreuveFlat[]>(`plannings/${planningId}/epreuves`)
      .then(setEpreuves)
      .catch(() => {})
      .finally(() => setLoadingEp(false));
  }, [planningId]);

  async function doUpload() {
    if (uploadFiles.length === 0) return;
    setUploading(true);
    setUploadErr("");
    try {
      const fd = new FormData();
      uploadFiles.forEach((f) => fd.append("files", f));
      if (uploadMatiereId !== "") fd.append("matiere_id", String(uploadMatiereId));
      if (uploadExamId !== "") fd.append("examinateur_id", String(uploadExamId));
      const res = await fetch("/api/backend/planches/upload", {
        method: "POST",
        body: fd,
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.detail ?? "Erreur lors de l'upload");
      }
      const created = await res.json() as PlancheItem[];
      toast.success(`${created.length} planche(s) injectée(s)`);
      setUploadFiles([]);
      setShowUpload(false);
      loadPlanches();
    } catch (e: unknown) {
      setUploadErr(e instanceof Error ? e.message : String(e));
    } finally {
      setUploading(false);
    }
  }

  function startEdit(p: PlancheItem) {
    setEditRow(p.id);
    setEditNom(p.nom);
    setEditMatiereId(p.matiere_id ?? "");
    setEditExamId(p.examinateur_id ?? "");
    setEditStatut(p.statut);
  }

  async function saveEdit(id: number) {
    setSavingRow(true);
    try {
      await patch(`planches/${id}`, {
        nom: editNom,
        matiere_id: editMatiereId !== "" ? editMatiereId : null,
        examinateur_id: editExamId !== "" ? editExamId : null,
        statut: editStatut,
      });
      setEditRow(null);
      loadPlanches();
      toast.success("Planche mise à jour");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setSavingRow(false);
    }
  }

  async function doDelete(id: number) {
    if (!await confirm("Supprimer cette planche ?", { confirmLabel: "Supprimer", danger: true })) return;
    try {
      await del(`planches/${id}`);
      loadPlanches();
      toast.success("Planche supprimée");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : String(e));
    }
  }

  async function doAssign(epreuveId: number, plancheId: number) {
    setAssigning(true);
    try {
      await post(`planches/epreuves/${epreuveId}/assigner`, { planche_id: plancheId });
      setEpreuves((prev) =>
        prev.map((e) => {
          if (e.id !== epreuveId) return e;
          const p = planches.find((pl) => pl.id === plancheId);
          return { ...e, planche_id: plancheId, planche_nom: p?.nom ?? null };
        })
      );
      setAssignModal(null);
      toast.success("Planche assignée");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setAssigning(false);
    }
  }

  async function doDesassign(epreuveId: number) {
    try {
      await del(`planches/epreuves/${epreuveId}/assigner`);
      setEpreuves((prev) =>
        prev.map((e) => e.id === epreuveId ? { ...e, planche_id: null, planche_nom: null } : e)
      );
      toast.success("Planche retirée");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : String(e));
    }
  }

  // ── Logique impression ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!impPlanningId || !impDate) { setImpEpreuves([]); setImpSelected(new Set()); return; }
    setImpLoading(true);
    get<EpreuveFlat[]>(`plannings/${impPlanningId}/epreuves`)
      .then((all) => {
        const filtered = all.filter(
          (e) => e.date === impDate && e.planche_id !== null && (impMatiere === "" || e.matiere === impMatiere)
        );
        setImpEpreuves(filtered);
        // Pré-sélectionner toutes les épreuves avec candidat + planche
        setImpSelected(new Set(filtered.filter((e) => e.candidat_id && e.planche_id).map((e) => e.id)));
      })
      .catch(() => {})
      .finally(() => setImpLoading(false));
  }, [impPlanningId, impDate, impMatiere]);

  async function doDownloadBatch() {
    const ids = Array.from(impSelected);
    if (ids.length === 0) return;
    setImpDownloading(true);
    try {
      const res = await fetch("/api/backend/planches/batch-cartouche", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ epreuve_ids: ids }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.detail ?? "Erreur lors du téléchargement");
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const cd = res.headers.get("content-disposition") ?? "";
      const fnMatch = cd.match(/filename="([^"]+)"/);
      a.download = fnMatch ? fnMatch[1] : `planches_${impDate}.zip`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(`${ids.length} planche(s) téléchargée(s)`);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setImpDownloading(false);
    }
  }

  // Planches filtrées par matière pour la modale d'assignation
  const planchesForAssign = assignModal
    ? planches.filter(
        (p) =>
          p.statut === "ACTIF" &&
          (assignModal.matiere
            ? p.matiere_intitule === assignModal.matiere
            : true)
      )
    : [];

  const epreuvesFiltrees = filterMatAss
    ? epreuves.filter((e) => e.matiere === filterMatAss)
    : epreuves;

  const matiereOptions = Array.from(new Set(epreuves.map((e) => e.matiere))).sort();

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-semibold">Planches</h2>
          <p className="text-sm text-black/40 mt-0.5">Gestion des sujets PDF et assignation aux épreuves</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-black/5 p-1 rounded-xl w-fit">
        {(["sujets", "assignation", "impression"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition ${
              tab === t ? "bg-white shadow text-black" : "text-black/50 hover:text-black/70"
            }`}
          >
            {t === "sujets" ? "Gestion des sujets" : t === "assignation" ? "Assignation" : "Impression"}
          </button>
        ))}
      </div>

      {/* ── Onglet Sujets ────────────────────────────────────────────────────── */}
      {tab === "sujets" && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <Btn label="+ Injecter des sujets" icon={Upload} onClick={() => setShowUpload(true)} />
          </div>

          {/* Upload modal */}
          <Modal open={showUpload} onClose={() => { setShowUpload(false); setUploadFiles([]); setUploadErr(""); }} title="Injecter des sujets PDF">
            <div className="space-y-4">
              <div>
                <input
                  ref={uploadRef}
                  type="file"
                  accept=".pdf"
                  multiple
                  className="hidden"
                  onChange={(e) => setUploadFiles(Array.from(e.target.files ?? []))}
                />
                <div
                  onClick={() => uploadRef.current?.click()}
                  className="cursor-pointer rounded-xl border-2 border-dashed border-gray-200 hover:border-[#C62828] transition p-8 text-center"
                >
                  {uploadFiles.length > 0 ? (
                    <div>
                      <p className="text-sm font-semibold text-gray-800">{uploadFiles.length} fichier(s) sélectionné(s)</p>
                      <p className="text-xs text-gray-400 mt-1">{uploadFiles.map((f) => f.name).join(", ")}</p>
                      <p className="text-xs text-gray-400 mt-1">Cliquer pour changer</p>
                    </div>
                  ) : (
                    <div>
                      <Upload className="h-8 w-8 mx-auto mb-2 text-gray-300" />
                      <p className="text-sm text-gray-500">Cliquer pour sélectionner des PDFs</p>
                      <p className="text-xs text-gray-400 mt-1">Plusieurs fichiers acceptés · PDF uniquement</p>
                    </div>
                  )}
                </div>
              </div>
              <Field label="Matière (optionnel)">
                <Select value={uploadMatiereId} onChange={(e) => setUploadMatiereId(e.target.value === "" ? "" : Number(e.target.value))}>
                  <option value="">— Choisir une matière</option>
                  {matieres.filter((m) => m.active).map((m) => (
                    <option key={m.id} value={m.id}>{m.intitule}</option>
                  ))}
                </Select>
              </Field>
              <Field label="Auteur (optionnel)">
                <Select value={uploadExamId} onChange={(e) => setUploadExamId(e.target.value === "" ? "" : Number(e.target.value))}>
                  <option value="">— Choisir un examinateur</option>
                  {examinateurs.map((ex) => (
                    <option key={ex.id} value={ex.id}>{ex.prenom} {ex.nom}</option>
                  ))}
                </Select>
              </Field>
              {uploadErr && <ErrorMsg msg={uploadErr} />}
              <div className="flex gap-2 justify-end">
                <button onClick={() => { setShowUpload(false); setUploadFiles([]); setUploadErr(""); }} className="text-sm text-gray-500 px-4 py-2 rounded-lg hover:bg-gray-100 transition">Annuler</button>
                <Btn label="Injecter" disabled={uploadFiles.length === 0 || uploading} icon={uploading ? Loader2 : Upload} onClick={doUpload} />
              </div>
            </div>
          </Modal>

          {/* Table */}
          {loadingP ? (
            <div className="flex justify-center py-12 text-black/30"><Spinner /></div>
          ) : planches.length === 0 ? (
            <Empty message="Aucun sujet chargé" sub="Cliquez sur « Injecter des sujets » pour importer des PDFs." />
          ) : (
            <div className="rounded-xl border bg-white shadow-sm overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-[#F5F5F5]">
                    {["Nom", "Matière", "Auteur", "Statut", "Assignée", ""].map((h) => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-black/50 tracking-wide">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {planches.map((p) => (
                    <tr key={p.id} className="border-t border-black/5 hover:bg-black/[0.012]">
                      {editRow === p.id ? (
                        <>
                          <td className="px-4 py-2">
                            <input
                              value={editNom}
                              onChange={(e) => setEditNom(e.target.value)}
                              className="w-full px-2 py-1 rounded border border-black/15 text-sm"
                            />
                          </td>
                          <td className="px-4 py-2">
                            <select
                              value={editMatiereId}
                              onChange={(e) => setEditMatiereId(e.target.value === "" ? "" : Number(e.target.value))}
                              className="w-full px-2 py-1 rounded border border-black/15 text-sm bg-white"
                            >
                              <option value="">—</option>
                              {matieres.filter((m) => m.active).map((m) => (
                                <option key={m.id} value={m.id}>{m.intitule}</option>
                              ))}
                            </select>
                          </td>
                          <td className="px-4 py-2">
                            <select
                              value={editExamId}
                              onChange={(e) => setEditExamId(e.target.value === "" ? "" : Number(e.target.value))}
                              className="w-full px-2 py-1 rounded border border-black/15 text-sm bg-white"
                            >
                              <option value="">—</option>
                              {examinateurs.map((ex) => (
                                <option key={ex.id} value={ex.id}>{ex.prenom} {ex.nom}</option>
                              ))}
                            </select>
                          </td>
                          <td className="px-4 py-2">
                            <select
                              value={editStatut}
                              onChange={(e) => setEditStatut(e.target.value)}
                              className="px-2 py-1 rounded border border-black/15 text-sm bg-white"
                            >
                              <option value="ACTIF">Actif</option>
                              <option value="INACTIF">Inactif</option>
                            </select>
                          </td>
                          <td className="px-4 py-2" />
                          <td className="px-4 py-2 text-right">
                            <div className="flex gap-2 justify-end">
                              <Btn label="Sauv." small onClick={() => saveEdit(p.id)} disabled={savingRow} />
                              <Btn label="Annuler" small variant="ghost" onClick={() => setEditRow(null)} />
                            </div>
                          </td>
                        </>
                      ) : (
                        <>
                          <td className="px-4 py-3 font-medium text-sm">
                            <div className="flex items-center gap-2">
                              <FileText className="h-4 w-4 text-black/30 shrink-0" />
                              {p.nom}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-sm text-black/60">{p.matiere_intitule ?? <span className="text-black/30 italic">—</span>}</td>
                          <td className="px-4 py-3 text-sm text-black/60">{p.examinateur_nom ?? <span className="text-black/30 italic">—</span>}</td>
                          <td className="px-4 py-3">
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${p.statut === "ACTIF" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                              {p.statut === "ACTIF" ? "Actif" : "Inactif"}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${p.assignee ? "bg-blue-100 text-blue-700" : "bg-gray-100 text-gray-400"}`}>
                              {p.assignee ? "Oui" : "Non"}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <div className="flex gap-1.5 justify-end">
                              <a
                                href={`/api/backend/planches/${p.id}/download`}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1 text-xs text-black/50 hover:text-black/80 px-2 py-1 rounded hover:bg-black/5 transition"
                              >
                                <Download className="h-3.5 w-3.5" />
                                PDF
                              </a>
                              <Btn label="Modifier" small variant="ghost" icon={Edit2} onClick={() => startEdit(p)} />
                              <button
                                onClick={() => doDelete(p.id)}
                                disabled={p.assignee}
                                title={p.assignee ? "Assignée à une épreuve — non supprimable" : "Supprimer"}
                                className="inline-flex items-center gap-1 text-xs text-red-500 px-2 py-1 rounded hover:bg-red-50 transition disabled:opacity-30 disabled:cursor-not-allowed"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </td>
                        </>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── Onglet Assignation ───────────────────────────────────────────────── */}
      {tab === "assignation" && (
        <div className="space-y-5">
          <div className="flex items-end gap-4 flex-wrap">
            <Field label="Planning">
              <Select value={planningId} onChange={(e) => setPlanningId(e.target.value === "" ? "" : Number(e.target.value))} className="min-w-[220px]">
                <option value="">— Sélectionner un planning</option>
                {plannings.map((p) => <option key={p.id} value={p.id}>{p.nom}</option>)}
              </Select>
            </Field>
            {matiereOptions.length > 0 && (
              <Field label="Filtrer par matière">
                <Select value={filterMatAss} onChange={(e) => setFilterMatAss(e.target.value)}>
                  <option value="">Toutes</option>
                  {matiereOptions.map((m) => <option key={m} value={m}>{m}</option>)}
                </Select>
              </Field>
            )}
          </div>

          {!planningId ? (
            <Empty message="Sélectionnez un planning" />
          ) : loadingEp ? (
            <div className="flex justify-center py-12 text-black/30"><Spinner /></div>
          ) : epreuvesFiltrees.length === 0 ? (
            <Empty message="Aucune épreuve" />
          ) : (
            <div className="rounded-xl border bg-white shadow-sm overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-[#F5F5F5]">
                    {["Date", "Matière", "Horaire", "Candidat", "Planche assignée", ""].map((h) => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-black/50 tracking-wide">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {epreuvesFiltrees.map((ep) => (
                    <tr key={ep.id} className="border-t border-black/5 hover:bg-black/[0.012]">
                      <td className="px-4 py-3 text-xs text-black/50">{ep.date}</td>
                      <td className="px-4 py-3 font-medium">{ep.matiere}</td>
                      <td className="px-4 py-3 text-xs text-black/60">{hm(ep.heure_debut)} → {hm(ep.heure_fin)}</td>
                      <td className="px-4 py-3 text-sm">
                        {ep.candidat_nom
                          ? <span className="font-medium">{ep.candidat_nom} {ep.candidat_prenom}</span>
                          : <span className="text-black/30 italic">—</span>}
                      </td>
                      <td className="px-4 py-3">
                        {ep.planche_nom ? (
                          <div className="flex items-center gap-2">
                            <FileText className="h-3.5 w-3.5 text-blue-500 shrink-0" />
                            <span className="text-sm text-blue-700 font-medium">{ep.planche_nom}</span>
                          </div>
                        ) : (
                          <span className="text-xs text-black/30 italic">Non assignée</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex gap-1.5 justify-end">
                          <Btn
                            label={ep.planche_nom ? "Changer" : "Assigner"}
                            small
                            variant={ep.planche_nom ? "ghost" : "primary"}
                            icon={FileText}
                            onClick={() => setAssignModal(ep)}
                          />
                          {ep.planche_nom && (
                            <>
                              {ep.candidat_id && (
                                <a
                                  href={`/api/backend/planches/epreuves/${ep.id}/cartouche`}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="inline-flex items-center gap-1 text-xs text-green-700 bg-green-50 hover:bg-green-100 px-2 py-1 rounded transition font-medium"
                                >
                                  <Download className="h-3.5 w-3.5" />
                                  Cartouche
                                </a>
                              )}
                              <button
                                onClick={() => doDesassign(ep.id)}
                                className="inline-flex items-center gap-1 text-xs text-red-500 px-2 py-1 rounded hover:bg-red-50 transition"
                              >
                                <X className="h-3.5 w-3.5" />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Modale assignation */}
          <Modal open={!!assignModal} onClose={() => setAssignModal(null)} title={`Assigner une planche — ${assignModal?.matiere ?? ""}`} wide>
            {assignModal && (
              <div className="space-y-3">
                <p className="text-sm text-black/50">
                  Épreuve : <strong>{assignModal.matiere}</strong> · {assignModal.date} · {hm(assignModal.heure_debut)}
                  {assignModal.candidat_nom && <> · {assignModal.candidat_nom} {assignModal.candidat_prenom}</>}
                </p>
                {planchesForAssign.length === 0 ? (
                  <Empty
                    message="Aucune planche disponible pour cette matière"
                    sub="Assurez-vous d'avoir injecté des sujets actifs avec la matière correspondante."
                  />
                ) : (
                  <div className="rounded-xl border overflow-hidden">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-[#F5F5F5]">
                          {["Nom", "Auteur", ""].map((h) => (
                            <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold text-black/50">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {planchesForAssign.map((p) => (
                          <tr key={p.id} className={`border-t border-black/5 ${assignModal.planche_id === p.id ? "bg-blue-50" : "hover:bg-black/[0.012]"}`}>
                            <td className="px-4 py-2.5 font-medium">
                              <div className="flex items-center gap-2">
                                <FileText className="h-4 w-4 text-black/30 shrink-0" />
                                {p.nom}
                              </div>
                            </td>
                            <td className="px-4 py-2.5 text-black/50 text-xs">{p.examinateur_nom ?? "—"}</td>
                            <td className="px-4 py-2.5 text-right">
                              {assignModal.planche_id === p.id ? (
                                <span className="text-xs text-blue-600 font-medium">Actuelle</span>
                              ) : (
                                <Btn
                                  label="Assigner"
                                  small
                                  disabled={assigning}
                                  onClick={() => doAssign(assignModal.id, p.id)}
                                />
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </Modal>
        </div>
      )}

      {/* ── Onglet Impression ────────────────────────────────────────────────── */}
      {tab === "impression" && (
        <div className="space-y-5">
          {/* Filtres */}
          <div className="flex items-end gap-4 flex-wrap">
            <Field label="Planning">
              <Select
                value={impPlanningId}
                onChange={(e) => { setImpPlanningId(e.target.value === "" ? "" : Number(e.target.value)); setImpDate(""); setImpMatiere(""); }}
              >
                <option value="">— Sélectionner un planning</option>
                {plannings.map((p) => <option key={p.id} value={p.id}>{p.nom}</option>)}
              </Select>
            </Field>
            {impPlanningId !== "" && (
              <Field label="Date">
                <Input
                  type="date"
                  value={impDate}
                  onChange={(e) => setImpDate(e.target.value)}
                />
              </Field>
            )}
            {impEpreuves.length > 0 && (
              <Field label="Matière">
                <Select value={impMatiere} onChange={(e) => setImpMatiere(e.target.value)}>
                  <option value="">Toutes</option>
                  {Array.from(new Set(impEpreuves.map((e) => e.matiere))).sort().map((m) => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </Select>
              </Field>
            )}
          </div>

          {/* Résumé + action */}
          {impEpreuves.length > 0 && (
            <div className="flex items-center justify-between rounded-xl bg-blue-50 border border-blue-100 px-4 py-3">
              <div className="text-sm text-blue-800">
                <span className="font-semibold">{impSelected.size}</span> planche(s) sélectionnée(s) sur {impEpreuves.filter((e) => e.candidat_id && e.planche_id).length} disponible(s)
              </div>
              <Btn
                label={impDownloading ? "Génération…" : `Télécharger le ZIP (${impSelected.size})`}
                icon={impDownloading ? Loader2 : Download}
                disabled={impSelected.size === 0 || impDownloading}
                onClick={doDownloadBatch}
              />
            </div>
          )}

          {!impPlanningId || !impDate ? (
            <Empty message="Sélectionnez un planning et une date" />
          ) : impLoading ? (
            <div className="flex justify-center py-12 text-black/30"><Spinner /></div>
          ) : impEpreuves.length === 0 ? (
            <Empty
              message="Aucune planche assignée pour cette sélection"
              sub="Assurez-vous d'avoir assigné des planches aux épreuves dans l'onglet Assignation."
            />
          ) : (
            <div className="rounded-xl border bg-white shadow-sm overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-[#F5F5F5]">
                    <th className="px-4 py-3 w-10">
                      <input
                        type="checkbox"
                        checked={
                          impEpreuves.filter((e) => e.candidat_id && e.planche_id).length > 0 &&
                          impEpreuves.filter((e) => e.candidat_id && e.planche_id).every((e) => impSelected.has(e.id))
                        }
                        onChange={(ev) => {
                          const printable = impEpreuves.filter((e) => e.candidat_id && e.planche_id).map((e) => e.id);
                          setImpSelected(ev.target.checked ? new Set(printable) : new Set());
                        }}
                        className="rounded"
                      />
                    </th>
                    {["Matière", "Heure prépa", "Heure passage", "Candidat", "Planche", "Examinateur"].map((h) => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-black/50 tracking-wide">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {impEpreuves.map((ep) => {
                    const printable = !!(ep.candidat_id && ep.planche_id);
                    const checked = impSelected.has(ep.id);
                    // Heure préparation si preparation_minutes renseigné
                    let heurePrepa = "—";
                    if (ep.preparation_minutes && ep.heure_debut) {
                      const [h, m] = ep.heure_debut.split(":").map(Number);
                      const total = h * 60 + m - ep.preparation_minutes;
                      heurePrepa = `${String(Math.floor(total / 60)).padStart(2, "0")}h${String(total % 60).padStart(2, "0")}`;
                    }
                    return (
                      <tr
                        key={ep.id}
                        className={`border-t border-black/5 transition ${
                          !printable ? "opacity-40" : checked ? "bg-blue-50/50" : "hover:bg-black/[0.012]"
                        }`}
                      >
                        <td className="px-4 py-3">
                          <input
                            type="checkbox"
                            checked={checked}
                            disabled={!printable}
                            onChange={(ev) => {
                              const next = new Set(impSelected);
                              ev.target.checked ? next.add(ep.id) : next.delete(ep.id);
                              setImpSelected(next);
                            }}
                            className="rounded"
                          />
                        </td>
                        <td className="px-4 py-3 font-medium">{ep.matiere}</td>
                        <td className="px-4 py-3 text-sm text-black/60">{heurePrepa}</td>
                        <td className="px-4 py-3 text-sm text-black/60">{hm(ep.heure_debut)}</td>
                        <td className="px-4 py-3 text-sm">
                          {ep.candidat_nom
                            ? <span className="font-medium">{ep.candidat_nom} {ep.candidat_prenom}</span>
                            : <span className="text-black/30 italic">Non attribué</span>}
                        </td>
                        <td className="px-4 py-3">
                          {ep.planche_nom
                            ? <div className="flex items-center gap-1.5"><FileText className="h-3.5 w-3.5 text-blue-400 shrink-0" /><span className="text-sm">{ep.planche_nom}</span></div>
                            : <span className="text-black/30 italic text-xs">—</span>}
                        </td>
                        <td className="px-4 py-3 text-sm text-black/60">
                          {ep.examinateur_nom
                            ? `${ep.examinateur_prenom ?? ""} ${ep.examinateur_nom}`.trim()
                            : <span className="text-black/30 italic">—</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Gestion des salles ─────────────────────────────────────────────────────────
function SallesSection() {
  const toast = useToast();
  const confirm = useConfirm();
  const [plannings, setPlannings] = useState<Planning[]>([]);
  const [planningId, setPlanningId] = useState<number | "">("");
  const [salles, setSalles] = useState<Salle[]>([]);
  const [epreuves, setEpreuves] = useState<EpreuveFlat[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState<number | null>(null);
  const [newSalle, setNewSalle] = useState("");
  const [addingS, setAddingS] = useState(false);
  const [addErr, setAddErr] = useState("");
  const [filterMatiere, setFilterMatiere] = useState("");
  const [filterDate, setFilterDate] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkSalleId, setBulkSalleId] = useState<string>("");
  const [bulkSallePrepId, setBulkSallePrepId] = useState<string>("");
  // Salles par défaut
  type SalleDefaut = { matiere: string; salle_id: number | null; salle_preparation_id: number | null; surveillant_id: number | null };
  type SurveillantItem = { id: number; nom: string; prenom: string; actif: boolean };
  const [defaults, setDefaults] = useState<SalleDefaut[]>([]);
  const [savingDefaults, setSavingDefaults] = useState(false);
  const [surveillants, setSurveillants] = useState<SurveillantItem[]>([]);

  const reloadSalles = useCallback(() => {
    get<Salle[]>("parametrages/salles/").then(setSalles).catch(() => {});
  }, []);

  useEffect(() => {
    get<Planning[]>("plannings/").then(setPlannings).catch(() => {});
    reloadSalles();
  }, [reloadSalles]);

  useEffect(() => {
    if (!planningId) { setEpreuves([]); setDefaults([]); setSurveillants([]); return; }
    setLoading(true);
    Promise.all([
      get<EpreuveFlat[]>(`plannings/${planningId}/epreuves`),
      get<SalleDefaut[]>(`plannings/${planningId}/salle-defaults`),
      get<SurveillantItem[]>(`surveillants/?planning_id=${planningId}`),
    ])
      .then(([eps, defs, survs]) => { setEpreuves(eps); setDefaults(defs); setSurveillants(survs); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [planningId]);

  async function saveDefaults() {
    if (!planningId) return;
    setSavingDefaults(true);
    try {
      const saved = await put<SalleDefaut[]>(`plannings/${planningId}/salle-defaults`, defaults);
      setDefaults(saved);
      toast.success("Défauts enregistrés");
    } catch (e) { toast.error(e instanceof Error ? e.message : "Erreur"); }
    finally { setSavingDefaults(false); }
  }

  async function applyDefaults() {
    if (!planningId) return;
    setSavingDefaults(true);
    try {
      await put(`plannings/${planningId}/salle-defaults`, defaults);
      const r = await post<{ updated: number }>(`plannings/${planningId}/salle-defaults/apply`, {});
      toast.success(`${r.updated} épreuve(s) mise(s) à jour`);
      const eps = await get<EpreuveFlat[]>(`plannings/${planningId}/epreuves`);
      setEpreuves(eps);
    } catch (e) { toast.error(e instanceof Error ? e.message : "Erreur"); }
    finally { setSavingDefaults(false); }
  }

  async function assignSalleBulk(
    date: string,
    matiere: string,
    field: "salle_id" | "salle_preparation_id" | "surveillant_id",
    value: number | null
  ) {
    const targets = epreuves.filter((e) => e.date === date && e.matiere === matiere);
    setSaving(-1);
    try {
      await Promise.all(
        targets.map((e) => patch(`plannings/${planningId}/epreuves/${e.id}`, { [field]: value }))
      );
      setEpreuves((prev) =>
        prev.map((e) => {
          if (e.date !== date || e.matiere !== matiere) return e;
          if (field === "surveillant_id") {
            const surv = surveillants.find((s) => s.id === value) ?? null;
            return { ...e, surveillant_id: value, surveillant_nom: surv?.nom ?? null, surveillant_prenom: surv?.prenom ?? null };
          }
          const intituleField = field === "salle_id" ? "salle_intitule" : "salle_preparation_intitule";
          const salle = salles.find((s) => s.id === value) ?? null;
          return { ...e, [field]: value, [intituleField]: salle?.intitule ?? null };
        })
      );
    } finally {
      setSaving(null);
    }
  }

  async function createSalle() {
    if (!newSalle.trim()) return;
    setAddingS(true); setAddErr("");
    try {
      const s = await post<Salle>("parametrages/salles/", { intitule: newSalle.trim(), active: true });
      setSalles((prev) => [...prev, s].sort((a, b) => a.intitule.localeCompare(b.intitule)));
      setNewSalle("");
    } catch (e: unknown) {
      setAddErr(e instanceof Error ? e.message : "Erreur");
    } finally {
      setAddingS(false);
    }
  }

  async function toggleSalle(s: Salle) {
    await patch(`parametrages/salles/${s.id}`, { active: !s.active });
    setSalles((prev) => prev.map((x) => (x.id === s.id ? { ...x, active: !x.active } : x)));
  }

  async function deleteSalle(id: number) {
    if (!await confirm("Supprimer cette salle ?", { confirmLabel: "Supprimer", danger: true })) return;
    await del(`parametrages/salles/${id}`);
    toast.success("Salle supprimée");
    setSalles((prev) => prev.filter((s) => s.id !== id));
  }

  async function applyBulkSelection() {
    if (selected.size === 0) return;
    setSaving(-1);
    try {
      await Promise.all(
        Array.from(selected).flatMap((key) => {
          const [date, matiere] = key.split("||");
          const targets = epreuves.filter((e) => e.date === date && e.matiere === matiere);
          return targets.flatMap((e) => {
            const calls = [];
            if (bulkSalleId !== "") calls.push(patch(`plannings/${planningId}/epreuves/${e.id}`, { salle_id: bulkSalleId ? Number(bulkSalleId) : null }));
            if (bulkSallePrepId !== "") calls.push(patch(`plannings/${planningId}/epreuves/${e.id}`, { salle_preparation_id: bulkSallePrepId ? Number(bulkSallePrepId) : null }));
            return calls;
          });
        })
      );
      setEpreuves((prev) =>
        prev.map((e) => {
          const key = `${e.date}||${e.matiere}`;
          if (!selected.has(key)) return e;
          const updates: Partial<EpreuveFlat> = {};
          if (bulkSalleId !== "") {
            updates.salle_id = bulkSalleId ? Number(bulkSalleId) : null;
            updates.salle_intitule = salles.find((s) => s.id === Number(bulkSalleId))?.intitule ?? null;
          }
          if (bulkSallePrepId !== "") {
            updates.salle_preparation_id = bulkSallePrepId ? Number(bulkSallePrepId) : null;
            updates.salle_preparation_intitule = salles.find((s) => s.id === Number(bulkSallePrepId))?.intitule ?? null;
          }
          return { ...e, ...updates };
        })
      );
      setSelected(new Set());
      setBulkSalleId("");
      setBulkSallePrepId("");
      toast.success(`Salle affectée à ${selected.size} groupe(s)`);
    } finally {
      setSaving(null);
    }
  }

  const matieres = Array.from(new Set(epreuves.map((e) => e.matiere))).sort();
  const filtered = epreuves
    .filter((e) => !filterMatiere || e.matiere === filterMatiere)
    .filter((e) => !filterDate || e.date === filterDate);

  // Grouper par (date, matière)
  type GroupKey = { date: string; matiere: string };
  const groupMap = filtered.reduce<Record<string, EpreuveFlat[]>>((acc, e) => {
    const k = `${e.date}||${e.matiere}`;
    (acc[k] ??= []).push(e);
    return acc;
  }, {});
  const groups: (GroupKey & { epreuves: EpreuveFlat[] })[] = Object.entries(groupMap)
    .map(([k, eps]) => {
      const [date, matiere] = k.split("||");
      return { date, matiere, epreuves: eps };
    })
    .sort((a, b) => a.date.localeCompare(b.date) || a.matiere.localeCompare(b.matiere));

  const dates = Array.from(new Set(groups.map((g) => g.date))).sort();

  const activeSalles = salles.filter((s) => s.active);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="h-9 w-9 rounded-xl grid place-items-center text-white" style={{ backgroundColor: RED }}>
          <Building2 className="h-5 w-5" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-black/90">Gestion des salles</h2>
          <p className="text-xs text-black/40">Affectez une salle d'examen et une salle de préparation à chaque créneau</p>
        </div>
      </div>

      <div className="flex gap-5 items-start">
        {/* Panneau salles */}
        <div className="w-64 shrink-0 bg-white rounded-2xl border border-black/5 shadow-sm p-4 space-y-3">
          <p className="text-xs font-semibold text-black/40 uppercase tracking-wide">Salles disponibles</p>

          {/* Ajouter une salle */}
          <div className="flex gap-1.5">
            <input
              type="text"
              value={newSalle}
              onChange={(e) => setNewSalle(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && createSalle()}
              placeholder="ex : 2042"
              className="flex-1 border rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-black/15"
            />
            <button
              onClick={createSalle}
              disabled={addingS || !newSalle.trim()}
              className="px-2.5 py-1.5 rounded-lg text-white text-sm font-medium disabled:opacity-40"
              style={{ backgroundColor: RED }}
            >
              {addingS ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            </button>
          </div>
          {addErr && <p className="text-xs text-red-500">{addErr}</p>}

          {/* Liste */}
          <div className="divide-y divide-black/5 rounded-xl border border-black/8 overflow-hidden">
            {salles.length === 0 && (
              <p className="text-sm text-black/30 text-center py-4">Aucune salle</p>
            )}
            {salles.map((s) => (
              <div key={s.id} className="flex items-center gap-2 px-3 py-2 bg-white hover:bg-black/[0.01]">
                <button
                  onClick={() => toggleSalle(s)}
                  title={s.active ? "Désactiver" : "Activer"}
                  className={`h-4 w-4 rounded border flex-shrink-0 transition ${s.active ? "bg-emerald-500 border-emerald-500" : "border-black/20"}`}
                >
                  {s.active && <CheckCircle2 className="h-3 w-3 text-white m-auto" />}
                </button>
                <span className={`flex-1 text-sm font-mono ${s.active ? "text-black/80" : "text-black/30 line-through"}`}>
                  {s.intitule}
                </span>
                <button
                  onClick={() => deleteSalle(s.id)}
                  className="p-1 rounded text-red-300 hover:text-red-500 hover:bg-red-50 transition"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
          <p className="text-[11px] text-black/30">
            {activeSalles.length} salle(s) active(s) · Cochez pour activer/désactiver
          </p>
        </div>

        {/* Panneau épreuves */}
        <div className="flex-1 min-w-0 space-y-4">

          {/* Salles par défaut */}
          {planningId !== "" && (
            <div className="bg-white rounded-2xl border border-black/5 shadow-sm p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-black/50 uppercase tracking-wide">Salles par défaut par matière</p>
                  <p className="text-[11px] text-black/30 mt-0.5">Appliquées automatiquement à la génération et à l'ajout de créneau</p>
                </div>
                <button onClick={applyDefaults} disabled={savingDefaults} className="text-xs px-3 py-1.5 rounded-lg text-white font-medium hover:opacity-90 transition disabled:opacity-40 flex items-center gap-1.5" style={{ backgroundColor: RED }}>
                  {savingDefaults && <Loader2 className="h-3 w-3 animate-spin" />}
                  Appliquer à toutes les épreuves
                </button>
              </div>
              {matieres.length === 0 ? (
                <p className="text-xs text-black/30">Aucune matière trouvée pour ce planning.</p>
              ) : (
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-black/5">
                      <th className="text-left py-1.5 text-black/40 font-medium w-36">Matière</th>
                      <th className="text-left py-1.5 text-black/60 font-semibold">Salle d'examen</th>
                      <th className="text-left py-1.5 text-black/40 font-medium">Salle de préparation</th>
                      <th className="text-left py-1.5 text-black/40 font-medium">Surveillant</th>
                    </tr>
                  </thead>
                  <tbody>
                    {matieres.map((m) => {
                      const d = defaults.find((x) => x.matiere === m);
                      const setD = (patch: Partial<SalleDefaut>) =>
                        setDefaults((prev) => {
                          const next = prev.filter((x) => x.matiere !== m);
                          return [...next, { matiere: m, salle_id: d?.salle_id ?? null, salle_preparation_id: d?.salle_preparation_id ?? null, surveillant_id: d?.surveillant_id ?? null, ...patch }];
                        });
                      return (
                        <tr key={m} className="border-b border-black/[0.04] last:border-0">
                          <td className="py-2 font-medium text-black/70">{m}</td>
                          <td className="py-2 pr-3">
                            <select
                              value={d?.salle_id ?? ""}
                              onChange={(e) => setD({ salle_id: e.target.value ? Number(e.target.value) : null })}
                              className="border rounded-lg px-2 py-1 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-black/15 min-w-[120px]"
                            >
                              <option value="">— Aucune —</option>
                              {activeSalles.map((s) => <option key={s.id} value={s.id}>{s.intitule}</option>)}
                            </select>
                          </td>
                          <td className="py-2 pr-3">
                            <select
                              value={d?.salle_preparation_id ?? ""}
                              onChange={(e) => setD({ salle_preparation_id: e.target.value ? Number(e.target.value) : null })}
                              className="border rounded-lg px-2 py-1 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-black/15 min-w-[120px]"
                            >
                              <option value="">— Aucune —</option>
                              {activeSalles.map((s) => <option key={s.id} value={s.id}>{s.intitule}</option>)}
                            </select>
                          </td>
                          <td className="py-2">
                            <select
                              value={d?.surveillant_id ?? ""}
                              onChange={(e) => setD({ surveillant_id: e.target.value ? Number(e.target.value) : null })}
                              className="border rounded-lg px-2 py-1 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-black/15 min-w-[140px]"
                            >
                              <option value="">— Aucun —</option>
                              {surveillants.filter((s) => s.actif).map((s) => (
                                <option key={s.id} value={s.id}>{s.nom} {s.prenom}</option>
                              ))}
                            </select>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {/* Sélection planning + filtre matière */}
          <div className="bg-white rounded-2xl border border-black/5 shadow-sm p-4 flex gap-3 flex-wrap">
            <div className="flex-1 min-w-[180px]">
              <label className="text-xs text-black/40 mb-1 block">Planning</label>
              <select
                value={planningId}
                onChange={(e) => setPlanningId(e.target.value ? Number(e.target.value) : "")}
                className="w-full border rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-black/15"
              >
                <option value="">— Choisir un planning —</option>
                {plannings.map((p) => (
                  <option key={p.id} value={p.id}>{p.nom}</option>
                ))}
              </select>
            </div>
            {matieres.length > 0 && (
              <div className="flex-1 min-w-[140px]">
                <label className="text-xs text-black/40 mb-1 block">Filtrer par matière</label>
                <select
                  value={filterMatiere}
                  onChange={(e) => setFilterMatiere(e.target.value)}
                  className="w-full border rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-black/15"
                >
                  <option value="">Toutes</option>
                  {matieres.map((m) => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
            )}
            {dates.length > 0 && (
              <div className="flex-1 min-w-[160px]">
                <label className="text-xs text-black/40 mb-1 block">Filtrer par journée</label>
                <select
                  value={filterDate}
                  onChange={(e) => setFilterDate(e.target.value)}
                  className="w-full border rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-black/15"
                >
                  <option value="">Toutes</option>
                  {Array.from(new Set(epreuves.map((e) => e.date))).sort().map((d) => (
                    <option key={d} value={d}>
                      {new Date(d + "T12:00:00").toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" })}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Barre de sélection groupée */}
          {selected.size > 0 && (
            <div className="bg-white rounded-2xl border border-black/5 shadow-sm px-4 py-3 flex items-center gap-3 flex-wrap">
              <span className="text-xs font-semibold text-black/60">{selected.size} groupe(s) sélectionné(s)</span>
              <select
                value={bulkSalleId}
                onChange={(e) => setBulkSalleId(e.target.value)}
                className="border rounded-lg px-2 py-1.5 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-black/15"
              >
                <option value="">— Salle d'examen —</option>
                <option value="null">Aucune</option>
                {activeSalles.map((s) => <option key={s.id} value={s.id}>{s.intitule}</option>)}
              </select>
              <select
                value={bulkSallePrepId}
                onChange={(e) => setBulkSallePrepId(e.target.value)}
                className="border rounded-lg px-2 py-1.5 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-black/15"
              >
                <option value="">— Salle de préparation —</option>
                <option value="null">Aucune</option>
                {activeSalles.map((s) => <option key={s.id} value={s.id}>{s.intitule}</option>)}
              </select>
              <button
                onClick={applyBulkSelection}
                disabled={saving === -1 || (bulkSalleId === "" && bulkSallePrepId === "")}
                className="px-3 py-1.5 rounded-lg text-xs text-white font-medium disabled:opacity-40 transition"
                style={{ backgroundColor: RED }}
              >
                Appliquer
              </button>
              <button onClick={() => setSelected(new Set())} className="text-xs text-black/40 hover:text-black/60 transition ml-auto">
                Annuler
              </button>
            </div>
          )}

          {/* Modifications ponctuelles */}
          {planningId !== "" && dates.length > 0 && (
            <div className="flex items-center gap-2 pt-1">
              <p className="text-xs font-semibold text-black/40 uppercase tracking-wide">Modifications ponctuelles</p>
              <div className="flex-1 h-px bg-black/[0.06]" />
            </div>
          )}

          {/* Tableau */}
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="h-6 w-6 animate-spin text-black/20" />
            </div>
          ) : !planningId ? (
            <div className="bg-white rounded-2xl border border-black/5 shadow-sm p-12 text-center">
              <Building2 className="h-10 w-10 mx-auto mb-3 text-black/10" />
              <p className="text-sm text-black/40">Sélectionnez un planning pour affecter les salles</p>
            </div>
          ) : dates.length === 0 ? (
            <div className="bg-white rounded-2xl border border-black/5 shadow-sm p-12 text-center">
              <p className="text-sm text-black/30">Aucun créneau trouvé pour ce planning.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {dates.map((date) => {
                const dayGroups = groups.filter((g) => g.date === date);
                return (
                  <div key={date} className="bg-white rounded-2xl border border-black/5 shadow-sm overflow-hidden">
                    <div className="px-4 py-2.5 bg-black/[0.02] border-b border-black/5">
                      <span className="text-xs font-semibold text-black/50">
                        {new Date(date + "T12:00:00").toLocaleDateString("fr-FR", {
                          weekday: "long", day: "numeric", month: "long",
                        })}
                      </span>
                    </div>
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-black/5">
                          <th className="px-4 py-2 w-8">
                            <input
                              type="checkbox"
                              checked={dayGroups.every((g) => selected.has(`${g.date}||${g.matiere}`))}
                              onChange={(e) => {
                                setSelected((prev) => {
                                  const next = new Set(prev);
                                  dayGroups.forEach((g) => {
                                    const k = `${g.date}||${g.matiere}`;
                                    e.target.checked ? next.add(k) : next.delete(k);
                                  });
                                  return next;
                                });
                              }}
                              className="cursor-pointer"
                            />
                          </th>
                          <th className="text-left px-4 py-2 text-black/40 font-medium w-36">Matière</th>
                          <th className="text-left px-4 py-2 text-black/40 font-medium w-20">Créneaux</th>
                          <th className="text-left px-4 py-2 text-black/60 font-semibold">Salle d'examen</th>
                          <th className="text-left px-4 py-2 text-black/40 font-medium">Salle de préparation</th>
                          <th className="text-left px-4 py-2 text-black/40 font-medium">Surveillant</th>
                        </tr>
                      </thead>
                      <tbody>
                        {dayGroups.map((g) => {
                          const key = `${g.date}||${g.matiere}`;
                          const isSelected = selected.has(key);
                          const salleId = g.epreuves[0]?.salle_id ?? null;
                          const sallesPrepId = g.epreuves[0]?.salle_preparation_id ?? null;
                          const surveillantId = g.epreuves[0]?.surveillant_id ?? null;
                          return (
                            <tr key={g.matiere} className={`border-b border-black/[0.04] last:border-0 ${isSelected ? "bg-amber-50/60" : "hover:bg-black/[0.01]"}`}>
                              <td className="px-4 py-2.5">
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={(e) => {
                                    setSelected((prev) => {
                                      const next = new Set(prev);
                                      e.target.checked ? next.add(key) : next.delete(key);
                                      return next;
                                    });
                                  }}
                                  className="cursor-pointer"
                                />
                              </td>
                              <td className="px-4 py-2.5 font-medium text-black/70">{g.matiere}</td>
                              <td className="px-4 py-2.5 text-black/40">{g.epreuves.length}</td>
                              <td className="px-4 py-2.5">
                                <select
                                  value={salleId ?? ""}
                                  onChange={(ev) => assignSalleBulk(g.date, g.matiere, "salle_id", ev.target.value ? Number(ev.target.value) : null)}
                                  disabled={saving === -1}
                                  className="border rounded-lg px-2 py-1 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-black/15 min-w-[120px]"
                                >
                                  <option value="">— Aucune —</option>
                                  {activeSalles.map((s) => (
                                    <option key={s.id} value={s.id}>{s.intitule}</option>
                                  ))}
                                </select>
                              </td>
                              <td className="px-4 py-2.5">
                                <select
                                  value={sallesPrepId ?? ""}
                                  onChange={(ev) => assignSalleBulk(g.date, g.matiere, "salle_preparation_id", ev.target.value ? Number(ev.target.value) : null)}
                                  disabled={saving === -1}
                                  className="border rounded-lg px-2 py-1 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-black/15 min-w-[120px]"
                                >
                                  <option value="">— Aucune —</option>
                                  {activeSalles.map((s) => (
                                    <option key={s.id} value={s.id}>{s.intitule}</option>
                                  ))}
                                </select>
                              </td>
                              <td className="px-4 py-2.5">
                                <select
                                  value={surveillantId ?? ""}
                                  onChange={(ev) => assignSalleBulk(g.date, g.matiere, "surveillant_id", ev.target.value ? Number(ev.target.value) : null)}
                                  disabled={saving === -1}
                                  className="border rounded-lg px-2 py-1 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-black/15 min-w-[140px]"
                                >
                                  <option value="">— Aucun —</option>
                                  {surveillants.filter((s) => s.actif).map((s) => (
                                    <option key={s.id} value={s.id}>{s.nom} {s.prenom}</option>
                                  ))}
                                </select>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
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
    <ToastProvider>
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
            {section === "surveillants" && <SurveillantsSection />}
            {section === "dashboard" && <DashboardSection />}
            {section === "conflits" && <ConflitsSection />}
            {section === "planches" && <PlanchesSection />}
            {section === "salles" && <SallesSection />}
            {section === "notes" && <NotesSection />}
            {section === "parametrages" && <ParametragesSection />}
          </div>
        </main>
      </div>
    </div>
    </ToastProvider>
  );
}
