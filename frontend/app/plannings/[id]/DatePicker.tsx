"use client";

import { useRouter } from "next/navigation";

export default function DatePicker({ id, date }: { id: string; date: string }) {
  const router = useRouter();

  return (
    <div className="mt-4">
      <label className="text-sm text-gray-600">Choisir une date</label>
      <input
        type="date"
        defaultValue={date}
        className="ml-3 rounded border px-2 py-1 text-sm"
        onChange={(e) => router.push(`/plannings/${id}?date=${e.target.value}`)}
      />
    </div>
  );
}
