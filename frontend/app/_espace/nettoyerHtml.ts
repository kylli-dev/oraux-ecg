// Nettoie un HTML saisi dans l'admin (messages-type) avant de l'injecter dans une page :
// ne garde que les balises de mise en forme et, pour les liens, une adresse http(s), tel ou
// mailto. Tout le reste (scripts, attributs onclick…, styles, iframes) disparaît, pour
// qu'un contenu piégé ne puisse pas s'exécuter chez les candidats.

const BALISES = new Set([
  "P", "BR", "STRONG", "B", "EM", "I", "U", "S", "UL", "OL", "LI", "A", "SPAN", "DIV",
  "H1", "H2", "H3", "H4", "BLOCKQUOTE", "HR",
]);
// Contenu supprimé avec sa balise (pas seulement la balise)
const A_VIDER = new Set(["SCRIPT", "STYLE", "IFRAME", "OBJECT", "EMBED", "TEMPLATE", "NOSCRIPT", "SVG", "MATH"]);

function nettoyerNoeud(n: Node, doc: Document): Node[] {
  if (n.nodeType === Node.TEXT_NODE) return [doc.createTextNode(n.textContent ?? "")];
  if (n.nodeType !== Node.ELEMENT_NODE) return [];
  const el = n as Element;
  const balise = el.tagName.toUpperCase(); // en minuscules dans un SVG
  const enfants = () => Array.from(el.childNodes).flatMap((c) => nettoyerNoeud(c, doc));
  if (A_VIDER.has(balise)) return [];
  // Balise non autorisée : on garde son texte, sans elle
  if (!BALISES.has(balise)) return enfants();
  const propre = doc.createElement(balise.toLowerCase());
  if (balise === "A") {
    const href = (el.getAttribute("href") ?? "").trim();
    if (/^(https?:|mailto:|tel:)/i.test(href)) {
      propre.setAttribute("href", href);
      if (/^https?:/i.test(href)) {
        propre.setAttribute("target", "_blank");
        propre.setAttribute("rel", "noopener noreferrer");
      }
    }
  }
  enfants().forEach((c) => propre.appendChild(c));
  return [propre];
}

export function nettoyerHtml(html: string): string {
  if (typeof window === "undefined" || !html) return "";
  const doc = new DOMParser().parseFromString(html, "text/html");
  const sortie = doc.createElement("div");
  Array.from(doc.body.childNodes).flatMap((c) => nettoyerNoeud(c, doc)).forEach((c) => sortie.appendChild(c));
  return sortie.innerHTML;
}
