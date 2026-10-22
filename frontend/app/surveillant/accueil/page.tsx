"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { CalendarDays, ChevronRight, KeyRound, Mail } from "lucide-react";
import { RED, PageLoader } from "../_ui";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8002";

// Champs utiles au résumé (le détail est sur la page planning)
type EpreuveResume = {
  date: string;
  candidat_id: number | null;
  statut: string;
};

function formatDate(d: string) {
  return new Date(d + "T12:00:00").toLocaleDateString("fr-FR", {
    weekday: "long", day: "numeric", month: "long",
  });
}

const actions = [
  {
    href: "/surveillant/planning",
    icon: <CalendarDays className="h-5 w-5" />,
    label: "Mon planning",
    desc: "Consultez vos créneaux de surveillance et enregistrez les présences.",
  },
  {
    href: "/surveillant/changer-mot-de-passe",
    icon: <KeyRound className="h-5 w-5" />,
    label: "Changer mon mot de passe",
    desc: "Modifiez le mot de passe de votre compte surveillant.",
  },
];

export default function SurveillantAccueilPage() {
  const router = useRouter();
  const [me, setMe] = useState<{ nom: string; prenom: string; email: string } | null>(null);
  const [epreuves, setEpreuves] = useState<EpreuveResume[] | null>(null);
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

    // Résumé (créneaux, candidats, prochaine journée) — chargé indépendamment :
    // en cas d'échec, les compteurs ne s'affichent simplement pas.
    fetch(`${API}/surveillant/me/epreuves`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => { if (Array.isArray(data)) setEpreuves(data); })
      .catch(() => {});
  }, [router]);

  if (loading) return <PageLoader />;
  if (!me) return null;

  const initiales = `${me.prenom?.[0] ?? ""}${me.nom?.[0] ?? ""}`.toUpperCase();

  let resume: { label: string; valeur: string }[] | null = null;
  if (epreuves) {
    const today = new Date().toISOString().slice(0, 10);
    const prochaine = [...new Set(epreuves.map((e) => e.date))].sort().find((d) => d >= today);
    resume = [
      { label: "Créneaux", valeur: String(epreuves.length) },
      { label: "Candidats attendus", valeur: String(epreuves.filter((e) => e.candidat_id).length) },
      { label: "Prochaine journée", valeur: prochaine ? formatDate(prochaine) : "—" },
    ];
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-10">
      {/* ── Bienvenue ── */}
      <div className="relative overflow-hidden rounded-2xl bg-white border border-black/5 shadow-sm mb-6">
        <div className="absolute inset-y-0 left-0 w-1.5" style={{ backgroundColor: RED }} />
        <div className="p-6 pl-8">
          <div className="flex flex-wrap items-center gap-4">
            <div
              className="h-14 w-14 rounded-2xl flex items-center justify-center text-lg font-bold text-white shadow-sm shrink-0"
              style={{ backgroundColor: RED }}
            >
              {initiales}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm text-gray-700">Bonjour,</p>
              <h1 className="text-2xl font-bold text-gray-900 truncate">
                {me.prenom} {me.nom}
              </h1>
              <p className="text-sm text-gray-700 flex items-center gap-1.5 mt-0.5 min-w-0">
                <Mail className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">{me.email}</span>
              </p>
            </div>
            <span
              className="text-xs font-semibold px-3 py-1 rounded-full"
              style={{ backgroundColor: RED + "14", color: RED }}
            >
              Surveillance des oraux
            </span>
          </div>

          {resume && (
            <div className="mt-5 grid grid-cols-1 sm:grid-cols-3 gap-3">
              {resume.map((r) => (
                <div key={r.label} className="rounded-xl bg-gray-50 border border-gray-100 px-4 py-3">
                  <p className="text-[11px] font-medium uppercase tracking-wide text-gray-700">{r.label}</p>
                  <p className="text-lg font-bold text-gray-900 capitalize truncate">{r.valeur}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Accès rapides ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {actions.map((a) => (
          <Link
            key={a.href}
            href={a.href}
            className="group flex items-center gap-4 bg-white rounded-2xl border border-black/5 shadow-sm p-5 transition hover:shadow-md hover:-translate-y-0.5 hover:border-[#C62828]/30"
          >
            <div
              className="flex-shrink-0 flex items-center justify-center h-11 w-11 rounded-xl transition group-hover:scale-105"
              style={{ backgroundColor: RED + "14", color: RED }}
            >
              {a.icon}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-gray-900">{a.label}</p>
              <p className="text-xs text-gray-700 mt-0.5">{a.desc}</p>
            </div>
            <ChevronRight className="h-4 w-4 text-gray-700 shrink-0 transition group-hover:translate-x-0.5 group-hover:text-[#C62828]" />
          </Link>
        ))}
      </div>
    </div>
  );
}
