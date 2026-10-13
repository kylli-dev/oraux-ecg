"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Star, Lock } from "lucide-react";

const RED = "#C62828";
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

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-65px)]">
        <Loader2 className="h-6 w-6 animate-spin text-gray-700" />
      </div>
    );
  }

  // Pas de moyenne : chaque épreuve est notée séparément (3 notes distinctes sur 20).
  return (
    <div className="max-w-lg mx-auto px-4 py-8">
      <div className="flex items-center gap-3 mb-2">
        <Star className="h-6 w-6" style={{ color: RED }} />
        <h1 className="text-xl font-bold text-gray-900">Mes notes</h1>
      </div>
      <p className="text-sm text-gray-700 mb-6">
        Chaque épreuve est notée séparément, sur 20. Les notes affichées ont été publiées
        par le service des admissions.
      </p>

      {error && (
        <div className="mb-4 rounded-lg bg-red-50 border border-red-100 px-4 py-3 text-sm text-red-600">
          {error}
        </div>
      )}

      {notes.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-200 p-12 text-center">
          <Lock className="h-8 w-8 mx-auto mb-3 text-gray-700" />
          <p className="text-sm font-medium text-gray-700">Vos notes ne sont pas encore disponibles</p>
          <p className="text-xs text-gray-700 mt-1">
            Elles apparaîtront ici dès leur publication.
          </p>
        </div>
      ) : (
        <>
          {/* Liste des notes */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            {notes.map((note, i) => (
              <div
                key={note.matiere}
                className={`flex items-center justify-between px-5 py-4 ${
                  i > 0 ? "border-t border-gray-100" : ""
                }`}
              >
                <div>
                  <p className="text-base font-semibold text-gray-900">{note.matiere}</p>
                  {note.published_at && (
                    <p className="text-xs text-gray-700 mt-0.5">
                      Publiée le{" "}
                      {new Date(note.published_at).toLocaleDateString("fr-FR", {
                        day: "numeric", month: "long", year: "numeric",
                      })}
                    </p>
                  )}
                </div>
                <div className="flex items-center">
                  {/* Note neutre : ni barre de progression, ni couleur selon la valeur */}
                  <span className="text-lg font-bold text-gray-900 w-24 text-right tabular-nums">
                    {formatScore(note.valeur)}
                    <span className="text-xs font-normal text-gray-700">/20</span>
                  </span>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      <div className="mt-8 pt-6 border-t border-gray-100 text-center">
        <button
          onClick={() => router.push("/candidat/accueil")}
          className="text-xs text-gray-700 hover:text-black underline underline-offset-2"
        >
          ← Retour à l&apos;accueil
        </button>
      </div>
    </div>
  );
}
