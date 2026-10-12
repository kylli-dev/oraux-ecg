"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2, KeyRound, Eye, EyeOff } from "lucide-react";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8002";

// Deux façons de se connecter : email + mot de passe (comme l'espace candidat), ou code
// d'accès personnel (historique, toujours valable).
type Mode = "motdepasse" | "code";

export default function ExaminateurLoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("motdepasse");
  const [code, setCode] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (sessionStorage.getItem("examinateur_token")) {
      router.replace("/examinateur/accueil");
    }
  }, [router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const body = mode === "code"
        ? { code_acces: code.trim().toUpperCase() }
        : { email: email.trim(), password };
      const res = await fetch(`${API}/examinateur/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail ?? (mode === "code" ? "Code d'accès invalide" : "Email ou mot de passe incorrect"));
      }
      const { access_token } = await res.json();
      sessionStorage.setItem("examinateur_token", access_token);
      router.push("/examinateur/accueil");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  const peutValider = mode === "code" ? !!code.trim() : !!email.trim() && !!password;

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F5F5F5] px-4">
      <div className="w-full max-w-sm">
        {/* Logo / titre */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-[#C62828] mb-4 shadow-lg">
            <KeyRound className="h-7 w-7 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Espace examinateur</h1>
          <p className="text-sm text-gray-700 mt-1">Connectez-vous pour accéder à votre planning</p>
        </div>

        {/* Choix du mode de connexion */}
        <div className="grid grid-cols-2 gap-1 p-1 mb-3 bg-white rounded-xl border border-gray-200">
          {([
            ["motdepasse", "Email et mot de passe"],
            ["code", "Code d'accès"],
          ] as const).map(([m, label]) => (
            <button
              key={m}
              type="button"
              onClick={() => { setMode(m); setError(""); }}
              className={`py-2 text-sm rounded-lg font-medium transition ${
                mode === m ? "bg-[#C62828] text-white" : "text-gray-800 hover:bg-gray-50"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-4">
          {mode === "code" ? (
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-1.5">Code d&apos;accès</label>
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="ex : A1B2C3D4"
                autoFocus
                className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-900 font-mono tracking-widest focus:outline-none focus:ring-2 focus:ring-[#C62828] focus:border-transparent"
              />
            </div>
          ) : (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-900 mb-1.5">Adresse email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="prenom.nom@exemple.fr"
                  autoComplete="username"
                  autoFocus
                  className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#C62828] focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-900 mb-1.5">Mot de passe</label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    autoComplete="current-password"
                    className="w-full pl-3.5 pr-11 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#C62828] focus:border-transparent"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? "Masquer le mot de passe" : "Afficher le mot de passe"}
                    title={showPassword ? "Masquer le mot de passe" : "Afficher le mot de passe"}
                    className="absolute inset-y-0 right-0 px-3 flex items-center text-gray-700 hover:text-black transition"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
            </>
          )}

          {error && (
            <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading || !peutValider}
            className="w-full py-2.5 px-4 bg-[#C62828] text-white text-sm font-semibold rounded-xl hover:bg-[#B71C1C] transition disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            Accéder à mon espace
          </button>
        </form>

        <div className="text-center mt-4 space-y-2">
          {mode === "motdepasse" ? (
            <>
              <a href="/examinateur/mot-de-passe-oublie" className="block text-sm text-[#C62828] hover:text-[#B71C1C] hover:underline transition">
                Mot de passe oublié ?
              </a>
              <p className="text-xs text-gray-700">
                Première connexion ? Utilisez « Mot de passe oublié ? » pour créer votre mot de passe,
                ou connectez-vous avec votre code d&apos;accès.
              </p>
            </>
          ) : (
            <>
              <p className="text-xs text-gray-700">
                Votre code d&apos;accès vous a été communiqué par le service des admissions.
              </p>
              <a href="/examinateur/code-perdu" className="block text-sm text-[#C62828] hover:text-[#B71C1C] hover:underline transition">
                Code d&apos;accès perdu ?
              </a>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
