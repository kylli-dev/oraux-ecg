export default function CandidatLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <p className="text-sm font-semibold text-gray-700 tracking-wide">
            Oraux ECG &mdash; Espace Candidat
          </p>
        </div>
      </header>
      <div className="flex-1">{children}</div>
    </div>
  );
}
