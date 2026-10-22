"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Star, Lock } from "lucide-react";
import { RED, PageLoader, PageHeader, Alert } from "../_ui";

const API_BASE = process.env.NEXT_PUBLIC_PORTAL_API_URL ?? "http://localhost:8000";

type Note = {
  matiere: string;
  valeur: number | null;
  published_at: string | null;
};

function authHeaders(token: string) {
  return { Authorization: `Bearer ${token}` };
}

function formatScore(v: number | null) {
  if (v === null) return "—";
  return v.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function NotesPage() {
  const router = useRouter();
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadNotes = useCallback(async (tok: string) => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${API_BASE}/portal/me/notes`, {
        headers: authHeaders(tok),
      });
      if (res.status === 401) {
        sessionStorage.removeItem("candidat_token");
        router.replace("/candidat");
        return;
      }
      if (!res.ok) throw new Error("Erreur lors du chargement");
      setNotes(await res.json());
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    const tok = sessionStorage.getItem("candidat_token");
    if (!tok) { router.replace("/candidat"); return; }
    loadNotes(tok);
  }, [router, loadNotes]);

  if (loading) return <PageLoader />;

  // Pas de moyenne : chaque épreuve est notée séparément (3 notes distinctes sur 20).
  return (
    <div className="max-w-3xl mx-auto px-4 py-10">
      <PageHeader
        icon={<Star className="h-6 w-6" />}
        title="Mes notes"
        subtitle="Chaque épreuve est notée séparément, sur 20. Les notes affichées ont été publiées par le service des admissions."
      />

      {error && <Alert tone="error" className="mb-5">{error}</Alert>}

      {notes.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-12 text-center">
          <div
            className="h-12 w-12 rounded-2xl flex items-center justify-center mx-auto mb-4"
            style={{ backgroundColor: RED + "14", color: RED }}
          >
            <Lock className="h-6 w-6" />
          </div>
          <p className="text-sm font-semibold text-gray-900">Vos notes ne sont pas encore disponibles</p>
          <p className="text-sm text-gray-700 mt-1">
            Elles apparaîtront ici dès leur publication.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {notes.map((note) => (
            <div
              key={note.matiere}
              className="relative overflow-hidden rounded-2xl bg-white border border-black/5 shadow-sm p-5 flex flex-col"
            >
              <div className="absolute inset-x-0 top-0 h-1" style={{ backgroundColor: RED }} />
              <p className="text-sm font-semibold text-gray-900">{note.matiere}</p>
              {/* Note neutre : ni barre de progression, ni couleur selon la valeur */}
              <p className="mt-4 mb-1 text-4xl font-bold text-gray-900 tabular-nums">
                {formatScore(note.valeur)}
                <span className="text-base font-medium text-gray-700"> /20</span>
              </p>
              {note.published_at && (
                <p className="mt-auto pt-2 text-xs text-gray-700">
                  Publiée le{" "}
                  {new Date(note.published_at).toLocaleDateString("fr-FR", {
                    day: "numeric", month: "long", year: "numeric",
                  })}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
