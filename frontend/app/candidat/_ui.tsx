"use client";

// Espace candidat : réutilise les éléments partagés (app/_espace/ui.tsx) avec les
// réglages propres au candidat (jeton, pages publiques, lien de retour).

import { EspaceHeader, PageHeader as BasePageHeader } from "../_espace/ui";

export { RED, PAGE_MIN_H, inputClass, inputStyle, primaryButtonClass, PageLoader, AuthCard, AuthEntete, Alert } from "../_espace/ui";

export function CandidatHeader() {
  return (
    <EspaceHeader
      libelle="Espace candidat"
      base="/candidat"
      tokenKey="candidat_token"
      pagesPubliques={["/candidat", "/candidat/mot-de-passe-oublie", "/candidat/reinitialiser-mot-de-passe"]}
    />
  );
}

export function PageHeader(props: Omit<React.ComponentProps<typeof BasePageHeader>, "retourHref">) {
  return <BasePageHeader retourHref="/candidat/accueil" {...props} />;
}
