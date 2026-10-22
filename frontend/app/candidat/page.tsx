"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Loader2, Eye, EyeOff, LogIn } from "lucide-react";
import { RED, AuthCard, Alert, inputClass, inputStyle, primaryButtonClass } from "./_ui";

const API_BASE = process.env.NEXT_PUBLIC_PORTAL_API_URL ?? "http://localhost:8000";

export default function CandidatLoginPage() {
  const router = useRouter();
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);

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
    <AuthCard
      icon={<LogIn className="h-6 w-6" />}
      title="Espace candidat"
      subtitle="Connectez-vous avec les identifiants reçus par email."
      footer={
        <Link
          href="/candidat/mot-de-passe-oublie"
          className="text-sm font-medium hover:underline underline-offset-2"
          style={{ color: RED }}
        >
          Mot de passe oublié ?
        </Link>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <label className="block text-xs font-semibold text-gray-800 uppercase tracking-wide">
            Login
          </label>
          <input
            type="text"
            value={login}
            onChange={(e) => setLogin(e.target.value)}
            placeholder="Votre identifiant"
            autoFocus
            autoComplete="username"
            className={inputClass}
            style={inputStyle}
          />
        </div>

        <div className="space-y-1.5">
          <label className="block text-xs font-semibold text-gray-800 uppercase tracking-wide">
            Mot de passe
          </label>
          <div className="relative">
            <input
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete="current-password"
              className={`${inputClass} pr-11`}
              style={inputStyle}
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              tabIndex={-1}
              title={showPassword ? "Masquer le mot de passe" : "Afficher le mot de passe"}
              className="absolute right-0 top-0 h-full px-3 flex items-center text-gray-700 hover:text-black transition"
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>

        {error && <Alert tone="error">{error}</Alert>}

        <button
          type="submit"
          disabled={loading || !login.trim() || !password}
          className={primaryButtonClass}
          style={{ backgroundColor: RED }}
        >
          {loading && <Loader2 className="h-4 w-4 animate-spin" />}
          {loading ? "Connexion…" : "Se connecter"}
        </button>
      </form>
    </AuthCard>
  );
}
