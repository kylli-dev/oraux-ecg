"use client";

// Partagé par les sections de l'espace admin : types, appels à l'API (get, post…),
// composants d'interface (Btn, Modal, Spinner…), planning actif, filtres retenus et
// intentions de navigation entre écrans (liens « il manque… », recherche globale).

import React, { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { useToast, useConfirm } from "../Toast";
import {
  Trash2,
  X,
  Loader2,
  Wand2,
  Download,
  Upload,
  Edit2,
  AlertTriangle,
} from "lucide-react";

// ── Constants ──────────────────────────────────────────────────────────────────
export const RED = "#C62828";


// ── Types ──────────────────────────────────────────────────────────────────────
export type Planning = {
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

export type JourneeType = {
  id: number;
  nom: string;
  duree_defaut_minutes: number;
  pause_defaut_minutes: number;
  preparation_defaut_minutes: number;
  statut_initial: string;
};

export type Epreuve = {
  id: number;
  matiere: string;
  heure_debut: string;
  heure_fin: string;
  statut: string;
  preparation_minutes?: number | null;
  candidat_id?: number | null;
  candidat_nom?: string | null;
  candidat_prenom?: string | null;
  salle_intitule?: string | null;
  salle_preparation_intitule?: string | null;
};

export type DemiJournee = {
  id: number;
  type: string;
  heure_debut: string;
  heure_fin: string;
  epreuves: Epreuve[];
  journee_type_nom?: string | null;
  gabarit_applique_le?: string | null;
};

export type DayViewData = {
  planning_id: number;
  date: string;
  demi_journees: DemiJournee[];
};

export type EpreuveFlat = {
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
  hors_inscription?: boolean; // candidat attribué sans inscription (absent de sa fiche)
  examinateur_id: number | null;
  examinateur_nom: string | null;
  examinateur_prenom: string | null;
  examinateur2_id: number | null;
  examinateur2_nom: string | null;
  examinateur2_prenom: string | null;
  salle_id: number | null;
  salle_intitule: string | null;
  salle_verifiee: boolean;
  salle_preparation_id: number | null;
  salle_preparation_intitule: string | null;
  surveillant_id: number | null;
  surveillant_nom: string | null;
  surveillant_prenom: string | null;
  surveillant2_id: number | null;
  surveillant2_nom: string | null;
  surveillant2_prenom: string | null;
  planche_id: number | null;
  planche_nom: string | null;
  // Triplet de la matrice de la journée type (« T5 »), null si journée sans matrice
  triplet?: string | null;
};

export type Examinateur = {
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

export type EtablissementItem = {
  id: number;
  code_uai: string;
  nom: string;
  ville: string | null;
  departement: string | null;
};

export type SectionKey = "plannings" | "publication" | "journeeTypes" | "candidats" | "examinateurs" | "surveillants" | "dashboard" | "conflits" | "parametrages" | "notes" | "salles" | "planches" | "monitoring";

export type TripletEpreuveGestion = {
  id: number;
  matiere: string;
  heure_debut: string;
  heure_fin: string;
  statut?: string;
  preparation_minutes?: number | null;
};

// Début de la préparation (heure de l'oral moins la préparation), « HH:MM »
export function debutPrepa(e: { heure_debut: string; preparation_minutes?: number | null }): string {
  if (!e.preparation_minutes || !e.heure_debut) return e.heure_debut;
  const [h, m] = e.heure_debut.split(":").map(Number);
  const t = h * 60 + m - e.preparation_minutes;
  return `${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`;
}

// « 10:30 – 11:30 » préparation comprise
export const plageAvecPrepa = (e: { heure_debut: string; heure_fin: string; preparation_minutes?: number | null }) =>
  `${debutPrepa(e)} – ${e.heure_fin}`;

// Info-bulle détaillant préparation et oral
export const detailPrepa = (e: { heure_debut: string; heure_fin: string; preparation_minutes?: number | null }) =>
  e.preparation_minutes
    ? `Préparation ${debutPrepa(e)} – ${e.heure_debut} (${e.preparation_minutes} min), oral ${e.heure_debut} – ${e.heure_fin}`
    : `Oral ${e.heure_debut} – ${e.heure_fin} (sans préparation)`;

export type TripletDisponible = {
  date: string;
  heure_debut: string;
  epreuves: TripletEpreuveGestion[];
  type_slot: "LIBRE" | "PRERESERVEE" | "ATTRIBUEE" | "INCOMPLET" | "INDISPONIBLE";
  candidat_id?: number | null;
  candidat_nom?: string | null;
  candidat_prenom?: string | null;
  motif?: string | null;
  details?: string[];
  cle?: string | null;
  // Numéro du triplet dans la matrice de la journée type (T5 → 5), absent en rotation
  numero?: number | null;
  // Libre mais invisible des candidats (salle, examinateur, surveillant ou planche manquant)
  manques_publication?: string[];
};

// Ce qui manque à une épreuve LIBRE pour être proposée aux candidats — même règle que
// backend/app/services/publication.py (salle, examinateur 1 ou 2, surveillant 1 ou 2, planche)
export function manquesPublication(e: {
  statut?: string; salle_id?: number | null;
  examinateur_id?: number | null; examinateur2_id?: number | null;
  surveillant_id?: number | null; surveillant2_id?: number | null;
  planche_id?: number | null;
}): string[] {
  if (e.statut !== "LIBRE") return [];
  const manques: string[] = [];
  if (!e.salle_id) manques.push("salle");
  if (!e.examinateur_id && !e.examinateur2_id) manques.push("examinateur");
  if (!e.surveillant_id && !e.surveillant2_id) manques.push("surveillant");
  if (!e.planche_id) manques.push("planche");
  return manques;
}

// ── Planning actif, partagé entre les sections ──
// Le dernier planning choisi (dans n'importe quelle section, ou ouvert dans Planning) est
// retenu : chaque section s'ouvre dessus au lieu de redemander le choix.
const CLE_PLANNING_ACTIF = "admin_planning_actif";
export function planningMemorise(ps: { id: number }[]): number | null {
  try {
    const id = Number(localStorage.getItem(CLE_PLANNING_ACTIF));
    return id && ps.some((p) => p.id === id) ? id : null;
  } catch { return null; }
}
export function memoriserPlanning(id: number | string | null | undefined) {
  if (!id) return;
  try { localStorage.setItem(CLE_PLANNING_ACTIF, String(id)); } catch {}
}

// ── Filtres retenus entre les sections ──
// Un filtre déclaré avec useFiltre garde sa valeur quand on change de section et qu'on
// revient (sessionStorage : le temps de l'onglet du navigateur). `pid` : planning auquel le
// filtre se rapporte (jour, heure… n'ont de sens que pour lui) — undefined pour un filtre
// indépendant du planning (recherche, onglet…). `force` : valeur imposée (lien « il
// manque… », recherche globale), qui remplace la valeur retenue.
function planningActifMemorise(): number | null {
  try { return Number(localStorage.getItem(CLE_PLANNING_ACTIF)) || null; } catch { return null; }
}
export function useFiltre<T>(nom: string, initial: T, pid?: number | string | null, force = false): [T, React.Dispatch<React.SetStateAction<T>>] {
  const lie = pid !== undefined;
  const [valeur, setValeur] = useState<T>(() => {
    if (force) return initial;
    try {
      const p = lie ? (pid || planningActifMemorise()) : "-";
      const brut = p ? sessionStorage.getItem(`filtre:${nom}:${p}`) : null;
      return brut != null ? (JSON.parse(brut) as T) : initial;
    } catch { return initial; }
  });
  useEffect(() => {
    const p = lie ? pid : "-";
    if (!p) return; // planning pas encore chargé
    try { sessionStorage.setItem(`filtre:${nom}:${p}`, JSON.stringify(valeur)); } catch {}
  }, [nom, valeur, lie, pid]);
  return [valeur, setValeur];
}

// ── Ouverture de Candidats depuis une notification ou la recherche globale ──
// Planning, onglet et candidat à présélectionner, lus par CandidatsSection à son montage
// (recherche : texte du champ de recherche de la liste).
type IntentionCandidats = { planningId: number; tab: "liste_attente" | "liste"; candidatId: number | null; recherche?: string };
// Intentions de navigation : écrites par l'écran de départ, lues (puis effacées) par l'écran
// ouvert. Rangées dans un objet partagé, qu'on peut modifier depuis n'importe quel fichier.
// examinateur : fiche à ouvrir (recherche globale) ; surveillant : nom à retrouver dans
// l'annuaire ; affectation : voir « Liens vers l'affectation manquante » plus bas.
export const intentions: {
  candidats: IntentionCandidats | null;
  examinateur: { id: number; nom: string } | null;
  surveillant: { nom: string } | null;
  affectation: IntentionAffectation | null;
} = { candidats: null, examinateur: null, surveillant: null, affectation: null };

// ── Liens vers l'affectation manquante ──
// Un clic sur « salle », « examinateur » ou « surveillant » ouvre l'écran d'affectation
// correspondant (Salles — aussi pour les surveillants —, Examinateurs > Affectation,
// Planches > Assignation), déjà filtré
// sur le planning, le jour, la matière et l'heure du créneau, et sur les créneaux sans
// cette affectation. L'intention est gardée ici le temps que l'écran cible la lise.
export type AffectationManquante = "salle" | "examinateur" | "surveillant" | "planche";
export type IntentionAffectation = {
  manque: AffectationManquante;
  planningId: number;
  date?: string;
  matiere?: string;
  heure?: string;
};
const lireIntention = (manque: AffectationManquante) =>
  intentions.affectation?.manque === manque ? intentions.affectation : null;
export const NavAffectationContext = React.createContext<(i: IntentionAffectation) => void>(() => {});

export const ECRAN_AFFECTATION: Record<AffectationManquante, string> = {
  salle: "Salles & surveillants",
  examinateur: "Examinateurs > Affectation",
  surveillant: "Salles & surveillants",
  planche: "Planches > Assignation",
};

// L'écran cible lit l'intention à son montage, puis l'efface
export function useIntentionAffectation(manque: AffectationManquante) {
  const [intention] = useState(() => lireIntention(manque));
  useEffect(() => { if (intention) intentions.affectation = null; }, [intention]);
  return intention;
}

function LienAffectation({ manque, ...creneau }: IntentionAffectation) {
  const aller = React.useContext(NavAffectationContext);
  return (
    <button
      type="button"
      onClick={(ev) => { ev.stopPropagation(); aller({ manque, ...creneau }); }}
      title={`Affecter : ouvre l'écran ${ECRAN_AFFECTATION[manque]}, filtré sur ce créneau`}
      className="font-semibold underline decoration-dotted underline-offset-2 hover:decoration-solid"
    >
      {manque}
    </button>
  );
}

// Liens séparés par des virgules : « manque salle, surveillant »
export function LiensManques({ manques, ...creneau }: { manques: string[] } & Omit<IntentionAffectation, "manque">) {
  return (
    <>
      {manques.map((m, i) => (
        <React.Fragment key={m}>
          {i > 0 && ", "}
          <LienAffectation manque={m as AffectationManquante} {...creneau} />
        </React.Fragment>
      ))}
    </>
  );
}

// « Maths 15:30 : examinateur, surveillant » (manques_publication du serveur) → éléments
function lireManque(ligne: string): { matiere: string; heure: string; manques: string[] } | null {
  const m = /^(.*) (\d{2}:\d{2}) : (.*)$/.exec(ligne);
  return m ? { matiere: m[1], heure: m[2], manques: m[3].split(", ") } : null;
}

// Une ligne de manque d'un triplet, avec liens : « Maths 15:30 : examinateur, surveillant »
export function LigneManque({ ligne, planningId, date }: { ligne: string; planningId: number; date: string }) {
  const m = lireManque(ligne);
  if (!m) return <>{ligne}</>;
  return (
    <>
      {m.matiere} {m.heure} : <LiensManques manques={m.manques} planningId={planningId} date={date} matiere={m.matiere} heure={m.heure} />
    </>
  );
}

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
// Le backend (Render, plan Free) se met en veille après 15 min d'inactivité et met
// 30-60s à se réveiller. Le proxy /api/backend renvoie alors {code: "backend_waking_up"}
// (503) au lieu de laisser Vercel couper brutalement : on réessaie automatiquement
// en affichant une bannière, plutôt que de faire échouer l'action immédiatement.
//
// En production, on réessaie toutes les quelques secondes pendant WAKE_WINDOW_MS (2 min),
// ce qui couvre le réveil normal (30-60 s ; chaque essai attend déjà jusqu'à 8 s côté
// proxy). Avant, 3 essais seulement (~30 s) faisaient souvent basculer sur l'attente de
// 5 min alors que le serveur était sur le point de répondre. Au-delà de la fenêtre, c'est
// traité comme une vraie erreur de connexion (bannière dédiée) avec une dernière
// tentative 5 min plus tard. En développement, 3 tentatives suffisent : pas de veille
// Render à attendre en local.
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const FAST_ATTEMPTS = 3;
const WAKE_WINDOW_MS = 2 * 60 * 1000;
const LONG_RETRY_DELAY_MS = 5 * 60 * 1000;

function notifyBackendWaking() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event("backend-waking"));
}
function notifyBackendAwake() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event("backend-awake"));
}
function notifyBackendConnectionError(retryInMs: number | null) {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("backend-connection-error", { detail: { retryInMs } }));
  }
}

async function apiCall<T = unknown>(
  method: string,
  path: string,
  body?: unknown
): Promise<T> {
  const isProd = process.env.NEXT_PUBLIC_ENV === "production";
  const debut = Date.now();
  let longRetryFait = false;

  for (let attempt = 1; ; attempt++) {
    const res = await fetch(`/api/backend/${path}`, {
      method,
      headers: body ? { "Content-Type": "application/json" } : {},
      body: body ? JSON.stringify(body) : undefined,
      cache: "no-store",
    });
    if (res.status === 204) { notifyBackendAwake(); return null as T; }
    const text = await res.text();
    let data: any;
    try { data = JSON.parse(text); } catch { data = { detail: text || `Erreur ${res.status}` }; }

    if (res.status === 503 && data?.code === "backend_waking_up") {
      if (attempt < FAST_ATTEMPTS || (isProd && Date.now() - debut < WAKE_WINDOW_MS)) {
        notifyBackendWaking();
        await sleep(Math.min(attempt * 2500, 4000));
        continue;
      }
      if (isProd && !longRetryFait) {
        // Toujours en échec après la fenêtre de réveil : bannière "erreur de connexion"
        // et une dernière tentative 5 min plus tard.
        longRetryFait = true;
        notifyBackendConnectionError(LONG_RETRY_DELAY_MS);
        await sleep(LONG_RETRY_DELAY_MS);
        continue;
      }
      break;
    }

    if (!res.ok) {
      notifyBackendAwake();
      const detail = data.detail;
      const msg = Array.isArray(detail)
        ? detail.map((e: any) => `${e.loc?.slice(-1)[0] ?? ""}: ${e.msg}`).join(" | ")
        : (detail ?? JSON.stringify(data));
      throw new Error(msg);
    }
    notifyBackendAwake();
    return data;
  }
  notifyBackendConnectionError(null);
  throw new Error(
    isProd
      ? "Le serveur reste injoignable après plusieurs tentatives, y compris un nouvel essai après 5 minutes. Réessayez plus tard ou contactez l'équipe technique."
      : "Le serveur ne répond pas. Vérifiez qu'il est bien lancé en local."
  );
}

export const get = <T,>(p: string) => apiCall<T>("GET", p);
export const post = <T,>(p: string, b: unknown) => apiCall<T>("POST", p, b);
export const put = <T,>(p: string, b: unknown) => apiCall<T>("PUT", p, b);
export const patch = <T,>(p: string, b: unknown) => apiCall<T>("PATCH", p, b);
export const del = (p: string) => apiCall("DELETE", p);

// ── Utilities ──────────────────────────────────────────────────────────────────
export function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + "T12:00:00");
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function enumerateDates(start: string, end: string): string[] {
  const dates: string[] = [];
  let d = start;
  while (d <= end) {
    dates.push(d);
    d = addDays(d, 1);
  }
  return dates;
}

// "2026-09-17" → "17-09-2026" (jj-mm-aaaa), pour les colonnes de tableau.
export function formatDateCourte(dateStr: string | null | undefined): string {
  if (!dateStr) return "";
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(dateStr);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : dateStr;
}

export function formatDate(dateStr: string): string {
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

export function hm(t: string) {
  return t?.slice(0, 5) ?? "";
}

export function Spinner() {
  return <Loader2 className="h-4 w-4 animate-spin inline" />;
}

export function Modal({
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
export function ImportExcelModal({
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
          <p className="text-sm text-gray-700">Télécharger le modèle Excel</p>
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
                  <p className="text-xs text-gray-700 mt-1">{(file.size / 1024).toFixed(1)} Ko — cliquer pour changer</p>
                </div>
              ) : (
                <div>
                  <Upload className="h-8 w-8 mx-auto mb-2 text-gray-700" />
                  <p className="text-sm text-gray-700">Cliquer pour sélectionner un fichier Excel</p>
                  <p className="text-xs text-gray-700 mt-1">.xlsx uniquement</p>
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
            <button onClick={handleClose} className="text-sm text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-100 transition">
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

export function Btn({
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
    ghost: `text-gray-800 hover:bg-black/5`,
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

export function Field({
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
      <label className="block text-xs font-medium text-gray-800 uppercase tracking-wide">{label}</label>
      {hint && <p className="text-[10px] text-gray-700 -mt-0.5">{hint}</p>}
      {children}
    </div>
  );
}

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className="w-full px-3 py-2 rounded-lg border border-black/10 text-sm focus:outline-none focus:ring-2 focus:ring-black/10 bg-white"
    />
  );
}

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className="w-full px-3 py-2 rounded-lg border border-black/10 text-sm focus:outline-none bg-white"
    />
  );
}

export function ErrorMsg({ msg }: { msg: string }) {
  if (!msg) return null;
  return (
    <p className="text-red-600 text-sm rounded-lg bg-red-50 px-3 py-2">{msg}</p>
  );
}

// Couleur et libellé lisible de chaque statut (planning, épreuve, candidat)
export const STATUT_BADGE: Record<string, [string, string]> = {
  BROUILLON:     ["bg-gray-100 text-gray-700",   "Brouillon"],
  OUVERT:        ["bg-green-100 text-green-700",  "Ouvert"],
  CLOS:          ["bg-black/10 text-gray-800",    "Clos"],
  LIBRE:         ["bg-green-100 text-green-700",  "Libre"],
  PRERESERVEE:   ["bg-amber-100 text-amber-700",  "Préréservé"],
  ABSENT:        ["bg-red-100 text-red-700",      "Absent"],
  CREE:          ["bg-gray-100 text-gray-700",    "Créé"],
  ATTRIBUEE:     ["bg-blue-100 text-blue-700",    "Réservé"],
  EN_EVALUATION: ["bg-yellow-100 text-yellow-700","En éval."],
  FINALISEE:     ["bg-purple-100 text-purple-700","Finalisé"],
  ANNULEE:       ["bg-red-100 text-red-500",      "Annulé"],
  IMPORTE:       ["bg-gray-100 text-gray-700",    "À placer"],
  INSCRIT:       ["bg-green-100 text-green-700",  "Inscrit"],
  CONFIRME:      ["bg-blue-100 text-blue-700",    "Confirmé"],
  ANNULE:        ["bg-red-100 text-red-500",      "Annulé"],
};

export function StatutBadge({ statut }: { statut: string }) {
  const [cls, label] = STATUT_BADGE[statut] ?? ["bg-gray-100 text-gray-700", statut];
  return (
    <span className={`inline-block text-xs px-2 py-0.5 rounded-full font-medium ${cls}`}>
      {label}
    </span>
  );
}

export function Empty({ message, sub }: { message: string; sub?: string }) {
  return (
    <div className="rounded-xl border border-dashed border-black/15 p-14 text-center">
      <p className="text-gray-700 font-medium">{message}</p>
      {sub && <p className="text-sm text-gray-700 mt-1">{sub}</p>}
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
          className="w-full text-sm text-gray-800 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-medium file:bg-black/5 hover:file:bg-black/10"
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

// ── Journées sans numéro de triplet ──
// Journées générées avant la numérotation des triplets : la colonne Triplet affiche « — ».
// Le bouton les numérote d'après leur journée type, sans régénérer les épreuves
// (POST plannings/{id}/numeroter-triplets) ; une simulation annonce d'abord le résultat.
type BilanNumerotation = {
  numerotees: string[]; epreuves: number;
  sans_gabarit: string[]; gabarit_modifie: string[]; avec_reservations: string[];
};

export function BandeauTripletsSansNumero({ planningId, epreuves, onFait }: {
  planningId: number; epreuves: EpreuveFlat[]; onFait: () => void;
}) {
  const toast = useToast();
  const confirm = useConfirm();
  const [enCours, setEnCours] = useState(false);
  const datesSans = Array.from(new Set(epreuves.filter((e) => !e.triplet && e.statut !== "ANNULEE").map((e) => e.date)));
  if (datesSans.length === 0) return null;

  const jour = (d: string) => new Date(d + "T12:00:00").toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
  const liste = (ds: string[]) => ds.map(jour).join(", ");

  async function numeroter() {
    setEnCours(true);
    try {
      const sim = await post<BilanNumerotation>(`plannings/${planningId}/numeroter-triplets?simulation=true`, {});
      const restes = [
        sim.sans_gabarit.length ? `• Sans journée type enregistrée (${liste(sim.sans_gabarit)}) : réappliquez la journée type à ces dates.` : "",
        sim.gabarit_modifie.length ? `• Épreuves ajoutées/supprimées à la main, ou journée type modifiée depuis (${liste(sim.gabarit_modifie)}) : laissées telles quelles.` : "",
        sim.avec_reservations.length ? `• Créneaux déjà préréservés ou attribués (${liste(sim.avec_reservations)}) : laissées telles quelles, pour ne pas changer les triplets réservés.` : "",
      ].filter(Boolean).join("\n");
      if (sim.numerotees.length === 0) {
        toast.error(`Aucune journée ne peut être numérotée automatiquement. ${restes.replace(/\n/g, " ")}`);
        return;
      }
      const ok = await confirm(
        `${sim.numerotees.length} journée(s) seront numérotées d'après leur journée type (${liste(sim.numerotees)}), ` +
        `sans toucher aux épreuves ni aux affectations.${restes ? `\n\nNon numérotées :\n${restes}` : ""}`,
        { confirmLabel: "Numéroter" },
      );
      if (!ok) return;
      const r = await post<BilanNumerotation>(`plannings/${planningId}/numeroter-triplets`, {});
      toast.success(`${r.numerotees.length} journée(s) numérotée(s) (${r.epreuves} épreuves)`);
      onFait();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erreur");
    } finally {
      setEnCours(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl border border-black/10 bg-white px-4 py-3 text-sm text-gray-900 shadow-sm">
      <AlertTriangle className="h-4 w-4 shrink-0 text-amber-700" />
      <span className="flex-1 min-w-[240px]">
        <strong>{datesSans.length} journée(s)</strong> sans numéro de triplet ({liste(datesSans.sort())}) :
        elles ont été générées avant la numérotation, la colonne Triplet y affiche « — ».
      </span>
      <button
        type="button"
        onClick={numeroter}
        disabled={enCours}
        className="inline-flex items-center gap-1.5 rounded-lg bg-black px-3 py-1.5 text-xs font-semibold text-white hover:bg-black/80 disabled:opacity-50"
      >
        {enCours ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Wand2 className="h-3.5 w-3.5" />}
        Numéroter depuis la journée type
      </button>
    </div>
  );
}

const EPREUVE_STATUTS = ["CREE", "LIBRE", "PRERESERVEE", "ATTRIBUEE", "EN_EVALUATION", "FINALISEE", "ANNULEE"];
export const EPREUVE_STATUT_LABEL: Record<string, string> = {
  CREE: "Créé", LIBRE: "Libre", PRERESERVEE: "Préréservé",
  ATTRIBUEE: "Attribué", EN_EVALUATION: "En évaluation", FINALISEE: "Finalisé", ANNULEE: "Annulé",
  ABSENT: "Absent",
};

// Couleurs d'un statut d'épreuve — UNE seule palette pour toutes les vues du planning
// (Vue tableau, Vue triplets, Association triplets, Vue créneaux) : Libre = vert,
// Préréservé = ambre, Attribué = bleu.
export function statutEpreuveCls(s: string): string {
  switch (s) {
    case "LIBRE": return "bg-emerald-50 text-emerald-800 border-emerald-200";
    case "PRERESERVEE": return "bg-amber-50 text-amber-800 border-amber-200";
    case "ATTRIBUEE": return "bg-blue-50 text-blue-800 border-blue-200";
    case "ABSENT": return "bg-red-50 text-red-700 border-red-200";
    case "ANNULEE": return "bg-gray-100 text-gray-700 border-gray-300 line-through";
    case "EN_EVALUATION": return "bg-yellow-50 text-yellow-800 border-yellow-200";
    case "FINALISEE": return "bg-purple-50 text-purple-800 border-purple-200";
    default: return "bg-gray-50 text-gray-800 border-gray-200";
  }
}

export function heurePrepa(heureDebut: string, prepMinutes: number | null | undefined): string | null {
  if (!prepMinutes) return null;
  const [h, m] = hm(heureDebut).split(":").map(Number);
  const total = h * 60 + m - prepMinutes;
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

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
    if (s === "CREE") return "bg-gray-50 text-gray-700";
    if (s === "EN_EVALUATION") return "bg-yellow-50 text-yellow-700";
    if (s === "FINALISEE") return "bg-purple-50 text-purple-700";
    if (s === "ANNULEE") return "bg-red-50 text-red-500";
    return "bg-gray-50 text-gray-700";
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
          <span className="text-xs text-gray-700 font-mono w-24 shrink-0">
            {hm(epreuve.heure_debut)} – {hm(epreuve.heure_fin)}
          </span>
          <div className="flex flex-col min-w-0">
            <span className="text-sm font-medium">{epreuve.matiere}</span>
            {epreuve.candidat_nom && (
              <span className="text-xs text-gray-700 truncate">
                {epreuve.candidat_prenom} {epreuve.candidat_nom}
              </span>
            )}
            {epreuve.salle_intitule && (
              <span className="text-[10px] text-gray-700 font-mono">{epreuve.salle_intitule}</span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            onClick={openEdit}
            className="p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-black/5 text-gray-700 hover:text-black transition"
            title="Modifier"
          >
            <Edit2 className="h-3 w-3" />
          </button>
          {!epreuve.candidat_nom && (
            <button
              onClick={handleDelete}
              className="p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-red-50 text-gray-700 hover:text-red-500 transition"
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
          <span className="text-xs text-gray-700">–</span>
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
          <button onClick={() => setEditOpen(false)} className="text-xs text-gray-700 hover:text-black">
            Annuler
          </button>
        </div>
      )}
    </>
  );
}

export function ApplyForm({
  planningId,
  date,
  dateDebut,
  dateFin,
  journeeTypes,
  onSuccess,
  precocherDate = true,
}: {
  planningId: number;
  date: string;
  dateDebut: string;
  dateFin: string;
  journeeTypes: JourneeType[];
  onSuccess: () => void;
  // false quand `date` n'est qu'une valeur par défaut (début du planning) et pas un choix de
  // l'utilisateur : elle ne doit pas être cochée d'office en mode « Plusieurs dates »
  precocherDate?: boolean;
}) {
  const [jtId, setJtId] = useState(journeeTypes[0]?.id ?? 0);
  const [mode, setMode] = useState<"single" | "multi">("single");
  const [singleDate, setSingleDate] = useState(date);
  const allDates = enumerateDates(dateDebut, dateFin);
  const [selectedDates, setSelectedDates] = useState<Set<string>>(() => new Set(precocherDate ? [date] : []));
  const [rangeFrom, setRangeFrom] = useState(date);
  const [rangeTo, setRangeTo] = useState(date);
  // Modifier « Du » ou « Au » coche directement les dates de la plage (limitée à la période du planning)
  const choisirPlage = (de: string, a: string) => {
    setRangeFrom(de);
    setRangeTo(a);
    if (de && a && de <= a) {
      setSelectedDates(new Set(enumerateDates(de < dateDebut ? dateDebut : de, a > dateFin ? dateFin : a)));
    }
  };
  const [loading, setLoading] = useState(false);
  type ApplyResult = { date: string; demi_journees_created: number; epreuves_created: number; warnings: string[] };
  const [results, setResults] = useState<ApplyResult[] | null>(null);
  const [failed, setFailed] = useState<{ date: string; message: string }[]>([]);
  const [error, setError] = useState("");

  const toggleDate = (d: string) => {
    setSelectedDates((prev) => {
      const next = new Set(prev);
      if (next.has(d)) next.delete(d); else next.add(d);
      return next;
    });
  };

  const submit = async () => {
    const dates = mode === "single" ? [singleDate] : Array.from(selectedDates).sort();
    if (dates.length === 0) {
      setError("Sélectionnez au moins une date");
      return;
    }
    // Les champs date n'empêchent pas de SAISIR une date hors bornes : on écarte ici les
    // dates hors de la période du planning (le serveur les refuserait avec une erreur 422).
    const horsPeriode = dates.filter((d) => d < dateDebut || d > dateFin);
    if (horsPeriode.length === dates.length) {
      setError(
        `${horsPeriode.length > 1 ? "Ces dates sont" : "Cette date est"} en dehors de la période du planning ` +
        `(du ${formatDateCourte(dateDebut)} au ${formatDateCourte(dateFin)}) : ` +
        `${horsPeriode.map(formatDateCourte).join(", ")}. Modifiez d'abord les dates du planning (Plannings → Modifier).`
      );
      return;
    }
    setLoading(true);
    setError("");
    const newResults: ApplyResult[] = [];
    const newFailed: { date: string; message: string }[] = horsPeriode.map((d) => ({
      date: d,
      message: `en dehors de la période du planning (du ${formatDateCourte(dateDebut)} au ${formatDateCourte(dateFin)})`,
    }));
    for (const d of dates.filter((x) => !horsPeriode.includes(x))) {
      try {
        const r = await post<any>(`plannings/${planningId}/apply-journee-type`, {
          journee_type_id: jtId,
          date: d,
        });
        newResults.push({
          date: d,
          demi_journees_created: r.demi_journees_created,
          epreuves_created: r.epreuves_created,
          warnings: r.warnings ?? [],
        });
      } catch (e: any) {
        newFailed.push({ date: d, message: e.message });
      }
    }
    setResults(newResults);
    setFailed(newFailed);
    setLoading(false);
  };

  if (results) {
    const totalDj = results.reduce((s, r) => s + r.demi_journees_created, 0);
    const totalEp = results.reduce((s, r) => s + r.epreuves_created, 0);
    const withWarnings = results.filter((r) => r.warnings.length > 0);
    const hasIssue = failed.length > 0 || withWarnings.length > 0;

    return (
      <div className="space-y-4">
        <div className={`rounded-xl border p-4 ${hasIssue ? "bg-amber-50 border-amber-100" : "bg-green-50 border-green-100"}`}>
          <p className={`font-semibold text-sm ${hasIssue ? "text-amber-700" : "text-green-700"}`}>
            {results.length} date{results.length > 1 ? "s" : ""} traitée{results.length > 1 ? "s" : ""}
            {failed.length > 0 && ` • ${failed.length} échec${failed.length > 1 ? "s" : ""}`}
          </p>
          <p className={`text-sm mt-1 ${hasIssue ? "text-amber-600" : "text-green-600"}`}>
            {totalDj} demi-journée(s) créée(s) &bull; {totalEp} épreuve(s) générée(s)
          </p>
          {results.length > 0 && (
            <ul className="mt-2 space-y-0.5 text-xs text-gray-900">
              {results.map((r) => (
                <li key={r.date}>
                  ✓ <span className="capitalize">{formatDate(r.date)}</span> — {r.epreuves_created} épreuve(s)
                </li>
              ))}
            </ul>
          )}
        </div>

        {withWarnings.length > 0 && (
          <div className="rounded-xl border border-amber-100 bg-amber-50 p-3 space-y-2">
            {withWarnings.map((r) => (
              <div key={r.date} className="text-xs">
                <strong className="text-amber-800">{formatDate(r.date)}</strong>
                {r.warnings.map((w, i) => (
                  <p key={i} className="text-amber-700 mt-0.5">{w}</p>
                ))}
              </div>
            ))}
          </div>
        )}

        {failed.length > 0 && (
          <div className="rounded-xl border border-red-100 bg-red-50 p-3 space-y-1.5">
            {failed.map((f) => (
              <p key={f.date} className="text-xs text-red-700">
                <strong>{formatDate(f.date)}</strong> — {f.message}
              </p>
            ))}
          </div>
        )}

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

      <div className="flex gap-1 bg-black/[0.04] rounded-lg p-1 w-fit">
        {(["single", "multi"] as const).map((m) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition ${
              mode === m ? "bg-white shadow-sm text-black" : "text-gray-800 hover:text-black"
            }`}
          >
            {m === "single" ? "Une date" : "Plusieurs dates"}
          </button>
        ))}
      </div>

      {mode === "single" ? (
        <Field label="Date">
          <Input
            type="date"
            value={singleDate}
            min={dateDebut}
            max={dateFin}
            onChange={(e) => setSingleDate(e.target.value)}
          />
        </Field>
      ) : (
        <div className="space-y-3">
          <div className="rounded-lg border border-black/10 bg-black/[0.02] p-3">
            <p className="text-xs font-medium text-gray-800 uppercase tracking-wide mb-2">Sélectionner une plage</p>
            <div className="flex items-end gap-2">
              <Field label="Du">
                <Input type="date" value={rangeFrom} min={dateDebut} max={dateFin} onChange={(e) => choisirPlage(e.target.value, rangeTo < e.target.value ? e.target.value : rangeTo)} />
              </Field>
              <Field label="Au">
                <Input type="date" value={rangeTo} min={dateDebut} max={dateFin} onChange={(e) => choisirPlage(rangeFrom, e.target.value)} />
              </Field>
            </div>
            <p className="text-xs text-gray-700 mt-2">Les dates de la plage sont cochées ci-dessous ; ajustez-les ensuite une par une si besoin.</p>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-gray-800 uppercase tracking-wide">
              {selectedDates.size} date{selectedDates.size > 1 ? "s" : ""} sélectionnée{selectedDates.size > 1 ? "s" : ""}
            </span>
            <div className="flex gap-3">
              <button onClick={() => setSelectedDates(new Set(allDates))} className="text-xs text-gray-700 hover:text-black underline">
                Tout cocher
              </button>
              <button onClick={() => setSelectedDates(new Set())} className="text-xs text-gray-700 hover:text-black underline">
                Tout décocher
              </button>
            </div>
          </div>
          <div className="max-h-60 overflow-y-auto rounded-lg border border-black/10 divide-y divide-black/5">
            {allDates.map((d) => (
              <label key={d} className="flex items-center gap-2.5 px-3 py-2 text-sm hover:bg-black/[0.02] cursor-pointer">
                <input type="checkbox" checked={selectedDates.has(d)} onChange={() => toggleDate(d)} />
                <span className="capitalize">{formatDate(d)}</span>
              </label>
            ))}
          </div>
        </div>
      )}

      <ErrorMsg msg={error} />
      <div className="flex items-center gap-2 pt-1">
        <Btn
          label={loading ? "Génération…" : mode === "multi" ? `Générer (${selectedDates.size})` : "Générer"}
          icon={Wand2}
          onClick={submit}
          disabled={loading || !jtId || (mode === "multi" && selectedDates.size === 0)}
        />
        {loading && <Spinner />}
      </div>
    </div>
  );
}

// ── Examinateurs ───────────────────────────────────────────────────────────────

export type MatiereItem = { id: number; intitule: string; active: boolean };

export function useMatieres() {
  const [matieres, setMatieres] = useState<MatiereItem[]>([]);
  useEffect(() => {
    get<MatiereItem[]>("parametrages/matieres/").then(setMatieres).catch(() => {});
  }, []);
  return matieres;
}
