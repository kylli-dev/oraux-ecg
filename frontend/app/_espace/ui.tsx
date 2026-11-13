"use client";

// Éléments visuels partagés par les espaces candidat et examinateur (en-tête, cartes,
// titres, alertes) : une seule source pour garder la charte cohérente — rouge ENSAE
// #C62828, fond gris clair, texte foncé (pas de gris clair, voir lisibilité).

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ArrowLeft, GraduationCap, Loader2, LogOut, User, CheckCircle2, AlertTriangle, AlertCircle, Info } from "lucide-react";

export const RED = "#C62828";

// Hauteur disponible entre l'en-tête rouge (64px) et le pied de page (~64px), pour
// centrer les cartes sans faire défiler la page
export const PAGE_MIN_H = "min-h-[calc(100vh-128px)]";

export const inputClass =
  "w-full px-4 py-2.5 rounded-lg border border-gray-300 bg-white text-sm text-gray-900 placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:border-transparent transition";
export const inputStyle = { "--tw-ring-color": RED } as React.CSSProperties;

export const primaryButtonClass =
  "w-full py-2.5 rounded-lg text-white text-sm font-semibold shadow-sm transition hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2";

// Pastille ronde aux initiales de la personne connectée ; un clic ouvre un menu avec son
// nom et « Se déconnecter ». Le nom vient de meUrl (…/me) ; tant qu'il n'est pas chargé, la
// pastille montre une icône.
function MenuProfil({ tokenKey, base, meUrl }: { tokenKey: string; base: string; meUrl: string }) {
  const router = useRouter();
  const [ouvert, setOuvert] = useState(false);
  const [moi, setMoi] = useState<{ prenom?: string; nom?: string } | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const token = sessionStorage.getItem(tokenKey);
    if (!token) return;
    fetch(meUrl, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setMoi({ prenom: d.prenom, nom: d.nom }))
      .catch(() => {});
  }, [meUrl, tokenKey]);

  useEffect(() => {
    if (!ouvert) return;
    const clic = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOuvert(false); };
    const touche = (e: KeyboardEvent) => { if (e.key === "Escape") setOuvert(false); };
    document.addEventListener("mousedown", clic);
    document.addEventListener("keydown", touche);
    return () => { document.removeEventListener("mousedown", clic); document.removeEventListener("keydown", touche); };
  }, [ouvert]);

  const initiales = `${moi?.prenom?.trim()[0] ?? ""}${moi?.nom?.trim()[0] ?? ""}`.toUpperCase();
  const nomComplet = [moi?.prenom, moi?.nom].filter(Boolean).join(" ");

  return (
    <div ref={ref} className="relative shrink-0 lg:justify-self-end">
      <button
        type="button"
        onClick={() => setOuvert((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={ouvert}
        title={nomComplet || "Mon profil"}
        className="h-10 w-10 rounded-full bg-white flex items-center justify-center text-sm font-bold shadow-sm ring-2 ring-white/40 hover:ring-white transition"
        style={{ color: RED }}
      >
        {initiales || <User className="h-5 w-5" />}
      </button>
      {ouvert && (
        <div role="menu" className="absolute right-0 mt-2 w-60 rounded-xl bg-white shadow-lg border border-black/10 py-1 z-50">
          {nomComplet && (
            <div className="px-4 py-2.5 border-b border-black/5">
              <p className="text-sm font-semibold text-gray-900 truncate">{nomComplet}</p>
            </div>
          )}
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              sessionStorage.removeItem(tokenKey);
              router.push(base);
            }}
            className="w-full flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-gray-900 hover:bg-red-50 transition"
          >
            <LogOut className="h-4 w-4" style={{ color: RED }} />
            Se déconnecter
          </button>
        </div>
      )}
    </div>
  );
}

// En-tête rouge d'un espace. Le menu profil (initiales, déconnexion) n'apparaît pas sur les
// pages publiques (connexion, mot de passe oublié…).
export function EspaceHeader({
  libelle,
  base,
  tokenKey,
  meUrl,
  pagesPubliques,
  logoEnsae = false,
  onglets = [],
}: {
  libelle: string;
  base: string;
  tokenKey: string;
  meUrl: string;
  pagesPubliques: string[];
  logoEnsae?: boolean;
  onglets?: { href: string; label: string }[];
}) {
  const pathname = usePathname().replace(/\/$/, "");
  const connecte = !pagesPubliques.includes(pathname);

  return (
    <header className="sticky top-0 z-40 shadow-md" style={{ backgroundColor: RED }}>
      {/* Identité à gauche, onglets centrés, déconnexion à droite. Sur petit écran, les onglets
          passent sur une seconde ligne qui défile horizontalement. */}
      <div className="px-4 lg:px-6 py-2 lg:py-0 lg:h-16 flex flex-wrap lg:grid lg:grid-cols-[1fr_auto_1fr] items-center justify-between gap-x-4">
        <Link href={connecte ? `${base}/accueil` : base} className="flex flex-1 lg:flex-none items-center gap-4 min-w-0">
          {logoEnsae ? (
            // Logo rendu en blanc pour s'accorder au bandeau rouge, comme dans l'espace admin
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src="/logo-ensae.png"
              alt="ENSAE — IP Paris"
              className="h-12 w-auto shrink-0 select-none brightness-0 invert"
              draggable={false}
            />
          ) : (
            <div className="h-9 w-9 rounded-xl bg-white flex items-center justify-center shadow-sm shrink-0">
              <GraduationCap className="h-5 w-5" style={{ color: RED }} />
            </div>
          )}
          <div className={`leading-tight min-w-0 ${logoEnsae ? "border-l border-white/40 pl-4" : ""}`}>
            <p className="text-sm font-bold text-white">Oraux ECG</p>
            <p className="text-xs text-white/90 truncate">{logoEnsae ? libelle : `ENSAE — IP Paris · ${libelle}`}</p>
          </div>
        </Link>
        {connecte && onglets.length > 0 && (
          <nav aria-label={libelle} className="order-3 lg:order-none w-full lg:w-auto min-w-0 mt-2 lg:mt-0 flex items-center gap-1 overflow-x-auto">
            {onglets.map((o) => {
              const actif = pathname === o.href || pathname.startsWith(`${o.href}/`);
              return (
                <Link
                  key={o.href}
                  href={o.href}
                  aria-current={actif ? "page" : undefined}
                  className={`text-sm px-3 py-1.5 rounded-lg whitespace-nowrap transition ${
                    actif ? "bg-white font-semibold" : "font-medium text-white hover:bg-white/15"
                  }`}
                  style={actif ? { color: RED } : undefined}
                >
                  {o.label}
                </Link>
              );
            })}
          </nav>
        )}
        {connecte && <MenuProfil tokenKey={tokenKey} base={base} meUrl={meUrl} />}
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
