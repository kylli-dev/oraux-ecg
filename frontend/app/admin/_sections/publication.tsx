"use client";

import React, { useState, useEffect } from "react";
import { RefreshCw, CheckCircle2, AlertTriangle } from "lucide-react";
import {
  AffectationManquante,
  ECRAN_AFFECTATION,
  Empty,
  EpreuveFlat,
  NavAffectationContext,
  Planning,
  Spinner,
  get,
  manquesPublication,
  memoriserPlanning,
  planningMemorise,
  useFiltre,
} from "./commun";

// ── Gestion des salles ─────────────────────────────────────────────────────────
// ── Prêt à publier ? ──────────────────────────────────────────────────────────
// Vue d'ensemble des 4 affectations exigées pour qu'un créneau soit proposé aux
// candidats (salle, examinateur, surveillant, planche — voir manquesPublication).
// Une ligne par créneau (jour, matière, heure) ; chaque pastille manquante ouvre
// l'écran d'affectation correspondant, filtré sur ce créneau.
const TYPES_AFFECTATION: { manque: AffectationManquante; label: string }[] = [
  { manque: "salle", label: "Salle" },
  { manque: "examinateur", label: "Examinateur" },
  { manque: "surveillant", label: "Surveillant" },
  { manque: "planche", label: "Planche" },
];

// Ce qui manque à une épreuve, quel que soit son statut (une épreuve déjà attribuée
// doit elle aussi avoir sa salle, son jury, son surveillant et sa planche le jour J)
function manquesEpreuve(e: EpreuveFlat): AffectationManquante[] {
  return manquesPublication({ ...e, statut: "LIBRE" }) as AffectationManquante[];
}

export function PretAPublierSection() {
  const allerAffecter = React.useContext(NavAffectationContext);
  const [plannings, setPlannings] = useState<Planning[]>([]);
  const [planningId, setPlanningId] = useState<number | "">("");
  const [filtreDate, setFiltreDate] = useFiltre("publication:date", "", planningId);
  const [seulementIncomplets, setSeulementIncomplets] = useFiltre("publication:incomplets", true);

  useEffect(() => {
    get<Planning[]>("plannings/").then((ps) => {
      setPlannings(ps);
      // Planning retenu introuvable (supprimé) ou aucun : on prend le premier
      setPlanningId(planningMemorise(ps) ?? ps[0]?.id ?? "");
    }).catch(() => {});
  }, []);

  // Épreuves chargées, avec le planning auquel elles appartiennent : tant qu'elles ne
  // correspondent pas au planning choisi, on affiche le chargement
  const [donnees, setDonnees] = useState<{ pid: number; epreuves: EpreuveFlat[] } | null>(null);
  const [version, setVersion] = useState(0);
  useEffect(() => {
    if (!planningId) return;
    let annule = false;
    get<EpreuveFlat[]>(`plannings/${planningId}/epreuves`)
      .then((eps) => { if (!annule) setDonnees({ pid: planningId, epreuves: eps }); })
      .catch(() => { if (!annule) setDonnees({ pid: planningId, epreuves: [] }); });
    memoriserPlanning(planningId);
    return () => { annule = true; };
  }, [planningId, version]);
  const epreuves = donnees && donnees.pid === planningId ? donnees.epreuves : [];
  const loading = !!planningId && donnees?.pid !== planningId;
  const charger = () => { setDonnees(null); setVersion((v) => v + 1); };

  const actives = epreuves.filter((e) => e.statut !== "ANNULEE");
  const dates = Array.from(new Set(actives.map((e) => e.date))).sort();

  // Créneaux = (jour, matière, heure) ; plusieurs épreuves en parallèle (doublons) y sont regroupées
  type Creneau = { cle: string; date: string; matiere: string; heure: string; heureFin: string;
    triplet: string | null; epreuves: EpreuveFlat[]; manques: Record<AffectationManquante, number> };
  const creneaux = new Map<string, Creneau>();
  for (const e of actives) {
    const cle = `${e.date}|${e.matiere}|${e.heure_debut}`;
    let c = creneaux.get(cle);
    if (!c) {
      c = { cle, date: e.date, matiere: e.matiere, heure: e.heure_debut, heureFin: e.heure_fin,
        triplet: e.triplet ?? null, epreuves: [], manques: { salle: 0, examinateur: 0, surveillant: 0, planche: 0 } };
      creneaux.set(cle, c);
    }
    c.epreuves.push(e);
    for (const m of manquesEpreuve(e)) c.manques[m]++;
  }
  const estComplet = (c: Creneau) => TYPES_AFFECTATION.every((t) => c.manques[t.manque] === 0);
  const tous = Array.from(creneaux.values()).sort((a, b) =>
    a.date.localeCompare(b.date) || a.heure.localeCompare(b.heure) || a.matiere.localeCompare(b.matiere));
  const nbComplets = tous.filter(estComplet).length;
  const totalManques = (m: AffectationManquante) => tous.reduce((n, c) => n + (c.manques[m] > 0 ? 1 : 0), 0);

  const affiches = tous
    .filter((c) => !filtreDate || c.date === filtreDate)
    .filter((c) => !seulementIncomplets || !estComplet(c));
  const parDate = dates
    .map((d) => ({ date: d, lignes: affiches.filter((c) => c.date === d), tousDuJour: tous.filter((c) => c.date === d) }))
    .filter((g) => g.lignes.length > 0);

  const fmtJour = (d: string) => new Date(d + "T12:00:00").toLocaleDateString("fr-FR", {
    weekday: "long", day: "numeric", month: "long",
  });
  const pid = typeof planningId === "number" ? planningId : null;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-gray-900">Prêt à publier ?</h2>
        <p className="text-sm text-gray-700 mt-1">
          Un créneau n&apos;est proposé aux candidats que s&apos;il a une salle, un examinateur, un surveillant
          et une planche. Cliquez sur une pastille orange pour compléter l&apos;affectation manquante.
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-[200px]">
          <label className="text-xs text-gray-700 mb-1 block">Planning</label>
          <select
            value={planningId}
            onChange={(e) => { setPlanningId(e.target.value ? Number(e.target.value) : ""); setFiltreDate(""); }}
            className="w-full border rounded-lg px-3 py-2 text-sm bg-white text-gray-900 focus:outline-none focus:ring-1 focus:ring-black/15"
          >
            {plannings.length === 0 && <option value="">Aucun planning</option>}
            {plannings.map((p) => <option key={p.id} value={p.id}>{p.nom}</option>)}
          </select>
        </div>
        {dates.length > 0 && (
          <div className="min-w-[180px]">
            <label className="text-xs text-gray-700 mb-1 block">Jour</label>
            <select
              value={filtreDate}
              onChange={(e) => setFiltreDate(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm bg-white text-gray-900 focus:outline-none focus:ring-1 focus:ring-black/15"
            >
              <option value="">Tous les jours</option>
              {dates.map((d) => <option key={d} value={d}>{fmtJour(d)}</option>)}
            </select>
          </div>
        )}
        <div className="flex rounded-xl border overflow-hidden text-xs font-medium">
          {([[true, "À compléter"], [false, "Tous les créneaux"]] as const).map(([v, l]) => (
            <button key={l} onClick={() => setSeulementIncomplets(v)}
              className={`px-4 py-2 transition ${seulementIncomplets === v ? "bg-black text-white" : "bg-white text-gray-800 hover:bg-black/5"}`}
            >
              {l}
            </button>
          ))}
        </div>
        <button onClick={charger} className="ml-auto flex items-center gap-1.5 text-sm text-gray-800 border rounded-lg px-3 py-2 bg-white hover:bg-black/5">
          <RefreshCw className="h-3.5 w-3.5" /> Actualiser
        </button>
      </div>

      {/* Résumé : avancement global et manques par type (clic = écran d'affectation, tout le planning) */}
      {tous.length > 0 && pid && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <div className="bg-white rounded-2xl border border-black/5 shadow-sm p-4">
            <p className="text-xs text-gray-700">Créneaux complets</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{nbComplets}<span className="text-sm font-medium text-gray-700"> / {tous.length}</span></p>
            <div className="h-1.5 rounded-full bg-black/5 mt-2 overflow-hidden">
              <div className="h-full bg-emerald-500" style={{ width: `${Math.round((nbComplets / tous.length) * 100)}%` }} />
            </div>
          </div>
          {TYPES_AFFECTATION.map(({ manque, label }) => {
            const n = totalManques(manque);
            return (
              <button key={manque} disabled={n === 0}
                onClick={() => allerAffecter({ manque, planningId: pid })}
                title={n ? `Ouvre l'écran ${ECRAN_AFFECTATION[manque]}, sur les épreuves sans ${label.toLowerCase()}` : undefined}
                className={`text-left rounded-2xl border shadow-sm p-4 transition ${n ? "bg-amber-50 border-amber-200 hover:shadow-md" : "bg-white border-black/5"}`}
              >
                <p className="text-xs text-gray-700">Sans {label.toLowerCase()}</p>
                <p className={`text-2xl font-bold mt-1 ${n ? "text-amber-800" : "text-emerald-700"}`}>{n}</p>
                <p className="text-[11px] text-gray-700 mt-1">{n ? `→ ${ECRAN_AFFECTATION[manque]}` : "Tout est affecté"}</p>
              </button>
            );
          })}
        </div>
      )}

      {loading ? (
        <div className="p-8 text-center"><Spinner /></div>
      ) : !pid ? (
        <Empty message="Sélectionnez un planning" />
      ) : tous.length === 0 ? (
        <Empty message="Aucun créneau" sub="Appliquez un gabarit pour générer les créneaux." />
      ) : parDate.length === 0 ? (
        <div className="bg-white rounded-2xl border border-black/5 shadow-sm p-8 text-center">
          <CheckCircle2 className="h-8 w-8 text-emerald-600 mx-auto" />
          <p className="text-sm font-semibold text-gray-900 mt-2">Tous les créneaux sont complets{filtreDate ? " ce jour-là" : ""}.</p>
          <p className="text-xs text-gray-700 mt-1">Les créneaux libres sont visibles des candidats.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {parDate.map(({ date, lignes, tousDuJour }) => {
            const complets = tousDuJour.filter(estComplet).length;
            return (
              <div key={date} className="bg-white rounded-2xl border border-black/5 shadow-sm overflow-hidden">
                <div className="px-4 py-2.5 bg-black/[0.02] border-b border-black/5 flex items-center justify-between">
                  <span className="text-sm font-semibold text-gray-900 capitalize">{fmtJour(date)}</span>
                  <span className={`text-xs font-medium ${complets === tousDuJour.length ? "text-emerald-700" : "text-amber-800"}`}>
                    {complets} / {tousDuJour.length} créneau(x) complet(s)
                  </span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-black/5 text-xs">
                        <th className="text-left px-4 py-2 text-gray-700 font-medium w-28">Heure</th>
                        <th className="text-left px-4 py-2 text-gray-700 font-medium">Matière</th>
                        <th className="text-left px-4 py-2 text-gray-700 font-medium w-20">Triplet</th>
                        <th className="text-left px-4 py-2 text-gray-700 font-medium">Affectations</th>
                      </tr>
                    </thead>
                    <tbody>
                      {lignes.map((c) => (
                        <tr key={c.cle} className="border-b border-black/[0.04] last:border-0">
                          <td className="px-4 py-2.5 font-mono text-gray-800 whitespace-nowrap">{c.heure.slice(0, 5)} – {c.heureFin.slice(0, 5)}</td>
                          <td className="px-4 py-2.5 font-medium text-gray-900">
                            {c.matiere}
                            {c.epreuves.length > 1 && <span className="ml-2 text-xs font-normal text-gray-700">({c.epreuves.length} salles en parallèle)</span>}
                          </td>
                          <td className="px-4 py-2.5">
                            {c.triplet
                              ? <span className="inline-block px-2 py-0.5 rounded-md bg-gray-100 text-gray-800 text-xs font-semibold">{c.triplet}</span>
                              : <span className="text-gray-700">—</span>}
                          </td>
                          <td className="px-4 py-2.5">
                            <div className="flex flex-wrap gap-1.5">
                              {TYPES_AFFECTATION.map(({ manque, label }) => {
                                const n = c.manques[manque];
                                if (n === 0) {
                                  return (
                                    <span key={manque} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-xs bg-emerald-50 border-emerald-200 text-emerald-800">
                                      <CheckCircle2 className="h-3 w-3" /> {label}
                                    </span>
                                  );
                                }
                                return (
                                  <button key={manque} type="button"
                                    onClick={() => allerAffecter({ manque, planningId: pid, date: c.date, matiere: c.matiere, heure: c.heure })}
                                    title={`Affecter : ouvre l'écran ${ECRAN_AFFECTATION[manque]}, filtré sur ce créneau`}
                                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-xs font-semibold bg-amber-50 border-amber-300 text-amber-900 hover:bg-amber-100"
                                  >
                                    <AlertTriangle className="h-3 w-3" /> {label}
                                    {c.epreuves.length > 1 && <span className="font-normal">({n}/{c.epreuves.length})</span>}
                                  </button>
                                );
                              })}
                            </div>
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
  );
}
