"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Loader2, CalendarDays, CalendarClock, CheckCircle2, Clock, AlertTriangle, MapPin } from "lucide-react";
import { RED, PageLoader, PageHeader, Alert } from "../_ui";

const API_BASE = process.env.NEXT_PUBLIC_PORTAL_API_URL ?? "http://localhost:8000";

// ── Types ───────────────────────────────────────────────────────────────────────
type EpreuveOut = {
  id: number;
  matiere: string;
  heure_debut: string;
  heure_fin: string;
  heure_prepa?: string;
  demi_journee_type: string;
  salle_intitule?: string | null;
  salle_preparation_intitule?: string | null;
};

type TripletOut = {
  date: string;
  heure_debut: string;
  heure_fin: string;
  nb_epreuves: number;
  epreuves: EpreuveOut[];
};

type InscriptionActive = {
  id: number;
  date: string;
  statut: string;
  epreuves: EpreuveOut[];
};

// ── Helpers ─────────────────────────────────────────────────────────────────────
function formatDate(d: string) {
  return new Date(d + "T12:00:00").toLocaleDateString("fr-FR", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  });
}

function authHeaders(token: string) {
  return { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
}

// ── Composants ──────────────────────────────────────────────────────────────────
function EpreuveRow({ ep }: { ep: EpreuveOut }) {
  return (
    <div className="py-4 space-y-3">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <span className="flex items-center gap-2.5">
          <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: RED }} />
          <span className="text-sm font-semibold text-gray-900">{ep.matiere}</span>
        </span>
        <div className="ml-auto flex flex-wrap items-center gap-1.5">
          {ep.salle_preparation_intitule && (
            <span className="inline-flex items-center gap-1 rounded-full border border-gray-300 bg-white px-2.5 py-0.5 text-xs font-medium text-gray-900">
              <MapPin className="h-3 w-3" />
              Préparation : salle {ep.salle_preparation_intitule}
            </span>
          )}
          {ep.salle_intitule ? (
            <span
              className="inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold text-gray-900"
              style={{ borderColor: RED + "55", backgroundColor: RED + "0D" }}
            >
              <MapPin className="h-3 w-3" style={{ color: RED }} />
              Examen : salle {ep.salle_intitule}
            </span>
          ) : (
            <span className="text-xs italic text-gray-700">Salle communiquée ultérieurement</span>
          )}
        </div>
      </div>
      {/* Les trois tranches horaires */}
      <div className="grid grid-cols-3 gap-2 tabular-nums">
        {[
          ["Préparation", ep.heure_prepa ?? "—"],
          ["Début examen", ep.heure_debut],
          ["Fin examen", ep.heure_fin],
        ].map(([label, heure]) => (
          <div key={label} className="rounded-lg bg-gray-50 border border-gray-100 px-3 py-1.5">
            <p className="text-[11px] font-medium uppercase tracking-wide text-gray-700">{label}</p>
            <p className="text-sm font-semibold text-gray-900">{heure}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function Modale({ children }: { children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-[2px] flex items-center justify-center z-50 px-4">
      <div className="bg-white rounded-2xl shadow-xl p-7 max-w-sm w-full">{children}</div>
    </div>
  );
}

// ── Page ────────────────────────────────────────────────────────────────────────
export default function CandidatPlanningPage() {
  const router = useRouter();
  const [token, setToken] = useState("");
  const [inscription, setInscription] = useState<InscriptionActive | null>(null);
  const [triplets, setTriplets] = useState<TripletOut[]>([]);
  const [loading, setLoading] = useState(true);
  // Vrai après le premier chargement : les rechargements suivants (après une inscription…)
  // gardent la page affichée au lieu de la remplacer par le spinner plein écran.
  const [charge, setCharge] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState("");

  // Confirmation de désinscription
  const [confirmDesinscription, setConfirmDesinscription] = useState(false);
  // Confirmation de changement
  const [pendingTriplet, setPendingTriplet] = useState<{ date: string; heure_debut: string } | null>(null);
  // Filtre par date
  const [filterDate, setFilterDate] = useState("");
  // Triplet dont l'inscription est en cours — le spinner ne s'affiche que sur son bouton
  const [inscritKey, setInscritKey] = useState<string | null>(null);

  const loadData = useCallback(async (tok: string) => {
    setLoading(true);
    setError("");
    try {
      const [resInsc, resTriplets] = await Promise.all([
        fetch(`${API_BASE}/portal/me/inscription`, { headers: authHeaders(tok) }),
        fetch(`${API_BASE}/portal/me/triplets`, { headers: authHeaders(tok) }),
      ]);
      if (!resInsc.ok || !resTriplets.ok) {
        if (resInsc.status === 401 || resTriplets.status === 401) {
          sessionStorage.removeItem("candidat_token");
          router.replace("/candidat");
          return;
        }
        throw new Error("Erreur lors du chargement");
      }
      const insc = await resInsc.json();
      const trips = await resTriplets.json();
      setInscription(insc);
      setTriplets(trips);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
      setCharge(true);
    }
  }, [router]);

  useEffect(() => {
    const tok = sessionStorage.getItem("candidat_token");
    if (!tok) { router.replace("/candidat"); return; }
    setToken(tok);
    loadData(tok);
  }, [router, loadData]);

  // Après un rechargement (inscription, désinscription…), la date filtrée peut ne plus
  // avoir aucun triplet : elle disparaît alors des filtres, qui retombaient visuellement
  // sur « Toutes les dates » alors que le filtre restait actif (liste vide).
  // On réinitialise le filtre dans ce cas pour que l'affichage et la sélection concordent.
  useEffect(() => {
    if (filterDate && !triplets.some((t) => t.date === filterDate)) setFilterDate("");
  }, [triplets, filterDate]);

  const doInscrire = async (date: string, heure_debut: string) => {
    setActionLoading(true);
    setError("");
    try {
      const res = await fetch(`${API_BASE}/portal/me/inscriptions`, {
        method: "POST",
        headers: authHeaders(token),
        body: JSON.stringify({ date, heure_debut }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.detail ?? "Erreur lors de l'inscription");
      }
      await loadData(token);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setActionLoading(false);
      setPendingTriplet(null);
    }
  };

  const handleInscrireClick = (date: string, heure_debut: string) => {
    if (inscription) {
      setPendingTriplet({ date, heure_debut });
    } else {
      doInscrire(date, heure_debut);
    }
  };

  const handleDesinscription = async () => {
    if (!inscription) return;
    setActionLoading(true);
    setError("");
    setConfirmDesinscription(false);
    try {
      const res = await fetch(`${API_BASE}/portal/me/inscriptions/${inscription.id}`, {
        method: "DELETE",
        headers: authHeaders(token),
      });
      if (!res.ok && res.status !== 204) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.detail ?? "Erreur lors de la désinscription");
      }
      await loadData(token);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setActionLoading(false);
    }
  };

  if (loading && !charge) return <PageLoader />;

  const availableDates = Array.from(new Set(triplets.map((t) => t.date))).sort();
  // Une seule liste filtrée + triée (date puis heure de début), partagée par le compteur,
  // le message « aucun triplet » et l'affichage — les trois ne peuvent plus diverger.
  const tripletsAffiches = triplets
    .filter((t) => !filterDate || t.date === filterDate)
    .sort((a, b) => a.date.localeCompare(b.date) || a.heure_debut.localeCompare(b.heure_debut));
  // Regroupement par journée (la liste est déjà triée par date)
  const parJour: { date: string; triplets: TripletOut[] }[] = [];
  for (const t of tripletsAffiches) {
    const dernier = parJour[parJour.length - 1];
    if (dernier && dernier.date === t.date) dernier.triplets.push(t);
    else parJour.push({ date: t.date, triplets: [t] });
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-10">
      <PageHeader
        icon={<CalendarClock className="h-6 w-6" />}
        title="Mes créneaux d'oral"
        subtitle="Un triplet regroupe vos trois épreuves sur une même demi-journée."
      />

      {error && <Alert tone="error" className="mb-6">{error}</Alert>}

      {/* ── Inscription active ── */}
      {inscription ? (
        <div className="relative overflow-hidden rounded-2xl bg-white border border-black/5 shadow-sm mb-10">
          <div className="h-1" style={{ backgroundColor: RED }} />
          <div className="p-5 sm:p-6">
            <div className="flex flex-wrap items-start justify-between gap-4 mb-2">
              <div>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-green-50 border border-green-200 px-2.5 py-0.5 text-xs font-semibold text-green-800 mb-2">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Vous êtes inscrit
                </span>
                <p className="text-lg font-bold text-gray-900 capitalize">
                  {formatDate(inscription.date)}
                </p>
              </div>
              <button
                onClick={() => setConfirmDesinscription(true)}
                disabled={actionLoading}
                className="shrink-0 text-sm font-medium text-red-700 border border-red-200 rounded-lg px-3 py-1.5 hover:bg-red-50 transition disabled:opacity-50"
              >
                Je me désinscris
              </button>
            </div>
            <div className="divide-y divide-gray-100">
              {inscription.epreuves.map((ep) => (
                <EpreuveRow key={ep.id} ep={ep} />
              ))}
            </div>
          </div>
        </div>
      ) : (
        <Alert tone="warning" className="mb-10">
          Vous n&apos;êtes inscrit à aucun triplet de créneaux pour l&apos;instant. Choisissez-en
          un ci-dessous.
        </Alert>
      )}

      {/* ── Triplets disponibles ── */}
      <div className="flex items-baseline justify-between gap-3 mb-4">
        <h2 className="text-lg font-bold text-gray-900">
          {inscription ? "Changer de créneau" : "Triplets disponibles"}
        </h2>
        <span className="text-sm text-gray-700 tabular-nums">
          {tripletsAffiches.length} triplet{tripletsAffiches.length > 1 ? "s" : ""}
          {loading && <Loader2 className="inline h-3.5 w-3.5 ml-2 animate-spin" />}
        </span>
      </div>

      {/* Filtre par date, toujours visible dès qu'il y a des triplets. Liste déroulante
          plutôt qu'un <input type="date"> : seules les dates ayant réellement des triplets
          sont proposées, et « Toutes les dates » retire le filtre. */}
      {availableDates.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 mb-5 bg-white rounded-2xl border border-black/5 shadow-sm px-4 py-3">
          <label htmlFor="filtre-date" className="flex items-center gap-2 text-sm font-semibold text-gray-900">
            <CalendarDays className="h-4 w-4" style={{ color: RED }} />
            Filtrer par date
          </label>
          <select
            id="filtre-date"
            value={filterDate}
            onChange={(e) => setFilterDate(e.target.value)}
            className="flex-1 min-w-[200px] text-sm border border-gray-300 rounded-lg px-3 py-2 text-gray-900 bg-white focus:outline-none focus:ring-2 focus:border-transparent"
            style={{ "--tw-ring-color": RED } as React.CSSProperties}
          >
            <option value="">Toutes les dates ({triplets.length})</option>
            {availableDates.map((d) => (
              <option key={d} value={d}>
                {formatDate(d)} ({triplets.filter((t) => t.date === d).length})
              </option>
            ))}
          </select>
          {filterDate && (
            <button
              onClick={() => setFilterDate("")}
              className="text-sm font-medium hover:underline underline-offset-2"
              style={{ color: RED }}
            >
              Effacer
            </button>
          )}
        </div>
      )}

      {triplets.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-12 text-center">
          <CalendarDays className="h-8 w-8 mx-auto mb-3" style={{ color: RED }} />
          <p className="text-sm font-medium text-gray-900">Aucun triplet disponible pour l&apos;instant.</p>
        </div>
      ) : (
        <div className="space-y-8">
          {parJour.map(({ date, triplets: duJour }) => (
            <section key={date}>
              <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-900 uppercase tracking-wide mb-3">
                <CalendarDays className="h-4 w-4" style={{ color: RED }} />
                <span className="capitalize">{formatDate(date)}</span>
              </h3>
              <div className="space-y-4">
                {duJour.map((triplet) => {
                  const tripletKey = `${triplet.date}-${triplet.heure_debut}-${triplet.epreuves.map((e) => e.id).join(",")}`;
                  const firstHeure = triplet.epreuves.length > 0
                    ? (triplet.epreuves[0].heure_prepa ?? triplet.epreuves[0].heure_debut)
                    : triplet.heure_debut.slice(0, 5);
                  const lastHeure = triplet.epreuves.length > 0
                    ? triplet.epreuves[triplet.epreuves.length - 1].heure_fin
                    : triplet.heure_fin.slice(0, 5);
                  return (
                    <div
                      key={tripletKey}
                      className="rounded-2xl border border-black/5 bg-white shadow-sm overflow-hidden transition hover:shadow-md"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5 border-b border-gray-100">
                        <div className="flex items-center gap-2.5">
                          <div
                            className="h-8 w-8 rounded-lg flex items-center justify-center"
                            style={{ backgroundColor: RED + "14", color: RED }}
                          >
                            <Clock className="h-4 w-4" />
                          </div>
                          <span className="text-base font-bold text-gray-900 tabular-nums">
                            {firstHeure} – {lastHeure}
                          </span>
                        </div>
                        <button
                          onClick={() => { setInscritKey(tripletKey); handleInscrireClick(triplet.date, triplet.heure_debut); }}
                          disabled={actionLoading}
                          className="text-sm text-white px-4 py-1.5 rounded-lg font-semibold shadow-sm hover:opacity-90 transition disabled:opacity-50 flex items-center gap-1.5"
                          style={{ backgroundColor: RED }}
                        >
                          {actionLoading && pendingTriplet === null && inscritKey === tripletKey && (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          )}
                          Je m&apos;inscris
                        </button>
                      </div>
                      <div className="px-5 divide-y divide-gray-100">
                        {triplet.epreuves.map((ep) => (
                          <EpreuveRow key={ep.id} ep={ep} />
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}

      {/* ── Modale de confirmation changement ── */}
      {pendingTriplet && inscription && (
        <Modale>
          <div className="h-11 w-11 rounded-xl bg-amber-50 flex items-center justify-center mb-4">
            <AlertTriangle className="h-6 w-6 text-amber-600" />
          </div>
          <h2 className="text-base font-semibold text-gray-900 mb-2">
            Confirmer le changement d&apos;inscription
          </h2>
          <p className="text-sm text-gray-700 mb-6">
            En validant, votre inscription du{" "}
            <strong className="text-gray-900">{formatDate(inscription.date)}</strong> sera annulée et
            remplacée par celle du <strong className="text-gray-900">{formatDate(pendingTriplet.date)}</strong>.
          </p>
          <div className="flex gap-3">
            <button
              onClick={() => setPendingTriplet(null)}
              disabled={actionLoading}
              className="flex-1 py-2 rounded-lg border border-gray-300 text-sm font-medium text-gray-800 hover:bg-gray-50 transition"
            >
              Annuler
            </button>
            <button
              onClick={() => doInscrire(pendingTriplet.date, pendingTriplet.heure_debut)}
              disabled={actionLoading}
              className="flex-1 py-2 rounded-lg text-white text-sm font-semibold hover:opacity-90 transition flex items-center justify-center gap-2"
              style={{ backgroundColor: RED }}
            >
              {actionLoading && <Loader2 className="h-4 w-4 animate-spin" />}
              Confirmer
            </button>
          </div>
        </Modale>
      )}

      {/* ── Modale de confirmation désinscription ── */}
      {confirmDesinscription && inscription && (
        <Modale>
          <div className="h-11 w-11 rounded-xl bg-red-50 flex items-center justify-center mb-4">
            <AlertTriangle className="h-6 w-6 text-red-600" />
          </div>
          <h2 className="text-base font-semibold text-gray-900 mb-2">
            Confirmer l&apos;annulation
          </h2>
          <p className="text-sm text-gray-700 mb-6">
            Êtes-vous sûr de vouloir annuler votre inscription aux oraux du{" "}
            <strong className="text-gray-900">{formatDate(inscription.date)}</strong> ?
          </p>
          <div className="flex gap-3">
            <button
              onClick={() => setConfirmDesinscription(false)}
              disabled={actionLoading}
              className="flex-1 py-2 rounded-lg border border-gray-300 text-sm font-medium text-gray-800 hover:bg-gray-50 transition"
            >
              Non, garder
            </button>
            <button
              onClick={handleDesinscription}
              disabled={actionLoading}
              className="flex-1 py-2 rounded-lg bg-red-600 text-white text-sm font-semibold hover:bg-red-700 transition flex items-center justify-center gap-2"
            >
              {actionLoading && <Loader2 className="h-4 w-4 animate-spin" />}
              Oui, annuler
            </button>
          </div>
        </Modale>
      )}
    </div>
  );
}
