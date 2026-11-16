"use client";

// Annulation des grosses actions (24 h) : application d'un gabarit, suppression d'une
// journée, affectations groupées, salles par défaut, numérotation des triplets.
// Données : /admin/annulations (backend/app/api/annulations.py).
//   - FournisseurAnnulation : donne annuler(id) aux écrans (bouton « Annuler » des messages)
//   - BoutonAnnulations : liste des actions annulables, à côté de la cloche
import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { Undo2 } from "lucide-react";
import { type ToastAction, useConfirm, useToast } from "./Toast";

type Annulable = {
  id: number;
  date: string; // ISO UTC
  libelle: string;
  planning_nom: string | null;
  admin_nom: string | null;
};

type Api = {
  get: <T>(p: string) => Promise<T>;
  post: <T>(p: string, b: unknown) => Promise<T>;
};

// Plusieurs id : une action faite en plusieurs requêtes (ex. réinitialisation des salles),
// annulée d'un seul clic, de la plus récente à la plus ancienne
type Annuler = (ids: number | number[], libelle?: string) => Promise<void>;
const AnnulationCtx = createContext<{ annuler: Annuler } | null>(null);

export function FournisseurAnnulation({ post, onAnnule, children }: Pick<Api, "post"> & {
  onAnnule: () => void; // l'état a changé : recharger l'écran affiché
  children: React.ReactNode;
}) {
  const toast = useToast();
  const confirm = useConfirm();
  const annuler = useCallback<Annuler>(async (ids, libelle) => {
    const ok = await confirm(
      `Annuler ${libelle ? `« ${libelle} »` : "cette action"} ? Les données reviennent à leur état d'avant.`,
      { confirmLabel: "Annuler l'action", danger: true },
    );
    if (!ok) return;
    try {
      const messages: string[] = [];
      for (const id of [ids].flat().reverse()) {
        const r = await post<{ message: string }>(`annulations/${id}/annuler`, {});
        messages.push(r.message);
      }
      toast.success(messages.join(" "));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Annulation impossible");
    } finally {
      onAnnule();
    }
  }, [confirm, post, toast, onAnnule]);
  return <AnnulationCtx.Provider value={{ annuler }}>{children}</AnnulationCtx.Provider>;
}

// Bouton « Annuler » à joindre au message de succès d'une action (si elle est annulable)
export function useActionAnnuler(): (ids: number | null | undefined | (number | null | undefined)[], libelle?: string) => ToastAction | undefined {
  const ctx = useContext(AnnulationCtx);
  return (ids, libelle) => {
    const liste = [ids].flat().filter((i): i is number => !!i);
    return liste.length && ctx ? { label: "Annuler", onClick: () => { ctx.annuler(liste, libelle); } } : undefined;
  };
}

function quand(iso: string): string {
  const minutes = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
  if (minutes < 1) return "à l'instant";
  if (minutes < 60) return `il y a ${minutes} min`;
  return `il y a ${Math.round(minutes / 60)} h`;
}

export function BoutonAnnulations({ get }: { get: Api["get"] }) {
  const ctx = useContext(AnnulationCtx);
  const [ouvert, setOuvert] = useState(false);
  const [liste, setListe] = useState<Annulable[] | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  const charger = useCallback(() => {
    get<Annulable[]>("annulations/").then(setListe).catch(() => setListe([]));
  }, [get]);

  useEffect(() => {
    if (!ouvert) return;
    const clic = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOuvert(false); };
    const touche = (e: KeyboardEvent) => e.key === "Escape" && setOuvert(false);
    document.addEventListener("mousedown", clic);
    document.addEventListener("keydown", touche);
    return () => { document.removeEventListener("mousedown", clic); document.removeEventListener("keydown", touche); };
  }, [ouvert]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => { if (!ouvert) { setListe(null); charger(); } setOuvert((o) => !o); }}
        title="Annuler une action récente (24 h)"
        aria-label="Actions annulables"
        className="h-9 w-9 grid place-items-center rounded-lg hover:bg-black/10 transition"
      >
        <Undo2 className="h-4 w-4" />
      </button>
      {ouvert && (
        <div className="absolute bottom-full right-0 mb-2 w-80 max-h-[70vh] flex flex-col rounded-xl border border-black/10 bg-white text-gray-900 shadow-xl z-50">
          <div className="px-4 py-2.5 border-b border-black/10">
            <p className="text-sm font-semibold">Annuler une action</p>
            <p className="text-[11px] text-gray-700">Actions des dernières 24 h, les plus récentes d&apos;abord</p>
          </div>
          <div className="overflow-y-auto divide-y divide-black/5">
            {liste === null ? (
              <p className="px-4 py-6 text-sm text-gray-700 text-center">Chargement…</p>
            ) : liste.length === 0 ? (
              <p className="px-4 py-6 text-sm text-gray-700 text-center">Aucune action à annuler</p>
            ) : (
              liste.map((a) => (
                <div key={a.id} className="px-4 py-2.5 flex items-start gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-gray-900">{a.libelle}</p>
                    <p className="text-[11px] text-gray-700 mt-0.5">
                      {[a.planning_nom, a.admin_nom, quand(a.date)].filter(Boolean).join(" · ")}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={async () => { setOuvert(false); await ctx?.annuler(a.id, a.libelle); }}
                    className="shrink-0 rounded-md border border-[#C62828]/40 px-2 py-0.5 text-xs font-semibold text-[#C62828] hover:bg-[#C62828]/[0.06]"
                  >
                    Annuler
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
