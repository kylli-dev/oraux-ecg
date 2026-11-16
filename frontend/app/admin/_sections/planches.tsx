"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { useToast, useConfirm } from "../Toast";
import {
  Trash2,
  X,
  Loader2,
  Download,
  Upload,
  Edit2,
  Palette,
  CheckCircle2,
  FileText,
} from "lucide-react";
import {
  Btn,
  Empty,
  EpreuveFlat,
  ErrorMsg,
  Examinateur,
  Field,
  Input,
  Modal,
  Planning,
  RED,
  Select,
  Spinner,
  del,
  formatDateCourte,
  get,
  hm,
  memoriserPlanning,
  patch,
  planningMemorise,
  post,
  useFiltre,
  useIntentionAffectation,
  useMatieres,
} from "./commun";

type PlancheItem = {
  id: number;
  nom: string;
  fichier_path: string;
  matiere_id: number | null;
  matiere_intitule: string | null;
  examinateur_id: number | null;
  examinateur_nom: string | null;
  statut: string;
  // Couleur choisie par l'admin (#RRGGBB) ; null = couleur automatique
  couleur?: string | null;
  assignee: boolean;
  created_at: string;
};

// ── Gestion des planches ───────────────────────────────────────────────────────
// ── Code couleur des planches ─────────────────────────────────────────────────
// Une couleur FIXE par planche : celle choisie par l'admin (sélecteur de couleur de
// l'onglet « Gestion des sujets »), sinon une couleur automatique dérivée de son
// identifiant. La même planche a toujours la même couleur, dans l'assignation, la liste
// des sujets et la fenêtre d'assignation. Le code court (P + numéro) lève toute ambiguïté.
const PALETTE_PLANCHES = [
  "#C62828", "#1565C0", "#2E7D32", "#EF6C00", "#6A1B9A", "#00838F", "#AD1457", "#827717",
  "#4E342E", "#283593", "#00695C", "#D84315", "#5D4037", "#0277BD", "#558B2F", "#8E24AA",
];

// Couleurs choisies, par id de planche — renseigné au chargement de la liste des
// planches, pour que les pastilles qui ne connaissent que l'id (tableau d'assignation)
// affichent aussi la couleur choisie.
const couleursChoisies = new Map<number, string>();

function enregistrerCouleursPlanches(planches: PlancheItem[]) {
  couleursChoisies.clear();
  for (const p of planches) if (p.couleur) couleursChoisies.set(p.id, p.couleur);
}

function couleurPlanche(id: number): string {
  return couleursChoisies.get(id) ?? PALETTE_PLANCHES[Math.abs(id) % PALETTE_PLANCHES.length];
}

// Texte lisible sur une couleur claire (jaune, beige…) : on bascule alors sur du texte
// foncé, la couleur restant visible par la bordure et la pastille.
function estCouleurClaire(hex: string): boolean {
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  return 0.299 * r + 0.587 * g + 0.114 * b > 170;
}

function PastillePlanche({ id, nom }: { id: number; nom?: string | null }) {
  const c = couleurPlanche(id);
  return (
    <span
      className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-xs font-semibold tabular-nums whitespace-nowrap"
      style={{ borderColor: c, color: estCouleurClaire(c) ? "#1F2937" : c, backgroundColor: c + "14" }}
      title={nom ? `Planche « ${nom} » — code P${id}` : `Planche P${id}`}
    >
      <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: c }} />
      P{id}
    </span>
  );
}

// Palette proposée dans le sélecteur : couleurs franches, bien distinctes entre elles
const PALETTE_CHOIX_PLANCHES = [
  "#C62828", "#E53935", "#AD1457", "#D81B60", "#8E24AA", "#6A1B9A", "#5E35B1", "#283593",
  "#1565C0", "#0277BD", "#00838F", "#00695C", "#2E7D32", "#558B2F", "#827717", "#F9A825",
  "#EF6C00", "#D84315", "#6D4C41", "#4E342E", "#546E7A", "#37474F", "#616161", "#212121",
];

// ── Nuancier à curseurs (teinte / saturation / luminosité) ──────────────────────
function hexVersHsv(hex: string): { h: number; s: number; v: number } {
  const n = parseInt(hex.slice(1), 16);
  const r = ((n >> 16) & 255) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
  let h = 0;
  if (d) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h = (h * 60 + 360) % 360;
  }
  return { h, s: max ? d / max : 0, v: max };
}

function hsvVersHex(h: number, s: number, v: number): string {
  const f = (n: number) => {
    const k = (n + h / 60) % 6;
    return Math.round((v - v * s * Math.max(0, Math.min(k, 4 - k, 1))) * 255);
  };
  return "#" + [f(5), f(3), f(1)].map((x) => x.toString(16).padStart(2, "0")).join("").toUpperCase();
}

// Carré saturation × luminosité + barre de teinte, chacun avec un curseur qu'on fait
// glisser (souris, stylet ou doigt). La teinte est gardée dans l'état : elle ne se
// perd pas quand on passe par le blanc, le noir ou un gris.
function NuancierCurseurs({ valeur, onChange }: { valeur: string; onChange: (hex: string) => void }) {
  const [hsv, setHsv] = useState(() => hexVersHsv(/^#[0-9A-Fa-f]{6}$/.test(valeur) ? valeur : "#C62828"));
  const carre = useRef<HTMLDivElement>(null);
  const barre = useRef<HTMLDivElement>(null);

  // Saisie hexadécimale externe : on resynchronise les curseurs
  useEffect(() => {
    if (/^#[0-9A-Fa-f]{6}$/.test(valeur) && valeur.toUpperCase() !== hsvVersHex(hsv.h, hsv.s, hsv.v)) {
      const n = hexVersHsv(valeur);
      setHsv((prev) => ({ ...n, h: n.s === 0 ? prev.h : n.h }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [valeur]);

  function maj(n: { h: number; s: number; v: number }) {
    setHsv(n);
    onChange(hsvVersHex(n.h, n.s, n.v));
  }

  function surCarre(e: React.PointerEvent) {
    const r = carre.current!.getBoundingClientRect();
    const s = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
    const v = 1 - Math.min(1, Math.max(0, (e.clientY - r.top) / r.height));
    maj({ ...hsv, s, v });
  }

  function surBarre(e: React.PointerEvent) {
    const r = barre.current!.getBoundingClientRect();
    const h = Math.min(359.9, Math.max(0, ((e.clientX - r.left) / r.width) * 360));
    maj({ ...hsv, h });
  }

  const glisser = (gestion: (e: React.PointerEvent) => void) => ({
    onPointerDown: (e: React.PointerEvent) => { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); gestion(e); },
    onPointerMove: (e: React.PointerEvent) => { if (e.buttons & 1) gestion(e); },
  });

  const couleur = hsvVersHex(hsv.h, hsv.s, hsv.v);
  return (
    <div className="space-y-2.5 select-none">
      <div
        ref={carre}
        {...glisser(surCarre)}
        className="relative h-36 w-full rounded-lg cursor-crosshair touch-none overflow-hidden"
        style={{ backgroundColor: `hsl(${hsv.h}, 100%, 50%)` }}
      >
        <div className="absolute inset-0" style={{ background: "linear-gradient(to right, #fff, rgba(255,255,255,0))" }} />
        <div className="absolute inset-0" style={{ background: "linear-gradient(to top, #000, rgba(0,0,0,0))" }} />
        <div
          className="absolute h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-[0_0_0_1px_rgba(0,0,0,0.4)] pointer-events-none"
          style={{ left: `${hsv.s * 100}%`, top: `${(1 - hsv.v) * 100}%`, backgroundColor: couleur }}
        />
      </div>
      <div
        ref={barre}
        {...glisser(surBarre)}
        className="relative h-3.5 w-full rounded-full cursor-pointer touch-none"
        style={{ background: "linear-gradient(to right, #f00, #ff0, #0f0, #0ff, #00f, #f0f, #f00)" }}
        title="Teinte"
      >
        <div
          className="absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-[0_0_0_1px_rgba(0,0,0,0.4)] pointer-events-none"
          style={{ left: `${(hsv.h / 360) * 100}%`, backgroundColor: `hsl(${hsv.h}, 100%, 50%)` }}
        />
      </div>
    </div>
  );
}

// Sélecteur de couleur d'une planche : nuancier à curseurs avec saisie hexadécimale,
// palette prédéfinie, et retour à la couleur automatique.
// Le panneau est en position fixe pour ne pas être rogné par le tableau (overflow).
function SelecteurCouleurPlanche({
  planche,
  onChoisir,
}: {
  planche: PlancheItem;
  onChoisir: (couleur: string | null) => Promise<void>;
}) {
  const [ouvert, setOuvert] = useState(false);
  const [position, setPosition] = useState<{ top: number; left: number }>({ top: 0, left: 0 });
  const actuelle = couleurPlanche(planche.id);
  const [perso, setPerso] = useState(actuelle);
  const [enregistrement, setEnregistrement] = useState(false);
  const bouton = useRef<HTMLButtonElement>(null);
  const panneau = useRef<HTMLDivElement>(null);
  const hexValide = /^#[0-9A-Fa-f]{6}$/.test(perso);

  useEffect(() => {
    if (!ouvert) return;
    const fermer = (e: MouseEvent) => {
      if (!panneau.current?.contains(e.target as Node) && !bouton.current?.contains(e.target as Node)) setOuvert(false);
    };
    const echap = (e: KeyboardEvent) => { if (e.key === "Escape") setOuvert(false); };
    const surDefilement = () => setOuvert(false);
    document.addEventListener("mousedown", fermer);
    document.addEventListener("keydown", echap);
    window.addEventListener("scroll", surDefilement, true);
    return () => {
      document.removeEventListener("mousedown", fermer);
      document.removeEventListener("keydown", echap);
      window.removeEventListener("scroll", surDefilement, true);
    };
  }, [ouvert]);

  function basculer() {
    if (!ouvert && bouton.current) {
      const r = bouton.current.getBoundingClientRect();
      const largeur = 272;
      setPosition({ top: r.bottom + 6, left: Math.max(8, Math.min(r.left, window.innerWidth - largeur - 8)) });
      setPerso(actuelle);
    }
    setOuvert((o) => !o);
  }

  async function choisir(couleur: string | null) {
    setEnregistrement(true);
    try {
      await onChoisir(couleur);
      setOuvert(false);
    } finally {
      setEnregistrement(false);
    }
  }

  return (
    <>
      <button
        ref={bouton}
        type="button"
        onClick={basculer}
        className="group inline-flex items-center gap-1 rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-[#C62828]/40"
        title="Choisir la couleur de la planche"
      >
        <PastillePlanche id={planche.id} nom={planche.nom} />
        <Palette className="h-3.5 w-3.5 text-gray-700 opacity-60 group-hover:opacity-100 transition" />
      </button>
      {ouvert && (
        <div
          ref={panneau}
          className="fixed z-[70] w-[272px] rounded-xl border border-black/10 bg-white shadow-xl p-3 space-y-3"
          style={{ top: position.top, left: position.left }}
        >
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-gray-900">Couleur de la planche P{planche.id}</p>
            {enregistrement && <Loader2 className="h-3.5 w-3.5 animate-spin text-gray-700" />}
          </div>

          {/* Nuancier à curseurs */}
          <NuancierCurseurs valeur={perso} onChange={setPerso} />

          {/* Aperçu + code hexadécimal */}
          <div>
            <div className="flex items-center gap-2">
              <span
                className="h-8 w-10 rounded-lg border border-black/15 shrink-0"
                style={{ backgroundColor: hexValide ? perso : actuelle }}
                title="Aperçu"
              />
              <input
                type="text"
                value={perso}
                onChange={(e) => setPerso(e.target.value.trim().toUpperCase())}
                maxLength={7}
                placeholder="#RRGGBB"
                className={`w-24 px-2 py-1.5 rounded border text-xs font-mono text-gray-900 ${hexValide ? "border-black/15" : "border-red-400 bg-red-50"}`}
              />
              <button
                type="button"
                onClick={() => choisir(perso)}
                disabled={!hexValide || enregistrement}
                className="ml-auto text-xs font-semibold text-white px-2.5 py-1.5 rounded-lg disabled:opacity-40"
                style={{ backgroundColor: "#C62828" }}
              >
                Appliquer
              </button>
            </div>
          </div>

          {/* Couleurs rapides : un clic enregistre directement */}
          <div className="border-t border-black/5 pt-3">
            <p className="text-[11px] font-medium uppercase tracking-wide text-gray-700 mb-1.5">Couleurs rapides</p>
            <div className="grid grid-cols-8 gap-1.5">
              {PALETTE_CHOIX_PLANCHES.map((c) => {
                const actif = c.toUpperCase() === actuelle.toUpperCase();
                return (
                  <button
                    key={c}
                    type="button"
                    disabled={enregistrement}
                    onClick={() => choisir(c)}
                    className={`h-6 w-6 rounded-full border border-black/10 transition hover:scale-110 disabled:opacity-50 ${actif ? "ring-2 ring-offset-2 ring-gray-900" : ""}`}
                    style={{ backgroundColor: c }}
                    title={c}
                    aria-label={`Couleur ${c}`}
                  />
                );
              })}
            </div>
          </div>

          <button
            type="button"
            onClick={() => choisir(null)}
            disabled={enregistrement || !planche.couleur}
            className="w-full text-xs font-medium text-gray-800 hover:text-black px-2 py-1.5 rounded-lg border border-black/10 hover:bg-gray-50 transition disabled:opacity-40"
            title={planche.couleur ? "Revenir à la couleur attribuée automatiquement" : "La couleur actuelle est déjà automatique"}
          >
            Couleur automatique
          </button>
        </div>
      )}
    </>
  );
}

// ── Historique des planches (journal en ajout seul, jamais réécrit) ──────────
type PlancheHistoriqueItem = {
  id: number;
  created_at: string;
  action: string;
  planning_id: number | null;
  planche_nom: string | null;
  ancienne_planche_nom: string | null;
  matiere: string | null;
  date_epreuve: string | null;
  heure_debut: string | null;
  candidat_nom: string | null;
  examinateur_nom: string | null;
};

const ACTION_PLANCHE: Record<string, { label: string; cls: string }> = {
  ASSIGNEE: { label: "Assignée", cls: "bg-emerald-50 text-emerald-800 border-emerald-200" },
  REMPLACEE: { label: "Remplacée", cls: "bg-blue-50 text-blue-800 border-blue-200" },
  RETIREE: { label: "Retirée", cls: "bg-gray-100 text-gray-800 border-gray-300" },
  PLANCHE_SUPPRIMEE: { label: "Planche supprimée", cls: "bg-red-50 text-red-700 border-red-200" },
  IMPRIMEE: { label: "Imprimée", cls: "bg-purple-50 text-purple-800 border-purple-200" },
  REPRISE: { label: "Déjà assignée (reprise)", cls: "bg-amber-50 text-amber-800 border-amber-200" },
};

function HistoriquePlanches() {
  const [items, setItems] = useState<PlancheHistoriqueItem[]>([]);
  const [plannings, setPlannings] = useState<Planning[]>([]);
  const [planningId, setPlanningId] = useState("");
  const [loading, setLoading] = useState(true);
  const [recherche, setRecherche] = useState("");
  const [fAction, setFAction] = useState("");
  const [fMatiere, setFMatiere] = useState("");
  const [fDate, setFDate] = useState("");

  useEffect(() => {
    get<Planning[]>("plannings/").then((ps) => {
      setPlannings(ps);
      setPlanningId((cur) => cur || String(planningMemorise(ps) ?? ""));
    }).catch(() => {});
  }, []);
  useEffect(() => memoriserPlanning(planningId), [planningId]);
  useEffect(() => {
    setLoading(true);
    get<PlancheHistoriqueItem[]>(`planches/historique${planningId ? `?planning_id=${planningId}` : ""}`)
      .then(setItems)
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, [planningId]);

  const horodatage = (iso: string) =>
    new Date(iso.endsWith("Z") || iso.includes("+") ? iso : iso + "Z").toLocaleString("fr-FR", {
      day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit",
    });

  const q = recherche.trim().toLowerCase();
  const filtres = items
    .filter((h) => !fAction || h.action === fAction)
    .filter((h) => !fMatiere || h.matiere === fMatiere)
    .filter((h) => !fDate || h.date_epreuve === fDate)
    .filter((h) => !q || `${h.planche_nom ?? ""} ${h.ancienne_planche_nom ?? ""} ${h.candidat_nom ?? ""} ${h.examinateur_nom ?? ""}`.toLowerCase().includes(q));
  const matieres = [...new Set(items.map((h) => h.matiere).filter((m): m is string => !!m))].sort((a, b) => a.localeCompare(b, "fr"));
  const dates = [...new Set(items.map((h) => h.date_epreuve).filter((d): d is string => !!d))].sort();
  const actifs = !!(recherche || fAction || fMatiere || fDate);

  // Export CSV (séparateur « ; » + BOM : s'ouvre directement dans Excel en français)
  const exporter = () => {
    const entetes = ["Date de l'action", "Action", "Planche", "Ancienne planche", "Matière", "Date épreuve", "Heure", "Candidat", "Examinateur"];
    const cell = (v: string | null | undefined) => `"${(v ?? "").replace(/"/g, '""')}"`;
    const lignes = filtres.map((h) => [
      horodatage(h.created_at), ACTION_PLANCHE[h.action]?.label ?? h.action, h.planche_nom, h.ancienne_planche_nom,
      h.matiere, h.date_epreuve ? formatDateCourte(h.date_epreuve) : "", h.heure_debut, h.candidat_nom, h.examinateur_nom,
    ].map(cell).join(";"));
    const blob = new Blob(["\ufeff" + [entetes.map(cell).join(";"), ...lignes].join("\r\n")], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `historique_planches_${new Date().toLocaleDateString("sv-SE")}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-800">
        Journal complet de chaque planche, du début à la fin : assignation, remplacement, retrait, suppression et impression.
        Chaque ligne est conservée telle quelle — elle n&apos;est jamais modifiée ni effacée.
      </p>

      <div className="bg-white rounded-xl border border-black/10 shadow-sm p-4 space-y-3">
        <div className="grid gap-3 grid-cols-2 md:grid-cols-5">
          <Field label="Planning">
            <Select value={planningId} onChange={(e) => setPlanningId(e.target.value)}>
              <option value="">Tous</option>
              {plannings.map((p) => <option key={p.id} value={p.id}>{p.nom}</option>)}
            </Select>
          </Field>
          <Field label="Recherche">
            <Input value={recherche} onChange={(e) => setRecherche(e.target.value)} placeholder="Planche, candidat, examinateur…" />
          </Field>
          <Field label="Action">
            <Select value={fAction} onChange={(e) => setFAction(e.target.value)}>
              <option value="">Toutes</option>
              {Object.entries(ACTION_PLANCHE).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </Select>
          </Field>
          <Field label="Matière">
            <Select value={fMatiere} onChange={(e) => setFMatiere(e.target.value)}>
              <option value="">Toutes</option>
              {matieres.map((m) => <option key={m} value={m}>{m}</option>)}
            </Select>
          </Field>
          <Field label="Date de l'épreuve">
            <Select value={fDate} onChange={(e) => setFDate(e.target.value)}>
              <option value="">Toutes</option>
              {dates.map((d) => <option key={d} value={d}>{formatDateCourte(d)}</option>)}
            </Select>
          </Field>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-sm text-gray-900">
            <span className="font-semibold">{filtres.length}</span> événement{filtres.length > 1 ? "s" : ""}
            {actifs && <> sur {items.length}</>}
            {actifs && (
              <button
                onClick={() => { setRecherche(""); setFAction(""); setFMatiere(""); setFDate(""); }}
                className="ml-3 font-medium hover:underline" style={{ color: RED }}
              >
                Réinitialiser
              </button>
            )}
          </span>
          <Btn label="Exporter (Excel / CSV)" icon={Download} small variant="ghost" onClick={exporter} disabled={filtres.length === 0} />
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12 text-gray-700"><Spinner /></div>
      ) : filtres.length === 0 ? (
        <Empty
          message={items.length === 0 ? "Aucun événement enregistré" : "Aucun événement ne correspond aux filtres"}
          sub={items.length === 0 ? "L'historique démarre à partir de maintenant : chaque assignation, retrait ou impression sera tracé ici." : undefined}
        />
      ) : (
        <div className="rounded-xl border bg-white shadow-sm overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[#F5F5F5]">
                {["Date de l'action", "Action", "Planche", "Matière", "Épreuve", "Candidat", "Examinateur"].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-900 whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtres.map((h) => {
                const a = ACTION_PLANCHE[h.action] ?? { label: h.action, cls: "bg-gray-50 text-gray-800 border-gray-200" };
                return (
                  <tr key={h.id} className="border-t border-black/5">
                    <td className="px-4 py-2.5 text-gray-900 tabular-nums whitespace-nowrap">{horodatage(h.created_at)}</td>
                    <td className="px-4 py-2.5">
                      <span className={`inline-block px-2 py-0.5 rounded-full border text-xs font-semibold whitespace-nowrap ${a.cls}`}>{a.label}</span>
                    </td>
                    <td className="px-4 py-2.5 text-gray-900">
                      {h.ancienne_planche_nom && <span className="text-gray-700 line-through mr-1">{h.ancienne_planche_nom}</span>}
                      {h.ancienne_planche_nom && <span className="text-gray-700 mr-1">→</span>}
                      <span className="font-medium">{h.planche_nom ?? "—"}</span>
                    </td>
                    <td className="px-4 py-2.5 text-gray-900">{h.matiere ?? "—"}</td>
                    <td className="px-4 py-2.5 text-gray-900 tabular-nums whitespace-nowrap">
                      {h.date_epreuve ? formatDateCourte(h.date_epreuve) : "—"}{h.heure_debut ? ` · ${h.heure_debut}` : ""}
                    </td>
                    <td className="px-4 py-2.5 text-gray-900">{h.candidat_nom ?? <span className="italic text-gray-700">aucun</span>}</td>
                    <td className="px-4 py-2.5 text-gray-900">{h.examinateur_nom ?? <span className="italic text-gray-700">—</span>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export function PlanchesSection() {
  const toast = useToast();
  const confirm = useConfirm();
  const matieres = useMatieres();
  const intention = useIntentionAffectation("planche");
  const [tab, setTab] = useFiltre<"sujets" | "assignation" | "impression" | "historique">("planches:onglet", intention ? "assignation" : "sujets", undefined, !!intention);

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

  const [loadingCartouche, setLoadingCartouche] = useState<Set<number>>(new Set());
  const [doneCartouche, setDoneCartouche] = useState<Set<number>>(new Set());

  async function doCartouche(epreuveId: number, nomFichier: string) {
    setLoadingCartouche((s) => new Set(s).add(epreuveId));
    try {
      const res = await fetch(`/api/backend/planches/epreuves/${epreuveId}/cartouche`);
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.detail ?? "Erreur lors de la génération");
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${nomFichier}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      setDoneCartouche((s) => new Set(s).add(epreuveId));
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setLoadingCartouche((s) => { const n = new Set(s); n.delete(epreuveId); return n; });
    }
  }

  // ── Onglet Impression ────────────────────────────────────────────────────────
  const [impPlanningId, setImpPlanningId] = useState<number | "">("");
  const [impDate, setImpDate] = useState("");
  const [impMatiere, setImpMatiere] = useState("");
  const [impEpreuves, setImpEpreuves] = useState<EpreuveFlat[]>([]);
  const [impAvecPlanche, setImpAvecPlanche] = useState<EpreuveFlat[]>([]);
  const [impLoading, setImpLoading] = useState(false);
  const [impSelected, setImpSelected] = useState<Set<number>>(new Set());
  const [impDownloading, setImpDownloading] = useState(false);

  // ── Onglet Assignation ───────────────────────────────────────────────────────
  const [plannings, setPlannings] = useState<Planning[]>([]);
  const [planningId, setPlanningId] = useState<number | "">(intention?.planningId ?? "");
  const [epreuves, setEpreuves] = useState<EpreuveFlat[]>([]);
  const [loadingEp, setLoadingEp] = useState(false);
  const [assignModal, setAssignModal] = useState<EpreuveFlat | null>(null);
  const [filterMatAss, setFilterMatAss] = useFiltre("planches:matiere", intention?.matiere ?? "", planningId, !!intention);
  const [filterDateAss, setFilterDateAss] = useFiltre("planches:date", intention?.date ?? "", planningId, !!intention);
  const [filterHeureAss, setFilterHeureAss] = useFiltre("planches:heure", intention?.heure ? hm(intention.heure) : "", planningId, !!intention);
  // "" = tous, "avec" / "sans" candidat, sinon l'id du candidat
  const [filterCandAss, setFilterCandAss] = useFiltre("planches:candidat", "", planningId, !!intention);
  // "" = toutes, "assignee" / "non_assignee", sinon le nom de la planche
  const [filterPlancheAss, setFilterPlancheAss] = useFiltre("planches:planche", intention ? "non_assignee" : "", planningId, !!intention);
  const [rechercheAss, setRechercheAss] = useState("");
  // "" = tous, "aucun" = sans examinateur, sinon l'id de l'examinateur (1er ou 2e)
  const [filterExamAss, setFilterExamAss] = useFiltre("planches:examinateur", "", planningId, !!intention);
  const [assigning, setAssigning] = useState(false);

  const loadPlanches = useCallback(() => {
    setLoadingP(true);
    get<PlancheItem[]>("planches/")
      .then((ps) => { enregistrerCouleursPlanches(ps); setPlanches(ps); })
      .catch(() => {})
      .finally(() => setLoadingP(false));
  }, []);

  async function changerCouleur(p: PlancheItem, couleur: string | null) {
    try {
      const maj = await patch<PlancheItem>(`planches/${p.id}`, { couleur });
      setPlanches((prev) => {
        const suivant = prev.map((x) => (x.id === p.id ? { ...x, couleur: maj?.couleur ?? couleur } : x));
        enregistrerCouleursPlanches(suivant);
        return suivant;
      });
      toast.success(couleur ? "Couleur de la planche enregistrée" : "Couleur automatique rétablie");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : String(e));
    }
  }

  useEffect(() => {
    loadPlanches();
    get<Planning[]>("plannings/").then((ps) => {
      setPlannings(ps);
      const id = planningMemorise(ps);
      if (id) {
        setPlanningId((cur) => cur || id);
        setImpPlanningId((cur) => cur || id);
      }
    }).catch(() => {});
    get<Examinateur[]>("examinateurs/").then(setExaminateurs).catch(() => {});
  }, [loadPlanches]);
  useEffect(() => memoriserPlanning(planningId), [planningId]);
  useEffect(() => memoriserPlanning(impPlanningId), [impPlanningId]);

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
  // Toutes les épreuves du planning ayant une planche — chargées une fois par planning ;
  // les filtres date/matière s'appliquent ensuite localement (et leurs listes d'options
  // viennent de cet ensemble complet, pas de la sélection déjà filtrée).
  useEffect(() => {
    if (!impPlanningId) { setImpAvecPlanche([]); return; }
    setImpLoading(true);
    get<EpreuveFlat[]>(`plannings/${impPlanningId}/epreuves`)
      .then((all) => setImpAvecPlanche(all.filter((e) => e.planche_id !== null)))
      .catch(() => setImpAvecPlanche([]))
      .finally(() => setImpLoading(false));
  }, [impPlanningId]);

  useEffect(() => {
    const filtered = impAvecPlanche
      .filter((e) => (impDate === "" || e.date === impDate) && (impMatiere === "" || e.matiere === impMatiere))
      .sort((a, b) => a.date.localeCompare(b.date) || hm(a.heure_debut).localeCompare(hm(b.heure_debut)));
    setImpEpreuves(filtered);
    // Pré-sélectionner toutes les épreuves avec candidat + planche
    setImpSelected(new Set(filtered.filter((e) => e.candidat_id && e.planche_id).map((e) => e.id)));
  }, [impAvecPlanche, impDate, impMatiere]);

  // Dates où des planches sont assignées (avec leur nombre) — seules proposées au filtre
  const impDatesPlanches = Array.from(
    impAvecPlanche.reduce((m, e) => m.set(e.date, (m.get(e.date) ?? 0) + 1), new Map<string, number>()).entries()
  ).sort(([a], [b]) => a.localeCompare(b));
  const impMatieresOptions = Array.from(
    new Set(impAvecPlanche.filter((e) => impDate === "" || e.date === impDate).map((e) => e.matiere))
  ).sort((a, b) => a.localeCompare(b, "fr"));

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

  // Filtres de l'onglet Assignation — combinables, sur toutes les colonnes du tableau
  const rechAss = rechercheAss.trim().toLowerCase();
  const epreuvesFiltrees = epreuves
    .filter((e) => !filterMatAss || e.matiere === filterMatAss)
    .filter((e) => !filterDateAss || e.date === filterDateAss)
    .filter((e) => !filterHeureAss || hm(e.heure_debut) === filterHeureAss)
    .filter((e) =>
      !filterCandAss ? true
      : filterCandAss === "avec" ? e.candidat_id != null
      : filterCandAss === "sans" ? e.candidat_id == null
      : String(e.candidat_id) === filterCandAss)
    .filter((e) =>
      !filterPlancheAss ? true
      : filterPlancheAss === "assignee" ? !!e.planche_nom
      : filterPlancheAss === "non_assignee" ? !e.planche_nom
      : e.planche_nom === filterPlancheAss)
    .filter((e) =>
      !filterExamAss ? true
      : filterExamAss === "aucun" ? !e.examinateur_id && !e.examinateur2_id
      : String(e.examinateur_id) === filterExamAss || String(e.examinateur2_id) === filterExamAss)
    .filter((e) =>
      !rechAss ||
      `${e.matiere} ${e.candidat_nom ?? ""} ${e.candidat_prenom ?? ""} ${e.planche_nom ?? ""} ${formatDateCourte(e.date)} ${hm(e.heure_debut)} ${e.examinateur_nom ?? ""} ${e.examinateur_prenom ?? ""} ${e.examinateur2_nom ?? ""} ${e.examinateur2_prenom ?? ""}`
        .toLowerCase().includes(rechAss))
    .sort((a, b) => a.date.localeCompare(b.date) || hm(a.heure_debut).localeCompare(hm(b.heure_debut)) || a.matiere.localeCompare(b.matiere, "fr"));

  const matiereOptions = Array.from(new Set(epreuves.map((e) => e.matiere))).sort();
  const dateOptionsAss = Array.from(new Set(epreuves.map((e) => e.date))).sort();
  const heureOptionsAss = Array.from(new Set(epreuves.map((e) => hm(e.heure_debut)))).sort();
  const candidatOptionsAss = Array.from(
    new Map(
      epreuves
        .filter((e) => e.candidat_id != null)
        .map((e) => [e.candidat_id as number, `${e.candidat_nom ?? ""} ${e.candidat_prenom ?? ""}`.trim()])
    ).entries()
  ).sort(([, a], [, b]) => a.localeCompare(b, "fr"));
  const plancheOptionsAss = Array.from(new Set(epreuves.map((e) => e.planche_nom).filter((n): n is string => !!n)))
    .sort((a, b) => a.localeCompare(b, "fr"));
  const examOptionsAss = Array.from(
    new Map(
      epreuves.flatMap((e) => [
        ...(e.examinateur_id ? [[e.examinateur_id, `${e.examinateur_nom ?? ""} ${e.examinateur_prenom ?? ""}`.trim()] as [number, string]] : []),
        ...(e.examinateur2_id ? [[e.examinateur2_id, `${e.examinateur2_nom ?? ""} ${e.examinateur2_prenom ?? ""}`.trim()] as [number, string]] : []),
      ])
    ).entries()
  ).sort(([, a], [, b]) => a.localeCompare(b, "fr"));
  const filtresAssActifs = [filterMatAss, filterDateAss, filterHeureAss, filterCandAss, filterPlancheAss, filterExamAss, rechercheAss].some(Boolean);
  const resetFiltresAss = () => {
    setFilterMatAss(""); setFilterDateAss(""); setFilterHeureAss("");
    setFilterCandAss(""); setFilterPlancheAss(""); setFilterExamAss(""); setRechercheAss("");
  };

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-semibold">Planches</h2>
          <p className="text-sm text-gray-700 mt-0.5">Gestion des sujets PDF et assignation aux épreuves</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-black/5 p-1 rounded-xl w-fit">
        {(["sujets", "assignation", "impression", "historique"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition ${
              tab === t ? "bg-white shadow text-black" : "text-gray-800 hover:text-black"
            }`}
          >
            {t === "sujets" ? "Gestion des sujets" : t === "assignation" ? "Assignation" : t === "impression" ? "Impression" : "Historique"}
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
                      <p className="text-xs text-gray-700 mt-1">{uploadFiles.map((f) => f.name).join(", ")}</p>
                      <p className="text-xs text-gray-700 mt-1">Cliquer pour changer</p>
                    </div>
                  ) : (
                    <div>
                      <Upload className="h-8 w-8 mx-auto mb-2 text-gray-700" />
                      <p className="text-sm text-gray-700">Cliquer pour sélectionner des PDFs</p>
                      <p className="text-xs text-gray-700 mt-1">Plusieurs fichiers acceptés · PDF uniquement</p>
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
                <button onClick={() => { setShowUpload(false); setUploadFiles([]); setUploadErr(""); }} className="text-sm text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-100 transition">Annuler</button>
                <Btn label="Injecter" disabled={uploadFiles.length === 0 || uploading} icon={uploading ? Loader2 : Upload} onClick={doUpload} />
              </div>
            </div>
          </Modal>

          {/* Table */}
          {loadingP ? (
            <div className="flex justify-center py-12 text-gray-700"><Spinner /></div>
          ) : planches.length === 0 ? (
            <Empty message="Aucun sujet chargé" sub="Cliquez sur « Injecter des sujets » pour importer des PDFs." />
          ) : (
            <div className="rounded-xl border bg-white shadow-sm overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-[#F5F5F5]">
                    {["Nom", "Matière", "Auteur", "Statut", "Assignée", ""].map((h) => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-800 tracking-wide">{h}</th>
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
                              <SelecteurCouleurPlanche planche={p} onChoisir={(c) => changerCouleur(p, c)} />
                              {p.nom}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-800">{p.matiere_intitule ?? <span className="text-gray-700 italic">—</span>}</td>
                          <td className="px-4 py-3 text-sm text-gray-800">{p.examinateur_nom ?? <span className="text-gray-700 italic">—</span>}</td>
                          <td className="px-4 py-3">
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${p.statut === "ACTIF" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-700"}`}>
                              {p.statut === "ACTIF" ? "Actif" : "Inactif"}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${p.assignee ? "bg-blue-100 text-blue-700" : "bg-gray-100 text-gray-700"}`}>
                              {p.assignee ? "Oui" : "Non"}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <div className="flex gap-1.5 justify-end">
                              <a
                                href={`/api/backend/planches/${p.id}/download`}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1 text-xs text-gray-800 hover:text-black px-2 py-1 rounded hover:bg-black/5 transition"
                              >
                                <Download className="h-3.5 w-3.5" />
                                PDF
                              </a>
                              <Btn label="Modifier" small variant="ghost" icon={Edit2} onClick={() => startEdit(p)} />
                              <button
                                onClick={() => doDelete(p.id)}
                                title={p.assignee ? "Supprimer (désassigne automatiquement les épreuves liées)" : "Supprimer"}
                                className="inline-flex items-center gap-1 text-xs text-red-500 px-2 py-1 rounded hover:bg-red-50 transition"
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
              <Select
                value={planningId}
                onChange={(e) => { setPlanningId(e.target.value === "" ? "" : Number(e.target.value)); resetFiltresAss(); }}
                className="min-w-[220px]"
              >
                <option value="">— Sélectionner un planning</option>
                {plannings.map((p) => <option key={p.id} value={p.id}>{p.nom}</option>)}
              </Select>
            </Field>
          </div>

          {/* Filtres sur toutes les colonnes */}
          {planningId !== "" && epreuves.length > 0 && (
            <div className="bg-white rounded-xl border border-black/10 shadow-sm p-4 space-y-3">
              <div className="grid gap-3 grid-cols-2 md:grid-cols-4 lg:grid-cols-7">
                <Field label="Recherche">
                  <Input
                    value={rechercheAss}
                    onChange={(e) => setRechercheAss(e.target.value)}
                    placeholder="Nom, planche…"
                  />
                </Field>
                <Field label="Date">
                  <Select value={filterDateAss} onChange={(e) => setFilterDateAss(e.target.value)}>
                    <option value="">Toutes</option>
                    {dateOptionsAss.map((d) => <option key={d} value={d}>{formatDateCourte(d)}</option>)}
                  </Select>
                </Field>
                <Field label="Matière">
                  <Select value={filterMatAss} onChange={(e) => setFilterMatAss(e.target.value)}>
                    <option value="">Toutes</option>
                    {matiereOptions.map((m) => <option key={m} value={m}>{m}</option>)}
                  </Select>
                </Field>
                <Field label="Horaire">
                  <Select value={filterHeureAss} onChange={(e) => setFilterHeureAss(e.target.value)}>
                    <option value="">Tous</option>
                    {heureOptionsAss.map((h) => <option key={h} value={h}>{h}</option>)}
                  </Select>
                </Field>
                <Field label="Examinateur">
                  <Select value={filterExamAss} onChange={(e) => setFilterExamAss(e.target.value)}>
                    <option value="">Tous</option>
                    <option value="aucun">— Non assigné —</option>
                    {examOptionsAss.map(([id, nom]) => <option key={id} value={String(id)}>{nom}</option>)}
                  </Select>
                </Field>
                <Field label="Candidat">
                  <Select value={filterCandAss} onChange={(e) => setFilterCandAss(e.target.value)}>
                    <option value="">Tous</option>
                    <option value="avec">— Avec candidat —</option>
                    <option value="sans">— Sans candidat —</option>
                    {candidatOptionsAss.map(([id, nom]) => <option key={id} value={String(id)}>{nom}</option>)}
                  </Select>
                </Field>
                <Field label="Planche">
                  <Select value={filterPlancheAss} onChange={(e) => setFilterPlancheAss(e.target.value)}>
                    <option value="">Toutes</option>
                    <option value="assignee">— Assignée —</option>
                    <option value="non_assignee">— Non assignée —</option>
                    {plancheOptionsAss.map((p) => <option key={p} value={p}>{p}</option>)}
                  </Select>
                </Field>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-900">
                  <span className="font-semibold">{epreuvesFiltrees.length}</span> épreuve{epreuvesFiltrees.length > 1 ? "s" : ""}
                  {filtresAssActifs && <> sur {epreuves.length}</>}
                  {" · "}
                  <span className="font-semibold">{epreuvesFiltrees.filter((e) => !e.planche_nom).length}</span> sans planche
                </span>
                {filtresAssActifs && (
                  <button onClick={resetFiltresAss} className="text-sm font-medium hover:underline" style={{ color: RED }}>
                    Réinitialiser les filtres
                  </button>
                )}
              </div>
            </div>
          )}

          {!planningId ? (
            <Empty message="Sélectionnez un planning" />
          ) : loadingEp ? (
            <div className="flex justify-center py-12 text-gray-700"><Spinner /></div>
          ) : epreuves.length === 0 ? (
            <Empty message="Aucune épreuve" />
          ) : epreuvesFiltrees.length === 0 ? (
            <Empty message="Aucune épreuve ne correspond aux filtres" />
          ) : (
            <div className="rounded-xl border bg-white shadow-sm overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-[#F5F5F5]">
                    {["Date", "Matière", "Horaire", "Examinateur(s)", "Candidat", "Code couleur", "Planche assignée", ""].map((h) => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-800 tracking-wide">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {epreuvesFiltrees.map((ep) => (
                    <tr key={ep.id} className="border-t border-black/5 hover:bg-black/[0.012]">
                      <td className="px-4 py-3 text-sm text-gray-900 tabular-nums whitespace-nowrap">{formatDateCourte(ep.date)}</td>
                      <td className="px-4 py-3 font-medium">{ep.matiere}</td>
                      <td className="px-4 py-3 text-sm text-gray-900 tabular-nums whitespace-nowrap">{hm(ep.heure_debut)} → {hm(ep.heure_fin)}</td>
                      <td className="px-4 py-3 text-sm text-gray-900">
                        {ep.examinateur_id || ep.examinateur2_id ? (
                          <div className="space-y-0.5">
                            {ep.examinateur_id && <div>{ep.examinateur_nom} {ep.examinateur_prenom}</div>}
                            {ep.examinateur2_id && (
                              <div>
                                {ep.examinateur2_nom} {ep.examinateur2_prenom}
                                <span className="ml-1.5 text-xs text-gray-700">(2ᵉ)</span>
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-gray-700 italic">Non assigné</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        {ep.candidat_nom
                          ? <span className="font-medium">{ep.candidat_nom} {ep.candidat_prenom}</span>
                          : <span className="text-gray-700 italic">—</span>}
                      </td>
                      <td className="px-4 py-3">
                        {ep.planche_id
                          ? <PastillePlanche id={ep.planche_id} nom={ep.planche_nom} />
                          : <span className="text-gray-700">—</span>}
                      </td>
                      <td className="px-4 py-3">
                        {ep.planche_nom ? (
                          <div className="flex items-center gap-2">
                            <FileText className="h-3.5 w-3.5 shrink-0" style={{ color: ep.planche_id ? couleurPlanche(ep.planche_id) : undefined }} />
                            <span className="text-sm font-medium text-gray-900">{ep.planche_nom}</span>
                          </div>
                        ) : (
                          <span className="text-xs text-gray-700 italic">Non assignée</span>
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
                              {ep.candidat_id && (() => {
                                const busy = loadingCartouche.has(ep.id);
                                const done = doneCartouche.has(ep.id);
                                return (
                                  <button
                                    onClick={() => doCartouche(ep.id, `${ep.planche_nom}_${ep.matiere}`)}
                                    disabled={busy}
                                    className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded transition font-medium ${
                                      busy ? "bg-amber-100 text-amber-700 cursor-wait"
                                      : done ? "bg-blue-100 text-blue-700 hover:bg-blue-200"
                                      : "bg-green-50 text-green-700 hover:bg-green-100"
                                    }`}
                                  >
                                    {busy
                                      ? <><Loader2 className="h-3.5 w-3.5 animate-spin" />Génération…</>
                                      : done
                                      ? <><CheckCircle2 className="h-3.5 w-3.5" />Téléchargé</>
                                      : <><Download className="h-3.5 w-3.5" />Cartouche</>
                                    }
                                  </button>
                                );
                              })()}
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
                <p className="text-sm text-gray-800">
                  Épreuve : <strong>{assignModal.matiere}</strong> · {formatDateCourte(assignModal.date)} · {hm(assignModal.heure_debut)}
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
                            <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold text-gray-800">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {planchesForAssign.map((p) => (
                          <tr key={p.id} className={`border-t border-black/5 ${assignModal.planche_id === p.id ? "bg-blue-50" : "hover:bg-black/[0.012]"}`}>
                            <td className="px-4 py-2.5 font-medium">
                              <div className="flex items-center gap-2">
                                <PastillePlanche id={p.id} nom={p.nom} />
                                {p.nom}
                              </div>
                            </td>
                            <td className="px-4 py-2.5 text-gray-800 text-xs">{p.examinateur_nom ?? "—"}</td>
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
      {tab === "historique" && <HistoriquePlanches />}

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
            {impPlanningId !== "" && impDatesPlanches.length > 0 && (
              <Field label="Date (planches assignées)">
                <Select
                  value={impDate}
                  onChange={(e) => { setImpDate(e.target.value); setImpMatiere(""); }}
                  className="min-w-[200px]"
                >
                  <option value="">Toutes les dates ({impAvecPlanche.length})</option>
                  {impDatesPlanches.map(([d, n]) => (
                    <option key={d} value={d}>{formatDateCourte(d)} — {n} planche{n > 1 ? "s" : ""}</option>
                  ))}
                </Select>
              </Field>
            )}
            {impMatieresOptions.length > 0 && (
              <Field label="Matière">
                <Select value={impMatiere} onChange={(e) => setImpMatiere(e.target.value)}>
                  <option value="">Toutes</option>
                  {impMatieresOptions.map((m) => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </Select>
              </Field>
            )}
            {(impDate || impMatiere) && (
              <button
                onClick={() => { setImpDate(""); setImpMatiere(""); }}
                className="text-sm font-medium hover:underline pb-2"
                style={{ color: RED }}
              >
                Réinitialiser
              </button>
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

          {!impPlanningId ? (
            <Empty message="Sélectionnez un planning" />
          ) : impLoading ? (
            <div className="flex justify-center py-12 text-gray-700"><Spinner /></div>
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
                    {["Matière", "Heure prépa", "Heure passage", "Candidat", "Planche", "Examinateur", "Examinateur 2"].map((h) => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-800 tracking-wide">{h}</th>
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
                        <td className="px-4 py-3 text-sm text-gray-800">{heurePrepa}</td>
                        <td className="px-4 py-3 text-sm text-gray-800">{hm(ep.heure_debut)}</td>
                        <td className="px-4 py-3 text-sm">
                          {ep.candidat_nom
                            ? <span className="font-medium">{ep.candidat_nom} {ep.candidat_prenom}</span>
                            : <span className="text-gray-700 italic">Non attribué</span>}
                        </td>
                        <td className="px-4 py-3">
                          {ep.planche_nom
                            ? <div className="flex items-center gap-1.5"><FileText className="h-3.5 w-3.5 text-blue-400 shrink-0" /><span className="text-sm">{ep.planche_nom}</span></div>
                            : <span className="text-gray-700 italic text-xs">—</span>}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900">
                          {ep.examinateur_nom
                            ? `${ep.examinateur_prenom ?? ""} ${ep.examinateur_nom}`.trim()
                            : <span className="text-gray-700 italic">—</span>}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900">
                          {ep.examinateur2_nom
                            ? `${ep.examinateur2_prenom ?? ""} ${ep.examinateur2_nom}`.trim()
                            : <span className="text-gray-700 italic">—</span>}
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
