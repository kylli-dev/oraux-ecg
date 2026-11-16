"use client";

// Cloche des notifications admin (ex. candidat mis en liste d'attente ; pour les super-admins,
// les alertes d'activité des autres admins : affectations, gabarits, connexions, suppressions),
// en bas du menu.
// Données : /admin/notifications (backend/app/api/notifications.py), relues toutes les minutes.
import React, { useCallback, useEffect, useRef, useState } from "react";
import { Bell } from "lucide-react";

export type NotificationAdmin = {
  id: number;
  date: string; // ISO UTC
  type: string;
  titre: string;
  message: string;
  planning_id: number | null;
  candidat_id: number | null;
  lue: boolean;
  nombre?: number; // action répétée, regroupée en une ligne
};

type Reponse = {
  non_lues: number; notifications: NotificationAdmin[];
  non_lues_metier?: number; non_lues_activite?: number; super_admin?: boolean;
};

// Deux onglets : alertes sur les candidats (liste d'attente…) et, pour les super-admins,
// activité des autres admins. Chaque onglet a sa propre liste, ses non lues et son
// « Tout marquer comme lu ».
type Onglet = "metier" | "activite";
const ONGLETS: { k: Onglet; label: string }[] = [
  { k: "metier", label: "Candidats" },
  { k: "activite", label: "Activité des admins" },
];

const ACTUALISATION_MS = 60_000;

function quand(iso: string): string {
  const d = new Date(iso);
  const minutes = Math.round((Date.now() - d.getTime()) / 60_000);
  if (minutes < 1) return "à l'instant";
  if (minutes < 60) return `il y a ${minutes} min`;
  return d.toLocaleString("fr-FR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Paris" });
}

export default function NotificationsCloche({
  get,
  post,
  onOuvrir,
}: {
  get: <T>(p: string) => Promise<T>;
  post: <T>(p: string, b: unknown) => Promise<T>;
  // Clic sur une notification : ouvrir l'écran concerné (ex. Candidats > Liste d'attente)
  onOuvrir: (n: NotificationAdmin) => void;
}) {
  const [donnees, setDonnees] = useState<Reponse>({ non_lues: 0, notifications: [] });
  const [ouvert, setOuvert] = useState(false);
  const [onglet, setOnglet] = useState<Onglet>("metier");
  const ref = useRef<HTMLDivElement>(null);

  const charger = useCallback(() => {
    get<Reponse>(`notifications/?categorie=${onglet}`).then(setDonnees).catch(() => {});
  }, [get, onglet]);

  useEffect(() => {
    charger();
    const id = setInterval(charger, ACTUALISATION_MS);
    return () => clearInterval(id);
  }, [charger]);

  // Fermeture au clic extérieur ou sur Échap
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

  const ouvrir = async (n: NotificationAdmin) => {
    if (!n.lue) await post(`notifications/${n.id}/lue`, {}).catch(() => {});
    setOuvert(false);
    charger();
    onOuvrir(n);
  };

  const toutLu = async () => {
    await post(`notifications/tout-lu?categorie=${onglet}`, {}).catch(() => {});
    charger();
  };

  const { non_lues, notifications } = donnees;
  const nonLuesOnglet: Record<Onglet, number> = {
    metier: donnees.non_lues_metier ?? non_lues,
    activite: donnees.non_lues_activite ?? 0,
  };
  // Ouverture de la cloche : sur l'onglet qui a des non lues (Candidats en priorité)
  const basculer = () => {
    if (!ouvert && donnees.super_admin && !nonLuesOnglet.metier && nonLuesOnglet.activite) setOnglet("activite");
    setOuvert((o) => !o);
    if (!ouvert) charger();
  };

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={basculer}
        title={non_lues ? `${non_lues} notification${non_lues > 1 ? "s" : ""} non lue${non_lues > 1 ? "s" : ""}` : "Notifications"}
        aria-label="Notifications"
        className="relative h-9 w-9 grid place-items-center rounded-lg hover:bg-black/10 transition"
      >
        <Bell className="h-4 w-4" />
        {non_lues > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-amber-400 text-[10px] font-bold text-gray-900 grid place-items-center">
            {non_lues > 99 ? "99+" : non_lues}
          </span>
        )}
      </button>

      {ouvert && (
        <div className="absolute bottom-full left-0 mb-2 w-80 max-h-[70vh] flex flex-col rounded-xl border border-black/10 bg-white text-gray-900 shadow-xl z-50">
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-black/10">
            <span className="text-sm font-semibold">Notifications</span>
            {nonLuesOnglet[onglet] > 0 && (
              <button type="button" onClick={toutLu} className="text-xs font-medium text-[#C62828] hover:underline">
                Tout marquer comme lu
              </button>
            )}
          </div>
          {donnees.super_admin && (
            <div className="flex border-b border-black/10 text-xs font-medium">
              {ONGLETS.map(({ k, label }) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setOnglet(k)}
                  className={`flex-1 px-3 py-2 transition border-b-2 -mb-px ${
                    onglet === k ? "border-[#C62828] text-gray-900 font-semibold" : "border-transparent text-gray-700 hover:text-gray-900"
                  }`}
                >
                  {label}
                  {nonLuesOnglet[k] > 0 && (
                    <span className="ml-1.5 inline-grid place-items-center min-w-[18px] h-[18px] px-1 rounded-full bg-amber-400 text-[10px] font-bold text-gray-900">
                      {nonLuesOnglet[k] > 99 ? "99+" : nonLuesOnglet[k]}
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}
          <div className="overflow-y-auto divide-y divide-black/5">
            {notifications.length === 0 ? (
              <p className="px-4 py-6 text-sm text-gray-700 text-center">
                {onglet === "activite" ? "Aucune activité des autres admins" : "Aucune notification"}
              </p>
            ) : (
              notifications.map((n) => (
                <button
                  key={n.id}
                  type="button"
                  onClick={() => ouvrir(n)}
                  className={`w-full text-left px-4 py-2.5 hover:bg-black/[0.03] transition ${n.lue ? "" : "bg-amber-50"}`}
                >
                  <div className="flex items-start gap-2">
                    {!n.lue && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-amber-500" />}
                    <div className="min-w-0">
                      <p className={`text-sm ${n.lue ? "text-gray-800" : "font-semibold text-gray-900"}`}>
                        {n.titre}
                        {(n.nombre ?? 1) > 1 && <span className="ml-1.5 text-xs font-semibold text-gray-700">× {n.nombre}</span>}
                      </p>
                      <p className="text-xs text-gray-800 mt-0.5">{n.message}</p>
                      <p className="text-[11px] text-gray-700 mt-1">{quand(n.date)}</p>
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
