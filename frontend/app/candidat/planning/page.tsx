"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Loader2, CalendarDays, CheckCircle2, Clock, AlertTriangle } from "lucide-react";

const RED = "#C62828";
const API_BASE = process.env.NEXT_PUBLIC_PORTAL_API_URL ?? "http://localhost:8000";

// ── Types ───────────────────────────────────────────────────────────────────────
type EpreuveOut = {
  id: number;
  matiere: string;
  heure_debut: string;
  heure_fin: string;
  demi_journee_type: string;
};

type TripletOut = {
  date: string;
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
    <div className="flex items-center gap-3 py-1.5">
      <span className="text-xs font-mono text-gray-400 w-24 shrink-0">
        {ep.heure_debut} – {ep.heure_fin}
      </span>
      <span className="text-sm text-gray-700">{ep.matiere}</span>
      <span className="ml-auto text-xs text-gray-400">
        {ep.demi_journee_type === "MATIN" ? "Matin" : "Après-midi"}
      </span>
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
  const [pendingDate, setPendingDate] = useState<string | null>(null);

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

  const doInscrire = async (date: string) => {
    setActionLoading(true);
    setError("");
    try {
      const res = await fetch(`${API_BASE}/portal/me/inscriptions`, {
        method: "POST",
        headers: authHeaders(token),
        body: JSON.stringify({ date }),
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
      setPendingDate(null);
    }
  };

  const handleInscrireClick = (date: string) => {
    if (inscription) {
      // Demander confirmation de changement
      setPendingDate(date);
    } else {
      doInscrire(date);
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
  if (pendingDate) {
    return (
      <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
        <div className="bg-white rounded-2xl shadow-xl p-7 max-w-sm w-full">
          <AlertTriangle className="h-8 w-8 mb-3" style={{ color: "#d97706" }} />
          <h2 className="text-base font-semibold text-gray-900 mb-2">
            Confirmer le changement d&apos;inscription
          </h2>
          <p className="text-sm text-gray-600 mb-5">
            En validant, votre inscription du{" "}
            <strong>{formatDate(inscription!.date)}</strong> sera annulée et remplacée
            par celle du <strong>{formatDate(pendingDate)}</strong>.
          </p>
          <div className="flex gap-3">
            <button
              onClick={() => setPendingDate(null)}
              disabled={actionLoading}
              className="flex-1 py-2 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition"
            >
              Annuler
            </button>
            <button
              onClick={() => doInscrire(pendingDate)}
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
          <p className="text-sm text-gray-600 mb-5">
            Êtes-vous sûr de vouloir annuler votre inscription aux oraux du{" "}
            <strong>{formatDate(inscription!.date)}</strong> ?
          </p>
          <div className="flex gap-3">
            <button
              onClick={() => setConfirmDesinscription(false)}
              disabled={actionLoading}
              className="flex-1 py-2 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition"
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
        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
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
      <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">
        Triplets disponibles
      </h2>

      {triplets.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-200 p-12 text-center">
          <CalendarDays className="h-7 w-7 mx-auto mb-3 text-gray-300" />
          <p className="text-sm text-gray-400">Aucun triplet disponible pour l&apos;instant.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {triplets.map((triplet) => {
            const isCurrentDate = inscription?.date === triplet.date;
            return (
              <div
                key={triplet.date}
                className={`rounded-xl border bg-white shadow-sm overflow-hidden ${
                  isCurrentDate ? "opacity-50 pointer-events-none" : ""
                }`}
              >
                <div className="flex items-center justify-between px-4 py-3 border-b bg-gray-50">
                  <div className="flex items-center gap-2">
                    <Clock className="h-3.5 w-3.5 text-gray-400" />
                    <span className="text-sm font-semibold text-gray-800 capitalize">
                      {formatDate(triplet.date)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    {isCurrentDate ? (
                      <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">
                        Inscrit
                      </span>
                    ) : (
                      <button
                        onClick={() => handleInscrireClick(triplet.date)}
                        disabled={actionLoading}
                        className="text-xs text-white px-3 py-1.5 rounded-lg font-medium hover:opacity-90 transition disabled:opacity-50 flex items-center gap-1.5"
                        style={{ backgroundColor: RED }}
                      >
                        {actionLoading && pendingDate === null && (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        )}
                        Je m&apos;inscris
                      </button>
                    )}
                  </div>
                </div>
                <div className="px-4 divide-y divide-gray-50">
                  {triplet.epreuves.map((ep) => (
                    <EpreuveRow key={ep.id} ep={ep} />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="mt-8 pt-6 border-t border-gray-100 text-center">
        <button
          onClick={() => router.push("/candidat/accueil")}
          className="text-xs text-gray-400 hover:text-gray-600 underline underline-offset-2"
        >
          ← Retour à l&apos;accueil
        </button>
      </div>
    </div>
  );
}
