"use client";

import { useState } from "react";
import Link from "next/link";
import { Loader2, CheckCircle2, Mail } from "lucide-react";
import { RED, AuthCard, Alert, inputClass, inputStyle, primaryButtonClass } from "../_ui";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export default function SurveillantMotDePasseOubliePage() {
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
      await fetch(`${API_BASE}/surveillant/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: login.trim() }),
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
      <AuthCard icon={<CheckCircle2 className="h-6 w-6 text-green-700" />} title="Demande prise en compte">
        <p className="text-sm text-gray-700 text-center mt-2 mb-3">
          Si un compte correspond à <strong className="text-gray-900">{login.trim()}</strong>, un email
          contenant un lien pour choisir un nouveau mot de passe vient d&apos;être envoyé à
          l&apos;adresse enregistrée. Le lien est valable 30 minutes.
        </p>
        <p className="text-sm text-gray-700 text-center mb-6">
          Pensez à vérifier vos courriers indésirables (spam).
        </p>
        <Link href="/surveillant" className={primaryButtonClass} style={{ backgroundColor: RED }}>
          Retour à la connexion
        </Link>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      icon={<Mail className="h-6 w-6" />}
      title="Mot de passe oublié"
      subtitle="Saisissez l'adresse email de votre compte surveillant. Vous recevrez un lien pour choisir votre mot de passe — y compris pour la première fois."
      footer={
        <Link href="/surveillant" className="text-sm font-medium hover:underline underline-offset-2" style={{ color: RED }}>
          Retour à la connexion
        </Link>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <label className="block text-xs font-semibold text-gray-800 uppercase tracking-wide">
            Adresse email
          </label>
          <input
            type="text"
            value={login}
            onChange={(e) => setLogin(e.target.value)}
            placeholder="prenom.nom@exemple.fr"
            autoFocus
            autoComplete="username"
            className={inputClass}
            style={inputStyle}
          />
        </div>

        {error && <Alert tone="error">{error}</Alert>}

        <button
          type="submit"
          disabled={loading || !login.trim()}
          className={primaryButtonClass}
          style={{ backgroundColor: RED }}
        >
          {loading && <Loader2 className="h-4 w-4 animate-spin" />}
          {loading ? "Envoi…" : "Envoyer le lien"}
        </button>
      </form>
    </AuthCard>
  );
}
