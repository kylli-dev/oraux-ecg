type Planning = {
  id: number;
  nom: string;
  date_debut: string;
  date_fin: string;
  statut: string;
};

export default async function PlanningsPage() {
  const res = await fetch("http://localhost:3000/api/plannings", { cache: "no-store" });
  const data = await res.json();

  if (!res.ok) {
    return (
      <main className="min-h-screen p-6">
        <h1 className="text-2xl font-semibold">Plannings</h1>
        <pre className="mt-4 rounded-lg border p-4 text-sm">{JSON.stringify(data, null, 2)}</pre>
      </main>
    );
  }

  const plannings = data as Planning[];

  return (
    <main className="min-h-screen p-6">
      <h1 className="text-2xl font-semibold">Plannings</h1>
      <p className="mt-2 text-gray-600">Liste des plannings (admin)</p>

      <div className="mt-6 overflow-x-auto rounded-xl border">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 text-left">
            <tr>
              <th className="p-3">ID</th>
              <th className="p-3">Nom</th>
              <th className="p-3">Début</th>
              <th className="p-3">Fin</th>
              <th className="p-3">Statut</th>
            </tr>
          </thead>
          <tbody>
            {plannings.map((p) => (
              <tr key={p.id} className="border-t">
                <td className="p-3">{p.id}</td>
                <td className="p-3">{p.nom}</td>
                <td className="p-3">{p.date_debut}</td>
                <td className="p-3">{p.date_fin}</td>
                <td className="p-3">{p.statut}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
