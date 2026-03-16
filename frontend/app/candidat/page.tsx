"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Loader2 } from "lucide-react";

const RED = "#C62828";
const API_BASE = process.env.NEXT_PUBLIC_PORTAL_API_URL ?? "http://localhost:8000";

export default function CandidatLoginPage() {
  const router = useRouter();
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!login.trim() || !password) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${API_BASE}/portal/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ login: login.trim(), password }),
      });
      if (!res.ok) {
        setError("Identifiants incorrects. Vérifiez votre login et mot de passe.");
        return;
      }
      const data = await res.json();
      sessionStorage.setItem("candidat_token", data.access_token);
      router.push("/candidat/accueil");
    } catch {
      setError("Impossible de contacter le serveur. Veuillez réessayer.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-[calc(100vh-65px)] px-4">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-md border border-gray-100 p-8">
        <div className="mb-6 text-center">
          <div
            className="inline-flex items-center justify-center h-12 w-12 rounded-full mb-3"
            style={{ backgroundColor: RED + "18" }}
          >
            <div className="h-6 w-6 rounded-full border-2" style={{ borderColor: RED }} />
          </div>
          <h1 className="text-xl font-semibold text-gray-900">Espace Candidat</h1>
          <p className="text-sm text-gray-500 mt-1">
            Connectez-vous avec les identifiants reçus par email.
          </p>
        </div>

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

          <div className="space-y-1">
            <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide">
              Mot de passe
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete="current-password"
              className="w-full px-4 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:border-transparent"
              style={{ "--tw-ring-color": RED } as React.CSSProperties}
            />
          </div>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading || !login.trim() || !password}
            className="w-full py-2.5 rounded-lg text-white text-sm font-medium transition hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2"
            style={{ backgroundColor: RED }}
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            {loading ? "Connexion…" : "Se connecter"}
          </button>
        </form>

        <div className="mt-5 text-center">
          <Link
            href="/candidat/mot-de-passe-oublie"
            className="text-xs text-gray-400 hover:text-gray-600 underline underline-offset-2"
          >
            Mot de passe oublié ?
          </Link>
        </div>
      </div>
    </div>
  );
}
