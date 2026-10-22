"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { PageLoader } from "../_ui";

// Les codes d'accès ne sont plus utilisés : les anciens liens « Code d'accès perdu ? »
// mènent désormais à « Mot de passe oublié ? ».
export default function CodePerduRedirection() {
  const router = useRouter();
  useEffect(() => { router.replace("/examinateur/mot-de-passe-oublie"); }, [router]);
  return <PageLoader />;
}
