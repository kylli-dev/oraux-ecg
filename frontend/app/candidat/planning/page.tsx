"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Loader2, CalendarDays, CheckCircle2, Clock, AlertTriangle, MapPin } from "lucide-react";

const RED = "#C62828";
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
    <div className="py-3 space-y-1">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <span className="text-sm font-semibold text-gray-900">{ep.matiere}</span>
        <div className="ml-auto flex flex-wrap items-center gap-1.5">
        {ep.salle_preparation_intitule && (
          <span className="inline-flex items-center gap-1 rounded-md border border-gray-300 bg-gray-50 px-2 py-0.5 text-xs font-medium text-gray-900">
            <MapPin className="h-3 w-3" />
            Préparation : salle {ep.salle_preparation_intitule}
          </span>
        )}
        {ep.salle_intitule ? (
          <span
            className="inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-semibold text-gray-900"
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
      {/* Les trois tranches horaires, sur une simple ligne de texte */}
      <p className="text-sm text-gray-700 tabular-nums">
        Préparation{" "}
        <span className="font-semibold text-gray-900">{ep.heure_prepa ?? "—"}</span>
        <span className="mx-2">·</span>
        Début examen <span className="font-semibold text-gray-900">{ep.heure_debut}</span>
        <span className="mx-2">·</span>
        Fin examen <span className="font-semibold text-gray-900">{ep.heure_fin}</span>
      </p>
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
    }
  }, [router]);

  useEffect(() => {
    const tok = sessionStorage.getItem("candidat_token");
    if (!tok) { router.replace("/candidat"); return; }
    setToken(tok);
    loadData(tok);
  }, [router, loadData]);

  // Après un rechargement (inscription, désinscription…), la date filtrée peut ne plus
  // avoir aucun triplet : elle disparaît alors de la liste déroulante, qui retombait
  // visuellement sur « Toutes les dates » alors que le filtre restait actif (liste vide).
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

  // ── Modale de confirmation changement ────────────────────────────────────────
  if (pendingTriplet) {
    return (
      <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
        <div className="bg-white rounded-2xl shadow-xl p-7 max-w-sm w-full">
          <AlertTriangle className="h-8 w-8 mb-3" style={{ color: "#d97706" }} />
          <h2 className="text-base font-semibold text-gray-900 mb-2">
            Confirmer le changement d&apos;inscription
          </h2>
          <p className="text-sm text-gray-700 mb-5">
            En validant, votre inscription du{" "}
            <strong>{formatDate(inscription!.date)}</strong> sera annulée et remplacée
            par celle du <strong>{formatDate(pendingTriplet.date)}</strong>.
          </p>
          <div className="flex gap-3">
            <button
              onClick={() => setPendingTriplet(null)}
              disabled={actionLoading}
              className="flex-1 py-2 rounded-lg border border-gray-200 text-sm text-gray-700 hover:bg-gray-50 transition"
            >
              Annuler
            </button>
            <button
              onClick={() => doInscrire(pendingTriplet.date, pendingTriplet.heure_debut)}
              disabled={actionLoading}
              className="flex-1 py-2 rounded-lg text-white text-sm font-medium hover:opacity-90 transition flex items-center justify-center gap-2"
              style={{ backgroundColor: RED }}
            >
              {actionLoading && <Loader2 className="h-4 w-4 animate-spin" />}
              Confirmer
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Modale de confirmation désinscription ────────────────────────────────────
  if (confirmDesinscription) {
    return (
      <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
        <div className="bg-white rounded-2xl shadow-xl p-7 max-w-sm w-full">
          <AlertTriangle className="h-8 w-8 mb-3 text-red-500" />
          <h2 className="text-base font-semibold text-gray-900 mb-2">
            Confirmer l&apos;annulation
          </h2>
          <p className="text-sm text-gray-700 mb-5">
            Êtes-vous sûr de vouloir annuler votre inscription aux oraux du{" "}
            <strong>{formatDate(inscription!.date)}</strong> ?
          </p>
          <div className="flex gap-3">
            <button
              onClick={() => setConfirmDesinscription(false)}
              disabled={actionLoading}
              className="flex-1 py-2 rounded-lg border border-gray-200 text-sm text-gray-700 hover:bg-gray-50 transition"
            >
              Non, garder
            </button>
            <button
              onClick={handleDesinscription}
              disabled={actionLoading}
              className="flex-1 py-2 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700 transition flex items-center justify-center gap-2"
            >
              {actionLoading && <Loader2 className="h-4 w-4 animate-spin" />}
              Oui, annuler
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-65px)]">
        <Loader2 className="h-6 w-6 animate-spin text-gray-700" />
      </div>
    );
  }

  const availableDates = Array.from(new Set(triplets.map((t) => t.date))).sort();
  // Une seule liste filtrée + triée (date puis heure de début), partagée par le compteur,
  // le message « aucun triplet » et l'affichage — les trois ne peuvent plus diverger.
  const tripletsAffiches = triplets
    .filter((t) => !filterDate || t.date === filterDate)
    .sort((a, b) => a.date.localeCompare(b.date) || a.heure_debut.localeCompare(b.heure_debut));

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <button
        onClick={() => router.push("/candidat/accueil")}
        className="flex items-center gap-1 text-sm text-gray-700 hover:text-black mb-6 transition"
      >
        ← Retour à l&apos;accueil
      </button>
      <h1 className="text-xl font-bold text-gray-900 mb-6">Mes créneaux d&apos;oral</h1>

      {error && (
        <div className="mb-5 rounded-lg bg-red-50 border border-red-100 px-4 py-3 text-sm text-red-600">
          {error}
        </div>
      )}

      {/* ── Inscription active ── */}
      {inscription ? (
        <div
          className="rounded-2xl border-2 p-5 mb-8"
          style={{ borderColor: RED + "44", backgroundColor: RED + "06" }}
        >
          <div className="flex items-start justify-between gap-4 mb-3">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <CheckCircle2 className="h-5 w-5" style={{ color: "#16a34a" }} />
                <span className="text-sm font-semibold text-gray-900">
                  Vous êtes inscrit
                </span>
              </div>
              <p className="text-base font-bold text-gray-900 capitalize">
                {formatDate(inscription.date)}
              </p>
            </div>
            <button
              onClick={() => setConfirmDesinscription(true)}
              disabled={actionLoading}
              className="shrink-0 text-xs text-red-600 border border-red-200 rounded-lg px-3 py-1.5 hover:bg-red-50 transition disabled:opacity-50"
            >
              Je me désinscris
            </button>
          </div>
          <div className="divide-y divide-gray-100 rounded-xl bg-white border border-gray-100 overflow-hidden">
            {inscription.epreuves.map((ep) => (
              <div key={ep.id} className="px-4">
                <EpreuveRow ep={ep} />
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-800 mb-8">
          Vous n&apos;êtes inscrit à aucun triplet de créneaux pour l&apos;instant.
        </div>
      )}

      {/* ── Triplets disponibles ── */}
      <div className="flex flex-wrap items-end justify-between gap-3 mb-4">
        <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">
          Triplets disponibles
        </h2>
        {/* Liste déroulante plutôt qu'un <input type="date"> : seules les dates ayant
            réellement des triplets sont proposées, et "Toutes les dates" retire le filtre. */}
        {availableDates.length > 0 && (
          <div className="flex items-center gap-2">
            <label htmlFor="filtre-date" className="text-sm font-medium text-gray-900">Date :</label>
            <select
              id="filtre-date"
              value={filterDate}
              onChange={(e) => setFilterDate(e.target.value)}
              className="text-sm border border-gray-300 rounded-lg px-3 py-1.5 text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-red-100 focus:border-red-300"
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
                className="text-sm font-medium hover:underline"
                style={{ color: RED }}
              >
                Effacer
              </button>
            )}
          </div>
        )}
      </div>

      {/* Compteur explicite : rend le résultat du filtre vérifiable. Calculé sur la même
          liste que l'affichage (tripletsAffiches). */}
      {filterDate && (
        <p className="text-sm text-gray-900 -mt-2 mb-3">
          {tripletsAffiches.length} triplet{tripletsAffiches.length > 1 ? "s" : ""} pour le{" "}
          <span className="font-semibold">{formatDate(filterDate)}</span>
        </p>
      )}

      {triplets.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-300 p-12 text-center">
          <CalendarDays className="h-7 w-7 mx-auto mb-3 text-gray-700" />
          <p className="text-sm text-gray-900">Aucun triplet disponible pour l&apos;instant.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {tripletsAffiches.length === 0 && (
            <div className="rounded-xl border border-dashed border-gray-300 p-8 text-center">
              <CalendarDays className="h-7 w-7 mx-auto mb-3 text-gray-700" />
              <p className="text-sm text-gray-900">Aucun triplet pour cette date.</p>
            </div>
          )}
          {tripletsAffiches.map((triplet) => {
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
                className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden"
              >
                <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 border-b border-gray-200 bg-gray-50">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                    <Clock className="h-4 w-4 text-gray-900" />
                    <span className="text-sm font-semibold text-gray-900 capitalize">
                      {formatDate(triplet.date)}
                    </span>
                    <span className="text-sm font-medium text-gray-900 tabular-nums">
                      {firstHeure} – {lastHeure}
                    </span>
                  </div>
                  <button
                    onClick={() => { setInscritKey(tripletKey); handleInscrireClick(triplet.date, triplet.heure_debut); }}
                    disabled={actionLoading}
                    className="text-xs text-white px-3 py-1.5 rounded-lg font-medium hover:opacity-90 transition disabled:opacity-50 flex items-center gap-1.5"
                    style={{ backgroundColor: RED }}
                  >
                    {actionLoading && pendingTriplet === null && inscritKey === tripletKey && (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    )}
                    Je m&apos;inscris
                  </button>
                </div>
                <div className="px-4 divide-y divide-gray-100">
                  {triplet.epreuves.map((ep) => (
                    <EpreuveRow key={ep.id} ep={ep} />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

    </div>
  );
}
