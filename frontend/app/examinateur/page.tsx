"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2, KeyRound } from "lucide-react";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8002";

export default function ExaminateurLoginPage() {
  const router = useRouter();
  const [code, setCode] = useState("");
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
        body: JSON.stringify({ code_acces: code.trim().toUpperCase() }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail ?? "Code d'accès invalide");
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
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-50 to-white px-4">
      <div className="w-full max-w-sm">
        {/* Logo / titre */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-purple-600 mb-4 shadow-lg">
            <KeyRound className="h-7 w-7 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Espace examinateur</h1>
          <p className="text-sm text-gray-500 mt-1">Entrez votre code d&apos;accès personnel</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Code d&apos;accès
            </label>
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="ex : A1B2C3D4"
              required
              className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm font-mono tracking-widest focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent uppercase"
            />
          </div>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading || !code.trim()}
            className="w-full py-2.5 px-4 bg-purple-600 text-white text-sm font-semibold rounded-xl hover:bg-purple-700 transition disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            Accéder à mon espace
          </button>
        </form>

        <p className="text-center text-xs text-gray-400 mt-4">
          Votre code d&apos;accès vous a été communiqué par le service des admissions.
        </p>
      </div>
    </div>
  );
}
