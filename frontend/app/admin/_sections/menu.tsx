"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import NotificationsCloche, { type NotificationAdmin } from "../NotificationsCloche";
import {
  CalendarDays,
  Settings2,
  Users,
  GraduationCap,
  BarChart3,
  CheckCircle2,
  AlertTriangle,
  FileSpreadsheet,
  LogOut,
  Building2,
  Shield,
  FileText,
  Activity,
  LayoutTemplate,
  Search,
} from "lucide-react";
import { RED, SectionKey, get, post } from "./commun";

// ── EnvBadge ───────────────────────────────────────────────────────────────────
function EnvBadge() {
  const env = process.env.NEXT_PUBLIC_ENV;
  if (!env) return null;
  const styles: Record<string, string> = {
    development: "bg-amber-400 text-amber-900",
    preprod: "bg-orange-400 text-orange-900",
    production: "bg-emerald-400 text-emerald-900",
  };
  const label: Record<string, string> = {
    development: "DEV",
    preprod: "PREPROD",
    production: "PROD",
  };
  return (
    <span
      className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${styles[env] ?? "bg-gray-400 text-gray-900"}`}
    >
      {label[env] ?? env.toUpperCase()}
    </span>
  );
}

// ── Sidebar ────────────────────────────────────────────────────────────────────
export function Sidebar({
  active,
  onSelect,
  nbConflits = 0,
  onNotification,
  onRecherche,
}: {
  active: SectionKey;
  onSelect: (k: SectionKey) => void;
  nbConflits?: number;
  onNotification: (n: NotificationAdmin) => void;
  onRecherche: () => void;
}) {
  // Le Monitoring est réservé aux super-administrateurs (le serveur refuse aussi les autres)
  const [superAdmin, setSuperAdmin] = useState(false);
  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => setSuperAdmin(data?.role === "super_admin"))
      .catch(() => {});
  }, []);
  // Menu rangé dans l'ordre de travail d'une session d'oraux : on prépare (planning, puis
  // ses journées types), on affecte, on suit. Paramétrages et Monitoring, peu fréquents,
  // sont en bas, séparés par un trait.
  type ItemMenu = { key: SectionKey; label: string; icon: React.ElementType; badge?: number };
  const groupes: { titre: string | null; items: ItemMenu[] }[] = [
    { titre: null, items: [
      { key: "dashboard", label: "Tableau de bord", icon: BarChart3 },
    ] },
    { titre: "Préparer", items: [
      { key: "plannings", label: "Planning", icon: CalendarDays },
      { key: "journeeTypes", label: "Journées types", icon: LayoutTemplate },
    ] },
    { titre: "Affecter", items: [
      { key: "salles", label: "Salles & surveillants", icon: Building2 },
      { key: "examinateurs", label: "Examinateurs", icon: GraduationCap },
      { key: "planches", label: "Planches", icon: FileText },
      { key: "publication", label: "Prêt à publier ?", icon: CheckCircle2 },
    ] },
    { titre: "Suivre", items: [
      { key: "candidats", label: "Candidats", icon: Users },
      { key: "notes", label: "Notes", icon: FileSpreadsheet },
      { key: "surveillants", label: "Surveillants", icon: Shield },
      { key: "conflits", label: "Conflits", icon: AlertTriangle, badge: nbConflits },
    ] },
  ];
  const basMenu: ItemMenu[] =
    [
      { key: "parametrages", label: "Paramétrages", icon: Settings2 },
      ...(superAdmin ? [{ key: "monitoring" as const, label: "Monitoring", icon: Activity }] : []),
    ];

  return (
    <aside
      className="h-full w-[220px] shrink-0 flex flex-col text-white"
      style={{ backgroundColor: RED }}
    >
      <div className="p-5 pb-4">
        <div className="flex flex-col items-center gap-2">
          {/* Logo rendu en blanc pour s'accorder au bandeau rouge */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/logo-ensae.png"
            alt="ENSAE — IP Paris"
            className="h-24 w-auto select-none brightness-0 invert"
            draggable={false}
          />
          <EnvBadge />
        </div>
        <button
          type="button"
          onClick={onRecherche}
          className="mt-4 w-full flex items-center gap-2 rounded-lg bg-white/15 hover:bg-white/25 px-3 py-2 text-sm text-white transition"
          title="Rechercher un candidat, un examinateur, un surveillant ou une section"
        >
          <Search className="h-4 w-4 shrink-0" />
          <span className="flex-1 text-left">Rechercher…</span>
        </button>
      </div>

      <nav className="px-3 flex-1 overflow-y-auto">
        {groupes.map(({ titre, items }) => (
          <div key={titre ?? "accueil"} className="mb-2">
            {titre && (
              <div className="px-3 pt-2 pb-1 text-[10px] uppercase tracking-widest text-white/70 font-semibold">
                {titre}
              </div>
            )}
            {items.map((item) => (
              <BoutonMenu key={item.key} item={item} active={active} onSelect={onSelect} />
            ))}
          </div>
        ))}
        <div className="border-t border-white/15 mt-2 pt-2">
          {basMenu.map((item) => (
            <BoutonMenu key={item.key} item={item} active={active} onSelect={onSelect} />
          ))}
        </div>
      </nav>

      <div className="p-3 border-t border-white/10 flex items-center gap-2">
        <div className="flex-1 min-w-0">
          <ProfilMenu />
        </div>
        <NotificationsCloche get={get} post={post} onOuvrir={onNotification} />
      </div>
    </aside>
  );
}

function BoutonMenu({ item: { key, label, icon: Icon, badge }, active, onSelect }: {
  item: { key: SectionKey; label: string; icon: React.ElementType; badge?: number };
  active: SectionKey;
  onSelect: (k: SectionKey) => void;
}) {
  return (
    <button
      onClick={() => onSelect(key)}
      className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition text-sm mb-0.5 text-left ${
        active === key
          ? "bg-white/15 font-semibold"
          : "hover:bg-black/10 text-white/80"
      }`}
    >
      <Icon className="h-4 w-4 shrink-0" />
      <span className="flex-1">{label}</span>
      {badge !== undefined && badge > 0 && (
        <span className="h-2 w-2 rounded-full bg-amber-400 shrink-0" />
      )}
    </button>
  );
}

// Cercle de profil (initiale de l'utilisateur connecté) ; un clic ouvre un menu
// avec la déconnexion. Se ferme au clic extérieur ou sur Échap.
function ProfilMenu() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [ouvert, setOuvert] = useState(false);
  const [profil, setProfil] = useState<{ username: string | null; role: string } | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => data && setProfil({ username: data.username ?? null, role: data.role ?? "admin" }))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!ouvert) return;
    const clic = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOuvert(false);
    };
    const touche = (e: KeyboardEvent) => e.key === "Escape" && setOuvert(false);
    document.addEventListener("mousedown", clic);
    document.addEventListener("keydown", touche);
    return () => {
      document.removeEventListener("mousedown", clic);
      document.removeEventListener("keydown", touche);
    };
  }, [ouvert]);

  const handleLogout = async () => {
    setLoading(true);
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/admin/login");
    router.refresh();
  };

  const nom = profil?.username?.trim() || "Administrateur";
  const initiale = nom.charAt(0).toUpperCase();
  const role = profil?.role === "super_admin" ? "Super admin" : "Admin";

  return (
    <div ref={ref} className="relative">
      {ouvert && (
        <div className="absolute bottom-full left-0 right-0 mb-2 rounded-xl bg-white shadow-lg ring-1 ring-black/10 overflow-hidden text-gray-900">
          <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-3">
            <span
              className="h-9 w-9 shrink-0 rounded-full grid place-items-center text-white font-semibold"
              style={{ backgroundColor: RED }}
            >
              {initiale}
            </span>
            <div className="min-w-0 leading-tight">
              <div className="text-sm font-semibold truncate">{nom}</div>
              <div className="text-xs text-gray-700">{role}</div>
            </div>
          </div>
          <button
            onClick={handleLogout}
            disabled={loading}
            className="w-full flex items-center gap-2 px-4 py-2.5 text-sm font-medium hover:bg-red-50 transition disabled:opacity-60"
            style={{ color: RED }}
          >
            <LogOut className="h-4 w-4" />
            {loading ? "Déconnexion…" : "Se déconnecter"}
          </button>
        </div>
      )}
      <button
        onClick={() => setOuvert((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={ouvert}
        title="Mon profil"
        className={`w-full flex items-center gap-3 px-2 py-2 rounded-lg transition text-left ${
          ouvert ? "bg-white/15" : "hover:bg-black/10"
        }`}
      >
        <span
          className="h-9 w-9 shrink-0 rounded-full bg-white grid place-items-center font-bold text-base"
          style={{ color: RED }}
        >
          {initiale}
        </span>
        <span className="min-w-0 flex-1 leading-tight">
          <span className="block text-sm font-semibold truncate">{nom}</span>
          <span className="block text-xs text-white/80">{role}</span>
        </span>
      </button>
    </div>
  );
}
