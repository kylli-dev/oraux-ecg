"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Loader2, CheckCircle, ListChecks, AlertTriangle } from "lucide-react";

const RED = "#C62828";
const API_BASE = process.env.NEXT_PUBLIC_PORTAL_API_URL ?? "http://localhost:8000";

type JourneeDisponible = {
  date: string;
  nb_epreuves: number;
};

type ListeAttenteData = {
  dates_cochees: string[];
  journees_disponibles: JourneeDisponible[];
};

function formatDate(d: string) {
  return new Date(d + "T12:00:00").toLocaleDateString("fr-FR", {
    weekday: "long", day: "numeric", month: "long",
  });
}

function authHeaders(token: string) {
  return { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
}

export default function ListeAttentePage() {
  const router = useRouter();
  const [token, setToken] = useState("");
  const [data, setData] = useState<ListeAttenteData | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [dejaInscrit, setDejaInscrit] = useState(false);

  const loadData = useCallback(async (tok: string) => {
    setLoading(true);
    setError("");
    try {
      // Vérifier si déjà inscrit
      const resInsc = await fetch(`${API_BASE}/portal/me/inscription`, {
        headers: authHeaders(tok),
      });
      if (resInsc.status === 401) {
        sessionStorage.removeItem("candidat_token");
        router.replace("/candidat");
        return;
      }
      const insc = await resInsc.json();
      if (insc !== null) {
        setDejaInscrit(true);
        setLoading(false);
        return;
      }

      const res = await fetch(`${API_BASE}/portal/me/liste-attente`, {
        headers: authHeaders(tok),
      });
      if (!res.ok) throw new Error("Erreur lors du chargement");
      const d: ListeAttenteData = await res.json();
      setData(d);
      setSelected(new Set(d.dates_cochees));
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

  const toggle = (date: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(date)) next.delete(date);
      else next.add(date);
      return next;
    });
    setSuccess(false);
  };

  const handleSave = async () => {
    setSaving(true);
    setError("");
    setSuccess(false);
    try {
      const res = await fetch(`${API_BASE}/portal/me/liste-attente`, {
        method: "PUT",
        headers: authHeaders(token),
        body: JSON.stringify({ dates: Array.from(selected) }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.detail ?? "Erreur lors de l'enregistrement");
      }
      setSuccess(true);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  // ── Cas : déjà inscrit ───────────────────────────────────────────────────────
  if (dejaInscrit) {
    return (
      <div className="max-w-lg mx-auto px-4 py-10">
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-center">
          <AlertTriangle className="h-8 w-8 mx-auto mb-3 text-amber-500" />
          <h1 className="text-base font-semibold text-gray-900 mb-2">
            Vous êtes déjà inscrit aux oraux
          </h1>
          <p className="text-sm text-gray-600 mb-5">
            La liste d&apos;attente est réservée aux candidats non encore inscrits à un
            triplet de créneaux.
          </p>
          <button
            onClick={() => router.push("/candidat/planning")}
            className="text-sm font-medium text-white px-4 py-2 rounded-lg hover:opacity-90 transition"
            style={{ backgroundColor: RED }}
          >
            Voir mon inscription
          </button>
        </div>
        <div className="mt-6 text-center">
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

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-65px)]">
        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto px-4 py-8">
      <div className="flex items-center gap-3 mb-2">
        <ListChecks className="h-6 w-6" style={{ color: RED }} />
        <h1 className="text-xl font-bold text-gray-900">Liste d&apos;attente</h1>
      </div>
      <p className="text-sm text-gray-500 mb-6">
        Cochez les journées où vous êtes disponible. Vous serez contacté si une
        place se libère.
      </p>

      {error && (
        <div className="mb-4 rounded-lg bg-red-50 border border-red-100 px-4 py-3 text-sm text-red-600">
          {error}
        </div>
      )}

      {success && (
        <div className="mb-4 rounded-lg bg-green-50 border border-green-100 px-4 py-3 text-sm text-green-700 flex items-center gap-2">
          <CheckCircle className="h-4 w-4" />
          Vos disponibilités ont été enregistrées.
        </div>
      )}

      {!data || data.journees_disponibles.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-200 p-12 text-center">
          <p className="text-sm text-gray-400">Aucune journée disponible pour l&apos;instant.</p>
        </div>
      ) : (
        <>
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden mb-5">
            {data.journees_disponibles.map((j, i) => {
              const checked = selected.has(j.date);
              return (
                <label
                  key={j.date}
                  className={`flex items-center gap-4 px-5 py-4 cursor-pointer transition hover:bg-gray-50 ${
                    i > 0 ? "border-t border-gray-100" : ""
                  } ${checked ? "bg-red-50/40" : ""}`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggle(j.date)}
                    className="h-4 w-4 rounded accent-red-700"
                  />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-800 capitalize">
                      {formatDate(j.date)}
                    </p>
                    <p className="text-xs text-gray-400">
                      {j.nb_epreuves} créneau{j.nb_epreuves > 1 ? "x" : ""} disponible{j.nb_epreuves > 1 ? "s" : ""}
                    </p>
                  </div>
                  {checked && (
                    <CheckCircle className="h-4 w-4 shrink-0" style={{ color: RED }} />
                  )}
                </label>
              );
            })}
          </div>

          <div className="flex items-center justify-between gap-4">
            <p className="text-xs text-gray-400">
              {selected.size} journée{selected.size !== 1 ? "s" : ""} sélectionnée{selected.size !== 1 ? "s" : ""}
            </p>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-5 py-2.5 rounded-lg text-white text-sm font-medium hover:opacity-90 transition disabled:opacity-50 flex items-center gap-2"
              style={{ backgroundColor: RED }}
            >
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              {saving ? "Enregistrement…" : "Enregistrer mes disponibilités"}
            </button>
          </div>
        </>
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
