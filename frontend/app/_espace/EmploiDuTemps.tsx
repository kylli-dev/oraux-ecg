"use client";

// Vue « Emploi du temps » schématique partagée par les espaces examinateur et
// surveillant : une colonne par journée, l'axe vertical en heures. Chaque passage est
// un bloc placé à son horaire ; la préparation du candidat est une fine barre à gauche
// (elle chevauche souvent le passage précédent, d'où la barre plutôt qu'un bloc).
// Les passages simultanés (un surveillant couvre plusieurs salles) sont placés côte à
// côte. Bouton plein écran : API Fullscreen quand elle existe, sinon calque fixe.

import { useEffect, useRef, useState } from "react";
import { CalendarRange, Maximize2, Minimize2 } from "lucide-react";
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
// heure de début, son titre et son heure de fin.
const PX_PAR_MIN_DEFAUT = 2;
const ENTETE_JOUR_PX = 44;
const LARGEUR_MIN_VOIE = 120;

function enMinutes(h: string) {
  const [hh, mm] = h.split(":").map(Number);
  return hh * 60 + (mm || 0);
}

function enHeure(m: number) {
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
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

  const jours = [...new Set(creneaux.map((c) => c.date))].sort();
  const debut = Math.floor(Math.min(...creneaux.map((c) => enMinutes(c.heure_debut) - (c.preparation_minutes ?? 0))) / 60) * 60;
  const fin = Math.ceil(Math.max(...creneaux.map((c) => enMinutes(c.heure_fin))) / 60) * 60;
  // En plein écran, l'échelle s'agrandit pour que la journée occupe toute la hauteur
  // (~150 px réservés au titre, à la légende et aux en-têtes de journée)
  const pxParMin = pleinEcran && hauteurEcran
    ? Math.max(PX_PAR_MIN_DEFAUT, (hauteurEcran - 150) / Math.max(fin - debut, 60))
    : PX_PAR_MIN_DEFAUT;
  const hauteur = (fin - debut) * pxParMin;
  const heures: number[] = [];
  for (let m = debut; m <= fin; m += 60) heures.push(m);

  return (
    <div
      ref={conteneur}
      className={
        pleinEcran
          ? "fixed inset-0 z-[60] bg-white p-4 sm:p-6 overflow-auto"
          : "bg-white rounded-2xl border border-black/5 shadow-sm p-4"
      }
    >
      {pleinEcran && (
        <p className="text-lg font-bold text-gray-900 mb-3 flex items-center gap-2">
          <CalendarRange className="h-5 w-5" style={{ color: RED }} />
          {titrePleinEcran}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mb-4 text-xs text-gray-900">
        {legende.map((l) => (
          <span key={l.label} className="flex items-center gap-1.5">
            <span className="h-3.5 w-3.5 rounded-sm border-l-4 border" style={l.style} />
            {l.label}
          </span>
        ))}
        <span className="flex items-center gap-1.5">
          <span className="h-3.5 w-1.5 rounded-full" style={{ backgroundColor: RED + "55" }} />
          Préparation du candidat
        </span>
        {consigne && <span className="ml-auto text-gray-700">{consigne}</span>}
        <button
          onClick={pleinEcran ? quitterPleinEcran : entrerPleinEcran}
          className={`${consigne ? "" : "ml-auto "}flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg border bg-white font-medium hover:bg-red-50 transition`}
          style={{ borderColor: RED + "55", color: RED }}
          title={pleinEcran ? "Quitter le plein écran (Échap)" : "Afficher en plein écran"}
        >
          {pleinEcran ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          {pleinEcran ? "Quitter le plein écran" : "Plein écran"}
        </button>
      </div>

      <div className="overflow-x-auto">
        <div className="flex min-w-fit">
          {/* Axe des heures */}
          <div className="w-12 shrink-0 relative" style={{ height: hauteur + ENTETE_JOUR_PX }}>
            {heures.map((m) => (
              <span
                key={m}
                className="absolute right-2 -translate-y-1/2 text-[11px] font-medium text-gray-700 tabular-nums"
                style={{ top: ENTETE_JOUR_PX + (m - debut) * pxParMin }}
              >
                {enHeure(m)}
              </span>
            ))}
          </div>

          {jours.map((jour) => {
            const duJour = creneaux.filter((c) => c.date === jour);
            const { placement, maxVoies } = repartirEnVoies(duJour);
            return (
              <div
                key={jour}
                className="flex-1 border-l border-gray-200"
                style={{ minWidth: Math.max(150, maxVoies * LARGEUR_MIN_VOIE) }}
              >
                <div
                  className="flex flex-col items-center justify-center border-b border-gray-200 px-1"
                  style={{ height: ENTETE_JOUR_PX }}
                >
                  <span className="text-xs font-bold text-gray-900 capitalize">
                    {new Date(jour + "T12:00:00").toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" })}
                  </span>
                  <span className="text-[11px] text-gray-700">
                    {duJour.length} créneau{duJour.length > 1 ? "x" : ""}
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
                  {duJour.map((c) => {
                    const d = enMinutes(c.heure_debut);
                    const f = enMinutes(c.heure_fin);
                    const prep = c.preparation_minutes ?? 0;
                    const h = Math.max((f - d) * pxParMin, 22);
                    // Assez de hauteur : début en haut, fin en bas du bloc ; sinon « début – fin » sur une ligne
                    const finEnBas = h >= 40;
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
                          className="pointer-events-auto absolute left-3.5 right-1 rounded-md border border-l-4 px-1.5 py-0.5 text-left overflow-hidden text-gray-900 transition hover:shadow-md hover:z-10 focus:outline-none focus-visible:ring-2"
                          style={{ top: (d - debut) * pxParMin, height: h, "--tw-ring-color": RED, ...c.style } as React.CSSProperties}
                          title={c.infobulle}
                        >
                          <span className="block text-xs font-bold tabular-nums leading-tight">
                            {finEnBas ? c.heure_debut : `${c.heure_debut} – ${c.heure_fin}`}
                          </span>
                          {h >= 56 && <span className="block text-xs font-medium truncate leading-tight">{c.titre}</span>}
                          {h >= 76 && c.detail && (
                            <span className="block text-[11px] text-gray-800 truncate leading-tight">{c.detail}</span>
                          )}
                          {finEnBas && (
                            <span className="absolute bottom-0.5 left-1.5 text-[11px] font-semibold tabular-nums text-gray-800 leading-tight">
                              → {c.heure_fin}
                            </span>
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
