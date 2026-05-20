"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { CalendarDays, LogOut, Loader2, ShieldCheck } from "lucide-react";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8002";

export default function SurveillantAccueilPage() {
  const router = useRouter();
  const [me, setMe] = useState<{ nom: string; prenom: string; email: string } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = sessionStorage.getItem("surveillant_token");
    if (!token) { router.replace("/surveillant"); return; }
    fetch(`${API}/surveillant/me`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => {
        if (r.status === 401) { sessionStorage.removeItem("surveillant_token"); router.replace("/surveillant"); return null; }
        return r.json();
      })
      .then((d) => { if (d) setMe(d); })
      .finally(() => setLoading(false));
  }, [router]);

  if (loading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-[#C62828]" /></div>;
  if (!me) return null;

  return (
    <div className="min-h-screen bg-[#F5F5F5]">
      <header className="bg-white border-b border-gray-100 shadow-sm">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-red-50 flex items-center justify-center">
              <ShieldCheck className="h-5 w-5 text-[#C62828]" />
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-900">{me.prenom} {me.nom}</p>
              <p className="text-xs text-gray-400">{me.email}</p>
            </div>
          </div>
          <button onClick={() => { sessionStorage.removeItem("surveillant_token"); router.push("/surveillant"); }}
            className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-red-500 transition">
            <LogOut className="h-4 w-4" /> Déconnexion
          </button>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-10">
        <h1 className="text-2xl font-bold text-gray-900 mb-1">Bonjour, {me.prenom} !</h1>
        <p className="text-gray-500 text-sm mb-8">Espace de surveillance des oraux ECG</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <button onClick={() => router.push("/surveillant/planning")}
            className="group bg-white rounded-2xl border border-gray-100 shadow-sm p-6 text-left hover:shadow-md hover:border-red-200 transition">
            <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center mb-4 group-hover:bg-red-100 transition">
              <CalendarDays className="h-5 w-5 text-[#C62828]" />
            </div>
            <p className="font-semibold text-gray-900 mb-1">Mon planning</p>
            <p className="text-sm text-gray-500">Consultez vos créneaux de surveillance et enregistrez les présences.</p>
          </button>
        </div>
      </main>
    </div>
  );
}
