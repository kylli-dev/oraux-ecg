import DatePicker from "./DatePicker";

type DayView = {
  planning_id: number;
  date: string;
  demi_journees: Array<{
    id: number;
    type: string;
    heure_debut: string;
    heure_fin: string;
    epreuves: Array<{
      id: number;
      matiere: string;
      heure_debut: string;
      heure_fin: string;
      statut: string;
    }>;
  }>;
};

export default async function PlanningDayPage(props: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ date?: string }>;
}) {
  const { id } = await props.params;
  const { date: dateParam } = await props.searchParams;

  const date = dateParam ?? new Date().toISOString().slice(0, 10);

  const res = await fetch(
    `http://localhost:3000/api/day?planning_id=${id}&date=${date}`,
    { cache: "no-store" }
  );

  const data = await res.json();

  if (!res.ok) {
    return (
      <main className="min-h-screen p-6">
        <h1 className="text-2xl font-semibold">Planning {id}</h1>
        <DatePicker id={id} date={date} />
        <pre className="mt-4 rounded-lg border p-4 text-sm">
          {JSON.stringify(data, null, 2)}
        </pre>
      </main>
    );
  }

  const day = data as DayView;

  return (
    <main className="min-h-screen p-6">
      <h1 className="text-2xl font-semibold">Planning {day.planning_id}</h1>
      <p className="mt-2 text-gray-600">Date: {day.date}</p>

      {/* ✅ Sélecteur de date (client component) */}
      <DatePicker id={id} date={date} />

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        {day.demi_journees.map((dj) => (
          <section key={dj.id} className="rounded-xl border p-4">
            <div className="flex justify-between">
              <h2 className="font-medium">{dj.type}</h2>
              <span className="text-sm text-gray-500">
                {dj.heure_debut} – {dj.heure_fin}
              </span>
            </div>

            <div className="mt-3 space-y-2">
              {dj.epreuves.length === 0 ? (
                <p className="text-sm text-gray-400">Aucune épreuve</p>
              ) : (
                dj.epreuves.map((e) => (
                  <div key={e.id} className="rounded-lg border p-2">
                    <div className="flex justify-between">
                      <span>{e.matiere}</span>
                      <span className="text-xs">{e.statut}</span>
                    </div>
                    <div className="text-xs text-gray-500">
                      {e.heure_debut} – {e.heure_fin}
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>
        ))}
      </div>
    </main>
  );
}
