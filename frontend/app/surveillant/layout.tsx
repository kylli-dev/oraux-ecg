import { SurveillantHeader } from "./_ui";
import { EspaceFooter } from "../_espace/ui";

export default function SurveillantLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[#F5F5F5] flex flex-col">
      <SurveillantHeader />
      <div className="flex-1">{children}</div>
      <EspaceFooter />
    </div>
  );
}
