"use client";

// Espace surveillant : réutilise les éléments partagés (app/_espace/ui.tsx) avec les
// réglages propres au surveillant (jeton, pages publiques, lien de retour).

import { EspaceHeader, PageHeader as BasePageHeader } from "../_espace/ui";

export { RED, PAGE_MIN_H, inputClass, inputStyle, primaryButtonClass, PageLoader, AuthCard, AuthEntete, Alert } from "../_espace/ui";

export function SurveillantHeader() {
  return (
    <EspaceHeader
      libelle="Espace surveillant"
      base="/surveillant"
      tokenKey="surveillant_token"
      pagesPubliques={["/surveillant", "/surveillant/mot-de-passe-oublie", "/surveillant/reinitialiser-mot-de-passe"]}
    />
  );
}

export function PageHeader(props: Omit<React.ComponentProps<typeof BasePageHeader>, "retourHref">) {
  return <BasePageHeader retourHref="/surveillant/accueil" {...props} />;
}
