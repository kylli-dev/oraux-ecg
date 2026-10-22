"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { CalendarClock, CheckCircle2, ChevronRight, Info, KeyRound, ListChecks, Star, AlertTriangle } from "lucide-react";
import { RED, PageLoader } from "../_ui";

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
    icon: <CalendarClock className="h-5 w-5" />,
    label: "Mes créneaux d'oral",
    desc: "Consulter et gérer votre inscription aux épreuves.",
  },
  {
    href: "/candidat/notes",
    icon: <Star className="h-5 w-5" />,
    label: "Mes notes",
    desc: "Consulter vos notes une fois publiées.",
  },
  {
    href: "/candidat/liste-attente",
    icon: <ListChecks className="h-5 w-5" />,
    label: "Liste d'attente",
    desc: "Indiquer vos disponibilités si vous n'êtes pas encore inscrit.",
  },
  {
    href: "/candidat/changer-mot-de-passe",
    icon: <KeyRound className="h-5 w-5" />,
    label: "Changer mon mot de passe",
    desc: "Modifier le mot de passe reçu lors de votre admission.",
  },
];

function formatDate(d: string) {
  return new Date(d + "T12:00:00").toLocaleDateString("fr-FR", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  });
}

export default function AccueilCandidatPage() {
  const router = useRouter();
  const [me, setMe] = useState<CandidatMe | null>(null);
  const [consignes, setConsignes] = useState<string | null>(null);
  // undefined = pas encore chargée (ou en erreur : le bandeau ne s'affiche pas), null = aucune
  const [inscription, setInscription] = useState<{ date: string } | null | undefined>(undefined);
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

    // Encadré "Consignes importantes" — éditable côté admin (Paramétrages > Messages-type,
    // code CONSIGNES_ACCUEIL). Chargé indépendamment : si ça échoue, l'encadré ne s'affiche
    // simplement pas, sans bloquer le reste de la page.
    fetch(`${API_BASE}/portal/consignes-accueil`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => setConsignes(data?.corps_html?.trim() || null))
      .catch(() => {});

    // Résumé de l'inscription en tête de page, chargé lui aussi indépendamment
    fetch(`${API_BASE}/portal/me/inscription`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => (r.ok ? r.json() : undefined))
      .then((data) => setInscription(data))
      .catch(() => {});
  }, [router]);

  if (loading) return <PageLoader />;

  if (!me) return null;

  const initiales = `${me.prenom?.[0] ?? ""}${me.nom?.[0] ?? ""}`.toUpperCase();

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
              <p className="text-sm text-gray-700">Bienvenue,</p>
              <h1 className="text-2xl font-bold text-gray-900 truncate">
                {me.prenom} {me.nom}
              </h1>
            </div>
            {me.profil && (
              <span
                className="text-xs font-semibold px-3 py-1 rounded-full"
                style={{ backgroundColor: RED + "14", color: RED }}
              >
                Filière {me.profil}
              </span>
            )}
          </div>

          {inscription !== undefined && (
            <Link
              href="/candidat/planning"
              className={`mt-5 flex items-center gap-3 rounded-xl border px-4 py-3 text-sm transition hover:shadow-sm ${
                inscription
                  ? "bg-green-50 border-green-200 text-green-900"
                  : "bg-amber-50 border-amber-200 text-amber-900"
              }`}
            >
              {inscription ? (
                <CheckCircle2 className="h-5 w-5 shrink-0 text-green-700" />
              ) : (
                <AlertTriangle className="h-5 w-5 shrink-0 text-amber-700" />
              )}
              <span className="flex-1">
                {inscription ? (
                  <>
                    Vous êtes inscrit aux oraux du{" "}
                    <strong className="capitalize">{formatDate(inscription.date)}</strong>.
                  </>
                ) : (
                  "Vous n'avez pas encore choisi votre triplet de créneaux."
                )}
              </span>
              <span className="hidden sm:inline font-semibold whitespace-nowrap">
                {inscription ? "Voir le détail" : "Choisir un créneau"}
              </span>
              <ChevronRight className="h-4 w-4 shrink-0" />
            </Link>
          )}
        </div>
      </div>

      {/* ── Consignes ── */}
      {consignes && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 mb-6 text-sm text-amber-900">
          <p className="font-semibold mb-2 flex items-center gap-2">
            <Info className="h-4 w-4 shrink-0" />
            Consignes importantes
          </p>
          <div
            className="[&_ul]:list-disc [&_ul]:list-inside [&_ul]:space-y-1 [&_ol]:list-decimal [&_ol]:list-inside [&_ol]:space-y-1 [&_a]:underline [&_p+p]:mt-2"
            dangerouslySetInnerHTML={{ __html: consignes }}
          />
        </div>
      )}

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
