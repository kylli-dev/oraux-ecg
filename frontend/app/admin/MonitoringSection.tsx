"use client";

// Onglet Monitoring (super-administrateurs) : qui est en ligne, quand la plateforme est
// utilisée (pour choisir le moment d'un déploiement) et qui a fait quoi.
// Données : /admin/monitoring/* (backend/app/api/monitoring.py).

import React, { useCallback, useEffect, useRef, useState } from "react";
import { Activity, RefreshCw } from "lucide-react";

type EnLigne = { acteur_type: string; acteur_id: number | null; nom: string; derniere_activite: string; derniere_action: string };
type LigneJournal = {
  id: number; date: string; acteur_type: string; acteur_id: number | null; nom: string;
  action: string; methode: string; chemin: string; statut_http: number; duree_ms: number;
};
type Frequentation = { jours: number; moyenne: number[][]; maximum: number[][]; conservation_jours: number };

const TYPES: Record<string, { label: string; cls: string }> = {
  admin: { label: "Admin", cls: "bg-red-100 text-red-800" },
  candidat: { label: "Candidat", cls: "bg-sky-100 text-sky-800" },
  examinateur: { label: "Examinateur", cls: "bg-violet-100 text-violet-800" },
  surveillant: { label: "Surveillant", cls: "bg-emerald-100 text-emerald-800" },
  anonyme: { label: "Anonyme", cls: "bg-gray-100 text-gray-800" },
};
const JOURS = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"];
const MINUTES_EN_LIGNE = 10;
const RAFRAICHISSEMENT_MS = 30_000;

const heureParis = (iso: string) =>
  new Date(iso).toLocaleString("fr-FR", { timeZone: "Europe/Paris", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" });

function ilYa(iso: string) {
  const s = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return "à l'instant";
  return `il y a ${Math.round(s / 60)} min`;
}

function BadgeType({ type }: { type: string }) {
  const t = TYPES[type] ?? TYPES.anonyme;
  return <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${t.cls}`}>{t.label}</span>;
}

function Carte({ titre, droite, children }: { titre: string; droite?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl border border-black/5 shadow-sm p-5 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h3 className="text-sm font-semibold text-gray-900">{titre}</h3>
        {droite}
      </div>
      {children}
    </div>
  );
}

export default function MonitoringSection({ get }: { get: <T>(chemin: string) => Promise<T> }) {
  const [enLigne, setEnLigne] = useState<EnLigne[] | null>(null);
  const [freq, setFreq] = useState<Frequentation | null>(null);
  const [joursFreq, setJoursFreq] = useState(14);
  const [journal, setJournal] = useState<LigneJournal[]>([]);
  const [filtreType, setFiltreType] = useState("");
  const [avecConsultations, setAvecConsultations] = useState(false);
  const [finJournal, setFinJournal] = useState(false);
  const [erreur, setErreur] = useState("");
  const [majA, setMajA] = useState<Date | null>(null);
  const [chargement, setChargement] = useState(false);

  const LIMITE = 100;
  const paramsJournal = useCallback(
    (avantId?: number) => {
      const p = new URLSearchParams({ limite: String(LIMITE) });
      if (filtreType) p.set("acteur_type", filtreType);
      if (avecConsultations) p.set("avec_consultations", "true");
      if (avantId) p.set("avant_id", String(avantId));
      return p.toString();
    },
    [filtreType, avecConsultations]
  );

  // Après « Charger les suivantes », l'actualisation automatique ne ramène plus le journal à
  // sa première page (elle met seulement à jour les personnes en ligne et la fréquentation)
  const pagine = useRef(false);

  const rafraichir = useCallback(async (complet = true) => {
    setChargement(true);
    try {
      if (complet) pagine.current = false;
      const [l, f, j] = await Promise.all([
        get<EnLigne[]>(`monitoring/en-ligne?minutes=${MINUTES_EN_LIGNE}`),
        get<Frequentation>(`monitoring/frequentation?jours=${joursFreq}`),
        pagine.current ? Promise.resolve(null) : get<LigneJournal[]>(`monitoring/journal?${paramsJournal()}`),
      ]);
      setEnLigne(l);
      setFreq(f);
      if (j) {
        setJournal(j);
        setFinJournal(j.length < LIMITE);
      }
      setErreur("");
      setMajA(new Date());
    } catch (e: unknown) {
      setErreur(e instanceof Error ? e.message : String(e));
    } finally {
      setChargement(false);
    }
  }, [get, joursFreq, paramsJournal]);

  useEffect(() => {
    rafraichir();
    const t = setInterval(() => rafraichir(false), RAFRAICHISSEMENT_MS);
    return () => clearInterval(t);
  }, [rafraichir]);

  const chargerPlus = async () => {
    const dernier = journal[journal.length - 1];
    if (!dernier) return;
    try {
      const suite = await get<LigneJournal[]>(`monitoring/journal?${paramsJournal(dernier.id)}`);
      pagine.current = true;
      setJournal((prev) => [...prev, ...suite]);
      setFinJournal(suite.length < LIMITE);
    } catch (e: unknown) {
      setErreur(e instanceof Error ? e.message : String(e));
    }
  };

  // Personnes en ligne, par type
  const parType = (enLigne ?? []).reduce<Record<string, number>>((acc, p) => ({ ...acc, [p.acteur_type]: (acc[p.acteur_type] ?? 0) + 1 }), {});
  const nbEnLigne = enLigne?.length ?? 0;

  // Créneaux d'une heure les plus calmes en journée (8 h – 20 h), du lundi au dimanche
  const calmes = freq
    ? freq.moyenne
        .flatMap((ligne, j) => ligne.map((m, h) => ({ j, h, m, max: freq.maximum[j][h] })))
        .filter((c) => c.h >= 8 && c.h < 20)
        .sort((a, b) => a.m - b.m || a.max - b.max || a.j - b.j || a.h - b.h)
        .slice(0, 5)
    : [];
  const maxMoyenne = freq ? Math.max(1, ...freq.moyenne.flat()) : 1;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Activity className="h-5 w-5 text-[#C62828]" />
          <h2 className="text-lg font-semibold text-gray-900">Monitoring</h2>
        </div>
        <div className="flex items-center gap-3 text-xs text-gray-700">
          {majA && <span>Mis à jour à {majA.toLocaleTimeString("fr-FR")} · actualisation toutes les 30 s</span>}
          <button
            onClick={() => rafraichir()}
            disabled={chargement}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-black/15 bg-white text-gray-900 hover:bg-black/[0.03] disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${chargement ? "animate-spin" : ""}`} /> Actualiser
          </button>
        </div>
      </div>

      {erreur && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-800">{erreur}</div>}

      {/* ── En ligne maintenant ── */}
      <Carte titre={`En ligne maintenant (actifs sur les ${MINUTES_EN_LIGNE} dernières minutes)`}>
        {enLigne && (
          <div
            className={`rounded-xl border px-4 py-3 text-sm ${
              nbEnLigne === 0 ? "border-emerald-200 bg-emerald-50 text-emerald-900" : "border-amber-200 bg-amber-50 text-amber-900"
            }`}
          >
            {nbEnLigne === 0 ? (
              <><strong>Personne n&apos;est actif.</strong> C&apos;est un bon moment pour déployer.</>
            ) : (
              <>
                <strong>{nbEnLigne} personne{nbEnLigne > 1 ? "s" : ""} active{nbEnLigne > 1 ? "s" : ""}</strong>
                {" "}({Object.entries(parType).map(([t, n]) => `${n} ${TYPES[t]?.label.toLowerCase() ?? t}${n > 1 ? "s" : ""}`).join(", ")}).
                {" "}Un déploiement du serveur coupe la plateforme environ une minute : leurs actions en cours échoueraient.
              </>
            )}
          </div>
        )}
        {nbEnLigne > 0 && (
          <div className="divide-y divide-black/5 rounded-xl border border-black/10">
            {enLigne!.map((p) => (
              <div key={`${p.acteur_type}-${p.acteur_id}-${p.nom}`} className="flex items-center gap-3 px-4 py-2.5 text-sm flex-wrap">
                <BadgeType type={p.acteur_type} />
                <span className="font-medium text-gray-900">{p.nom}</span>
                <span className="text-gray-700">{p.derniere_action}</span>
                <span className="ml-auto text-xs text-gray-700">{ilYa(p.derniere_activite)}</span>
              </div>
            ))}
          </div>
        )}
      </Carte>

      {/* ── Fréquentation ── */}
      <Carte
        titre="Fréquentation : personnes actives par heure (heure de Paris)"
        droite={
          <select
            value={joursFreq}
            onChange={(e) => setJoursFreq(Number(e.target.value))}
            className="border border-black/15 rounded-lg px-2 py-1 text-xs text-gray-900 bg-white"
          >
            {[7, 14, 30].map((j) => <option key={j} value={j}>{j} derniers jours</option>)}
          </select>
        }
      >
        {freq && (
          <>
            <div className="overflow-x-auto">
              <table className="text-[11px] border-separate" style={{ borderSpacing: 2 }}>
                <thead>
                  <tr>
                    <th />
                    {Array.from({ length: 24 }, (_, h) => (
                      <th key={h} className="font-medium text-gray-700 w-7 text-center">{h}h</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {freq.moyenne.map((ligne, j) => (
                    <tr key={j}>
                      <td className="pr-2 font-medium text-gray-900 whitespace-nowrap">{JOURS[j]}</td>
                      {ligne.map((m, h) => {
                        const intensite = m / maxMoyenne;
                        return (
                          <td
                            key={h}
                            title={`${JOURS[j]} ${h}h–${h + 1}h : ${m.toLocaleString("fr-FR")} en moyenne, ${freq.maximum[j][h]} au maximum`}
                            className="h-7 w-7 rounded text-center font-semibold"
                            style={{
                              backgroundColor: m === 0 ? "#F3F4F6" : `rgba(198, 40, 40, ${0.15 + 0.75 * intensite})`,
                              color: intensite > 0.55 ? "#fff" : "#111827",
                            }}
                          >
                            {m > 0 ? (m >= 10 ? Math.round(m) : m.toLocaleString("fr-FR")) : ""}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-gray-700">
              Chaque case donne le nombre moyen de personnes différentes actives dans l&apos;heure, ce jour de la semaine, sur les {freq.jours} derniers jours
              (survol : maximum observé). Les données sont conservées {freq.conservation_jours} jours.
            </p>
            {calmes.length > 0 && (
              <div className="text-sm text-gray-900">
                <span className="font-semibold">Créneaux les plus calmes en journée (8 h – 20 h) :</span>{" "}
                {calmes.map((c) => `${JOURS[c.j].toLowerCase()} ${c.h}h–${c.h + 1}h (${c.m.toLocaleString("fr-FR")})`).join(" · ")}
                <span className="text-gray-700"> — la nuit est en général libre.</span>
              </div>
            )}
          </>
        )}
      </Carte>

      {/* ── Journal ── */}
      <Carte
        titre="Journal d'activité"
        droite={
          <div className="flex items-center gap-3 text-xs text-gray-900">
            <select
              value={filtreType}
              onChange={(e) => setFiltreType(e.target.value)}
              className="border border-black/15 rounded-lg px-2 py-1 bg-white"
            >
              <option value="">Tout le monde</option>
              {Object.entries(TYPES).map(([k, t]) => <option key={k} value={k}>{t.label}s</option>)}
            </select>
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input type="checkbox" checked={avecConsultations} onChange={(e) => setAvecConsultations(e.target.checked)} />
              Inclure les consultations
            </label>
          </div>
        }
      >
        {journal.length === 0 ? (
          <p className="text-sm text-gray-700">Aucune activité enregistrée.</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-black/10">
            <table className="w-full text-xs">
              <thead className="bg-gray-50 text-gray-900">
                <tr>
                  <th className="text-left px-3 py-2 font-semibold">Date</th>
                  <th className="text-left px-3 py-2 font-semibold">Qui</th>
                  <th className="text-left px-3 py-2 font-semibold">Action</th>
                  <th className="text-left px-3 py-2 font-semibold">Résultat</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/5">
                {journal.map((l) => {
                  const ok = l.statut_http < 400;
                  return (
                    <tr key={l.id} className="text-gray-900">
                      <td className="px-3 py-1.5 whitespace-nowrap font-mono">{heureParis(l.date)}</td>
                      <td className="px-3 py-1.5 whitespace-nowrap">
                        <span className="inline-flex items-center gap-2"><BadgeType type={l.acteur_type} /> {l.nom}</span>
                      </td>
                      <td className="px-3 py-1.5" title={`${l.methode} ${l.chemin}`}>{l.action}</td>
                      <td className="px-3 py-1.5 whitespace-nowrap">
                        <span className={ok ? "text-emerald-800" : "text-red-700 font-semibold"}>
                          {ok ? "OK" : `Échec (${l.statut_http})`}
                        </span>
                        <span className="text-gray-700"> · {l.duree_ms} ms</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {!finJournal && journal.length > 0 && (
          <button onClick={chargerPlus} className="text-xs font-medium text-gray-900 underline hover:no-underline">
            Charger les {LIMITE} suivantes
          </button>
        )}
      </Carte>
    </div>
  );
}
