"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Lock, Eye, EyeOff, Loader2, CheckCircle2 } from "lucide-react";

const RED = "#C62828";
// Durée maximale d'attente du réveil du backend Render (démarrage habituel : 30-60 s)
const WAKE_MAX_MS = 2 * 60 * 1000;

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const from = params.get("from") ?? "/admin";

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [waking, setWaking] = useState(false);
  // État du serveur, réveillé dès l'affichage de la page (voir /api/wake) :
  // le démarrage se fait pendant la saisie des identifiants, pas après le clic.
  const [serveur, setServeur] = useState<"verification" | "demarrage" | "pret" | "injoignable">("verification");

  useEffect(() => {
    let annule = false;
    (async () => {
      const debut = Date.now();
      while (!annule && Date.now() - debut < WAKE_MAX_MS) {
        try {
          const res = await fetch("/api/wake", { cache: "no-store" });
          if (res.ok) { if (!annule) setServeur("pret"); return; }
        } catch { /* réseau : on réessaie */ }
        if (annule) return;
        setServeur("demarrage");
        await new Promise((r) => setTimeout(r, 3000));
      }
      if (!annule) setServeur("injoignable");
    })();
    return () => { annule = true; };
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setWaking(false);
    // Réessaie tant que le serveur redémarre (jusqu'à ~2 min) au lieu d'abandonner après 15 s
    const debut = Date.now();
    try {
      for (let attempt = 1; ; attempt++) {
        const peutReessayer = Date.now() - debut < WAKE_MAX_MS;
        const res = await fetch("/api/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username, password }),
        });
        const contentType = res.headers.get("content-type") ?? "";
        const data = contentType.includes("application/json") ? await res.json() : null;

        if (res.status === 503 && data?.code === "backend_waking_up" && peutReessayer) {
          setWaking(true);
          await new Promise((r) => setTimeout(r, Math.min(attempt * 2000, 4000)));
          continue;
        }
        setWaking(false);
        if (res.ok) setServeur("pret");
        if (!res.ok) {
          throw new Error(data?.error ?? `Erreur serveur (${res.status})`);
        }
        router.push(from);
        router.refresh();
        return;
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F5F5F5]">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex justify-center mb-8">
          <div
            className="h-14 w-14 rounded-2xl flex items-center justify-center shadow-lg"
            style={{ backgroundColor: RED }}
          >
            <Lock className="h-6 w-6 text-white" />
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-black/5 p-8">
          <h1 className="text-xl font-semibold text-center mb-1">
            Espace administration
          </h1>
          <p className="text-sm text-gray-700 text-center mb-6">ENSAE — IP Paris</p>

          <form onSubmit={submit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-gray-800 mb-1.5 uppercase tracking-wide">
                Nom d&apos;utilisateur
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="admin"
                autoFocus
                autoComplete="username"
                className="w-full px-4 py-2.5 rounded-lg border border-black/10 bg-[#FAFAFA] text-sm focus:outline-none focus:ring-2 focus:ring-black/10 focus:border-black/20"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-800 mb-1.5 uppercase tracking-wide">
                Mot de passe
              </label>
              <div className="relative">
                <input
                  type={show ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  className="w-full px-4 py-2.5 pr-10 rounded-lg border border-black/10 bg-[#FAFAFA] text-sm focus:outline-none focus:ring-2 focus:ring-black/10 focus:border-black/20"
                />
                <button
                  type="button"
                  onClick={() => setShow((s) => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-700 hover:text-black transition"
                >
                  {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {(waking || serveur === "demarrage") && (
              <p className="text-xs text-amber-800 bg-amber-50 rounded-lg px-3 py-2 flex items-center gap-2">
                <Loader2 className="h-3.5 w-3.5 animate-spin shrink-0" />
                {loading
                  ? "Le serveur démarre — connexion automatique dès qu'il est prêt…"
                  : "Démarrage du serveur en cours (30 à 60 s) — vous pouvez déjà saisir vos identifiants."}
              </p>
            )}
            {!waking && serveur === "pret" && !error && (
              <p className="text-xs text-green-800 flex items-center gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                Serveur prêt
              </p>
            )}
            {serveur === "injoignable" && !loading && (
              <p className="text-xs text-red-700 bg-red-50 rounded-lg px-3 py-2">
                Le serveur ne répond toujours pas après 2 minutes. Rechargez la page pour réessayer.
              </p>
            )}

            {error && (
              <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading || !username || !password}
              className="w-full py-2.5 rounded-lg text-sm font-semibold text-white transition disabled:opacity-50"
              style={{ backgroundColor: RED }}
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {waking ? "Réveil du serveur…" : "Connexion…"}
                </span>
              ) : (
                "Se connecter"
              )}
            </button>
          </form>
        </div>

        <p className="text-center mt-4">
          <a href="/admin/mot-de-passe-oublie" className="text-sm font-medium hover:underline" style={{ color: RED }}>
            Mot de passe oublié ?
          </a>
        </p>
        <p className="text-center text-xs text-gray-700 mt-4">
          Oraux ENSAE — Back-office
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
