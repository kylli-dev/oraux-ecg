"use client";

import { useState, useEffect, useCallback } from "react";
import { RefreshCw, CheckCircle2, AlertTriangle } from "lucide-react";
import {
  Btn,
  ErrorMsg,
  RED,
  Spinner,
  formatDate,
  get,
  hm,
} from "./commun";

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

// ── ConflitsSection ────────────────────────────────────────────────────────────
export function ConflitsSection() {
  const [conflits, setConflits] = useState<Conflit[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setErr("");
    try {
      const data = await get<Conflit[]>("conflits/");
      setConflits(data);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const byDate = conflits.reduce<Record<string, Conflit[]>>((acc, c) => {
    (acc[c.date] ??= []).push(c);
    return acc;
  }, {});

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            Conflits établissement
          </h1>
          <p className="text-sm text-gray-700 mt-1">
            Épreuves où candidat et examinateur sont issus du même lycée (code UAI identique).
          </p>
        </div>
        <Btn label="Actualiser" icon={RefreshCw} variant="ghost" onClick={load} disabled={loading} />
      </div>

      <ErrorMsg msg={err} />

      {loading ? (
        <div className="flex justify-center py-16"><Spinner /></div>
      ) : conflits.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-gray-200 p-16 text-center">
          <CheckCircle2 className="h-10 w-10 mx-auto mb-3 text-green-400" />
          <p className="text-base font-medium text-gray-700">Aucun conflit détecté</p>
          <p className="text-sm text-gray-700 mt-1">
            Tous les candidats inscrits passent avec un examinateur d&apos;un autre établissement.
          </p>
        </div>
      ) : (
        <>
          <div className="rounded-xl px-4 py-3 mb-6 flex items-center gap-3 bg-amber-50 border-l-4 border-amber-400">
            <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
            <p className="text-sm text-amber-800">
              <strong>{conflits.length} conflit{conflits.length > 1 ? "s" : ""} détecté{conflits.length > 1 ? "s" : ""}</strong>
              {" "}— Ces épreuves nécessitent une intervention manuelle.
            </p>
          </div>

          <div className="space-y-6">
            {Object.entries(byDate).sort(([a], [b]) => a.localeCompare(b)).map(([date, cs]) => (
              <div key={date}>
                <h2 className="text-xs font-semibold text-gray-700 uppercase tracking-wide mb-2 capitalize">
                  {formatDate(date)}
                </h2>
                <div className="bg-white rounded-2xl border border-black/5 shadow-sm overflow-hidden">
                  {cs.map((c, i) => (
                    <div key={c.epreuve_id} className={`px-5 py-4 ${i > 0 ? "border-t border-gray-100" : ""}`}>
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <span className="text-sm font-semibold text-gray-900">{c.matiere}</span>
                            <span className="text-xs text-gray-700 font-mono">{hm(c.heure_debut)} – {hm(c.heure_fin)}</span>
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <div className="rounded-lg bg-blue-50 px-3 py-2">
                              <p className="text-[10px] text-blue-400 font-medium uppercase tracking-wide mb-0.5">Candidat</p>
                              <p className="text-sm font-semibold text-blue-900">{c.candidat_prenom} {c.candidat_nom}</p>
                              <p className="text-xs text-blue-300">#{c.candidat_id}</p>
                            </div>
                            <div className="rounded-lg bg-purple-50 px-3 py-2">
                              <p className="text-[10px] text-purple-400 font-medium uppercase tracking-wide mb-0.5">Examinateur</p>
                              <p className="text-sm font-semibold text-purple-900">{c.examinateur_prenom} {c.examinateur_nom}</p>
                              <p className="text-xs text-purple-300">#{c.examinateur_id}</p>
                            </div>
                          </div>
                        </div>
                        <div className="shrink-0 rounded-lg px-3 py-2 text-center" style={{ backgroundColor: RED + "12" }}>
                          <p className="text-[10px] font-medium mb-0.5" style={{ color: RED }}>UAI</p>
                          <p className="text-sm font-bold font-mono" style={{ color: RED }}>{c.code_uai}</p>
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
