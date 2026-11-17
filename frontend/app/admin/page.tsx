"use client";

// Espace admin : la page assemble le menu, la recherche globale et la section affichée.
// Chaque section est dans son fichier (_sections/<section>.tsx) ; ce qu'elles partagent
// (types, appels à l'API, composants d'interface, navigation entre écrans) est dans
// _sections/commun.tsx.

import { useState, useEffect, useCallback } from "react";
import { AnimatePresence, motion } from "framer-motion";
import RechercheGlobale, { type ResultatRecherche } from "./RechercheGlobale";
import { ToastProvider } from "./Toast";
import MonitoringSection from "./MonitoringSection";
import { type NotificationAdmin } from "./NotificationsCloche";
import { Loader2, Menu, AlertTriangle } from "lucide-react";
import { CandidatsSection } from "./_sections/candidats";
import {
  AffectationManquante,
  IntentionAffectation,
  JourneeType,
  NavAffectationContext,
  Planning,
  SectionKey,
  get,
  intentions,
  memoriserPlanning,
} from "./_sections/commun";
import { ConflitsSection } from "./_sections/conflits";
import { ExaminateursSection } from "./_sections/examinateurs";
import { JourneeTypesSection } from "./_sections/journeeTypes";
import { Sidebar } from "./_sections/menu";
import { NotesSection } from "./_sections/notes";
import { ParametragesSection } from "./_sections/parametrages";
import { PlanchesSection } from "./_sections/planches";
import { PlanningDaySection, PlanningsSection } from "./_sections/planning";
import { PretAPublierSection } from "./_sections/publication";
import { SallesSection } from "./_sections/salles";
import { SurveillantsSection } from "./_sections/surveillants";
import { DashboardSection } from "./_sections/tableauDeBord";

// Sections proposées par la recherche globale (Ctrl+K)
const SECTIONS_RECHERCHE: { key: SectionKey; label: string }[] = [
  { key: "dashboard", label: "Tableau de bord" },
  { key: "plannings", label: "Planning" },
  { key: "journeeTypes", label: "Journées types" },
  { key: "salles", label: "Salles & surveillants" },
  { key: "examinateurs", label: "Examinateurs" },
  { key: "planches", label: "Planches" },
  { key: "publication", label: "Prêt à publier ?" },
  { key: "candidats", label: "Candidats" },
  { key: "notes", label: "Notes" },
  { key: "surveillants", label: "Surveillants" },
  { key: "conflits", label: "Conflits" },
  { key: "parametrages", label: "Paramétrages" },
];
const SECTION_AFFECTATION: Record<AffectationManquante, SectionKey> = {
  salle: "salles",
  examinateur: "examinateurs",
  // Les surveillants s'affectent dans Salles (avec la salle qu'ils surveillent)
  surveillant: "salles",
  planche: "planches",
};

// ── UI primitives ──────────────────────────────────────────────────────────────
function BackendWakingBanner() {
  const [state, setState] = useState<"idle" | "waking" | "error">("idle");
  const [retryAt, setRetryAt] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    let hideTimer: ReturnType<typeof setTimeout> | null = null;
    const onWaking = () => {
      if (hideTimer) clearTimeout(hideTimer);
      setState("waking");
      setRetryAt(null);
    };
    // Émis après les 3 tentatives rapprochées : le serveur est traité comme injoignable
    // (pas juste "en cours de réveil"), avec le décompte avant la 4e tentative en prod.
    const onConnectionError = (e: Event) => {
      if (hideTimer) clearTimeout(hideTimer);
      const retryInMs = (e as CustomEvent<{ retryInMs: number | null }>).detail?.retryInMs ?? null;
      setState("error");
      setRetryAt(retryInMs != null ? Date.now() + retryInMs : null);
    };
    const onAwake = () => {
      hideTimer = setTimeout(() => { setState("idle"); setRetryAt(null); }, 800);
    };
    window.addEventListener("backend-waking", onWaking);
    window.addEventListener("backend-connection-error", onConnectionError as EventListener);
    window.addEventListener("backend-awake", onAwake);
    return () => {
      window.removeEventListener("backend-waking", onWaking);
      window.removeEventListener("backend-connection-error", onConnectionError as EventListener);
      window.removeEventListener("backend-awake", onAwake);
      if (hideTimer) clearTimeout(hideTimer);
    };
  }, []);

  // Rafraîchit le compte à rebours une fois par seconde tant qu'une 4e tentative est planifiée
  useEffect(() => {
    if (retryAt == null) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [retryAt]);

  if (state === "idle") return null;

  if (state === "error") {
    const remainingSec = retryAt != null ? Math.max(0, Math.ceil((retryAt - now) / 1000)) : null;
    const countdown = remainingSec != null
      ? `${Math.floor(remainingSec / 60)}:${String(remainingSec % 60).padStart(2, "0")}`
      : null;
    return (
      <div className="fixed top-0 inset-x-0 z-[200] bg-red-600 text-white text-xs md:text-sm text-center py-2 px-4 flex items-center justify-center gap-2 shadow-md">
        <AlertTriangle className="h-3.5 w-3.5 md:h-4 md:w-4 shrink-0" />
        {countdown
          ? `Serveur injoignable — nouvelle tentative dans ${countdown}`
          : "Serveur injoignable après plusieurs tentatives. Réessayez plus tard."}
      </div>
    );
  }

  return (
    <div className="fixed top-0 inset-x-0 z-[200] bg-amber-500 text-white text-xs md:text-sm text-center py-2 px-4 flex items-center justify-center gap-2 shadow-md">
      <Loader2 className="h-3.5 w-3.5 md:h-4 md:w-4 animate-spin shrink-0" />
      Le serveur redémarre après une période d&apos;inactivité — quelques secondes de patience…
    </div>
  );
}

// ── Main ───────────────────────────────────────────────────────────────────────
export default function AdminPage() {
  // Première connexion : Tableau de bord ; ensuite, la dernière section ouverte
  const [section, setSection] = useState<SectionKey>("dashboard");

  useEffect(() => {
    const saved = localStorage.getItem("admin_section") as SectionKey;
    if (saved) setSection(saved);
  }, []);
  const [selectedPlanning, setSelectedPlanning] = useState<Planning | null>(null);
  useEffect(() => memoriserPlanning(selectedPlanning?.id), [selectedPlanning]);
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
    localStorage.setItem("admin_section", k);
    setSelectedPlanning(null);
    setMobileSidebar(false);
  };

  // Lien « manque … » : ouvre l'écran d'affectation (remonté pour qu'il lise ses filtres)
  const [cleNavigation, setCleNavigation] = useState(0);

  // Notification « liste d'attente » : Candidats > Liste d'attente du planning, candidat présélectionné
  const ouvrirNotification = useCallback((n: NotificationAdmin) => {
    if (n.type === "ACTIVITE") {
      setSection("monitoring");
      localStorage.setItem("admin_section", "monitoring");
      setSelectedPlanning(null);
      setMobileSidebar(false);
      setCleNavigation((c) => c + 1);
      return;
    }
    // Incident signalé par un surveillant : fiche du candidat (où l'incident est affiché)
    if (n.type === "INCIDENT" && n.planning_id && n.candidat_id) {
      memoriserPlanning(n.planning_id);
      intentions.candidats = { planningId: n.planning_id, tab: "liste", candidatId: n.candidat_id };
      setSection("candidats");
      localStorage.setItem("admin_section", "candidats");
      setSelectedPlanning(null);
      setMobileSidebar(false);
      setCleNavigation((c) => c + 1);
      return;
    }
    if (n.type !== "LISTE_ATTENTE" || !n.planning_id) return;
    intentions.candidats = { planningId: n.planning_id, tab: "liste_attente", candidatId: n.candidat_id };
    setSection("candidats");
    localStorage.setItem("admin_section", "candidats");
    setSelectedPlanning(null);
    setMobileSidebar(false);
    setCleNavigation((c) => c + 1);
  }, []);
  // ── Recherche globale (Ctrl+K / Cmd+K) ──
  const [rechercheOuverte, setRechercheOuverte] = useState(false);
  useEffect(() => {
    const touche = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setRechercheOuverte((o) => !o);
      }
    };
    document.addEventListener("keydown", touche);
    return () => document.removeEventListener("keydown", touche);
  }, []);
  const allerSection = useCallback((k: SectionKey) => {
    setSection(k);
    localStorage.setItem("admin_section", k);
    setSelectedPlanning(null);
    setMobileSidebar(false);
    setCleNavigation((c) => c + 1);
    window.scrollTo({ top: 0 });
  }, []);
  const allerRecherche = useCallback(async (r: ResultatRecherche) => {
    setRechercheOuverte(false);
    if (r.type === "section") { allerSection(r.key as SectionKey); return; }
    if (r.type === "candidat") {
      memoriserPlanning(r.planningId);
      intentions.candidats = { planningId: r.planningId, tab: "liste", candidatId: r.id, recherche: r.nom };
      allerSection("candidats");
      return;
    }
    if (r.type === "examinateur") { intentions.examinateur = { id: r.id, nom: r.nom }; allerSection("examinateurs"); return; }
    if (r.type === "surveillant") { intentions.surveillant = { nom: r.nom }; allerSection("surveillants"); return; }
    // Planning : ouvert directement dans la section Planning
    try {
      const p = await get<Planning>(`plannings/${r.id}`);
      allerSection("plannings");
      setSelectedPlanning(p);
    } catch { /* planning supprimé entre-temps : rien à ouvrir */ }
  }, [allerSection]);

  const allerAffecter = useCallback((i: IntentionAffectation) => {
    intentions.affectation = i;
    const k = SECTION_AFFECTATION[i.manque];
    setSection(k);
    localStorage.setItem("admin_section", k);
    setSelectedPlanning(null);
    setCleNavigation((c) => c + 1);
    window.scrollTo({ top: 0 });
  }, []);

  return (
    <ToastProvider>
    <BackendWakingBanner />
    {rechercheOuverte && (
      <RechercheGlobale get={get} sections={SECTIONS_RECHERCHE} onChoisir={allerRecherche} onFermer={() => setRechercheOuverte(false)} />
    )}
    <div className="flex min-h-screen bg-[#F5F5F5]">
      {/* Sidebar desktop */}
      <div className="hidden md:block h-screen sticky top-0">
        <Sidebar active={section} onSelect={switchSection} nbConflits={nbConflits} onNotification={ouvrirNotification} onRecherche={() => setRechercheOuverte(true)} />
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
              <Sidebar active={section} onSelect={switchSection} nbConflits={nbConflits} onNotification={ouvrirNotification} onRecherche={() => { setMobileSidebar(false); setRechercheOuverte(true); }} />
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
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-ensae.png" alt="ENSAE — IP Paris" className="h-9 w-auto" />
          <span className="text-sm font-semibold text-gray-900">Admin</span>
        </div>

        <main className="flex-1 overflow-auto">
          <NavAffectationContext.Provider value={allerAffecter}>
          <div key={cleNavigation} className={`${(section === "plannings" && selectedPlanning) || section === "salles" || section === "candidats" || section === "examinateurs" ? "max-w-none" : "max-w-6xl"} mx-auto px-4 md:px-8 py-8`}>
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
            {section === "publication" && <PretAPublierSection />}
            {section === "notes" && <NotesSection />}
            {section === "parametrages" && <ParametragesSection />}
            {section === "monitoring" && <MonitoringSection get={get} />}
          </div>
          </NavAffectationContext.Provider>
        </main>
      </div>
    </div>
    </ToastProvider>
  );
}
