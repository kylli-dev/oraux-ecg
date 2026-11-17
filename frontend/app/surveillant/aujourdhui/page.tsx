"use client";

// Mode « Aujourd'hui » de l'espace surveillant, pour le jour des oraux : la journée en cours
// seulement, ce qui se passe en ce moment et le prochain candidat mis en avant, les
// créneaux passés grisés, et de gros boutons pour marquer un absent (pensés pour un
// téléphone ou une tablette). L'heure avance toute seule ; les créneaux sont relus
// régulièrement pour suivre les changements de l'admin.

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { CalendarCheck, CheckCircle, Clock, DoorOpen, Loader2, RefreshCw } from "lucide-react";
import { RED, PageHeader, Alert } from "../_ui";
import { BlocIncident, BoutonsPointage, etatPointage, heureArrivee, pointer } from "../_pointage";
import { ContactsUtiles } from "../_contacts";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8002";
const RELECTURE_MS = 2 * 60_000;

type Epreuve = {
  id: number;
  date: string;
  matiere: string;
  heure_debut: string;
  heure_fin: string;
  preparation_minutes: number | null;
  statut: string;
  candidat_id: number | null;
  candidat_nom: string | null;
  candidat_prenom: string | null;
  salle_intitule: string | null;
  salle_preparation_intitule: string | null;
  planche_nom: string | null;
  examinateur_nom: string | null;
  examinateur_prenom: string | null;
  presence_le?: string | null;
  incident?: string | null;
  incident_le?: string | null;
};

// Où en est un créneau à l'heure actuelle
type Phase = "passe" | "preparation" | "epreuve" | "a_venir";

const enMinutes = (h: string) => { const [hh, mm] = h.split(":").map(Number); return hh * 60 + (mm || 0); };
const enHeure = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
const debutPrepa = (e: Epreuve) => enMinutes(e.heure_debut) - (e.preparation_minutes ?? 0);
const isoLocal = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

function phaseDe(e: Epreuve, maintenant: number): Phase {
  if (maintenant >= enMinutes(e.heure_fin)) return "passe";
  if (maintenant >= enMinutes(e.heure_debut)) return "epreuve";
  if (maintenant >= debutPrepa(e)) return "preparation";
  return "a_venir";
}

function nomCandidat(e: Epreuve) {
  return e.candidat_id ? `${e.candidat_prenom ?? ""} ${e.candidat_nom ?? ""}`.trim() : "Créneau libre";
}

function authHeaders() {
  return { Authorization: `Bearer ${sessionStorage.getItem("surveillant_token") ?? ""}` };
}

export default function SurveillantAujourdhuiPage() {
  const router = useRouter();
  const [epreuves, setEpreuves] = useState<Epreuve[] | null>(null);
  const [erreur, setErreur] = useState("");
  const [enCours, setEnCours] = useState<Set<number>>(new Set());
  const [maintenant, setMaintenant] = useState(() => new Date());

  const charger = useCallback(async () => {
    const token = sessionStorage.getItem("surveillant_token");
    if (!token) { router.replace("/surveillant"); return; }
    try {
      const r = await fetch(`${API}/surveillant/me/epreuves`, { headers: authHeaders() });
      if (r.status === 401) { sessionStorage.removeItem("surveillant_token"); router.replace("/surveillant"); return; }
      if (!r.ok) throw new Error();
      const data = await r.json();
      if (Array.isArray(data)) { setEpreuves(data); setErreur(""); }
    } catch {
      setErreur("Impossible de charger vos créneaux. Vérifiez votre connexion puis réessayez.");
      setEpreuves((e) => e ?? []);
    }
  }, [router]);

  useEffect(() => {
    charger();
    const relecture = setInterval(charger, RELECTURE_MS);
    const horloge = setInterval(() => setMaintenant(new Date()), 30_000);
    return () => { clearInterval(relecture); clearInterval(horloge); };
  }, [charger]);

  async function pointerEpreuve(e: Epreuve, cible: "present" | "absent") {
    setEnCours((s) => new Set(s).add(e.id));
    try {
      const message = await pointer(e, cible);
      if (message) { setErreur(message); return; }
      setErreur("");
      await charger();
    } finally {
      setEnCours((s) => { const n = new Set(s); n.delete(e.id); return n; });
    }
  }

  const aujourdhui = isoLocal(maintenant);
  const minutes = maintenant.getHours() * 60 + maintenant.getMinutes();
  const titreJour = maintenant.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });

  if (epreuves === null) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-20 flex justify-center">
        <Loader2 className="h-6 w-6 animate-spin" style={{ color: RED }} />
      </div>
    );
  }

  const duJour = epreuves
    .filter((e) => e.date === aujourdhui)
    .sort((a, b) => a.heure_debut.localeCompare(b.heure_debut) || (a.salle_intitule ?? "").localeCompare(b.salle_intitule ?? ""));
  const avecCandidat = duJour.filter((e) => e.candidat_id);
  const maintenantCreneaux = duJour.filter((e) => e.candidat_id && ["preparation", "epreuve"].includes(phaseDe(e, minutes)));
  // Prochain passage : le plus tôt des créneaux à venir (tous ceux qui commencent alors)
  const aVenir = duJour.filter((e) => e.candidat_id && phaseDe(e, minutes) === "a_venir");
  const prochainDebut = aVenir.length ? Math.min(...aVenir.map(debutPrepa)) : null;
  const prochains = aVenir.filter((e) => debutPrepa(e) === prochainDebut);
  const passes = avecCandidat.filter((e) => phaseDe(e, minutes) === "passe").length;
  const absents = avecCandidat.filter((e) => e.statut === "ABSENT").length;
  const presents = avecCandidat.filter((e) => etatPointage(e) === "present").length;
  // Passages commencés (préparation ou épreuve) sans pointage : à vérifier
  const nonPointes = avecCandidat.filter((e) => etatPointage(e) === "attendu" && phaseDe(e, minutes) !== "a_venir").length;
  const prochaineDate = [...new Set(epreuves.map((e) => e.date))].sort().find((d) => d > aujourdhui);

  const boutonsPointage = (e: Epreuve, grand = false) => (
    <BoutonsPointage epreuve={e} occupe={enCours.has(e.id)} onPointer={(cible) => pointerEpreuve(e, cible)} grand={grand} />
  );

  const carte = (e: Epreuve, etiquette: string, couleur: string) => (
    <div key={e.id} className="bg-white rounded-2xl border-2 shadow-sm p-5" style={{ borderColor: couleur }}>
      <div className="flex flex-wrap items-center gap-2 mb-2">
        <span className="text-xs font-bold uppercase tracking-wide px-2.5 py-1 rounded-full text-white" style={{ backgroundColor: couleur }}>
          {etiquette}
        </span>
        <span className="text-sm font-semibold text-gray-900 tabular-nums">
          {e.heure_debut} → {e.heure_fin}
        </span>
      </div>
      <p className={`text-2xl font-bold ${e.statut === "ABSENT" ? "text-amber-800 line-through" : "text-gray-900"}`}>{nomCandidat(e)}</p>
      {e.presence_le && e.statut !== "ABSENT" && (
        <p className="mt-1 inline-flex items-center gap-1 text-sm font-semibold text-green-800">
          <CheckCircle className="h-4 w-4" /> Arrivé à {heureArrivee(e)}
        </p>
      )}
      <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1 text-sm text-gray-900">
        <p><span className="text-gray-700">Matière :</span> <strong>{e.matiere}</strong></p>
        <p><span className="text-gray-700">Salle d&apos;épreuve :</span> <strong>{e.salle_intitule ?? "—"}</strong></p>
        {(e.preparation_minutes ?? 0) > 0 && (
          <p>
            <span className="text-gray-700">Préparation :</span>{" "}
            <strong>dès {enHeure(debutPrepa(e))}{e.salle_preparation_intitule ? `, salle ${e.salle_preparation_intitule}` : ""}</strong>
          </p>
        )}
        {e.examinateur_nom && (
          <p><span className="text-gray-700">Examinateur :</span> <strong>{e.examinateur_prenom} {e.examinateur_nom}</strong></p>
        )}
        {e.planche_nom && <p><span className="text-gray-700">Planche :</span> <strong>{e.planche_nom}</strong></p>}
      </div>
      <div className="mt-4">{boutonsPointage(e, true)}</div>
      <div className="mt-3">
        <BlocIncident key={`${e.id}-${e.incident ?? ""}`} epreuve={e} onEnregistre={() => charger()} />
      </div>
    </div>
  );

  return (
    <div className="max-w-3xl mx-auto px-4 py-10">
      <PageHeader
        icon={<CalendarCheck className="h-6 w-6" />}
        title="Aujourd'hui"
        subtitle={<span className="capitalize">{titreJour} · il est {enHeure(minutes)}</span>}
        actions={
          <button
            onClick={() => charger()}
            className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg border bg-white font-medium text-gray-900 hover:bg-gray-50 transition"
          >
            <RefreshCw className="h-4 w-4" /> Actualiser
          </button>
        }
      />

      <div className="space-y-6">
        {erreur && <Alert tone="error">{erreur}</Alert>}

        {duJour.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-12 text-center">
            <Clock className="h-10 w-10 mx-auto mb-3" style={{ color: RED }} />
            <p className="text-base font-semibold text-gray-900">Aucun créneau de surveillance aujourd&apos;hui</p>
            {prochaineDate && (
              <p className="text-sm text-gray-800 mt-1">
                Prochaine journée :{" "}
                <strong className="capitalize">
                  {new Date(prochaineDate + "T12:00:00").toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })}
                </strong>
              </p>
            )}
            <Link href="/surveillant/emploi-du-temps" className="inline-block mt-4 text-sm font-semibold underline underline-offset-2" style={{ color: RED }}>
              Voir mon emploi du temps
            </Link>
          </div>
        ) : (
          <>
            {/* ── Avancement de la journée ── */}
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: "Présents", valeur: `${presents} / ${avecCandidat.length}`, cls: presents ? "text-green-800" : "" },
                { label: "Absents", valeur: String(absents), cls: absents ? "text-amber-800" : "" },
                { label: "Passés", valeur: `${passes} / ${avecCandidat.length}` },
              ].map((r) => (
                <div key={r.label} className="bg-white rounded-2xl border border-black/5 shadow-sm px-4 py-3">
                  <p className="text-[11px] font-medium uppercase tracking-wide text-gray-700">{r.label}</p>
                  <p className={`text-2xl font-bold tabular-nums text-gray-900 ${r.cls ?? ""}`}>{r.valeur}</p>
                </div>
              ))}
            </div>

            {nonPointes > 0 && (
              <Alert tone="warning">
                {nonPointes} candidat{nonPointes > 1 ? "s" : ""} déjà en préparation ou passé{nonPointes > 1 ? "s" : ""} sans pointage : marquez-le{nonPointes > 1 ? "s" : ""} présent{nonPointes > 1 ? "s" : ""} ou absent{nonPointes > 1 ? "s" : ""}.
              </Alert>
            )}

            {/* ── En ce moment / prochain ── */}
            {maintenantCreneaux.length > 0 && (
              <section className="space-y-3">
                <h2 className="text-sm font-bold uppercase tracking-wide text-gray-900">En ce moment</h2>
                {maintenantCreneaux.map((e) =>
                  carte(e, phaseDe(e, minutes) === "preparation" ? "En préparation" : "En épreuve", RED))}
              </section>
            )}
            {prochains.length > 0 && (
              <section className="space-y-3">
                <h2 className="text-sm font-bold uppercase tracking-wide text-gray-900">
                  Prochain{prochains.length > 1 ? "s" : ""} · {prochainDebut !== null && prochainDebut - minutes > 0
                    ? `dans ${prochainDebut - minutes >= 60 ? `${Math.floor((prochainDebut - minutes) / 60)} h ${String((prochainDebut - minutes) % 60).padStart(2, "0")}` : `${prochainDebut - minutes} min`}`
                    : "maintenant"}
                </h2>
                {prochains.map((e) => carte(e, "Prochain", "#1F2937"))}
              </section>
            )}
            {maintenantCreneaux.length === 0 && prochains.length === 0 && (
              <Alert tone="success">Tous les passages de la journée sont terminés.</Alert>
            )}

            {/* ── Toute la journée ── */}
            <section>
              <h2 className="text-sm font-bold uppercase tracking-wide text-gray-900 mb-3">Toute la journée</h2>
              <div className="bg-white rounded-2xl border border-black/5 shadow-sm divide-y divide-gray-100 overflow-hidden">
                {duJour.map((e) => {
                  const phase = phaseDe(e, minutes);
                  const passe = phase === "passe";
                  const actif = phase === "preparation" || phase === "epreuve";
                  return (
                    <div
                      key={e.id}
                      className={`flex flex-wrap items-center gap-3 px-4 py-3 ${passe ? "bg-gray-50" : ""} ${actif && e.candidat_id ? "bg-red-50/40" : ""}`}
                    >
                      <div className="w-24 shrink-0">
                        <p className={`text-base font-bold tabular-nums ${passe ? "text-gray-700" : "text-gray-900"}`}>{e.heure_debut}</p>
                        <p className="text-xs text-gray-700 tabular-nums">→ {e.heure_fin}</p>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className={`text-base font-semibold truncate ${
                          !e.candidat_id ? "text-gray-700 italic" : e.statut === "ABSENT" ? "text-amber-800 line-through" : passe ? "text-gray-700" : "text-gray-900"
                        }`}>
                          {nomCandidat(e)}
                        </p>
                        <p className="text-xs text-gray-800 flex items-center gap-1 truncate">
                          <DoorOpen className="h-3.5 w-3.5 shrink-0" />
                          {e.salle_intitule ? `Salle ${e.salle_intitule}` : "Salle à préciser"} · {e.matiere}
                        </p>
                      </div>
                      {actif && e.candidat_id && (
                        <span className="text-[11px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full text-white" style={{ backgroundColor: RED }}>
                          {phase === "preparation" ? "En préparation" : "En épreuve"}
                        </span>
                      )}
                      {e.presence_le && e.statut !== "ABSENT" && (
                        <span className="text-xs font-semibold text-green-800">Arrivé {heureArrivee(e)}</span>
                      )}
                      {e.incident && (
                        <span className="text-xs font-semibold" style={{ color: RED }} title={e.incident}>⚠ Incident</span>
                      )}
                      {e.candidat_id ? boutonsPointage(e) : null}
                    </div>
                  );
                })}
              </div>
            </section>
          </>
        )}
      </div>

      <ContactsUtiles className="mt-6" />
    </div>
  );
}
