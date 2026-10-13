"use client";

import { useState } from "react";
import { Lock, Loader2, CheckCircle } from "lucide-react";

const RED = "#C62828";

// « Mot de passe oublié » d'un compte administrateur : un lien est envoyé à l'adresse email
// enregistrée sur le compte. Sans adresse, c'est le super-administrateur qui réinitialise.
export default function AdminMotDePasseOubliePage() {
  const [identifiant, setIdentifiant] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!identifiant.trim()) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifiant: identifiant.trim() }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setError(d.error ?? "Une erreur est survenue.");
        return;
      }
      setSent(true);
    } catch {
      setError("Impossible de contacter le serveur.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F5F5F5] px-4">
      <div className="w-full max-w-sm">
        <div className="flex justify-center mb-8">
          <div className="h-14 w-14 rounded-2xl flex items-center justify-center shadow-lg" style={{ backgroundColor: RED }}>
            <Lock className="h-6 w-6 text-white" />
          </div>
        </div>
        <div className="bg-white rounded-2xl shadow-sm border border-black/5 p-8">
          {sent ? (
            <div className="text-center">
              <CheckCircle className="h-10 w-10 mx-auto mb-4" style={{ color: "#16a34a" }} />
              <h1 className="text-lg font-semibold text-gray-900 mb-2">Demande prise en compte</h1>
              <p className="text-sm text-gray-800 mb-3">
                Si ce compte existe et qu&apos;une adresse email y est associée, un lien pour choisir un nouveau
                mot de passe vient d&apos;y être envoyé. Il est valable 30 minutes.
              </p>
              <p className="text-sm text-gray-800 mb-6">
                Pas d&apos;email ? Votre compte n&apos;a peut-être pas d&apos;adresse enregistrée : contactez le
                super-administrateur, qui peut réinitialiser votre mot de passe.
              </p>
              <a href="/admin/login" className="block w-full py-2.5 rounded-lg text-sm font-semibold text-white text-center" style={{ backgroundColor: RED }}>
                Retour à la connexion
              </a>
            </div>
          ) : (
            <>
              <h1 className="text-xl font-semibold text-gray-900 text-center mb-1">Mot de passe oublié</h1>
              <p className="text-sm text-gray-800 text-center mb-6">
                Saisissez votre nom d&apos;utilisateur ou votre adresse email : vous recevrez un lien pour
                choisir un nouveau mot de passe.
              </p>
              <form onSubmit={submit} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-gray-900 mb-1.5 uppercase tracking-wide">
                    Nom d&apos;utilisateur ou email
                  </label>
                  <input
                    type="text"
                    value={identifiant}
                    onChange={(e) => setIdentifiant(e.target.value)}
                    autoFocus
                    autoComplete="username"
                    className="w-full px-4 py-2.5 rounded-lg border border-black/10 bg-[#FAFAFA] text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-black/10 focus:border-black/20"
                  />
                </div>
                {error && <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}
                <button
                  type="submit"
                  disabled={loading || !identifiant.trim()}
                  className="w-full py-2.5 rounded-lg text-sm font-semibold text-white transition disabled:opacity-50 flex items-center justify-center gap-2"
                  style={{ backgroundColor: RED }}
                >
                  {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                  Envoyer le lien
                </button>
              </form>
              <p className="text-center mt-4">
                <a href="/admin/login" className="text-sm text-gray-800 hover:text-black hover:underline">← Retour à la connexion</a>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
