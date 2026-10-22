"use client";

// Espace examinateur : réutilise les éléments partagés (app/_espace/ui.tsx) avec les
// réglages propres à l'examinateur (jeton, pages publiques, lien de retour).

import { EspaceHeader, PageHeader as BasePageHeader } from "../_espace/ui";

export { RED, PAGE_MIN_H, inputClass, inputStyle, primaryButtonClass, PageLoader, AuthCard, AuthEntete, Alert } from "../_espace/ui";

export function ExaminateurHeader() {
  return (
    <EspaceHeader
      libelle="Espace examinateur"
      base="/examinateur"
      tokenKey="examinateur_token"
      pagesPubliques={[
        "/examinateur",
        "/examinateur/mot-de-passe-oublie",
        "/examinateur/reinitialiser-mot-de-passe",
        "/examinateur/code-perdu",
      ]}
    />
  );
}

export function PageHeader(props: Omit<React.ComponentProps<typeof BasePageHeader>, "retourHref">) {
  return <BasePageHeader retourHref="/examinateur/accueil" {...props} />;
}
