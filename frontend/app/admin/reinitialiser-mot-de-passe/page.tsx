"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Lock, Loader2, CheckCircle, Eye, EyeOff } from "lucide-react";

const RED = "#C62828";

function Formulaire() {
  const token = useSearchParams().get("token") ?? "";
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [visible, setVisible] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(token ? "" : "Lien invalide. Refaites une demande de réinitialisation.");
  const [success, setSuccess] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirm) { setError("Les deux mots de passe ne correspondent pas."); return; }
    if (password.length < 8) { setError("Le mot de passe doit contenir au moins 8 caractères."); return; }
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, new_password: password }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setError(d.error ?? "Lien invalide ou expiré.");
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
        <p className="text-sm text-gray-800 mb-6">Vous pouvez maintenant vous connecter avec votre nouveau mot de passe.</p>
        <a href="/admin/login" className="block w-full py-2.5 rounded-lg text-sm font-semibold text-white text-center" style={{ backgroundColor: RED }}>
          Se connecter
        </a>
      </div>
    );
  }

  return (
    <>
      <h1 className="text-xl font-semibold text-gray-900 text-center mb-1">Nouveau mot de passe</h1>
      <p className="text-sm text-gray-800 text-center mb-6">Choisissez un mot de passe d&apos;au moins 8 caractères.</p>
      <form onSubmit={submit} className="space-y-4">
        {[
          { label: "Nouveau mot de passe", value: password, set: setPassword },
          { label: "Confirmer le mot de passe", value: confirm, set: setConfirm },
        ].map(({ label, value, set }) => (
          <div key={label}>
            <label className="block text-xs font-medium text-gray-900 mb-1.5 uppercase tracking-wide">{label}</label>
            <div className="relative">
              <input
                type={visible[label] ? "text" : "password"}
                value={value}
                onChange={(e) => set(e.target.value)}
                placeholder="••••••••"
                autoComplete="new-password"
                disabled={!token}
                className="w-full px-4 py-2.5 pr-11 rounded-lg border border-black/10 bg-[#FAFAFA] text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-black/10 focus:border-black/20 disabled:opacity-50"
              />
              <button
                type="button"
                onClick={() => setVisible((v) => ({ ...v, [label]: !v[label] }))}
                aria-label={visible[label] ? "Masquer le mot de passe" : "Afficher le mot de passe"}
                title={visible[label] ? "Masquer le mot de passe" : "Afficher le mot de passe"}
                className="absolute inset-y-0 right-0 px-3 flex items-center text-gray-700 hover:text-black transition"
              >
                {visible[label] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
        ))}
        {error && <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}
        <button
          type="submit"
          disabled={loading || !token || !password || !confirm}
          className="w-full py-2.5 rounded-lg text-sm font-semibold text-white transition disabled:opacity-50 flex items-center justify-center gap-2"
          style={{ backgroundColor: RED }}
        >
          {loading && <Loader2 className="h-4 w-4 animate-spin" />}
          Enregistrer le nouveau mot de passe
        </button>
      </form>
      <p className="text-center mt-4">
        <a href="/admin/mot-de-passe-oublie" className="text-sm text-gray-800 hover:text-black hover:underline">Redemander un lien</a>
      </p>
    </>
  );
}

export default function AdminReinitialisationPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F5F5F5] px-4">
      <div className="w-full max-w-sm">
        <div className="flex justify-center mb-8">
          <div className="h-14 w-14 rounded-2xl flex items-center justify-center shadow-lg" style={{ backgroundColor: RED }}>
            <Lock className="h-6 w-6 text-white" />
          </div>
        </div>
        <div className="bg-white rounded-2xl shadow-sm border border-black/5 p-8">
          <Suspense>
            <Formulaire />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
