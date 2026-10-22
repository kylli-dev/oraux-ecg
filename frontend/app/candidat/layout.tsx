import { CandidatHeader } from "./_ui";

export default function CandidatLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[#F5F5F5] flex flex-col">
      <CandidatHeader />
      <div className="flex-1">{children}</div>
      <footer className="py-6 text-center text-xs text-gray-700">
        Oraux ECG — ENSAE, Institut Polytechnique de Paris
      </footer>
    </div>
  );
}
