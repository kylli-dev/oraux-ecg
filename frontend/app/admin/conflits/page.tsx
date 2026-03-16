"use client";

import { useState, useEffect, useCallback } from "react";
import { AlertTriangle, RefreshCw, Loader2, CheckCircle } from "lucide-react";

const RED = "#C62828";
const ADMIN_KEY = process.env.NEXT_PUBLIC_ADMIN_API_KEY ?? "change-me-123";
const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8002";

type Conflit = {
  epreuve_id: number;
  date: string;
  matiere: string;
  heure_debut: string;
  heure_fin: string;
  candidat_id: number;
  candidat_nom: string;
  candidat_prenom: string;
  examinateur_id: number;
  examinateur_nom: string;
  examinateur_prenom: string;
  code_uai: string;
};

function formatDate(d: string) {
  return new Date(d + "T12:00:00").toLocaleDateString("fr-FR", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  });
}

function adminHeaders() {
  return { "X-Admin-Api-Key": ADMIN_KEY };
}

export default function ConflitsPage() {
  const [conflits, setConflits] = useState<Conflit[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${API_BASE}/admin/conflits/`, {
        headers: adminHeaders(),
        cache: "no-store",
      });
      if (!res.ok) throw new Error("Erreur lors du chargement");
      setConflits(await res.json());
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Grouper par date
  const byDate = conflits.reduce<Record<string, Conflit[]>>((acc, c) => {
    (acc[c.date] ??= []).push(c);
    return acc;
  }, {});

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <AlertTriangle className="h-6 w-6 text-amber-500" />
          <div>
            <h1 className="text-xl font-bold text-gray-900">Conflits établissement</h1>
            <p className="text-sm text-gray-500">
              Épreuves où le candidat et l&apos;examinateur sont issus du même lycée (code UAI identique).
            </p>
          </div>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="flex items-center gap-2 text-sm text-gray-500 border border-gray-200 rounded-lg px-3 py-2 hover:bg-gray-50 transition disabled:opacity-50"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          Actualiser
        </button>
      </div>

      {error && (
        <div className="mb-5 rounded-lg bg-red-50 border border-red-100 px-4 py-3 text-sm text-red-600">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
        </div>
      ) : conflits.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-200 p-16 text-center">
          <CheckCircle className="h-10 w-10 mx-auto mb-3 text-green-400" />
          <p className="text-base font-medium text-gray-500">Aucun conflit détecté</p>
          <p className="text-sm text-gray-400 mt-1">
            Tous les candidats inscrits sont affectés à des examinateurs d&apos;un autre établissement.
          </p>
        </div>
      ) : (
        <>
          {/* Résumé */}
          <div
            className="rounded-xl px-5 py-4 mb-6 flex items-center gap-3"
            style={{ backgroundColor: "#fef3c7", borderLeft: "4px solid #d97706" }}
          >
            <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0" />
            <p className="text-sm text-amber-800">
              <strong>{conflits.length} conflit{conflits.length > 1 ? "s" : ""} détecté{conflits.length > 1 ? "s" : ""}</strong>
              {" "}— Ces épreuves nécessitent une intervention manuelle.
            </p>
          </div>

          {/* Liste groupée par date */}
          <div className="space-y-6">
            {Object.entries(byDate).sort(([a], [b]) => a.localeCompare(b)).map(([date, cs]) => (
              <div key={date}>
                <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3 capitalize">
                  {formatDate(date)}
                </h2>
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                  {cs.map((c, i) => (
                    <div
                      key={c.epreuve_id}
                      className={`px-5 py-4 ${i > 0 ? "border-t border-gray-100" : ""}`}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          {/* Matière + heure */}
                          <div className="flex items-center gap-2 mb-2">
                            <span className="text-sm font-semibold text-gray-900">{c.matiere}</span>
                            <span className="text-xs text-gray-400 font-mono">
                              {c.heure_debut} – {c.heure_fin}
                            </span>
                          </div>
                          {/* Candidat / Examinateur */}
                          <div className="grid grid-cols-2 gap-3">
                            <div className="rounded-lg bg-blue-50 px-3 py-2">
                              <p className="text-xs text-blue-500 font-medium mb-0.5">Candidat</p>
                              <p className="text-sm font-semibold text-blue-900">
                                {c.candidat_prenom} {c.candidat_nom}
                              </p>
                              <p className="text-xs text-blue-400">#{c.candidat_id}</p>
                            </div>
                            <div className="rounded-lg bg-purple-50 px-3 py-2">
                              <p className="text-xs text-purple-500 font-medium mb-0.5">Examinateur</p>
                              <p className="text-sm font-semibold text-purple-900">
                                {c.examinateur_prenom} {c.examinateur_nom}
                              </p>
                              <p className="text-xs text-purple-400">#{c.examinateur_id}</p>
                            </div>
                          </div>
                        </div>
                        {/* Badge UAI */}
                        <div className="shrink-0 text-center">
                          <div
                            className="rounded-lg px-3 py-2 text-center"
                            style={{ backgroundColor: RED + "12" }}
                          >
                            <p className="text-xs font-medium mb-0.5" style={{ color: RED }}>
                              Code UAI
                            </p>
                            <p className="text-sm font-bold font-mono" style={{ color: RED }}>
                              {c.code_uai}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
