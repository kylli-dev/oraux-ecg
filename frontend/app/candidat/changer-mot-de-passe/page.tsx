"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Loader2, CheckCircle2, Eye, EyeOff, KeyRound } from "lucide-react";
import { RED, AuthCard, Alert, inputClass, inputStyle, primaryButtonClass } from "../_ui";

const API_BASE = process.env.NEXT_PUBLIC_PORTAL_API_URL ?? "http://localhost:8000";

export default function ChangerMotDePassePage() {
  const router = useRouter();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  // Un champ visible en clair à la fois n'a pas de sens ici : chacun se montre/masque
  // indépendamment des autres.
  const [visible, setVisible] = useState<Set<number>>(new Set());
  const toggleVisible = (i: number) =>
    setVisible((prev) => {
      const next = new Set(prev);
      next.has(i) ? next.delete(i) : next.add(i);
      return next;
    });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (next !== confirm) {
      setError("Les deux mots de passe ne correspondent pas.");
      return;
    }
    if (next.length < 8) {
      setError("Le mot de passe doit contenir au moins 8 caractères.");
      return;
    }
    const token = sessionStorage.getItem("candidat_token");
    if (!token) {
      router.replace("/candidat");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${API_BASE}/portal/me/change-password`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ current_password: current, new_password: next }),
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

  const retour = (
    <Link href="/candidat/accueil" className="text-sm font-medium text-gray-800 hover:text-black hover:underline underline-offset-2">
      ← Retour à l&apos;accueil
    </Link>
  );

  if (success) {
    return (
      <AuthCard
        icon={<CheckCircle2 className="h-6 w-6 text-green-700" />}
        title="Mot de passe modifié"
        subtitle="Votre mot de passe a été mis à jour avec succès."
      >
        <button
          onClick={() => router.push("/candidat/accueil")}
          className={primaryButtonClass}
          style={{ backgroundColor: RED }}
        >
          Retour à l&apos;accueil
        </button>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      icon={<KeyRound className="h-6 w-6" />}
      title="Changer mon mot de passe"
      subtitle="Choisissez un mot de passe d'au moins 8 caractères."
      footer={retour}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {[
          { label: "Mot de passe actuel", value: current, set: setCurrent, auto: "current-password" },
          { label: "Nouveau mot de passe", value: next, set: setNext, auto: "new-password" },
          { label: "Confirmer le nouveau mot de passe", value: confirm, set: setConfirm, auto: "new-password" },
        ].map(({ label, value, set, auto }, i) => (
          <div key={label} className="space-y-1.5">
            <label className="block text-xs font-semibold text-gray-800 uppercase tracking-wide">
              {label}
            </label>
            <div className="relative">
              <input
                type={visible.has(i) ? "text" : "password"}
                value={value}
                onChange={(e) => set(e.target.value)}
                autoComplete={auto}
                placeholder="••••••••"
                className={`${inputClass} pr-11`}
                style={inputStyle}
              />
              <button
                type="button"
                onClick={() => toggleVisible(i)}
                tabIndex={-1}
                title={visible.has(i) ? "Masquer le mot de passe" : "Afficher le mot de passe"}
                className="absolute right-0 top-0 h-full px-3 flex items-center text-gray-700 hover:text-black transition"
              >
                {visible.has(i) ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
        ))}

        {error && <Alert tone="error">{error}</Alert>}

        <button
          type="submit"
          disabled={loading || !current || !next || !confirm}
          className={primaryButtonClass}
          style={{ backgroundColor: RED }}
        >
          {loading && <Loader2 className="h-4 w-4 animate-spin" />}
          {loading ? "Enregistrement…" : "Modifier le mot de passe"}
        </button>
      </form>
    </AuthCard>
  );
}
