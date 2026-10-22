"use client";

// Éléments visuels partagés par les espaces candidat et examinateur (en-tête, cartes,
// titres, alertes) : une seule source pour garder la charte cohérente — rouge ENSAE
// #C62828, fond gris clair, texte foncé (pas de gris clair, voir lisibilité).

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ArrowLeft, GraduationCap, Loader2, LogOut, CheckCircle2, AlertTriangle, AlertCircle, Info } from "lucide-react";

export const RED = "#C62828";

// Hauteur disponible entre l'en-tête rouge (64px) et le pied de page (~64px), pour
// centrer les cartes sans faire défiler la page
export const PAGE_MIN_H = "min-h-[calc(100vh-128px)]";

export const inputClass =
  "w-full px-4 py-2.5 rounded-lg border border-gray-300 bg-white text-sm text-gray-900 placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:border-transparent transition";
export const inputStyle = { "--tw-ring-color": RED } as React.CSSProperties;

export const primaryButtonClass =
  "w-full py-2.5 rounded-lg text-white text-sm font-semibold shadow-sm transition hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2";

// En-tête rouge d'un espace. Le bouton « Se déconnecter » n'apparaît pas sur les pages
// publiques (connexion, mot de passe oublié…).
export function EspaceHeader({
  libelle,
  base,
  tokenKey,
  pagesPubliques,
}: {
  libelle: string;
  base: string;
  tokenKey: string;
  pagesPubliques: string[];
}) {
  const pathname = usePathname();
  const router = useRouter();
  const connecte = !pagesPubliques.includes(pathname.replace(/\/$/, ""));

  return (
    <header className="sticky top-0 z-40 shadow-md" style={{ backgroundColor: RED }}>
      <div className="max-w-4xl mx-auto px-4 h-16 flex items-center justify-between gap-4">
        <Link href={connecte ? `${base}/accueil` : base} className="flex items-center gap-3 min-w-0">
          <div className="h-9 w-9 rounded-xl bg-white flex items-center justify-center shadow-sm shrink-0">
            <GraduationCap className="h-5 w-5" style={{ color: RED }} />
          </div>
          <div className="leading-tight min-w-0">
            <p className="text-sm font-bold text-white">Oraux ECG</p>
            <p className="text-xs text-white/90 truncate">ENSAE — IP Paris · {libelle}</p>
          </div>
        </Link>
        {connecte && (
          <button
            onClick={() => {
              sessionStorage.removeItem(tokenKey);
              router.push(base);
            }}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-white px-3 py-1.5 rounded-lg border border-white/40 hover:bg-white/15 transition shrink-0"
          >
            <LogOut className="h-4 w-4" />
            <span className="hidden sm:inline">Se déconnecter</span>
          </button>
        )}
      </div>
    </header>
  );
}

export function EspaceFooter() {
  return (
    <footer className="py-6 text-center text-xs text-gray-700">
      Oraux ECG — ENSAE, Institut Polytechnique de Paris
    </footer>
  );
}

export function PageLoader() {
  return (
    <div className={`flex items-center justify-center ${PAGE_MIN_H}`}>
      <Loader2 className="h-6 w-6 animate-spin" style={{ color: RED }} />
    </div>
  );
}

// Titre de page : lien retour vers l'accueil, pastille d'icône, titre, sous-titre et
// éventuelles actions à droite (exports…)
export function PageHeader({
  icon,
  title,
  subtitle,
  retourHref,
  actions,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle?: React.ReactNode;
  retourHref: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="mb-8">
      <Link
        href={retourHref}
        className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-700 hover:text-black mb-5 transition"
      >
        <ArrowLeft className="h-4 w-4" />
        Accueil
      </Link>
      <div className="flex flex-wrap items-start gap-4">
        <div
          className="h-12 w-12 rounded-2xl flex items-center justify-center shrink-0"
          style={{ backgroundColor: RED + "14", color: RED }}
        >
          {icon}
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
          {subtitle && <p className="text-sm text-gray-700 mt-1">{subtitle}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </div>
  );
}

// Carte centrée des pages de connexion / mot de passe
export function AuthCard({
  icon,
  title,
  subtitle,
  children,
  footer,
}: {
  icon?: React.ReactNode;
  title?: string;
  subtitle?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <div className={`flex items-center justify-center ${PAGE_MIN_H} px-4 py-10`}>
      <div className="w-full max-w-sm">
        <div className="relative overflow-hidden bg-white rounded-2xl shadow-sm border border-black/5 p-8">
          {icon && (
            <div className="flex justify-center mb-5">
              <div
                className="h-12 w-12 rounded-2xl flex items-center justify-center"
                style={{ backgroundColor: RED + "14", color: RED }}
              >
                {icon}
              </div>
            </div>
          )}
          {title && <h1 className="text-xl font-semibold text-gray-900 text-center">{title}</h1>}
          {subtitle && <p className="text-sm text-gray-700 text-center mt-1.5 mb-6">{subtitle}</p>}
          {children}
        </div>
        {footer && <div className="mt-5 text-center">{footer}</div>}
      </div>
    </div>
  );
}

// En-tête centré (pastille d'icône + titre + texte) à l'intérieur d'une AuthCard
export function AuthEntete({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="text-center mb-6">
      <div
        className="h-12 w-12 rounded-2xl flex items-center justify-center mx-auto mb-5"
        style={{ backgroundColor: RED + "14", color: RED }}
      >
        {icon}
      </div>
      <h1 className="text-xl font-semibold text-gray-900">{title}</h1>
      <p className="text-sm text-gray-700 mt-1.5">{children}</p>
    </div>
  );
}

const TONS = {
  error: { cls: "bg-red-50 border-red-200 text-red-800", Icon: AlertCircle },
  success: { cls: "bg-green-50 border-green-200 text-green-800", Icon: CheckCircle2 },
  warning: { cls: "bg-amber-50 border-amber-200 text-amber-900", Icon: AlertTriangle },
  info: { cls: "bg-white border-gray-200 text-gray-900", Icon: Info },
} as const;

export function Alert({
  tone,
  children,
  className = "",
}: {
  tone: keyof typeof TONS;
  children: React.ReactNode;
  className?: string;
}) {
  const { cls, Icon } = TONS[tone];
  return (
    <div className={`flex items-start gap-2.5 rounded-xl border px-4 py-3 text-sm ${cls} ${className}`}>
      <Icon className="h-4 w-4 mt-0.5 shrink-0" />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
