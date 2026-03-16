"use client";

import { useState } from "react";
import Link from "next/link";
import { Loader2, CheckCircle } from "lucide-react";

const RED = "#C62828";
const API_BASE = process.env.NEXT_PUBLIC_PORTAL_API_URL ?? "http://localhost:8000";

export default function MotDePasseOublePage() {
  const [login, setLogin] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!login.trim()) return;
    setLoading(true);
    setError("");
    try {
      await fetch(`${API_BASE}/portal/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ login: login.trim() }),
      });
      // Toujours afficher le message de succès (pas d'énumération)
      setSent(true);
    } catch {
      setError("Impossible de contacter le serveur. Veuillez réessayer.");
    } finally {
      setLoading(false);
    }
  };

  if (sent) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-65px)] px-4">
        <div className="w-full max-w-sm bg-white rounded-2xl shadow-md border border-gray-100 p-8 text-center">
          <CheckCircle className="h-10 w-10 mx-auto mb-4" style={{ color: "#16a34a" }} />
          <h1 className="text-lg font-semibold text-gray-900 mb-2">Email envoyé</h1>
          <p className="text-sm text-gray-500 mb-6">
            Si votre login est reconnu, vous recevrez un email contenant un lien
            pour réinitialiser votre mot de passe.
          </p>
          <Link
            href="/candidat"
            className="block w-full py-2.5 rounded-lg text-white text-sm font-medium text-center transition hover:opacity-90"
            style={{ backgroundColor: RED }}
          >
            Retour à la connexion
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center min-h-[calc(100vh-65px)] px-4">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-md border border-gray-100 p-8">
        <h1 className="text-xl font-semibold text-gray-900 mb-1">Mot de passe oublié</h1>
        <p className="text-sm text-gray-500 mb-6">
          Entrez votre login. Vous recevrez un email avec un lien de réinitialisation.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide">
              Login
            </label>
            <input
              type="text"
              value={login}
              onChange={(e) => setLogin(e.target.value)}
              placeholder="Votre identifiant"
              autoFocus
              autoComplete="username"
              className="w-full px-4 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:border-transparent"
              style={{ "--tw-ring-color": RED } as React.CSSProperties}
            />
          </div>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading || !login.trim()}
            className="w-full py-2.5 rounded-lg text-white text-sm font-medium transition hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2"
            style={{ backgroundColor: RED }}
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            {loading ? "Envoi…" : "Envoyer le lien"}
          </button>
        </form>

        <div className="mt-5 text-center">
          <Link
            href="/candidat"
            className="text-xs text-gray-400 hover:text-gray-600 underline underline-offset-2"
          >
            Retour à la connexion
          </Link>
        </div>
      </div>
    </div>
  );
}
