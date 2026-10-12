"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

// Les codes d'accès ne sont plus utilisés : les anciens liens « Code d'accès perdu ? »
// mènent désormais à « Mot de passe oublié ? ».
export default function CodePerduRedirection() {
  const router = useRouter();
  useEffect(() => { router.replace("/examinateur/mot-de-passe-oublie"); }, [router]);
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F5F5F5]">
      <Loader2 className="h-6 w-6 animate-spin text-[#C62828]" />
    </div>
  );
}
