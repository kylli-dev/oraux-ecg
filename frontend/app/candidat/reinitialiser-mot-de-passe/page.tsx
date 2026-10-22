"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Loader2, CheckCircle2, AlertCircle, Eye, EyeOff, KeyRound } from "lucide-react";
import { RED, AuthCard, Alert, inputClass, inputStyle, primaryButtonClass } from "../_ui";

const API_BASE = process.env.NEXT_PUBLIC_PORTAL_API_URL ?? "http://localhost:8000";

// En-tête centré (pastille d'icône + titre + texte) des différents états de la page
function Entete({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="text-center mb-6">
      <div
        className="h-12 w-12 rounded-2xl flex items-center justify-center mx-auto mb-5"
        style={{ backgroundColor: RED + "14", color: RED }}
      >
        {icon}
      </div>
      <h1 className="text-xl font-semibold text-gray-900">{title}</h1>
      <p className="text-sm text-gray-700 mt-1.5">{children}</p>
    </div>
  );
}

function ResetForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  // Affichage en clair, champ par champ (bouton « œil »)
  const [visible, setVisible] = useState<Record<string, boolean>>({});

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
      <>
        <Entete icon={<CheckCircle2 className="h-6 w-6 text-green-700" />} title="Mot de passe réinitialisé">
          Vous pouvez maintenant vous connecter avec votre nouveau mot de passe.
        </Entete>
        <Link href="/candidat" className={primaryButtonClass} style={{ backgroundColor: RED }}>
          Se connecter
        </Link>
      </>
    );
  }

  if (!token) {
    return (
      <>
        <Entete icon={<AlertCircle className="h-6 w-6" />} title="Lien invalide">
          Ce lien de réinitialisation est invalide ou a expiré.
        </Entete>
        <Link href="/candidat/mot-de-passe-oublie" className={primaryButtonClass} style={{ backgroundColor: RED }}>
          Redemander un lien
        </Link>
      </>
    );
  }

  return (
    <>
      <Entete icon={<KeyRound className="h-6 w-6" />} title="Nouveau mot de passe">
        Choisissez un mot de passe d&apos;au moins 8 caractères.
      </Entete>

      <form onSubmit={handleSubmit} className="space-y-4">
        {[
          { label: "Nouveau mot de passe", value: password, set: setPassword },
          { label: "Confirmer le mot de passe", value: confirm, set: setConfirm },
        ].map(({ label, value, set }) => {
          const shown = !!visible[label];
          return (
            <div key={label} className="space-y-1.5">
              <label className="block text-xs font-semibold text-gray-800 uppercase tracking-wide">
                {label}
              </label>
              <div className="relative">
                <input
                  type={shown ? "text" : "password"}
                  value={value}
                  onChange={(e) => set(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="new-password"
                  className={`${inputClass} pr-11`}
                  style={inputStyle}
                />
                <button
                  type="button"
                  onClick={() => setVisible((v) => ({ ...v, [label]: !v[label] }))}
                  aria-label={shown ? "Masquer le mot de passe" : "Afficher le mot de passe"}
                  title={shown ? "Masquer le mot de passe" : "Afficher le mot de passe"}
                  className="absolute inset-y-0 right-0 px-3 flex items-center text-gray-700 hover:text-black transition"
                >
                  {shown ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
          );
        })}

        {error && <Alert tone="error">{error}</Alert>}

        <button
          type="submit"
          disabled={loading || !password || !confirm}
          className={primaryButtonClass}
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
    <AuthCard>
      <Suspense>
        <ResetForm />
      </Suspense>
    </AuthCard>
  );
}
