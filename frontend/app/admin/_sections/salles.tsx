"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { useToast, useConfirm } from "../Toast";
import { Plus, Trash2, RotateCcw, Loader2, CheckCircle2, Building2 } from "lucide-react";
import {
  Btn,
  EpreuveFlat,
  Modal,
  Planning,
  RED,
  del,
  get,
  memoriserPlanning,
  patch,
  planningMemorise,
  post,
  put,
  useFiltre,
  useIntentionAffectation,
} from "./commun";

type Salle = {
  id: number;
  intitule: string;
  active: boolean;
};

// Barre de défilement horizontal dupliquée EN HAUT du tableau, synchronisée avec le
// défilement natif du bas — pour un tableau haut (beaucoup de créneaux), la barre de
// défilement du navigateur ne se voit qu'en bas, après avoir déjà tout parcouru
// verticalement. Cette barre du haut reste visible dès l'arrivée sur la section.
function SyncedScrollX({ children }: { children: React.ReactNode }) {
  const topRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const [scrollWidth, setScrollWidth] = useState(0);
  const [dragging, setDragging] = useState(false);
  const syncing = useRef(false);
  // startX/startScrollLeft : origine du glisser. moved : distance parcourue, pour
  // distinguer un simple clic (sur une case à cocher, un menu déroulant...) d'un
  // véritable glisser — sans ce seuil, cliquer sur "Salle d'examen" pour l'ouvrir
  // se ferait passer pour un (micro) déplacement et perturberait le clic normal.
  const drag = useRef({ active: false, startX: 0, startScrollLeft: 0, moved: 0 });

  useEffect(() => {
    const el = bottomRef.current;
    if (!el) return;
    const update = () => setScrollWidth(el.scrollWidth);
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  });

  const syncFrom = (source: "top" | "bottom") => {
    if (syncing.current) return;
    syncing.current = true;
    if (source === "top" && topRef.current && bottomRef.current) {
      bottomRef.current.scrollLeft = topRef.current.scrollLeft;
    } else if (source === "bottom" && topRef.current && bottomRef.current) {
      topRef.current.scrollLeft = bottomRef.current.scrollLeft;
    }
    syncing.current = false;
  };

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    // Ne démarre pas le glisser depuis un contrôle interactif (case à cocher, menu
    // déroulant, bouton...) : ceux-ci doivent garder un clic normal, sans interférence.
    const target = e.target as HTMLElement;
    if (target.closest("select, input, button, option, a")) return;
    if (!bottomRef.current) return;
    drag.current = { active: true, startX: e.clientX, startScrollLeft: bottomRef.current.scrollLeft, moved: 0 };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!drag.current.active || !bottomRef.current) return;
    const dx = e.clientX - drag.current.startX;
    drag.current.moved = Math.max(drag.current.moved, Math.abs(dx));
    if (drag.current.moved > 3) setDragging(true);
    bottomRef.current.scrollLeft = drag.current.startScrollLeft - dx;
  };
  const endDrag = () => {
    drag.current.active = false;
    setDragging(false);
  };

  return (
    <>
      <div
        ref={topRef}
        onScroll={() => syncFrom("top")}
        className="overflow-x-auto overflow-y-hidden"
        style={{ height: 12 }}
      >
        <div style={{ width: scrollWidth, height: 1 }} />
      </div>
      <div
        ref={bottomRef}
        onScroll={() => syncFrom("bottom")}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerLeave={endDrag}
        className={`overflow-x-auto ${dragging ? "cursor-grabbing select-none" : "cursor-grab"}`}
      >
        {children}
      </div>
    </>
  );
}

export function SallesSection() {
  const toast = useToast();
  const confirm = useConfirm();
  const intentionSalle = useIntentionAffectation("salle");
  const intentionSurv = useIntentionAffectation("surveillant");
  const intention = intentionSalle ?? intentionSurv;
  const [plannings, setPlannings] = useState<Planning[]>([]);
  const [planningId, setPlanningId] = useState<number | "">(intention?.planningId ?? "");
  const [salles, setSalles] = useState<Salle[]>([]);
  const [epreuves, setEpreuves] = useState<EpreuveFlat[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState<number | null>(null);
  const [newSalle, setNewSalle] = useState("");
  const [addingS, setAddingS] = useState(false);
  const [addErr, setAddErr] = useState("");
  const [filterMatiere, setFilterMatiere] = useFiltre("salles:matiere", intention?.matiere ?? "", planningId, !!intention);
  const [filterDate, setFilterDate] = useFiltre("salles:date", intention?.date ?? "", planningId, !!intention);
  const [filterHeure, setFilterHeure] = useFiltre("salles:heure", intention?.heure ?? "", planningId, !!intention);
  // "" = toutes, "none" = non affectée, sinon l'id de la salle (en string)
  const [filterSalle, setFilterSalle] = useFiltre("salles:salle", intentionSalle ? "none" : "", planningId, !!intention);
  // "" = tous, "none" = sans surveillant (ni 1er ni 2ᵉ), sinon l'id du surveillant
  const [filterSurvSalle, setFilterSurvSalle] = useFiltre("salles:surveillant", intentionSurv ? "none" : "", planningId, !!intention);
  // Ne montrer que les doublons (créneau avec plusieurs épreuves en parallèle) dont les
  // salles ne sont pas toutes distinctes — pas encore vérifiés/différenciés, donc à risque
  // (2 candidats pourraient se retrouver affectés à la même salle physique).
  const [filterAVerifier, setFilterAVerifier] = useFiltre("salles:averifier", false, planningId, !!intention);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkSalleId, setBulkSalleId] = useState<string>("");
  const [bulkSallePrepId, setBulkSallePrepId] = useState<string>("");
  // Salle parallèle visée par l'affectation groupée : "" = toutes, sinon le rang (#1, #2…)
  const [bulkRang, setBulkRang] = useState("");
  // Surveillants de l'affectation groupée : "" = inchangé, "null" = aucun, sinon l'id
  const [bulkSurvId, setBulkSurvId] = useState<string>("");
  const [bulkSurv2Id, setBulkSurv2Id] = useState<string>("");
  // Salles par défaut
  type SalleDefaut = { matiere: string; salle_id: number | null; salle_preparation_id: number | null; surveillant_id: number | null; surveillant2_id: number | null };
  type SurveillantItem = { id: number; nom: string; prenom: string; actif: boolean };
  const [defaults, setDefaults] = useState<SalleDefaut[]>([]);
  // Tableau tel qu'enregistré : une valeur présente ici et vidée dans `defaults` sera
  // retirée des épreuves qui l'ont encore (voir apply_salle_defaults)
  const [defautsEnregistres, setDefautsEnregistres] = useState<SalleDefaut[]>([]);
  // Réinitialisation : quoi vider, et sur quelles épreuves
  const [showReinit, setShowReinit] = useState(false);
  const [reinitChamps, setReinitChamps] = useState({ salle_id: true, salle_preparation_id: true, surveillant_id: false, surveillant2_id: false });
  const [reinitDefauts, setReinitDefauts] = useState(true);
  const [reinitPortee, setReinitPortee] = useState<"tout" | "affiches">("tout");
  const [reinitEnCours, setReinitEnCours] = useState(false);
  const [savingDefaults, setSavingDefaults] = useState(false);
  const [surveillants, setSurveillants] = useState<SurveillantItem[]>([]);

  const reloadSalles = useCallback(() => {
    get<Salle[]>("parametrages/salles/").then(setSalles).catch(() => {});
  }, []);

  useEffect(() => {
    get<Planning[]>("plannings/").then((ps) => {
      setPlannings(ps);
      setPlanningId((cur) => cur || planningMemorise(ps) || cur);
    }).catch(() => {});
    reloadSalles();
  }, [reloadSalles]);
  useEffect(() => memoriserPlanning(planningId), [planningId]);

  useEffect(() => {
    if (!planningId) { setEpreuves([]); setDefaults([]); setSurveillants([]); return; }
    setLoading(true);
    Promise.all([
      get<EpreuveFlat[]>(`plannings/${planningId}/epreuves`),
      get<SalleDefaut[]>(`plannings/${planningId}/salle-defaults`),
      get<SurveillantItem[]>(`surveillants/?planning_id=${planningId}`),
    ])
      .then(([eps, defs, survs]) => { setEpreuves(eps); setDefaults(defs); setDefautsEnregistres(defs); setSurveillants(survs); })
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
      // Enregistre le tableau et l'applique en une requête ; « — Aucune — » à la place d'une
      // valeur enregistrée retire cette valeur des épreuves qui l'ont encore
      const r = await post<{ updated: number; retirees?: number; renseignes?: number }>(
        `plannings/${planningId}/salle-defaults/apply`, { defauts: defaults }
      );
      const retirees = r.retirees ?? 0;
      if (r.updated === 0) {
        toast.success(r.renseignes
          ? "Aucune épreuve modifiée : elles avaient déjà ces salles et surveillants."
          : "Aucune épreuve modifiée : le tableau est vide.");
      } else {
        toast.success(`${r.updated} épreuve(s) modifiée(s)${retirees ? `, dont ${retirees} vidée(s) des valeurs retirées du tableau` : ""}`);
      }
      const [eps, defs] = await Promise.all([
        get<EpreuveFlat[]>(`plannings/${planningId}/epreuves`),
        get<SalleDefaut[]>(`plannings/${planningId}/salle-defaults`),
      ]);
      setEpreuves(eps);
      setDefaults(defs);
      setDefautsEnregistres(defs);
    } catch (e) { toast.error(e instanceof Error ? e.message : "Erreur"); }
    finally { setSavingDefaults(false); }
  }

  // Affectation d'UNE SEULE épreuve — nécessaire pour le dédoublement de jury : avec
  // plusieurs salles en parallèle sur le même créneau, chaque salle doit pouvoir recevoir
  // une salle physique différente, pas la même pour toutes (l'affectation groupée reste
  // possible en sélectionnant le créneau puis en utilisant la barre "Modifications
  // ponctuelles" plus haut, qui vise elle toutes les épreuves du groupe à la fois).
  async function assignSalleSingle(
    epreuveId: number,
    field: "salle_id" | "salle_preparation_id" | "surveillant_id" | "surveillant2_id",
    value: number | null
  ) {
    setSaving(epreuveId);
    try {
      await patch(`plannings/${planningId}/epreuves/${epreuveId}`, { [field]: value });
      setEpreuves((prev) =>
        prev.map((e) => {
          if (e.id !== epreuveId) return e;
          if (field === "surveillant_id" || field === "surveillant2_id") {
            const surv = surveillants.find((s) => s.id === value) ?? null;
            const nomField = field === "surveillant_id" ? "surveillant_nom" : "surveillant2_nom";
            const prenomField = field === "surveillant_id" ? "surveillant_prenom" : "surveillant2_prenom";
            return { ...e, [field]: value, [nomField]: surv?.nom ?? null, [prenomField]: surv?.prenom ?? null };
          }
          const intituleField = field === "salle_id" ? "salle_intitule" : "salle_preparation_intitule";
          const salle = salles.find((s) => s.id === value) ?? null;
          // Changer la salle d'examen annule une éventuelle validation de doublon
          // antérieure — jamais l'inverse (voir estAVerifier / patch_epreuve).
          const verifieePatch = field === "salle_id" ? { salle_verifiee: false } : {};
          return { ...e, [field]: value, [intituleField]: salle?.intitule ?? null, ...verifieePatch };
        })
      );
    } finally {
      setSaving(null);
    }
  }

  // Validation explicite d'un doublon : seule action qui fait disparaître le groupe du
  // filtre "Doublons à vérifier" — jamais un simple choix de salle dans la liste.
  async function validerGroupe(epreuveIds: number[]) {
    setSaving(-1);
    try {
      await post(`plannings/${planningId}/epreuves/affecter-groupe`, { epreuve_ids: epreuveIds, salle_verifiee: true });
      setEpreuves((prev) => prev.map((e) => (epreuveIds.includes(e.id) ? { ...e, salle_verifiee: true } : e)));
      toast.success("Doublon validé");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erreur");
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
      // Une seule requête pour toutes les épreuves (une par épreuve et par champ saturait
      // le navigateur : ERR_INSUFFICIENT_RESOURCES)
      const ids = epreuves
        .filter((e) => selected.has(`${e.date}||${e.matiere}||${e.heure_debut}`) && estDansRang(e))
        .map((e) => e.id);
      const champs: Record<string, number | null> = {};
      if (bulkSalleId !== "") champs.salle_id = bulkSalleId && bulkSalleId !== "null" ? Number(bulkSalleId) : null;
      if (bulkSallePrepId !== "") champs.salle_preparation_id = bulkSallePrepId && bulkSallePrepId !== "null" ? Number(bulkSallePrepId) : null;
      if (bulkSurvId !== "") champs.surveillant_id = bulkSurvId === "null" ? null : Number(bulkSurvId);
      if (bulkSurv2Id !== "") champs.surveillant2_id = bulkSurv2Id === "null" ? null : Number(bulkSurv2Id);
      if (ids.length > 0) await post(`plannings/${planningId}/epreuves/affecter-groupe`, { epreuve_ids: ids, ...champs });
      setEpreuves((prev) =>
        prev.map((e) => {
          const key = `${e.date}||${e.matiere}||${e.heure_debut}`;
          if (!selected.has(key) || !estDansRang(e)) return e;
          const updates: Partial<EpreuveFlat> = {};
          if (bulkSalleId !== "") {
            updates.salle_id = bulkSalleId !== "null" ? Number(bulkSalleId) : null;
            updates.salle_intitule = salles.find((s) => s.id === Number(bulkSalleId))?.intitule ?? null;
            updates.salle_verifiee = false;
          }
          if (bulkSallePrepId !== "") {
            updates.salle_preparation_id = bulkSallePrepId !== "null" ? Number(bulkSallePrepId) : null;
            updates.salle_preparation_intitule = salles.find((s) => s.id === Number(bulkSallePrepId))?.intitule ?? null;
          }
          if (bulkSurvId !== "") {
            const s = bulkSurvId === "null" ? null : surveillants.find((x) => x.id === Number(bulkSurvId)) ?? null;
            updates.surveillant_id = s?.id ?? null;
            updates.surveillant_nom = s?.nom ?? null;
            updates.surveillant_prenom = s?.prenom ?? null;
          }
          if (bulkSurv2Id !== "") {
            const s = bulkSurv2Id === "null" ? null : surveillants.find((x) => x.id === Number(bulkSurv2Id)) ?? null;
            updates.surveillant2_id = s?.id ?? null;
            updates.surveillant2_nom = s?.nom ?? null;
            updates.surveillant2_prenom = s?.prenom ?? null;
          }
          return { ...e, ...updates };
        })
      );
      setSelected(new Set());
      setBulkSalleId("");
      setBulkSallePrepId("");
      setBulkSurvId("");
      setBulkSurv2Id("");
      setBulkRang("");
      toast.success(`Affectation appliquée à ${selected.size} groupe(s)${bulkRang ? ` (salle #${bulkRang} uniquement)` : ""}`);
    } finally {
      setSaving(null);
    }
  }

  // Rang (#1, #2…) de chaque épreuve parmi les salles parallèles de son créneau
  // (même date, matière, heure), calculé sur TOUT le planning : il ne change pas
  // selon les filtres, et c'est le même dans le tableau et l'affectation groupée.
  const rangParallele = new Map<number, number>();
  const tailleCreneau = new Map<string, number>();
  for (const e of epreuves) {
    const k = `${e.date}||${e.matiere}||${e.heure_debut}`;
    const n = (tailleCreneau.get(k) ?? 0) + 1;
    tailleCreneau.set(k, n);
    rangParallele.set(e.id, n);
  }
  const estDansRang = (e: EpreuveFlat) => !bulkRang || rangParallele.get(e.id) === Number(bulkRang);
  // Rangs proposés dans la barre : jusqu'au plus grand nombre de salles parallèles sélectionnées
  const maxRangSelection = Math.max(0, ...Array.from(selected).map((k) => tailleCreneau.get(k) ?? 0));

  // ── Occupations simultanées ──────────────────────────────────────────────────
  // Une salle d'examen ne reçoit qu'une épreuve à la fois (et ne peut pas servir en même
  // temps de salle de préparation), un surveillant ne surveille qu'une épreuve à la fois.
  // Les salles de préparation peuvent en revanche être partagées entre candidats.
  // Calculé sur tout le planning (pas seulement les lignes filtrées) : les choix qui
  // créeraient un conflit sont grisés dans les listes déroulantes.
  const enMin = (h: string | null | undefined) => {
    const [hh, mm] = (h ?? "00:00").slice(0, 5).split(":").map(Number);
    return hh * 60 + (mm || 0);
  };
  const epreuvesParDate = epreuves.reduce<Record<string, EpreuveFlat[]>>((acc, e) => {
    (acc[e.date] ??= []).push(e);
    return acc;
  }, {});
  const seChevauchent = (a1: number, a2: number, b1: number, b2: number) => a1 < b2 && b1 < a2;
  const libelleOccupation = (o: EpreuveFlat) =>
    `${o.matiere} ${o.heure_debut.slice(0, 5)}${(tailleCreneau.get(`${o.date}||${o.matiere}||${o.heure_debut}`) ?? 0) > 1 ? ` #${rangParallele.get(o.id)}` : ""}`;

  type Occupation = { salles: Map<number, string>; prepas: Map<number, string>; survs: Map<number, string> };
  // Ce qui est déjà pris, sur le créneau de chacune des épreuves `cibles`, par les AUTRES
  // épreuves : salles (pour la salle d'examen), salles (pour la préparation), surveillants
  function occupations(cibles: EpreuveFlat[]): Occupation {
    const occ: Occupation = { salles: new Map(), prepas: new Map(), survs: new Map() };
    const ids = new Set(cibles.map((c) => c.id));
    for (const ep of cibles) {
      const d = enMin(ep.heure_debut);
      const f = enMin(ep.heure_fin);
      const p = d - (ep.preparation_minutes ?? 0);
      for (const o of epreuvesParDate[ep.date] ?? []) {
        if (ids.has(o.id)) continue;
        const od = enMin(o.heure_debut);
        const of = enMin(o.heure_fin);
        const op = od - (o.preparation_minutes ?? 0);
        const lib = libelleOccupation(o);
        if (seChevauchent(d, f, od, of)) {
          if (o.salle_id) occ.salles.set(o.salle_id, `examen ${lib}`);
          if (o.surveillant_id) occ.survs.set(o.surveillant_id, lib);
          if (o.surveillant2_id) occ.survs.set(o.surveillant2_id, lib);
        }
        // Salle de préparation d'une autre épreuve pendant le passage de celle-ci
        if (o.salle_preparation_id && op < od && seChevauchent(d, f, op, od) && !occ.salles.has(o.salle_preparation_id)) {
          occ.salles.set(o.salle_preparation_id, `préparation ${lib}`);
        }
        // Salle d'examen d'une autre épreuve pendant la préparation de celle-ci
        if (o.salle_id && p < d && seChevauchent(p, d, od, of)) occ.prepas.set(o.salle_id, `examen ${lib}`);
      }
    }
    return occ;
  }

  // Les cibles se chevauchent-elles entre elles ? (même jour, horaires qui se recouvrent) :
  // une même salle d'examen ou un même surveillant ne peut alors pas leur être donné à toutes
  function ciblesSeChevauchent(cibles: EpreuveFlat[]) {
    const parJour = cibles.reduce<Record<string, EpreuveFlat[]>>((acc, e) => { (acc[e.date] ??= []).push(e); return acc; }, {});
    return Object.values(parJour).some((eps) => {
      const tries = [...eps].sort((a, b) => enMin(a.heure_debut) - enMin(b.heure_debut));
      return tries.some((e, i) => i > 0 && enMin(e.heure_debut) < enMin(tries[i - 1].heure_fin));
    });
  }

  // Options d'une liste : grisées (non sélectionnables) si déjà prises sur le créneau ;
  // la valeur actuelle reste choisie, signalée « conflit » si elle en crée un.
  function optionsOccupees<T extends { id: number }>(liste: T[], libelle: (x: T) => string, prises: Map<number, string>, courant: number | null, toutBloquer = false) {
    return liste.map((x) => {
      const raison = prises.get(x.id);
      const bloquee = x.id !== courant && (toutBloquer || !!raison);
      return (
        <option key={x.id} value={x.id} disabled={bloquee}>
          {libelle(x)}
          {raison ? (x.id === courant ? ` ⚠ conflit (${raison})` : ` — pris (${raison})`) : ""}
        </option>
      );
    });
  }
  const nomSalle = (x: Salle) => x.intitule;
  const nomSurv = (x: SurveillantItem) => `${x.nom} ${x.prenom}`;

  // Barre d'affectation groupée : épreuves visées et ce qui est pris autour d'elles
  const ciblesBulk = selected.size > 0
    ? epreuves.filter((e) => selected.has(`${e.date}||${e.matiere}||${e.heure_debut}`) && estDansRang(e))
    : [];
  const occBulk = occupations(ciblesBulk);
  const chevauchementBulk = ciblesSeChevauchent(ciblesBulk);

  const matieres = Array.from(new Set(epreuves.map((e) => e.matiere))).sort();
  const heures = Array.from(new Set(epreuves.map((e) => e.heure_debut))).sort();
  const filtered = epreuves
    .filter((e) => !filterMatiere || e.matiere === filterMatiere)
    .filter((e) => !filterDate || e.date === filterDate)
    .filter((e) => !filterHeure || e.heure_debut === filterHeure)
    .filter((e) => {
      if (!filterSalle) return true;
      if (filterSalle === "none") return e.salle_id == null;
      return e.salle_id === Number(filterSalle);
    })
    .filter((e) => {
      if (!filterSurvSalle) return true;
      if (filterSurvSalle === "none") return e.surveillant_id == null && e.surveillant2_id == null;
      return e.surveillant_id === Number(filterSurvSalle) || e.surveillant2_id === Number(filterSurvSalle);
    });

  // Grouper par (date, matière, heure) — granularité à l'heure plutôt qu'à la demi-journée :
  // deux créneaux de la même matière le même jour peuvent recevoir des salles différentes.
  // Si salles_par_matiere > 1, plusieurs épreuves partagent la même (date, matière, heure) —
  // g.epreuves peut alors avoir plus d'une entrée pour ce même créneau (salles dupliquées).
  type GroupKey = { date: string; matiere: string; heure_debut: string };
  const groupMap = filtered.reduce<Record<string, EpreuveFlat[]>>((acc, e) => {
    const k = `${e.date}||${e.matiere}||${e.heure_debut}`;
    (acc[k] ??= []).push(e);
    return acc;
  }, {});
  const groups: (GroupKey & { epreuves: EpreuveFlat[] })[] = Object.entries(groupMap)
    .map(([k, eps]) => {
      const [date, matiere, heure_debut] = k.split("||");
      return { date, matiere, heure_debut, epreuves: eps };
    })
    // Tri par heure d'abord (puis matière) — pour naviguer créneau par créneau,
    // toutes matières confondues, plutôt que de devoir parcourir toute une matière
    // avant d'atteindre la suivante à la même heure.
    .sort((a, b) => a.date.localeCompare(b.date) || a.heure_debut.localeCompare(b.heure_debut) || a.matiere.localeCompare(b.matiere));

  // "À vérifier" : doublon (plusieurs épreuves en parallèle sur ce créneau) pas encore
  // explicitement validé par l'admin. Ne se résout JAMAIS tout seul en choisissant une
  // salle dans la liste déroulante — seul le bouton "Valider" (qui coche salle_verifiee)
  // fait disparaître le groupe du filtre ; changer à nouveau la salle après coup annule la
  // validation (voir patch_epreuve côté backend).
  const estAVerifier = (g: { epreuves: EpreuveFlat[] }) => {
    if (g.epreuves.length < 2) return false;
    return !g.epreuves.every((e) => e.salle_verifiee);
  };
  const groupsAffiches = filterAVerifier ? groups.filter(estAVerifier) : groups;

  const dates = Array.from(new Set(groupsAffiches.map((g) => g.date))).sort();

  const activeSalles = salles.filter((s) => s.active);

  // Réinitialisation : vide les champs cochés sur tout le planning ou sur les créneaux
  // affichés (filtres), en une requête, et vide si demandé le tableau des salles par défaut
  const epreuvesAffichees = groupsAffiches.flatMap((g) => g.epreuves);
  const ciblesReinit = reinitPortee === "tout" ? epreuves : epreuvesAffichees;
  const champsReinit = (Object.keys(reinitChamps) as (keyof typeof reinitChamps)[]).filter((c) => reinitChamps[c]);
  async function reinitialiser() {
    if (!planningId) return;
    setReinitEnCours(true);
    try {
      if (champsReinit.length > 0 && ciblesReinit.length > 0) {
        await post(`plannings/${planningId}/epreuves/affecter-groupe`, {
          epreuve_ids: ciblesReinit.map((e) => e.id),
          ...Object.fromEntries(champsReinit.map((c) => [c, null])),
        });
      }
      if (reinitDefauts) await put(`plannings/${planningId}/salle-defaults`, []);
      const [eps, defs] = await Promise.all([
        get<EpreuveFlat[]>(`plannings/${planningId}/epreuves`),
        get<SalleDefaut[]>(`plannings/${planningId}/salle-defaults`),
      ]);
      setEpreuves(eps);
      setDefaults(defs);
      setDefautsEnregistres(defs);
      setSelected(new Set());
      setShowReinit(false);
      toast.success(`Réinitialisation faite${champsReinit.length ? ` sur ${ciblesReinit.length} épreuve(s)` : ""}${reinitDefauts ? ", salles par défaut vidées" : ""}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erreur");
    } finally {
      setReinitEnCours(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="h-9 w-9 rounded-xl grid place-items-center text-white" style={{ backgroundColor: RED }}>
          <Building2 className="h-5 w-5" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-gray-900">Salles &amp; surveillants</h2>
          <p className="text-xs text-gray-700">Affectez une salle d'examen et une salle de préparation à chaque créneau</p>
        </div>
      </div>

      <div className="space-y-5">
        {/* Panneau salles */}
        <div className="w-full bg-white rounded-2xl border border-black/5 shadow-sm p-4 space-y-3">
          <p className="text-xs font-semibold text-gray-700 uppercase tracking-wide">Salles disponibles</p>

          {/* Ajouter une salle */}
          <div className="flex gap-1.5 max-w-sm">
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
          <div className="grid gap-2 grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8">
            {salles.length === 0 && (
              <p className="col-span-full text-sm text-gray-800 py-2">Aucune salle</p>
            )}
            {salles.map((s) => (
              <div key={s.id} className="flex items-center gap-2 px-3 py-2 bg-white rounded-xl border border-black/10 hover:bg-black/[0.02]">
                <button
                  onClick={() => toggleSalle(s)}
                  title={s.active ? "Désactiver" : "Activer"}
                  className={`h-4 w-4 rounded border flex-shrink-0 transition ${s.active ? "bg-emerald-500 border-emerald-500" : "border-black/20"}`}
                >
                  {s.active && <CheckCircle2 className="h-3 w-3 text-white m-auto" />}
                </button>
                <span className={`flex-1 text-sm font-mono ${s.active ? "text-gray-900" : "text-gray-700 line-through"}`}>
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
          <p className="text-[11px] text-gray-700">
            {activeSalles.length} salle(s) active(s) · Cochez pour activer/désactiver
          </p>
        </div>

        {/* Panneau épreuves */}
        <div className="w-full min-w-0 space-y-4">

          {/* Salles par défaut */}
          {planningId !== "" && (
            <div className="bg-white rounded-2xl border border-black/5 shadow-sm p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-gray-800 uppercase tracking-wide">Salles par défaut par matière</p>
                  <p className="text-[11px] text-gray-700 mt-0.5">
                    Choisissez une salle ou un surveillant par matière, puis « Appliquer à toutes les épreuves ». Appliquées aussi
                    automatiquement à la génération et à l&apos;ajout de créneau. Remettre « — Aucune — » à la place d&apos;une valeur
                    appliquée la retire des épreuves qui l&apos;ont encore (les affectations faites à la main sont gardées).
                    Pour affecter seulement certains créneaux, utilisez la sélection plus bas.
                  </p>
                </div>
                <button
                  onClick={applyDefaults}
                  disabled={savingDefaults || (
                    !defaults.some((d) => d.salle_id != null || d.salle_preparation_id != null || d.surveillant_id != null || d.surveillant2_id != null)
                    && !defautsEnregistres.some((d) => d.salle_id != null || d.salle_preparation_id != null || d.surveillant_id != null || d.surveillant2_id != null)
                  )}
                  title="Choisissez d'abord au moins une salle ou un surveillant dans le tableau"
                  className="text-xs px-3 py-1.5 rounded-lg text-white font-medium hover:opacity-90 transition disabled:opacity-40 flex items-center gap-1.5" style={{ backgroundColor: RED }}>
                  {savingDefaults && <Loader2 className="h-3 w-3 animate-spin" />}
                  Appliquer à toutes les épreuves
                </button>
              </div>
              {matieres.length === 0 ? (
                <p className="text-xs text-gray-700">Aucune matière trouvée pour ce planning.</p>
              ) : (
                <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-black/5">
                      <th className="text-left py-1.5 text-gray-700 font-medium w-36">Matière</th>
                      <th className="text-left py-1.5 text-gray-800 font-semibold">Salle d'examen</th>
                      <th className="text-left py-1.5 text-gray-700 font-medium">Salle de préparation</th>
                      <th className="text-left py-1.5 text-gray-700 font-medium">Surveillant</th>
                      <th className="text-left py-1.5 text-gray-700 font-medium">Surveillant 2</th>
                    </tr>
                  </thead>
                  <tbody>
                    {matieres.map((m) => {
                      const d = defaults.find((x) => x.matiere === m);
                      const setD = (patch: Partial<SalleDefaut>) =>
                        setDefaults((prev) => {
                          const next = prev.filter((x) => x.matiere !== m);
                          return [...next, { matiere: m, salle_id: d?.salle_id ?? null, salle_preparation_id: d?.salle_preparation_id ?? null, surveillant_id: d?.surveillant_id ?? null, surveillant2_id: d?.surveillant2_id ?? null, ...patch }];
                        });
                      return (
                        <tr key={m} className="border-b border-black/[0.04] last:border-0">
                          <td className="py-2 font-medium text-gray-900">{m}</td>
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
                          <td className="py-2 pr-3">
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
                          <td className="py-2">
                            <select
                              value={d?.surveillant2_id ?? ""}
                              onChange={(e) => setD({ surveillant2_id: e.target.value ? Number(e.target.value) : null })}
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
              )}
            </div>
          )}

          <Modal open={showReinit} onClose={() => setShowReinit(false)} title="Réinitialiser les affectations">
            <div className="space-y-4 text-sm text-gray-900">
              <div>
                <p className="font-semibold mb-1.5">À vider</p>
                {([
                  ["salle_id", "Salles d'examen"],
                  ["salle_preparation_id", "Salles de préparation"],
                  ["surveillant_id", "Surveillants"],
                  ["surveillant2_id", "Surveillants 2"],
                ] as const).map(([c, libelle]) => (
                  <label key={c} className="flex items-center gap-2 py-0.5 cursor-pointer">
                    <input type="checkbox" checked={reinitChamps[c]}
                      onChange={(e) => setReinitChamps((prev) => ({ ...prev, [c]: e.target.checked }))} />
                    {libelle}
                  </label>
                ))}
                <label className="flex items-center gap-2 py-0.5 cursor-pointer">
                  <input type="checkbox" checked={reinitDefauts} onChange={(e) => setReinitDefauts(e.target.checked)} />
                  Tableau « Salles par défaut par matière »
                </label>
              </div>
              <div>
                <p className="font-semibold mb-1.5">Sur quelles épreuves</p>
                <label className="flex items-center gap-2 py-0.5 cursor-pointer">
                  <input type="radio" checked={reinitPortee === "tout"} onChange={() => setReinitPortee("tout")} />
                  Tout le planning ({epreuves.length} épreuve{epreuves.length > 1 ? "s" : ""})
                </label>
                <label className="flex items-center gap-2 py-0.5 cursor-pointer">
                  <input type="radio" checked={reinitPortee === "affiches"} onChange={() => setReinitPortee("affiches")} />
                  Seulement les créneaux affichés avec les filtres actuels ({epreuvesAffichees.length} épreuve{epreuvesAffichees.length > 1 ? "s" : ""})
                </label>
              </div>
              <p className="text-xs text-gray-800 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2">
                Les inscriptions des candidats ne sont pas touchées. Les créneaux libres sans salle ou sans
                surveillant ne sont plus visibles des candidats tant qu&apos;ils ne sont pas réaffectés.
              </p>
              <div className="flex justify-end gap-2">
                <Btn label="Annuler" variant="ghost" small onClick={() => setShowReinit(false)} />
                <Btn
                  label={reinitEnCours ? "Réinitialisation…" : "Réinitialiser"}
                  icon={reinitEnCours ? Loader2 : RotateCcw}
                  variant="danger"
                  small
                  disabled={reinitEnCours || (!reinitDefauts && (champsReinit.length === 0 || ciblesReinit.length === 0))}
                  onClick={reinitialiser}
                />
              </div>
            </div>
          </Modal>

          {/* Sélection planning + filtre matière */}
          <div className="bg-white rounded-2xl border border-black/5 shadow-sm p-4 flex gap-3 flex-wrap">
            <div className="flex-1 min-w-[180px]">
              <label className="text-xs text-gray-700 mb-1 block">Planning</label>
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
                <label className="text-xs text-gray-700 mb-1 block">Filtrer par matière</label>
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
                <label className="text-xs text-gray-700 mb-1 block">Filtrer par journée</label>
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
            {heures.length > 0 && (
              <div className="flex-1 min-w-[140px]">
                <label className="text-xs text-gray-700 mb-1 block">Filtrer par heure</label>
                <select
                  value={filterHeure}
                  onChange={(e) => setFilterHeure(e.target.value)}
                  className="w-full border rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-black/15"
                >
                  <option value="">Toutes</option>
                  {heures.map((h) => (
                    <option key={h} value={h}>{h.slice(0, 5)}</option>
                  ))}
                </select>
              </div>
            )}
            {epreuves.length > 0 && (
              <div className="flex-1 min-w-[160px]">
                <label className="text-xs text-gray-700 mb-1 block">Filtrer par salle d&apos;examen</label>
                <select
                  value={filterSalle}
                  onChange={(e) => setFilterSalle(e.target.value)}
                  className="w-full border rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-black/15"
                >
                  <option value="">Toutes</option>
                  <option value="none">Non affectée</option>
                  {activeSalles.map((s) => (
                    <option key={s.id} value={s.id}>{s.intitule}</option>
                  ))}
                </select>
              </div>
            )}
            {epreuves.length > 0 && (
              <div className="flex-1 min-w-[160px]">
                <label className="text-xs text-gray-700 mb-1 block">Filtrer par surveillant</label>
                <select
                  value={filterSurvSalle}
                  onChange={(e) => setFilterSurvSalle(e.target.value)}
                  className="w-full border rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-black/15"
                >
                  <option value="">Tous</option>
                  <option value="none">Sans surveillant</option>
                  {surveillants.map((s) => (
                    <option key={s.id} value={s.id}>{s.nom} {s.prenom}{s.actif ? "" : " (inactif)"}</option>
                  ))}
                </select>
              </div>
            )}
            {epreuves.length > 0 && (
              <div className="flex items-end pb-0.5">
                <label
                  className="flex items-center gap-1.5 text-sm text-gray-800 px-3 py-2 rounded-lg border bg-white cursor-pointer whitespace-nowrap"
                  title="Doublons (plusieurs salles en parallèle sur le même créneau) dont les salles ne sont pas toutes distinctes — non affectées ou affectées à la même salle physique, donc à risque de conflit"
                >
                  <input type="checkbox" checked={filterAVerifier} onChange={(e) => setFilterAVerifier(e.target.checked)} className="cursor-pointer" />
                  Doublons à vérifier
                </label>
              </div>
            )}
            {planningId !== "" && (
              <div className="flex items-end pb-0.5 ml-auto">
                <Btn label="Réinitialiser…" icon={RotateCcw} variant="danger" onClick={() => setShowReinit(true)} />
              </div>
            )}
          </div>

          {/* Barre de sélection groupée */}
          {selected.size > 0 && (
            <div className="bg-white rounded-2xl border border-black/5 shadow-sm px-4 py-3 flex items-center gap-3 flex-wrap">
              <span className="text-xs font-semibold text-gray-800">{selected.size} créneau(x) sélectionné(s)</span>
              {maxRangSelection > 1 && (
                <select
                  value={bulkRang}
                  onChange={(e) => setBulkRang(e.target.value)}
                  title="Salles parallèles concernées par l'affectation"
                  className="border rounded-lg px-2 py-1.5 text-xs bg-white text-gray-900 focus:outline-none focus:ring-1 focus:ring-black/15"
                >
                  <option value="">Toutes les salles parallèles</option>
                  {Array.from({ length: maxRangSelection }, (_, i) => String(i + 1)).map((r) => (
                    <option key={r} value={r}>Salle #{r} uniquement</option>
                  ))}
                </select>
              )}
              <select
                value={bulkSalleId}
                onChange={(e) => setBulkSalleId(e.target.value)}
                className="border rounded-lg px-2 py-1.5 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-black/15"
              >
                <option value="">— Salle d'examen —</option>
                <option value="null">Aucune</option>
                {optionsOccupees(activeSalles, nomSalle, occBulk.salles, null, chevauchementBulk)}
              </select>
              <select
                value={bulkSallePrepId}
                onChange={(e) => setBulkSallePrepId(e.target.value)}
                className="border rounded-lg px-2 py-1.5 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-black/15"
              >
                <option value="">— Salle de préparation —</option>
                <option value="null">Aucune</option>
                {optionsOccupees(activeSalles, nomSalle, occBulk.prepas, null)}
              </select>
              <select
                value={bulkSurvId}
                onChange={(e) => setBulkSurvId(e.target.value)}
                className="border rounded-lg px-2 py-1.5 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-black/15"
              >
                <option value="">— Surveillant —</option>
                <option value="null">Aucun</option>
                {optionsOccupees(surveillants.filter((s) => s.actif), nomSurv, occBulk.survs, null, chevauchementBulk)}
              </select>
              <select
                value={bulkSurv2Id}
                onChange={(e) => setBulkSurv2Id(e.target.value)}
                className="border rounded-lg px-2 py-1.5 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-black/15"
              >
                <option value="">— Surveillant 2 —</option>
                <option value="null">Aucun</option>
                {optionsOccupees(
                  surveillants.filter((s) => s.actif && String(s.id) !== bulkSurvId), nomSurv, occBulk.survs, null, chevauchementBulk,
                )}
              </select>
              <button
                onClick={applyBulkSelection}
                disabled={saving === -1 || (bulkSalleId === "" && bulkSallePrepId === "" && bulkSurvId === "" && bulkSurv2Id === "")}
                className="px-3 py-1.5 rounded-lg text-xs text-white font-medium disabled:opacity-40 transition"
                style={{ backgroundColor: RED }}
              >
                Appliquer
              </button>
              <button onClick={() => { setSelected(new Set()); setBulkRang(""); }} className="text-xs text-gray-700 hover:text-black transition ml-auto">
                Annuler
              </button>
              {chevauchementBulk && (
                <p className="basis-full text-xs text-amber-900">
                  Les créneaux sélectionnés ont lieu en même temps : une même salle d&apos;examen ou un même surveillant ne peut pas leur être donné à tous
                  (choix grisés).{maxRangSelection > 1 ? " Choisissez « Salle #N uniquement » pour affecter un jury à la fois, ou réduisez la sélection." : " Réduisez la sélection."}
                </p>
              )}
            </div>
          )}

          {/* Modifications ponctuelles */}
          {planningId !== "" && dates.length > 0 && (
            <div className="flex items-center gap-2 pt-1">
              <p className="text-xs font-semibold text-gray-700 uppercase tracking-wide">Modifications ponctuelles</p>
              <div className="flex-1 h-px bg-black/[0.06]" />
            </div>
          )}

          {/* Tableau */}
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="h-6 w-6 animate-spin text-gray-700" />
            </div>
          ) : !planningId ? (
            <div className="bg-white rounded-2xl border border-black/5 shadow-sm p-12 text-center">
              <Building2 className="h-10 w-10 mx-auto mb-3 text-gray-700" />
              <p className="text-sm text-gray-700">Sélectionnez un planning pour affecter les salles</p>
            </div>
          ) : dates.length === 0 ? (
            <div className="bg-white rounded-2xl border border-black/5 shadow-sm p-12 text-center">
              <p className="text-sm text-gray-700">
                {filterAVerifier ? "Aucun doublon à vérifier — toutes les salles en parallèle sont bien distinctes." : "Aucun créneau trouvé pour ce planning."}
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {dates.map((date) => {
                const dayGroups = groupsAffiches.filter((g) => g.date === date);
                return (
                  <div key={date} className="bg-white rounded-2xl border border-black/5 shadow-sm overflow-hidden">
                    <div className="px-4 py-2.5 bg-black/[0.02] border-b border-black/5">
                      <span className="text-xs font-semibold text-gray-800">
                        {new Date(date + "T12:00:00").toLocaleDateString("fr-FR", {
                          weekday: "long", day: "numeric", month: "long",
                        })}
                      </span>
                    </div>
                    <SyncedScrollX>
                    <table className="w-full text-xs min-w-[820px]">
                      <thead>
                        <tr className="border-b border-black/5">
                          <th className="px-4 py-2 w-8">
                            <input
                              type="checkbox"
                              checked={dayGroups.every((g) => selected.has(`${g.date}||${g.matiere}||${g.heure_debut}`))}
                              onChange={(e) => {
                                setSelected((prev) => {
                                  const next = new Set(prev);
                                  dayGroups.forEach((g) => {
                                    const k = `${g.date}||${g.matiere}||${g.heure_debut}`;
                                    e.target.checked ? next.add(k) : next.delete(k);
                                  });
                                  return next;
                                });
                              }}
                              className="cursor-pointer"
                            />
                          </th>
                          <th className="text-left px-4 py-2 text-gray-700 font-medium w-36">Matière</th>
                          <th className="text-left px-4 py-2 text-gray-700 font-medium w-40">Horaire (prépa → oral)</th>
                          <th className="text-left px-4 py-2 text-gray-700 font-medium w-20">Salles</th>
                          <th className="text-left px-4 py-2 text-gray-800 font-semibold">Salle d'examen</th>
                          <th className="text-left px-4 py-2 text-gray-700 font-medium">Salle de préparation</th>
                          <th className="text-left px-4 py-2 text-gray-700 font-medium">Surveillant</th>
                          <th className="text-left px-4 py-2 text-gray-700 font-medium">Surveillant 2</th>
                        </tr>
                      </thead>
                      <tbody>
                        {Array.from(new Set(dayGroups.map((g) => g.heure_debut))).sort().flatMap((h, hIdx) => {
                        const heureGroups = dayGroups.filter((g) => g.heure_debut === h);
                        return [
                          <tr key={`h-${h}`} className={hIdx > 0 ? "border-t-2 border-black/10" : undefined}>
                            <td colSpan={8} className="px-4 py-1.5 bg-black/[0.035] text-[11px] font-bold text-gray-800 tracking-wide sticky top-0">
                              {h.slice(0, 5)} <span className="font-normal text-gray-700">— {heureGroups.reduce((n, g) => n + g.epreuves.length, 0)} créneau(x)</span>
                            </td>
                          </tr>,
                          ...heureGroups.flatMap((g) => {
                          const key = `${g.date}||${g.matiere}||${g.heure_debut}`;
                          const isSelected = selected.has(key);
                          // salles_par_matiere / dédoublement sélectif > 1 : plusieurs épreuves
                          // parallèles partagent ce même créneau (même matière, même heure) —
                          // chacune doit pouvoir recevoir SA PROPRE salle (jury 1 → salle 203,
                          // jury 2 → salle 204, etc.), pas la même pour toutes.
                          const hasDoublons = g.epreuves.length > 1;
                          // Heure de préparation = heure_debut - preparation_minutes (même
                          // formule que la vue Candidats), "—" si pas de prépa configurée.
                          const prepMin = g.epreuves[0]?.preparation_minutes ?? null;
                          const heurePrepa = prepMin
                            ? (() => {
                                const [h, m] = g.heure_debut.slice(0, 5).split(":").map(Number);
                                const total = h * 60 + m - prepMin;
                                return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
                              })()
                            : "—";
                          const rowSpan = g.epreuves.length;

                          return g.epreuves.map((ep, epIdx) => {
                            const occ = occupations([ep]);
                            const conflit = (prises: Map<number, string>, v: number | null) => v != null && prises.has(v);
                            const bordure = (en: boolean) => (en ? "border-amber-500 bg-amber-50" : "bg-white");
                            return (
                            <tr key={ep.id} className={`border-b border-black/[0.04] last:border-0 ${isSelected ? "bg-amber-50/60" : "hover:bg-black/[0.01]"}`}>
                              {epIdx === 0 && (
                                <>
                                  <td className="px-4 py-2.5 align-top" rowSpan={rowSpan}>
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
                                      title={hasDoublons ? "Sélectionne les 2 salles parallèles pour une affectation groupée" : undefined}
                                      className="cursor-pointer"
                                    />
                                  </td>
                                  <td className="px-4 py-2.5 align-top font-medium text-gray-900" rowSpan={rowSpan}>{g.matiere}</td>
                                  <td className="px-4 py-2.5 align-top font-mono text-xs whitespace-nowrap" rowSpan={rowSpan}>
                                    <span className="text-gray-700">{heurePrepa}</span>
                                    <span className="text-gray-700 mx-1">→</span>
                                    <span className="text-gray-900 font-semibold">{g.heure_debut?.slice(0, 5)}</span>
                                    <span className="text-gray-700 mx-1">→</span>
                                    <span className="text-gray-800">{ep.heure_fin?.slice(0, 5) ?? "—"}</span>
                                  </td>
                                  <td className="px-4 py-2.5 align-top text-gray-700" rowSpan={rowSpan} title={hasDoublons ? "Plusieurs salles en parallèle pour ce créneau — une salle par ligne ci-dessous" : ""}>
                                    <div className="flex items-center gap-1.5">
                                      <span>{g.epreuves.length}</span>
                                      {hasDoublons && (
                                        g.epreuves.every((e) => e.salle_verifiee) ? (
                                          <span className="text-emerald-600" title="Doublon validé">
                                            <CheckCircle2 className="h-3.5 w-3.5" />
                                          </span>
                                        ) : (
                                          <button
                                            onClick={() => validerGroupe(g.epreuves.map((e) => e.id))}
                                            disabled={saving === -1}
                                            title="Confirmer que les salles de ce doublon ont bien été vérifiées"
                                            className="text-[10px] px-1.5 py-0.5 rounded border border-amber-300 text-amber-700 bg-amber-50 hover:bg-amber-100 transition font-medium disabled:opacity-50"
                                          >
                                            Valider
                                          </button>
                                        )
                                      )}
                                    </div>
                                  </td>
                                </>
                              )}
                              <td className="px-4 py-2.5">
                                {(tailleCreneau.get(key) ?? 0) > 1 && (
                                  <span className="text-[9px] text-gray-700 font-mono mr-1.5 align-middle">#{rangParallele.get(ep.id)}</span>
                                )}
                                <select
                                  value={ep.salle_id ?? ""}
                                  onChange={(ev) => assignSalleSingle(ep.id, "salle_id", ev.target.value ? Number(ev.target.value) : null)}
                                  disabled={saving === -1}
                                  title={conflit(occ.salles, ep.salle_id) ? `Salle déjà utilisée sur ce créneau (${occ.salles.get(ep.salle_id!)})` : undefined}
                                  className={`border rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-black/15 min-w-[120px] ${bordure(conflit(occ.salles, ep.salle_id))}`}
                                >
                                  <option value="">— Aucune —</option>
                                  {optionsOccupees(activeSalles, nomSalle, occ.salles, ep.salle_id)}
                                </select>
                              </td>
                              <td className="px-4 py-2.5">
                                <select
                                  value={ep.salle_preparation_id ?? ""}
                                  onChange={(ev) => assignSalleSingle(ep.id, "salle_preparation_id", ev.target.value ? Number(ev.target.value) : null)}
                                  disabled={saving === -1}
                                  title={conflit(occ.prepas, ep.salle_preparation_id) ? `Salle utilisée pour un examen pendant la préparation (${occ.prepas.get(ep.salle_preparation_id!)})` : undefined}
                                  className={`border rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-black/15 min-w-[120px] ${bordure(conflit(occ.prepas, ep.salle_preparation_id))}`}
                                >
                                  <option value="">— Aucune —</option>
                                  {optionsOccupees(activeSalles, nomSalle, occ.prepas, ep.salle_preparation_id)}
                                </select>
                              </td>
                              <td className="px-4 py-2.5">
                                <select
                                  value={ep.surveillant_id ?? ""}
                                  onChange={(ev) => assignSalleSingle(ep.id, "surveillant_id", ev.target.value ? Number(ev.target.value) : null)}
                                  disabled={saving === -1}
                                  title={conflit(occ.survs, ep.surveillant_id) ? `Surveillant déjà pris sur ce créneau (${occ.survs.get(ep.surveillant_id!)})` : undefined}
                                  className={`border rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-black/15 min-w-[140px] ${bordure(conflit(occ.survs, ep.surveillant_id))}`}
                                >
                                  <option value="">— Aucun —</option>
                                  {/* Le 2ᵉ surveillant de la même épreuve n'est pas proposé en 1er */}
                                  {optionsOccupees(surveillants.filter((s) => s.actif && s.id !== ep.surveillant2_id), nomSurv, occ.survs, ep.surveillant_id)}
                                </select>
                              </td>
                              <td className="px-4 py-2.5">
                                <select
                                  value={ep.surveillant2_id ?? ""}
                                  onChange={(ev) => assignSalleSingle(ep.id, "surveillant2_id", ev.target.value ? Number(ev.target.value) : null)}
                                  disabled={saving === -1}
                                  title={conflit(occ.survs, ep.surveillant2_id) ? `Surveillant déjà pris sur ce créneau (${occ.survs.get(ep.surveillant2_id!)})` : undefined}
                                  className={`border rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-black/15 min-w-[140px] ${bordure(conflit(occ.survs, ep.surveillant2_id))}`}
                                >
                                  <option value="">— Aucun —</option>
                                  {optionsOccupees(surveillants.filter((s) => s.actif && s.id !== ep.surveillant_id), nomSurv, occ.survs, ep.surveillant2_id)}
                                </select>
                              </td>
                            </tr>
                            );
                          });
                          }),
                        ];
                        })}
                      </tbody>
                    </table>
                    </SyncedScrollX>
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
