"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, CheckCircle } from "lucide-react";

const RED = "#C62828";
const API_BASE = process.env.NEXT_PUBLIC_PORTAL_API_URL ?? "http://localhost:8000";

export default function ChangerMotDePassePage() {
  const router = useRouter();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (next !== confirm) {
      setError("Les deux mots de passe ne correspondent pas.");
      return;
    }
    if (next.length < 8) {
      setError("Le mot de passe doit contenir au moins 8 caractères.");
      return;
    }
    const token = sessionStorage.getItem("candidat_token");
    if (!token) {
      router.replace("/candidat");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${API_BASE}/portal/me/change-password`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ current_password: current, new_password: next }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.detail ?? "Une erreur est survenue.");
        return;
      }
      setSuccess(true);
    } catch {
      setError("Impossible de contacter le serveur.");
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-65px)] px-4">
        <div className="w-full max-w-sm bg-white rounded-2xl shadow-md border border-gray-100 p-8 text-center">
          <CheckCircle className="h-10 w-10 mx-auto mb-4" style={{ color: "#16a34a" }} />
          <h1 className="text-lg font-semibold text-gray-900 mb-2">Mot de passe modifié</h1>
          <p className="text-sm text-gray-500 mb-6">
            Votre mot de passe a été mis à jour avec succès.
          </p>
          <button
            onClick={() => router.push("/candidat/accueil")}
            className="w-full py-2.5 rounded-lg text-white text-sm font-medium transition hover:opacity-90"
            style={{ backgroundColor: RED }}
          >
            Retour à l&apos;accueil
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center min-h-[calc(100vh-65px)] px-4">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-md border border-gray-100 p-8">
        <h1 className="text-xl font-semibold text-gray-900 mb-1">Changer mon mot de passe</h1>
        <p className="text-sm text-gray-500 mb-6">
          Choisissez un mot de passe d&apos;au moins 8 caractères.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          {[
            { label: "Mot de passe actuel", value: current, set: setCurrent, auto: "current-password" },
            { label: "Nouveau mot de passe", value: next, set: setNext, auto: "new-password" },
            { label: "Confirmer le nouveau mot de passe", value: confirm, set: setConfirm, auto: "new-password" },
          ].map(({ label, value, set, auto }) => (
            <div key={label} className="space-y-1">
              <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide">
                {label}
              </label>
              <input
                type="password"
                value={value}
                onChange={(e) => set(e.target.value)}
                autoComplete={auto}
                placeholder="••••••••"
                className="w-full px-4 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:border-transparent"
                style={{ "--tw-ring-color": RED } as React.CSSProperties}
              />
            </div>
          ))}

          {error && (
            <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading || !current || !next || !confirm}
            className="w-full py-2.5 rounded-lg text-white text-sm font-medium transition hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2"
            style={{ backgroundColor: RED }}
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            {loading ? "Enregistrement…" : "Modifier le mot de passe"}
          </button>
        </form>
      </div>
    </div>
  );
}
