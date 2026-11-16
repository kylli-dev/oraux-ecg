"use client";

// Recherche globale de l'espace admin (Ctrl+K) : candidats, examinateurs, surveillants,
// plannings et sections, par nom, prénom, e-mail ou code d'accès. Les listes sont chargées
// à l'ouverture ; un choix ouvre l'écran concerné (voir allerRecherche dans page.tsx).
import React, { useEffect, useMemo, useRef, useState } from "react";
import { CalendarDays, GraduationCap, LayoutList, Search, Shield, Users } from "lucide-react";

type Personne = { id: number; nom: string; prenom: string; email?: string | null; code_acces?: string | null };
type CandidatBrut = Personne & { planning_id: number; statut?: string };
type PlanningBrut = { id: number; nom: string; date_debut: string; date_fin: string };

export type ResultatRecherche =
  | { type: "section"; key: string; label: string }
  | { type: "planning"; id: number; nom: string }
  | { type: "candidat"; id: number; planningId: number; nom: string; prenom: string }
  | { type: "examinateur"; id: number; nom: string; prenom: string }
  | { type: "surveillant"; id: number; nom: string; prenom: string };

type Ligne = { r: ResultatRecherche; titre: string; detail: string; texte: string };

const GROUPES: { type: ResultatRecherche["type"]; titre: string; icon: React.ElementType }[] = [
  { type: "candidat", titre: "Candidats", icon: Users },
  { type: "examinateur", titre: "Examinateurs", icon: GraduationCap },
  { type: "surveillant", titre: "Surveillants", icon: Shield },
  { type: "planning", titre: "Plannings", icon: CalendarDays },
  { type: "section", titre: "Sections", icon: LayoutList },
];
const PAR_GROUPE = 6;

// Minuscules sans accents : « Héloïse » se trouve en tapant « heloise »
const normaliser = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

export default function RechercheGlobale({ get, sections, onChoisir, onFermer }: {
  get: <T>(p: string) => Promise<T>;
  sections: { key: string; label: string }[];
  onChoisir: (r: ResultatRecherche) => void;
  onFermer: () => void;
}) {
  const [texte, setTexte] = useState("");
  const [lignes, setLignes] = useState<Ligne[] | null>(null);
  const [actif, setActif] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    const nomsPlannings: Record<number, string> = {};
    Promise.all([
      get<PlanningBrut[]>("plannings/").catch(() => []),
      get<CandidatBrut[]>("candidats/").catch(() => []),
      get<Personne[]>("examinateurs/").catch(() => []),
      get<Personne[]>("surveillants/").catch(() => []),
    ]).then(([ps, cands, exs, survs]) => {
      ps.forEach((p) => { nomsPlannings[p.id] = p.nom; });
      const personne = (p: Personne) => [p.prenom, p.nom, p.nom, p.email ?? "", p.code_acces ?? ""].join(" ");
      setLignes([
        ...cands.map((c) => ({
          r: { type: "candidat" as const, id: c.id, planningId: c.planning_id, nom: c.nom, prenom: c.prenom },
          titre: `${c.nom} ${c.prenom}`, detail: [nomsPlannings[c.planning_id], c.email].filter(Boolean).join(" · "),
          texte: normaliser(personne(c)),
        })),
        ...exs.map((e) => ({
          r: { type: "examinateur" as const, id: e.id, nom: e.nom, prenom: e.prenom },
          titre: `${e.nom} ${e.prenom}`, detail: e.email ?? "", texte: normaliser(personne(e)),
        })),
        ...survs.map((s) => ({
          r: { type: "surveillant" as const, id: s.id, nom: s.nom, prenom: s.prenom },
          titre: `${s.nom} ${s.prenom}`, detail: s.email ?? "", texte: normaliser(personne(s)),
        })),
        ...ps.map((p) => ({
          r: { type: "planning" as const, id: p.id, nom: p.nom },
          titre: p.nom, detail: `du ${p.date_debut.split("-").reverse().join("/")} au ${p.date_fin.split("-").reverse().join("/")}`,
          texte: normaliser(p.nom),
        })),
        ...sections.map((s) => ({
          r: { type: "section" as const, key: s.key, label: s.label },
          titre: s.label, detail: "Section", texte: normaliser(s.label),
        })),
      ]);
    });
  }, [get, sections]);

  // Tous les mots tapés doivent apparaître (dans n'importe quel ordre) ; sans texte, les sections
  const resultats = useMemo(() => {
    if (!lignes) return [];
    const mots = normaliser(texte).split(/\s+/).filter(Boolean);
    const trouvees = mots.length
      ? lignes.filter((l) => mots.every((m) => l.texte.includes(m)))
      : lignes.filter((l) => l.r.type === "section");
    return GROUPES.flatMap((g) => trouvees.filter((l) => l.r.type === g.type).slice(0, PAR_GROUPE));
  }, [lignes, texte]);

  const choisir = (l: Ligne | undefined) => { if (l) onChoisir(l.r); };

  const clavier = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") { e.preventDefault(); onFermer(); }
    else if (e.key === "ArrowDown") { e.preventDefault(); setActif((a) => Math.min(a + 1, resultats.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActif((a) => Math.max(a - 1, 0)); }
    else if (e.key === "Enter") { e.preventDefault(); choisir(resultats[actif]); }
  };

  let index = -1;
  return (
    <div className="fixed inset-0 z-[100] bg-black/40 flex items-start justify-center px-4 pt-[12vh]" onMouseDown={onFermer}>
      <div
        className="w-full max-w-xl rounded-2xl bg-white text-gray-900 shadow-2xl overflow-hidden"
        onMouseDown={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Recherche"
      >
        <div className="flex items-center gap-3 px-4 border-b border-black/10">
          <Search className="h-4 w-4 text-gray-700 shrink-0" />
          <input
            ref={inputRef}
            value={texte}
            onChange={(e) => { setTexte(e.target.value); setActif(0); }}
            onKeyDown={clavier}
            placeholder="Rechercher un candidat, un examinateur, un surveillant, une section…"
            className="flex-1 py-3.5 text-sm bg-transparent outline-none placeholder:text-gray-700"
          />
          <kbd className="text-[10px] font-semibold text-gray-700 border border-black/15 rounded px-1.5 py-0.5">Échap</kbd>
        </div>
        <div className="max-h-[60vh] overflow-y-auto py-2">
          {lignes === null ? (
            <p className="px-4 py-6 text-sm text-gray-700 text-center">Chargement…</p>
          ) : resultats.length === 0 ? (
            <p className="px-4 py-6 text-sm text-gray-700 text-center">Aucun résultat pour « {texte} »</p>
          ) : (
            GROUPES.map((g) => {
              const duGroupe = resultats.filter((l) => l.r.type === g.type);
              if (!duGroupe.length) return null;
              const Icon = g.icon;
              return (
                <div key={g.type} className="mb-1">
                  <p className="px-4 pt-2 pb-1 text-[10px] uppercase tracking-widest font-semibold text-gray-700">{g.titre}</p>
                  {duGroupe.map((l) => {
                    index++;
                    const i = index;
                    return (
                      <button
                        key={`${l.r.type}-${"id" in l.r ? l.r.id : l.r.key}`}
                        type="button"
                        onMouseEnter={() => setActif(i)}
                        onClick={() => choisir(l)}
                        className={`w-full flex items-center gap-3 px-4 py-2 text-left ${actif === i ? "bg-[#C62828]/[0.08]" : ""}`}
                      >
                        <Icon className="h-4 w-4 shrink-0 text-[#C62828]" />
                        <span className="text-sm font-medium truncate">{l.titre}</span>
                        <span className="ml-auto text-xs text-gray-700 truncate">{l.detail}</span>
                      </button>
                    );
                  })}
                </div>
              );
            })
          )}
        </div>
        <div className="px-4 py-2 border-t border-black/10 text-[11px] text-gray-700 flex gap-4">
          <span>↑ ↓ pour naviguer</span><span>Entrée pour ouvrir</span><span>Ctrl K pour rouvrir</span>
        </div>
      </div>
    </div>
  );
}
