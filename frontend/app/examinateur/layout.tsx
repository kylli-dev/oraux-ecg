import { ExaminateurHeader } from "./_ui";
import { EspaceFooter } from "../_espace/ui";

export default function ExaminateurLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[#F5F5F5] flex flex-col">
      <ExaminateurHeader />
      <div className="flex-1">{children}</div>
      <EspaceFooter />
    </div>
  );
}
