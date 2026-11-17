"use client";

// Encadré « Contacts utiles » (responsable des oraux, salle de coordination…) des pages
// Accueil et Aujourd'hui. Le contenu se modifie dans l'admin : Paramétrages >
// Messages-type > « Contacts utiles ». Les numéros de téléphone deviennent cliquables.

import { useEffect, useState } from "react";
import { Phone } from "lucide-react";
import { RED } from "./_ui";
import { nettoyerHtml } from "../_espace/nettoyerHtml";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8002";

// 06 12 34 56 78, 06.12.34.56.78, 0612345678, +33 6 12 34 56 78
const TELEPHONE = /(?:\+33\s?|0)[1-9](?:[\s.-]?\d{2}){4}/g;

// Transforme les numéros présents dans le texte (hors liens existants) en liens tel:
function lienerTelephones(html: string): string {
  const doc = new DOMParser().parseFromString(`<div>${html}</div>`, "text/html");
  const racine = doc.body.firstElementChild!;
  const textes: Text[] = [];
  const parcours = doc.createTreeWalker(racine, NodeFilter.SHOW_TEXT);
  while (parcours.nextNode()) {
    const t = parcours.currentNode as Text;
    if (!t.parentElement?.closest("a")) textes.push(t);
  }
  for (const t of textes) {
    const valeur = t.textContent ?? "";
    TELEPHONE.lastIndex = 0;
    if (!TELEPHONE.test(valeur)) continue;
    const morceaux = doc.createDocumentFragment();
    let pos = 0;
    for (const m of valeur.matchAll(TELEPHONE)) {
      morceaux.append(valeur.slice(pos, m.index));
      const a = doc.createElement("a");
      a.href = `tel:${m[0].replace(/[\s.-]/g, "")}`;
      a.textContent = m[0];
      morceaux.append(a);
      pos = m.index! + m[0].length;
    }
    morceaux.append(valeur.slice(pos));
    t.replaceWith(morceaux);
  }
  return racine.innerHTML;
}

export function ContactsUtiles({ className = "" }: { className?: string }) {
  const [html, setHtml] = useState<string | null>(null);

  // Chargé indépendamment du reste de la page : en cas d'échec, l'encadré ne s'affiche pas
  useEffect(() => {
    const token = sessionStorage.getItem("surveillant_token");
    if (!token) return;
    fetch(`${API}/surveillant/contacts`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        const propre = nettoyerHtml(d?.corps_html ?? "").trim();
        // Contenu vide (éditeur vidé : « <p></p> ») → pas d'encadré
        const div = document.createElement("div");
        div.innerHTML = propre;
        setHtml(div.textContent?.trim() ? lienerTelephones(propre) : null);
      })
      .catch(() => {});
  }, []);

  if (!html) return null;
  return (
    <div className={`bg-white border border-black/5 shadow-sm rounded-2xl p-5 text-sm text-gray-800 ${className}`}>
      <p className="font-semibold text-gray-900 mb-3 flex items-center gap-3">
        <span
          className="flex-shrink-0 flex items-center justify-center h-8 w-8 rounded-lg"
          style={{ backgroundColor: RED + "14", color: RED }}
        >
          <Phone className="h-4 w-4" />
        </span>
        Contacts utiles
      </p>
      <div
        className="[&_ul]:list-disc [&_ul]:list-inside [&_ul]:space-y-1 [&_ol]:list-decimal [&_ol]:list-inside [&_ol]:space-y-1 [&_a]:underline [&_a]:font-semibold [&_a]:text-[#C62828] [&_p+p]:mt-2"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </div>
  );
}
