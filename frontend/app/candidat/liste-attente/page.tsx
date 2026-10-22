"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Check, ListChecks, AlertTriangle, CalendarDays } from "lucide-react";
import { RED, PageLoader, PageHeader, Alert, PAGE_MIN_H } from "../_ui";

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
      <div className={`flex items-center justify-center ${PAGE_MIN_H} px-4 py-10`}>
        <div className="w-full max-w-md bg-white rounded-2xl border border-black/5 shadow-sm p-8 text-center">
          <div className="h-12 w-12 rounded-2xl bg-amber-50 flex items-center justify-center mx-auto mb-4">
            <AlertTriangle className="h-6 w-6 text-amber-600" />
          </div>
          <h1 className="text-lg font-semibold text-gray-900 mb-2">
            Vous êtes déjà inscrit aux oraux
          </h1>
          <p className="text-sm text-gray-700 mb-6">
            La liste d&apos;attente est réservée aux candidats non encore inscrits à un
            triplet de créneaux.
          </p>
          <button
            onClick={() => router.push("/candidat/planning")}
            className="text-sm font-semibold text-white px-5 py-2.5 rounded-lg shadow-sm hover:opacity-90 transition"
            style={{ backgroundColor: RED }}
          >
            Voir mon inscription
          </button>
        </div>
      </div>
    );
  }

  if (loading) return <PageLoader />;

  const journees = data?.journees_disponibles ?? [];
  const toutCoche = journees.length > 0 && journees.every((j) => selected.has(j.date));

  return (
    <div className="max-w-2xl mx-auto px-4 py-10">
      <PageHeader
        icon={<ListChecks className="h-6 w-6" />}
        title="Liste d'attente"
        subtitle="Cochez les journées où vous êtes disponible. Vous serez contacté si une place se libère."
      />

      {error && <Alert tone="error" className="mb-5">{error}</Alert>}

      {success && (
        <Alert tone="success" className="mb-5">Vos disponibilités ont été enregistrées.</Alert>
      )}

      {journees.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-12 text-center">
          <CalendarDays className="h-8 w-8 mx-auto mb-3" style={{ color: RED }} />
          <p className="text-sm font-medium text-gray-900">Aucune journée disponible pour l&apos;instant.</p>
        </div>
      ) : (
        <>
          <div className="flex justify-end mb-3">
            <button
              onClick={() => {
                setSelected(toutCoche ? new Set() : new Set(journees.map((j) => j.date)));
                setSuccess(false);
              }}
              className="text-sm font-medium hover:underline underline-offset-2"
              style={{ color: RED }}
            >
              {toutCoche ? "Tout désélectionner" : "Tout sélectionner"}
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
            {journees.map((j) => {
              const checked = selected.has(j.date);
              return (
                <button
                  key={j.date}
                  type="button"
                  role="checkbox"
                  aria-checked={checked}
                  onClick={() => toggle(j.date)}
                  className={`flex items-center gap-3.5 rounded-2xl border-2 px-4 py-3.5 text-left transition focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 ${
                    checked ? "shadow-sm" : "bg-white border-gray-200 hover:border-gray-300"
                  }`}
                  style={{
                    "--tw-ring-color": RED,
                    ...(checked ? { borderColor: RED, backgroundColor: RED + "0A" } : {}),
                  } as React.CSSProperties}
                >
                  <span
                    className={`h-5 w-5 rounded-md border-2 flex items-center justify-center shrink-0 transition ${
                      checked ? "" : "border-gray-400 bg-white"
                    }`}
                    style={checked ? { borderColor: RED, backgroundColor: RED } : undefined}
                  >
                    {checked && <Check className="h-3.5 w-3.5 text-white" strokeWidth={3} />}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold text-gray-900 capitalize">
                      {formatDate(j.date)}
                    </span>
                    <span className="block text-xs text-gray-700">
                      {j.nb_epreuves} créneau{j.nb_epreuves > 1 ? "x" : ""} disponible{j.nb_epreuves > 1 ? "s" : ""}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>

          {/* Barre d'enregistrement, toujours visible en bas de l'écran */}
          <div className="sticky bottom-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-white border border-black/5 shadow-lg px-5 py-3">
            <p className="text-sm text-gray-900">
              <span className="font-bold tabular-nums">{selected.size}</span> journée{selected.size !== 1 ? "s" : ""} sélectionnée{selected.size !== 1 ? "s" : ""}
            </p>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-5 py-2.5 rounded-lg text-white text-sm font-semibold shadow-sm hover:opacity-90 transition disabled:opacity-50 flex items-center gap-2"
              style={{ backgroundColor: RED }}
            >
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              {saving ? "Enregistrement…" : "Enregistrer mes disponibilités"}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
