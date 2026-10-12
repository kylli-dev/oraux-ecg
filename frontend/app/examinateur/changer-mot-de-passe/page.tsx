"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2, CheckCircle, Eye, EyeOff, ArrowLeft } from "lucide-react";

const RED = "#C62828";
const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

// Même fonctionnement que l'espace candidat. Un examinateur connecté avec son code d'accès
// qui n'a encore aucun mot de passe le DÉFINIT ici, sans « mot de passe actuel ».
export default function ExaminateurChangerMotDePassePage() {
  const router = useRouter();
  const [aUnMotDePasse, setAUnMotDePasse] = useState<boolean | null>(null);
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [visible, setVisible] = useState<Set<number>>(new Set());
  const toggleVisible = (i: number) =>
    setVisible((prev) => {
      const s = new Set(prev);
      s.has(i) ? s.delete(i) : s.add(i);
      return s;
    });

  useEffect(() => {
    const token = sessionStorage.getItem("examinateur_token");
    if (!token) { router.replace("/examinateur"); return; }
    fetch(`${API}/examinateur/me`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => {
        if (r.status === 401) { sessionStorage.removeItem("examinateur_token"); router.replace("/examinateur"); return null; }
        return r.json();
      })
      .then((me) => { if (me) setAUnMotDePasse(!!me.a_un_mot_de_passe); })
      .catch(() => setAUnMotDePasse(true));
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (next !== confirm) { setError("Les deux mots de passe ne correspondent pas."); return; }
    if (next.length < 8) { setError("Le mot de passe doit contenir au moins 8 caractères."); return; }
    const token = sessionStorage.getItem("examinateur_token");
    if (!token) { router.replace("/examinateur"); return; }
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${API}/examinateur/me/change-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ current_password: aUnMotDePasse ? current : null, new_password: next }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.detail ?? "Une erreur est survenue.");
        return;
      }
      setSuccess(true);
    } catch {
      setError("Impossible de contacter le serveur.");
    } finally {
      setLoading(false);
    }
  };

  if (aUnMotDePasse === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F5F5F5]">
        <Loader2 className="h-6 w-6 animate-spin text-[#C62828]" />
      </div>
    );
  }

  if (success) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#F5F5F5] px-4">
        <div className="w-full max-w-sm bg-white rounded-2xl shadow-md border border-gray-100 p-8 text-center">
          <CheckCircle className="h-10 w-10 mx-auto mb-4" style={{ color: "#16a34a" }} />
          <h1 className="text-lg font-semibold text-gray-900 mb-2">
            {aUnMotDePasse ? "Mot de passe modifié" : "Mot de passe défini"}
          </h1>
          <p className="text-sm text-gray-700 mb-6">
            Vous pouvez désormais vous connecter avec votre adresse email et ce mot de passe
            (votre code d&apos;accès reste valable).
          </p>
          <button
            onClick={() => router.push("/examinateur/accueil")}
            className="w-full py-2.5 rounded-lg text-white text-sm font-medium transition hover:opacity-90"
            style={{ backgroundColor: RED }}
          >
            Retour à l&apos;accueil
          </button>
        </div>
      </div>
    );
  }

  const champs = [
    ...(aUnMotDePasse ? [{ label: "Mot de passe actuel", value: current, set: setCurrent, auto: "current-password" }] : []),
    { label: "Nouveau mot de passe", value: next, set: setNext, auto: "new-password" },
    { label: "Confirmer le nouveau mot de passe", value: confirm, set: setConfirm, auto: "new-password" },
  ];

  return (
    <div className="flex items-center justify-center min-h-screen bg-[#F5F5F5] px-4">
      <div className="w-full max-w-sm">
        <button
          onClick={() => router.push("/examinateur/accueil")}
          className="flex items-center gap-1 text-sm text-gray-800 hover:text-black mb-4 transition"
        >
          <ArrowLeft className="h-4 w-4" /> Retour à l&apos;accueil
        </button>
        <div className="bg-white rounded-2xl shadow-md border border-gray-100 p-8">
          <h1 className="text-xl font-semibold text-gray-900 mb-1">
            {aUnMotDePasse ? "Changer mon mot de passe" : "Définir mon mot de passe"}
          </h1>
          <p className="text-sm text-gray-700 mb-6">
            {aUnMotDePasse
              ? "Choisissez un nouveau mot de passe d'au moins 8 caractères."
              : "Vous vous connectez actuellement avec votre code d'accès. Définissez un mot de passe (8 caractères minimum) pour pouvoir aussi vous connecter avec votre adresse email."}
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            {champs.map(({ label, value, set, auto }, i) => (
              <div key={label} className="space-y-1">
                <label className="block text-xs font-medium text-gray-900 uppercase tracking-wide">{label}</label>
                <div className="relative">
                  <input
                    type={visible.has(i) ? "text" : "password"}
                    value={value}
                    onChange={(e) => set(e.target.value)}
                    autoComplete={auto}
                    placeholder="••••••••"
                    className="w-full px-4 py-2.5 pr-11 rounded-lg border border-gray-200 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:border-transparent"
                    style={{ "--tw-ring-color": RED } as React.CSSProperties}
                  />
                  <button
                    type="button"
                    onClick={() => toggleVisible(i)}
                    tabIndex={-1}
                    aria-label={visible.has(i) ? "Masquer le mot de passe" : "Afficher le mot de passe"}
                    title={visible.has(i) ? "Masquer le mot de passe" : "Afficher le mot de passe"}
                    className="absolute right-0 top-0 h-full px-3 flex items-center text-gray-700 hover:text-black transition"
                  >
                    {visible.has(i) ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
            ))}

            {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}

            <button
              type="submit"
              disabled={loading || !next || !confirm || (aUnMotDePasse && !current)}
              className="w-full py-2.5 rounded-lg text-white text-sm font-medium transition hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2"
              style={{ backgroundColor: RED }}
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              {loading ? "Enregistrement…" : aUnMotDePasse ? "Modifier le mot de passe" : "Définir le mot de passe"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
