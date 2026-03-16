"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Loader2, CheckCircle, AlertCircle } from "lucide-react";

const RED = "#C62828";
const API_BASE = process.env.NEXT_PUBLIC_PORTAL_API_URL ?? "http://localhost:8000";

function ResetForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!token) setError("Lien invalide. Veuillez redemander un email de réinitialisation.");
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirm) {
      setError("Les deux mots de passe ne correspondent pas.");
      return;
    }
    if (password.length < 8) {
      setError("Le mot de passe doit contenir au moins 8 caractères.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${API_BASE}/portal/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, new_password: password }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.detail ?? "Token invalide ou expiré.");
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
      <div className="text-center">
        <CheckCircle className="h-10 w-10 mx-auto mb-4" style={{ color: "#16a34a" }} />
        <h1 className="text-lg font-semibold text-gray-900 mb-2">Mot de passe réinitialisé</h1>
        <p className="text-sm text-gray-500 mb-6">
          Vous pouvez maintenant vous connecter avec votre nouveau mot de passe.
        </p>
        <Link
          href="/candidat"
          className="block w-full py-2.5 rounded-lg text-white text-sm font-medium text-center transition hover:opacity-90"
          style={{ backgroundColor: RED }}
        >
          Se connecter
        </Link>
      </div>
    );
  }

  if (!token) {
    return (
      <div className="text-center">
        <AlertCircle className="h-10 w-10 mx-auto mb-4 text-red-500" />
        <h1 className="text-lg font-semibold text-gray-900 mb-2">Lien invalide</h1>
        <p className="text-sm text-gray-500 mb-6">
          Ce lien de réinitialisation est invalide ou a expiré.
        </p>
        <Link
          href="/candidat/mot-de-passe-oublie"
          className="block w-full py-2.5 rounded-lg text-white text-sm font-medium text-center transition hover:opacity-90"
          style={{ backgroundColor: RED }}
        >
          Redemander un lien
        </Link>
      </div>
    );
  }

  return (
    <>
      <h1 className="text-xl font-semibold text-gray-900 mb-1">Nouveau mot de passe</h1>
      <p className="text-sm text-gray-500 mb-6">
        Choisissez un mot de passe d&apos;au moins 8 caractères.
      </p>

      <form onSubmit={handleSubmit} className="space-y-4">
        {[
          { label: "Nouveau mot de passe", value: password, set: setPassword },
          { label: "Confirmer le mot de passe", value: confirm, set: setConfirm },
        ].map(({ label, value, set }) => (
          <div key={label} className="space-y-1">
            <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide">
              {label}
            </label>
            <input
              type="password"
              value={value}
              onChange={(e) => set(e.target.value)}
              placeholder="••••••••"
              autoComplete="new-password"
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
          disabled={loading || !password || !confirm}
          className="w-full py-2.5 rounded-lg text-white text-sm font-medium transition hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2"
          style={{ backgroundColor: RED }}
        >
          {loading && <Loader2 className="h-4 w-4 animate-spin" />}
          {loading ? "Enregistrement…" : "Enregistrer le nouveau mot de passe"}
        </button>
      </form>
    </>
  );
}

export default function ReinitialisationPage() {
  return (
    <div className="flex items-center justify-center min-h-[calc(100vh-65px)] px-4">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-md border border-gray-100 p-8">
        <Suspense>
          <ResetForm />
        </Suspense>
      </div>
    </div>
  );
}
