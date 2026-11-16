"use client";

// Vue « Emploi du temps » partagée par les espaces examinateur et surveillant, en agenda
// semaine par semaine : une colonne par journée de la semaine affichée (seulement les jours
// qui ont des créneaux), l'axe vertical en heures, navigation entre les semaines. Chaque
// passage est un bloc à son horaire ; la préparation du candidat est une fine barre à
// gauche (elle chevauche souvent le passage précédent). Les passages simultanés (un
// surveillant couvre plusieurs salles) sont placés côte à côte. Aujourd'hui est mis en
// évidence, avec un trait à l'heure actuelle. Plein écran : API Fullscreen quand elle
// existe, sinon calque fixe.

import { useEffect, useRef, useState } from "react";
import { CalendarRange, ChevronLeft, ChevronRight, Maximize2, Minimize2 } from "lucide-react";
import { RED } from "./ui";

export type CreneauEdt = {
  id: number;
  date: string;
  heure_debut: string;
  heure_fin: string;
  preparation_minutes: number | null;
  titre: string;
  detail?: string | null;
  infobulle: string;
  style: React.CSSProperties;
};

export type LegendeEdt = { label: string; style: React.CSSProperties };

// 2 px/min = 120 px par heure : un passage de 30 min (60 px) affiche lisiblement son
// horaire, son titre et son détail.
const PX_PAR_MIN_DEFAUT = 2;
const ENTETE_JOUR_PX = 60;
const LARGEUR_MIN_VOIE = 130;

function enMinutes(h: string) {
  const [hh, mm] = h.split(":").map(Number);
  return hh * 60 + (mm || 0);
}

function enHeure(m: number) {
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}

// Date locale AAAA-MM-JJ (sans passer par l'UTC, qui décale les dates le soir)
function iso(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// Lundi de la semaine d'une date « AAAA-MM-JJ »
function lundiDe(jour: string) {
  const d = new Date(jour + "T12:00:00");
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return iso(d);
}

// Répartit les créneaux d'une journée en voies : les créneaux qui se chevauchent
// forment un groupe, chacun reçoit une voie libre et la largeur est partagée entre
// les voies du groupe.
function repartirEnVoies(creneaux: CreneauEdt[]) {
  const tries = [...creneaux].sort((a, b) => enMinutes(a.heure_debut) - enMinutes(b.heure_debut));
  const placement = new Map<number, { voie: number; nbVoies: number }>();
  let groupe: CreneauEdt[] = [];
  let finsVoies: number[] = [];
  let finGroupe = -1;
  let maxVoies = 1;

  const cloreGroupe = () => {
    for (const c of groupe) placement.get(c.id)!.nbVoies = finsVoies.length;
    maxVoies = Math.max(maxVoies, finsVoies.length);
    groupe = [];
    finsVoies = [];
  };

  for (const c of tries) {
    const d = enMinutes(c.heure_debut);
    const f = enMinutes(c.heure_fin);
    if (groupe.length && d >= finGroupe) cloreGroupe();
    let voie = finsVoies.findIndex((fin) => fin <= d);
    if (voie === -1) { voie = finsVoies.length; finsVoies.push(f); } else finsVoies[voie] = f;
    placement.set(c.id, { voie, nbVoies: 1 });
    groupe.push(c);
    finGroupe = Math.max(finGroupe, f);
  }
  if (groupe.length) cloreGroupe();
  return { placement, maxVoies };
}

export function EmploiDuTemps({
  creneaux,
  legende,
  consigne,
  titrePleinEcran = "Mon emploi du temps",
  onSelect,
}: {
  creneaux: CreneauEdt[];
  legende: LegendeEdt[];
  consigne?: string;
  titrePleinEcran?: string;
  onSelect: (id: number) => void;
}) {
  const conteneur = useRef<HTMLDivElement>(null);
  const [pleinEcran, setPleinEcran] = useState(false);
  const [hauteurEcran, setHauteurEcran] = useState(0);
  // Semaine affichée (lundi) ; null = choix automatique (semaine en cours, sinon la première)
  const [semaineChoisie, setSemaineChoisie] = useState<string | null>(null);
  // Heure actuelle, pour le trait « maintenant » (rafraîchie chaque minute)
  const [maintenant, setMaintenant] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setMaintenant(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  function entrerPleinEcran() {
    setPleinEcran(true);
    try {
      Promise.resolve(conteneur.current?.requestFullscreen?.()).catch(() => { /* calque fixe de repli */ });
    } catch { /* calque fixe de repli */ }
  }

  function quitterPleinEcran() {
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    setPleinEcran(false);
  }

  useEffect(() => {
    if (!pleinEcran) return;
    const mesurer = () => setHauteurEcran(window.innerHeight);
    const surChangement = () => { if (!document.fullscreenElement) setPleinEcran(false); };
    const surTouche = (e: KeyboardEvent) => { if (e.key === "Escape") quitterPleinEcran(); };
    mesurer();
    window.addEventListener("resize", mesurer);
    document.addEventListener("fullscreenchange", surChangement);
    document.addEventListener("keydown", surTouche);
    return () => {
      window.removeEventListener("resize", mesurer);
      document.removeEventListener("fullscreenchange", surChangement);
      document.removeEventListener("keydown", surTouche);
    };
  }, [pleinEcran]);

  if (creneaux.length === 0) return null;

  const aujourdhui = iso(maintenant);
  const semaines = [...new Set(creneaux.map((c) => lundiDe(c.date)))].sort();
  const semaine =
    semaineChoisie && semaines.includes(semaineChoisie) ? semaineChoisie
    : semaines.includes(lundiDe(aujourdhui)) ? lundiDe(aujourdhui)
    : semaines[0];
  const idxSemaine = semaines.indexOf(semaine);
  const duSemaine = creneaux.filter((c) => lundiDe(c.date) === semaine);
  const jours = [...new Set(duSemaine.map((c) => c.date))].sort();

  const dimanche = new Date(semaine + "T12:00:00");
  dimanche.setDate(dimanche.getDate() + 6);
  const libelleSemaine = (() => {
    const l = new Date(semaine + "T12:00:00");
    const memeMois = l.getMonth() === dimanche.getMonth();
    const debutTxt = l.toLocaleDateString("fr-FR", memeMois ? { day: "numeric" } : { day: "numeric", month: "long" });
    return `Semaine du ${debutTxt} au ${dimanche.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}`;
  })();

  const debut = Math.floor(Math.min(...duSemaine.map((c) => enMinutes(c.heure_debut) - (c.preparation_minutes ?? 0))) / 60) * 60;
  const fin = Math.ceil(Math.max(...duSemaine.map((c) => enMinutes(c.heure_fin))) / 60) * 60;
  // En plein écran, l'échelle s'agrandit pour que la journée occupe toute la hauteur
  // (~190 px réservés au titre, à la barre d'outils et aux en-têtes de journée)
  const pxParMin = pleinEcran && hauteurEcran
    ? Math.max(PX_PAR_MIN_DEFAUT, (hauteurEcran - 190) / Math.max(fin - debut, 60))
    : PX_PAR_MIN_DEFAUT;
  const hauteur = (fin - debut) * pxParMin;
  const heures: number[] = [];
  for (let m = debut; m <= fin; m += 60) heures.push(m);
  const minutesMaintenant = maintenant.getHours() * 60 + maintenant.getMinutes();

  const boutonNav =
    "h-9 w-9 grid place-items-center rounded-lg border border-gray-300 bg-white text-gray-900 hover:bg-gray-50 transition disabled:opacity-30 disabled:hover:bg-white";

  return (
    <div
      ref={conteneur}
      className={
        pleinEcran
          ? "fixed inset-0 z-[60] bg-white p-4 sm:p-6 overflow-auto"
          : "bg-white rounded-2xl border border-black/5 shadow-sm"
      }
    >
      {pleinEcran && (
        <p className="text-lg font-bold text-gray-900 mb-3 flex items-center gap-2">
          <CalendarRange className="h-5 w-5" style={{ color: RED }} />
          {titrePleinEcran}
        </p>
      )}

      {/* ── Barre d'outils : semaine, navigation, plein écran ── */}
      <div className={`flex flex-wrap items-center gap-2 ${pleinEcran ? "mb-3" : "px-4 pt-4 pb-3 border-b border-gray-100"}`}>
        <button
          onClick={() => setSemaineChoisie(semaines[idxSemaine - 1])}
          disabled={idxSemaine <= 0}
          className={boutonNav}
          aria-label="Semaine précédente"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <button
          onClick={() => setSemaineChoisie(semaines[idxSemaine + 1])}
          disabled={idxSemaine >= semaines.length - 1}
          className={boutonNav}
          aria-label="Semaine suivante"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
        <div className="ml-1 min-w-0">
          <p className="text-base font-bold text-gray-900 leading-tight">{libelleSemaine}</p>
          <p className="text-xs text-gray-700">
            {duSemaine.length} créneau{duSemaine.length > 1 ? "x" : ""}
            {semaines.length > 1 && ` · semaine ${idxSemaine + 1} sur ${semaines.length}`}
          </p>
        </div>
        {semaines.includes(lundiDe(aujourdhui)) && semaine !== lundiDe(aujourdhui) && (
          <button
            onClick={() => setSemaineChoisie(lundiDe(aujourdhui))}
            className="h-9 px-3 rounded-lg border text-sm font-semibold bg-white hover:bg-red-50 transition"
            style={{ borderColor: RED + "55", color: RED }}
          >
            Cette semaine
          </button>
        )}
        <button
          onClick={pleinEcran ? quitterPleinEcran : entrerPleinEcran}
          className="ml-auto h-9 flex items-center gap-1.5 text-sm px-3 rounded-lg border border-gray-300 bg-white font-medium text-gray-900 hover:bg-gray-50 transition"
          title={pleinEcran ? "Quitter le plein écran (Échap)" : "Afficher en plein écran"}
        >
          {pleinEcran ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          {pleinEcran ? "Quitter le plein écran" : "Plein écran"}
        </button>
      </div>

      {/* ── Légende ── */}
      <div className={`flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-gray-900 ${pleinEcran ? "mb-3" : "px-4 py-2.5"}`}>
        {legende.map((l) => (
          <span key={l.label} className="flex items-center gap-1.5">
            <span className="h-3.5 w-3.5 rounded border border-l-4" style={l.style} />
            {l.label}
          </span>
        ))}
        <span className="flex items-center gap-1.5">
          <span className="h-3.5 w-1.5 rounded-full" style={{ backgroundColor: RED + "55" }} />
          Préparation du candidat
        </span>
        {consigne && <span className="sm:ml-auto text-gray-700">{consigne}</span>}
      </div>

      {/* ── Grille ── */}
      <div className={`overflow-x-auto ${pleinEcran ? "" : "px-4 pb-4"}`}>
        <div className="flex min-w-fit rounded-xl border border-gray-200 overflow-hidden">
          {/* Axe des heures */}
          <div className="w-14 shrink-0 relative bg-gray-50/60" style={{ height: hauteur + ENTETE_JOUR_PX }}>
            {heures.map((m) => (
              <span
                key={m}
                className="absolute right-2 -translate-y-1/2 text-[11px] font-semibold text-gray-700 tabular-nums"
                style={{ top: ENTETE_JOUR_PX + (m - debut) * pxParMin }}
              >
                {enHeure(m)}
              </span>
            ))}
          </div>

          {jours.map((jour) => {
            const duJour = duSemaine.filter((c) => c.date === jour);
            const { placement, maxVoies } = repartirEnVoies(duJour);
            const estAujourdhui = jour === aujourdhui;
            const dj = new Date(jour + "T12:00:00");
            return (
              <div
                key={jour}
                className={`flex-1 border-l border-gray-200 ${estAujourdhui ? "bg-red-50/30" : ""}`}
                style={{ minWidth: Math.max(160, maxVoies * LARGEUR_MIN_VOIE) }}
              >
                {/* En-tête de journée, façon agenda : jour de la semaine, puis numéro */}
                <div
                  className="flex items-center justify-center gap-2 border-b border-gray-200 px-2 bg-white"
                  style={{ height: ENTETE_JOUR_PX }}
                >
                  <span
                    className={`h-9 min-w-9 px-1 grid place-items-center rounded-full text-lg font-bold tabular-nums ${estAujourdhui ? "text-white" : "text-gray-900"}`}
                    style={estAujourdhui ? { backgroundColor: RED } : undefined}
                  >
                    {dj.getDate()}
                  </span>
                  <span className="flex flex-col leading-tight">
                    <span className={`text-xs font-bold uppercase tracking-wide ${estAujourdhui ? "" : "text-gray-900"}`} style={estAujourdhui ? { color: RED } : undefined}>
                      {dj.toLocaleDateString("fr-FR", { weekday: "short" }).replace(".", "")}
                      {estAujourdhui && " · aujourd'hui"}
                    </span>
                    <span className="text-[11px] text-gray-700">
                      {dj.toLocaleDateString("fr-FR", { month: "short" })} · {duJour.length} créneau{duJour.length > 1 ? "x" : ""}
                    </span>
                  </span>
                </div>

                <div className="relative" style={{ height: hauteur }}>
                  {heures.map((m) => (
                    <div key={m} className="absolute inset-x-0 border-t border-gray-200" style={{ top: (m - debut) * pxParMin }} />
                  ))}
                  {/* Repères des demi-heures */}
                  {heures.slice(0, -1).map((m) => (
                    <div key={`d${m}`} className="absolute inset-x-0 border-t border-dashed border-gray-100" style={{ top: (m + 30 - debut) * pxParMin }} />
                  ))}
                  {/* Heure actuelle */}
                  {estAujourdhui && minutesMaintenant >= debut && minutesMaintenant <= fin && (
                    <div className="absolute inset-x-0 z-20 pointer-events-none" style={{ top: (minutesMaintenant - debut) * pxParMin }}>
                      <div className="absolute -left-1 -top-1 h-2 w-2 rounded-full" style={{ backgroundColor: RED }} />
                      <div className="border-t-2" style={{ borderColor: RED }} />
                    </div>
                  )}
                  {duJour.map((c) => {
                    const d = enMinutes(c.heure_debut);
                    const f = enMinutes(c.heure_fin);
                    const prep = c.preparation_minutes ?? 0;
                    const h = Math.max((f - d) * pxParMin, 24);
                    const { voie, nbVoies } = placement.get(c.id)!;
                    const gauche = `${(voie / nbVoies) * 100}%`;
                    const largeur = `${100 / nbVoies}%`;
                    return (
                      // pointer-events-none : la voie couvre toute la hauteur et ne doit pas
                      // masquer les blocs des autres groupes situés dessous
                      <div key={c.id} className="absolute inset-y-0 pointer-events-none" style={{ left: gauche, width: largeur }}>
                        {prep > 0 && (
                          <div
                            className="pointer-events-auto absolute left-1 w-1.5 rounded-full"
                            style={{ top: (d - prep - debut) * pxParMin, height: prep * pxParMin, backgroundColor: RED + "55" }}
                            title={`Préparation ${enHeure(d - prep)} – ${c.heure_debut}`}
                          />
                        )}
                        <button
                          onClick={() => { if (pleinEcran) quitterPleinEcran(); onSelect(c.id); }}
                          className="pointer-events-auto absolute left-3.5 right-1.5 rounded-lg border border-l-4 px-2 py-1 text-left overflow-hidden text-gray-900 shadow-sm transition hover:shadow-md hover:-translate-y-px hover:z-10 focus:outline-none focus-visible:ring-2"
                          style={{ top: (d - debut) * pxParMin + 1, height: h - 2, "--tw-ring-color": RED, ...c.style } as React.CSSProperties}
                          title={c.infobulle}
                        >
                          <span className="block text-[11px] font-bold tabular-nums leading-tight text-gray-800">
                            {c.heure_debut} – {c.heure_fin}
                          </span>
                          {h >= 44 && <span className="block text-sm font-semibold truncate leading-snug">{c.titre}</span>}
                          {h >= 64 && c.detail && (
                            <span className="block text-[11px] text-gray-800 truncate leading-tight">{c.detail}</span>
                          )}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
