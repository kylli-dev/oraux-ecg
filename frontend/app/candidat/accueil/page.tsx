"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Loader2, BookOpen, Clock, ListChecks, Star } from "lucide-react";

const RED = "#C62828";
const API_BASE = process.env.NEXT_PUBLIC_PORTAL_API_URL ?? "http://localhost:8000";

interface CandidatMe {
  id: number;
  nom: string;
  prenom: string;
  email: string;
  profil: string | null;
  login: string | null;
}

const actions = [
  {
    href: "/candidat/planning",
    icon: <Clock className="h-6 w-6" />,
    label: "Mes créneaux d'oral",
    desc: "Consulter et gérer votre inscription aux épreuves.",
  },
  {
    href: "/candidat/notes",
    icon: <Star className="h-6 w-6" />,
    label: "Mes notes",
    desc: "Consulter vos notes une fois publiées.",
  },
  {
    href: "/candidat/liste-attente",
    icon: <ListChecks className="h-6 w-6" />,
    label: "Liste d'attente",
    desc: "Indiquer vos disponibilités si vous n'êtes pas encore inscrit.",
  },
  {
    href: "/candidat/changer-mot-de-passe",
    icon: <BookOpen className="h-6 w-6" />,
    label: "Changer mon mot de passe",
    desc: "Modifier le mot de passe reçu lors de votre admission.",
  },
];

export default function AccueilCandidatPage() {
  const router = useRouter();
  const [me, setMe] = useState<CandidatMe | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = sessionStorage.getItem("candidat_token");
    if (!token) {
      router.replace("/candidat");
      return;
    }
    fetch(`${API_BASE}/portal/me`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => {
        if (!r.ok) {
          sessionStorage.removeItem("candidat_token");
          router.replace("/candidat");
          return null;
        }
        return r.json();
      })
      .then((data) => data && setMe(data))
      .finally(() => setLoading(false));
  }, [router]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-65px)]">
        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
      </div>
    );
  }

  if (!me) return null;

  return (
    <div className="max-w-2xl mx-auto px-4 py-10">
      <div className="mb-8">
        <p className="text-sm text-gray-500 mb-1">Bienvenue,</p>
        <h1 className="text-2xl font-bold text-gray-900">
          {me.prenom} {me.nom}
        </h1>
        {me.profil && (
          <span
            className="inline-block mt-2 text-xs font-semibold px-2.5 py-1 rounded-full"
            style={{ backgroundColor: RED + "18", color: RED }}
          >
            Filière {me.profil}
          </span>
        )}
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-8 text-sm text-amber-800">
        <p className="font-semibold mb-1">Consignes importantes</p>
        <ul className="list-disc list-inside space-y-1 text-amber-700">
          <li>Les inscriptions sont ouvertes jusqu'à 16h pour le lendemain.</li>
          <li>Vous ne pouvez être inscrit qu'à un seul triplet de créneaux à la fois.</li>
          <li>Pensez à changer votre mot de passe provisoire dès votre première connexion.</li>
        </ul>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {actions.map((a) => (
          <Link
            key={a.href}
            href={a.href}
            className="flex items-start gap-4 bg-white rounded-xl border border-gray-100 shadow-sm p-5 hover:shadow-md hover:-translate-y-0.5 transition"
          >
            <div
              className="flex-shrink-0 flex items-center justify-center h-11 w-11 rounded-full"
              style={{ backgroundColor: RED + "12", color: RED }}
            >
              {a.icon}
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-900">{a.label}</p>
              <p className="text-xs text-gray-500 mt-0.5">{a.desc}</p>
            </div>
          </Link>
        ))}
      </div>

      <div className="mt-8 text-center">
        <button
          onClick={() => {
            sessionStorage.removeItem("candidat_token");
            router.push("/candidat");
          }}
          className="text-xs text-gray-400 hover:text-gray-600 underline underline-offset-2"
        >
          Se déconnecter
        </button>
      </div>
    </div>
  );
}
