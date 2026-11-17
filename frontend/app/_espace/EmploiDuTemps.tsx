"use client";

// Vue « Emploi du temps » partagée par les espaces examinateur et surveillant : un jour à
// la fois, une colonne fixe par salle, l'axe vertical en heures. Les jours se choisissent
// dans une rangée de pastilles (avec leur nombre de candidats, aujourd'hui en rouge). Les
// créneaux libres sont masqués par défaut (une case les réaffiche) : sans eux, les
// candidats ne sont plus noyés au milieu des créneaux vides. Trait rouge à l'heure
// actuelle. Plein écran : API Fullscreen quand elle existe, sinon calque fixe.

import { useEffect, useRef, useState } from "react";
import { CalendarRange, ChevronLeft, ChevronRight, DoorOpen, Maximize2, Minimize2 } from "lucide-react";
import { RED } from "./ui";

// Couleurs d'un bloc : fond doux et barre verticale à gauche
export type TeinteEdt = { fond: string; barre: string };

export type CreneauEdt = {
  id: number;
  date: string;
  heure_debut: string;
  heure_fin: string;
  preparation_minutes: number | null;
  titre: string; // nom du candidat (ou « Créneau libre »)
  detail?: string | null; // affiché après l'horaire (matière)
  badge?: { texte: string; couleur: string; fond: string } | null; // état, à droite du nom
  alerte?: string | null; // ⚠ à côté du nom (incident), texte en infobulle
  infobulle: string;
  teinte: TeinteEdt;
  salle: string | null; // colonne du créneau
  libre: boolean; // pas de candidat
};

export type LegendeEdt = { label: string; teinte: TeinteEdt; libre?: boolean };

// 2,6 px/min ≈ 156 px par heure : un passage de 30 min (78 px) affiche en entier son
// heure, son candidat, son détail et sa préparation.
const PX_PAR_MIN_DEFAUT = 2.6;
const ENTETE_COLONNE_PX = 48;
const LARGEUR_MIN_COLONNE = 220;
const CLE_LIBRES = "edt_afficher_libres";

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

const triSalles = (a: string, b: string) => a.localeCompare(b, "fr", { numeric: true });

// Dans une même colonne, des créneaux peuvent se chevaucher (rare) : on les place côte à
// côte en partageant la largeur.
function repartirEnVoies(creneaux: CreneauEdt[]) {
  const tries = [...creneaux].sort((a, b) => enMinutes(a.heure_debut) - enMinutes(b.heure_debut));
  const placement = new Map<number, { voie: number; nbVoies: number }>();
  let groupe: CreneauEdt[] = [];
  let finsVoies: number[] = [];
  let finGroupe = -1;

  const cloreGroupe = () => {
    for (const c of groupe) placement.get(c.id)!.nbVoies = finsVoies.length;
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
  return placement;
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
  const pastilles = useRef<HTMLDivElement>(null);
  const [pleinEcran, setPleinEcran] = useState(false);
  const [hauteurEcran, setHauteurEcran] = useState(0);
  // Jour affiché ; null = choix automatique (aujourd'hui, sinon le prochain jour avec candidats)
  const [jourChoisi, setJourChoisi] = useState<string | null>(null);
  // Choix mémorisé dans le navigateur (le composant n'est monté qu'une fois les créneaux
  // chargés, côté client : pas de décalage avec le rendu serveur)
  const [libres, setLibres] = useState(() => {
    try { return localStorage.getItem(CLE_LIBRES) === "1"; } catch { return false; }
  });
  // Heure actuelle, pour le trait « maintenant » (rafraîchie chaque minute)
  const [maintenant, setMaintenant] = useState(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setMaintenant(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  function basculerLibres(v: boolean) {
    setLibres(v);
    try { localStorage.setItem(CLE_LIBRES, v ? "1" : "0"); } catch { /* stockage indisponible */ }
  }

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

  const aujourdhui = iso(maintenant);
  const jours = [...new Set(creneaux.map((c) => c.date))].sort();
  const candidatsDuJour = (j: string) => creneaux.filter((c) => c.date === j && !c.libre).length;
  const jour =
    jourChoisi && jours.includes(jourChoisi) ? jourChoisi
    : jours.includes(aujourdhui) ? aujourdhui
    : jours.find((j) => j >= aujourdhui && candidatsDuJour(j) > 0)
      ?? jours.find((j) => candidatsDuJour(j) > 0)
      ?? jours[0];
  const idxJour = jours.indexOf(jour);

  // Garde la pastille du jour affiché visible dans la rangée défilante
  useEffect(() => {
    pastilles.current?.querySelector<HTMLElement>("[data-actif='1']")?.scrollIntoView({ block: "nearest", inline: "center" });
  }, [jour]);

  if (creneaux.length === 0) return null;

  const duJour = creneaux.filter((c) => c.date === jour);
  const visibles = duJour.filter((c) => libres || !c.libre);
  const nbLibres = duJour.filter((c) => c.libre).length;
  const salles = [...new Set(visibles.map((c) => c.salle ?? ""))].sort(triSalles);

  const debut = visibles.length ? Math.floor(Math.min(...visibles.map((c) => enMinutes(c.heure_debut))) / 60) * 60 : 0;
  const fin = visibles.length ? Math.ceil(Math.max(...visibles.map((c) => enMinutes(c.heure_fin))) / 60) * 60 : 60;
  // En plein écran, l'échelle s'agrandit pour que la journée occupe toute la hauteur
  // (~230 px réservés au titre, aux pastilles, à la légende et aux en-têtes de salle)
  const pxParMin = pleinEcran && hauteurEcran
    ? Math.max(PX_PAR_MIN_DEFAUT, (hauteurEcran - 230) / Math.max(fin - debut, 60))
    : PX_PAR_MIN_DEFAUT;
  const hauteur = (fin - debut) * pxParMin;
  const heures: number[] = [];
  for (let m = debut; m <= fin; m += 60) heures.push(m);
  const minutesMaintenant = maintenant.getHours() * 60 + maintenant.getMinutes();
  const estAujourdhui = jour === aujourdhui;
  const titreJour = new Date(jour + "T12:00:00").toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });

  const boutonNav =
    "h-9 w-9 shrink-0 grid place-items-center rounded-lg border border-gray-300 bg-white text-gray-900 hover:bg-gray-50 transition disabled:opacity-30 disabled:hover:bg-white";

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

      {/* ── Jours : pastilles défilantes ── */}
      <div className={`flex items-center gap-2 ${pleinEcran ? "mb-3" : "px-4 pt-4 pb-3 border-b border-gray-100"}`}>
        <button onClick={() => setJourChoisi(jours[idxJour - 1])} disabled={idxJour <= 0} className={boutonNav} aria-label="Jour précédent">
          <ChevronLeft className="h-4 w-4" />
        </button>
        <div ref={pastilles} className="flex-1 min-w-0 flex gap-1.5 overflow-x-auto py-0.5 [scrollbar-width:thin]">
          {jours.map((j) => {
            const d = new Date(j + "T12:00:00");
            const n = candidatsDuJour(j);
            const actif = j === jour;
            const auj = j === aujourdhui;
            return (
              <button
                key={j}
                data-actif={actif ? "1" : "0"}
                onClick={() => setJourChoisi(j)}
                className={`shrink-0 min-w-[64px] rounded-xl border px-2.5 py-1.5 text-center transition ${
                  actif ? "text-white shadow-sm" : n === 0 ? "bg-gray-50 border-gray-200 text-gray-700 hover:bg-gray-100" : "bg-white border-gray-300 text-gray-900 hover:bg-gray-50"
                }`}
                style={actif ? { backgroundColor: RED, borderColor: RED } : auj ? { borderColor: RED, color: RED } : undefined}
                title={`${d.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })} : ${n} candidat${n > 1 ? "s" : ""}`}
              >
                <span className="block text-[11px] font-semibold uppercase leading-tight">
                  {auj ? "auj." : d.toLocaleDateString("fr-FR", { weekday: "short" }).replace(".", "")}
                </span>
                <span className="block text-base font-bold leading-tight tabular-nums">
                  {d.getDate()} <span className="text-[11px] font-semibold">{d.toLocaleDateString("fr-FR", { month: "short" }).replace(".", "")}</span>
                </span>
                <span className={`block text-[11px] leading-tight ${actif ? "text-white/90" : ""}`}>
                  {n} cand.
                </span>
              </button>
            );
          })}
        </div>
        <button onClick={() => setJourChoisi(jours[idxJour + 1])} disabled={idxJour >= jours.length - 1} className={boutonNav} aria-label="Jour suivant">
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      {/* ── Jour affiché, options et légende ── */}
      <div className={`flex flex-wrap items-center gap-x-4 gap-y-2 ${pleinEcran ? "mb-3" : "px-4 pt-3 pb-2"}`}>
        <p className="text-base font-bold text-gray-900 capitalize">
          {titreJour}
          {estAujourdhui && <span className="ml-2 text-xs font-bold uppercase" style={{ color: RED }}>aujourd&apos;hui</span>}
        </p>
        <label className="flex items-center gap-2 text-sm font-medium text-gray-900 cursor-pointer select-none">
          <input type="checkbox" checked={libres} onChange={(e) => basculerLibres(e.target.checked)} className="h-4 w-4 accent-[#C62828]" />
          Afficher les créneaux libres{nbLibres > 0 ? ` (${nbLibres})` : ""}
        </label>
        <button
          onClick={pleinEcran ? quitterPleinEcran : entrerPleinEcran}
          className="ml-auto h-9 flex items-center gap-1.5 text-sm px-3 rounded-lg border border-gray-300 bg-white font-medium text-gray-900 hover:bg-gray-50 transition"
          title={pleinEcran ? "Quitter le plein écran (Échap)" : "Afficher en plein écran"}
        >
          {pleinEcran ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          {pleinEcran ? "Quitter le plein écran" : "Plein écran"}
        </button>
      </div>
      <div className={`flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-gray-900 ${pleinEcran ? "mb-3" : "px-4 pb-3"}`}>
        {/* Entrée « créneau libre » seulement quand ils sont affichés */}
        {legende.filter((l) => libres || !l.libre).map((l) => (
          <span key={l.label} className="flex items-center gap-1.5">
            <span
              className={`h-3.5 w-4 rounded-sm ${l.libre ? "border border-dashed border-gray-400" : ""}`}
              style={{ backgroundColor: l.teinte.fond, boxShadow: `inset 3px 0 0 ${l.teinte.barre}` }}
            />
            {l.label}
          </span>
        ))}
        {consigne && <span className="sm:ml-auto text-gray-700">{consigne}</span>}
      </div>

      {/* ── Grille : une colonne par salle ── */}
      <div className={pleinEcran ? "" : "px-4 pb-4"}>
        {visibles.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-300 px-4 py-10 text-center">
            <p className="text-sm font-semibold text-gray-900">Aucun candidat ce jour-là</p>
            {nbLibres > 0 && (
              <button onClick={() => basculerLibres(true)} className="mt-2 text-sm font-semibold underline underline-offset-2" style={{ color: RED }}>
                Afficher les {nbLibres} créneau{nbLibres > 1 ? "x" : ""} libre{nbLibres > 1 ? "s" : ""}
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-gray-200">
            <div className="flex min-w-fit">
              {/* Axe des heures, fixe pendant le défilement horizontal */}
              <div className="sticky left-0 z-30 w-14 shrink-0 bg-gray-50 border-r border-gray-200" style={{ height: hauteur + ENTETE_COLONNE_PX }}>
                {heures.map((m) => (
                  <span
                    key={m}
                    className="absolute right-2 -translate-y-1/2 text-xs font-semibold text-gray-800 tabular-nums"
                    style={{ top: ENTETE_COLONNE_PX + (m - debut) * pxParMin }}
                  >
                    {enHeure(m)}
                  </span>
                ))}
              </div>

              {salles.map((salle, i) => {
                const deLaSalle = visibles.filter((c) => (c.salle ?? "") === salle);
                const placement = repartirEnVoies(deLaSalle);
                const nbCand = deLaSalle.filter((c) => !c.libre).length;
                return (
                  <div key={salle || "—"} className={`flex-1 ${i > 0 ? "border-l border-gray-200" : ""} ${estAujourdhui ? "bg-red-50/20" : ""}`} style={{ minWidth: LARGEUR_MIN_COLONNE }}>
                    <div className="flex items-center justify-center gap-2 border-b border-gray-200 bg-white px-2" style={{ height: ENTETE_COLONNE_PX }}>
                      <DoorOpen className="h-4 w-4 shrink-0" style={{ color: RED }} />
                      <span className="text-sm font-bold text-gray-900 truncate">{salle ? `Salle ${salle}` : "Sans salle"}</span>
                      <span className="text-[11px] text-gray-700 shrink-0">{nbCand} cand.</span>
                    </div>

                    <div className="relative" style={{ height: hauteur }}>
                      {heures.map((m) => (
                        <div key={m} className="absolute inset-x-0 border-t border-gray-100" style={{ top: (m - debut) * pxParMin }} />
                      ))}
                      {/* Heure actuelle */}
                      {estAujourdhui && minutesMaintenant >= debut && minutesMaintenant <= fin && (
                        <div className="absolute inset-x-0 z-20 pointer-events-none border-t-2" style={{ top: (minutesMaintenant - debut) * pxParMin, borderColor: RED }} />
                      )}
                      {deLaSalle.map((c) => {
                        const d = enMinutes(c.heure_debut);
                        const f = enMinutes(c.heure_fin);
                        const prep = c.preparation_minutes ?? 0;
                        const h = Math.max((f - d) * pxParMin, 24);
                        const { voie, nbVoies } = placement.get(c.id)!;
                        return (
                          <button
                            key={c.id}
                            onClick={() => { if (pleinEcran) quitterPleinEcran(); onSelect(c.id); }}
                            className={`absolute rounded-md pl-3 pr-2 text-left overflow-hidden text-gray-900 transition hover:brightness-[0.97] hover:z-10 focus:outline-none focus-visible:ring-2 ${
                              h >= 40 ? "py-1.5" : "py-0.5"
                            } ${c.libre ? "border border-dashed border-gray-300" : ""}`}
                            style={{
                              top: (d - debut) * pxParMin + 2,
                              height: h - 4,
                              left: `calc(${(voie / nbVoies) * 100}% + 6px)`,
                              width: `calc(${100 / nbVoies}% - 12px)`,
                              backgroundColor: c.teinte.fond,
                              boxShadow: `inset 3px 0 0 ${c.teinte.barre}`,
                              "--tw-ring-color": RED,
                            } as React.CSSProperties}
                            title={c.infobulle}
                          >
                            <span className="flex items-center gap-1.5 min-w-0">
                              {h < 40 && <span className="text-xs font-semibold tabular-nums shrink-0">{c.heure_debut}</span>}
                              <span className={`text-sm truncate ${c.libre ? "text-gray-700" : "font-semibold"}`}>{c.titre}</span>
                              {c.alerte && <span className="text-xs shrink-0" title={c.alerte}>⚠</span>}
                              {c.badge && (
                                <span
                                  className="ml-auto shrink-0 rounded-full px-1.5 py-px text-[11px] font-semibold tabular-nums"
                                  style={{ color: c.badge.couleur, backgroundColor: c.badge.fond }}
                                >
                                  {c.badge.texte}
                                </span>
                              )}
                            </span>
                            {h >= 40 && (
                              <span className="block text-xs text-gray-700 tabular-nums truncate mt-0.5">
                                {c.heure_debut} – {c.heure_fin}{c.detail ? ` · ${c.detail}` : ""}
                              </span>
                            )}
                            {h >= 70 && prep > 0 && (
                              <span className="block text-[11px] text-gray-700 tabular-nums truncate mt-0.5">
                                Préparation dès {enHeure(d - prep)}
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
