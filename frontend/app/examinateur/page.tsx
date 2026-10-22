"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Loader2, KeyRound, Eye, EyeOff } from "lucide-react";
import { RED, AuthCard, Alert, inputClass, inputStyle, primaryButtonClass } from "./_ui";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8002";

// Connexion par email + mot de passe, comme l'espace candidat (plus de code d'accès).
export default function ExaminateurLoginPage() {
  const router = useRouter();
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
      const res = await fetch(`${API}/examinateur/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail ?? "Email ou mot de passe incorrect");
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

  return (
    <AuthCard
      icon={<KeyRound className="h-6 w-6" />}
      title="Espace examinateur"
      subtitle="Connectez-vous avec votre adresse email et votre mot de passe."
      footer={
        <div className="space-y-2">
          <Link
            href="/examinateur/mot-de-passe-oublie"
            className="block text-sm font-medium hover:underline underline-offset-2"
            style={{ color: RED }}
          >
            Mot de passe oublié ?
          </Link>
          <p className="text-xs text-gray-700">
            Première connexion ? Cliquez sur « Mot de passe oublié ? » pour recevoir par email
            le lien de création de votre mot de passe.
          </p>
        </div>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <label className="block text-xs font-semibold text-gray-800 uppercase tracking-wide">Adresse email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="prenom.nom@exemple.fr"
            autoComplete="username"
            autoFocus
            className={inputClass}
            style={inputStyle}
          />
        </div>
        <div className="space-y-1.5">
          <label className="block text-xs font-semibold text-gray-800 uppercase tracking-wide">Mot de passe</label>
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
              aria-label={showPassword ? "Masquer le mot de passe" : "Afficher le mot de passe"}
              title={showPassword ? "Masquer le mot de passe" : "Afficher le mot de passe"}
              className="absolute inset-y-0 right-0 px-3 flex items-center text-gray-700 hover:text-black transition"
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>

        {error && <Alert tone="error">{error}</Alert>}

        <button
          type="submit"
          disabled={loading || !email.trim() || !password}
          className={primaryButtonClass}
          style={{ backgroundColor: RED }}
        >
          {loading && <Loader2 className="h-4 w-4 animate-spin" />}
          Accéder à mon espace
        </button>
      </form>
    </AuthCard>
  );
}
