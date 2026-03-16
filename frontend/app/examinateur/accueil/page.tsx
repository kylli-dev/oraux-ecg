"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { CalendarDays, LogOut, Loader2, User } from "lucide-react";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8002";

type ExaminateurMe = {
  id: number;
  nom: string;
  prenom: string;
  email: string;
  matieres: string[];
};

function authHeaders() {
  const token = sessionStorage.getItem("examinateur_token") ?? "";
  return { Authorization: `Bearer ${token}` };
}

export default function ExaminateurAccueilPage() {
  const router = useRouter();
  const [me, setMe] = useState<ExaminateurMe | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = sessionStorage.getItem("examinateur_token");
    if (!token) { router.replace("/examinateur"); return; }

    fetch(`${API}/examinateur/me`, { headers: authHeaders() })
      .then((r) => {
        if (r.status === 401) { sessionStorage.removeItem("examinateur_token"); router.replace("/examinateur"); return null; }
        return r.json();
      })
      .then((data) => { if (data) setMe(data); })
      .finally(() => setLoading(false));
  }, [router]);

  function logout() {
    sessionStorage.removeItem("examinateur_token");
    router.push("/examinateur");
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-purple-500" />
      </div>
    );
  }

  if (!me) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-white">
      {/* Header */}
      <header className="bg-white border-b border-gray-100 shadow-sm">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-purple-100 flex items-center justify-center">
              <User className="h-5 w-5 text-purple-600" />
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-900">{me.prenom} {me.nom}</p>
              <p className="text-xs text-gray-400">{me.email}</p>
            </div>
          </div>
          <button
            onClick={logout}
            className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-red-500 transition"
          >
            <LogOut className="h-4 w-4" />
            Déconnexion
          </button>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-10">
        <h1 className="text-2xl font-bold text-gray-900 mb-1">Bonjour, {me.prenom} !</h1>
        <p className="text-gray-500 text-sm mb-8">
          Matière{me.matieres.length > 1 ? "s" : ""} : <span className="font-medium text-gray-700">{me.matieres.join(", ") || "—"}</span>
        </p>

        {/* Actions */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <button
            onClick={() => router.push("/examinateur/planning")}
            className="group bg-white rounded-2xl border border-gray-100 shadow-sm p-6 text-left hover:shadow-md hover:border-purple-200 transition"
          >
            <div className="w-10 h-10 rounded-xl bg-purple-100 flex items-center justify-center mb-4 group-hover:bg-purple-200 transition">
              <CalendarDays className="h-5 w-5 text-purple-600" />
            </div>
            <p className="font-semibold text-gray-900 mb-1">Mon planning & notes</p>
            <p className="text-sm text-gray-500">Consultez vos créneaux d&apos;oral et saisissez les notes des candidats.</p>
          </button>
        </div>
      </main>
    </div>
  );
}
