"use client";

import { useState } from "react";
import Link from "next/link";
import { apiFetch } from "@/lib/api";

export default function CheckinPage() {
  const [mood, setMood] = useState(5);
  const [note, setNote] = useState("");
  const [status, setStatus] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setStatus(null);

    try {
      await apiFetch("/checkins/submit", {
        method: "POST",
        json: { mood, note: note.trim() ? note : undefined },
      });
      setNote("");
      setStatus("Check-in saved");
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setStatus(msg);
    }
  }

  return (
    <main className="max-w-md mx-auto px-6 py-10">
      <div className="flex items-center justify-between gap-3 mb-4">
        <h1 className="text-2xl font-bold">Daily mood check-in</h1>
        <Link className="underline text-sm" href="/app/client/assignment">
          Back to assignments
        </Link>
      </div>

      <form onSubmit={submit} className="space-y-3">
        <input
          type="range"
          min={0}
          max={10}
          value={mood}
          onChange={(e) => setMood(Number(e.target.value))}
          className="w-full"
        />
        <div>Current: {mood}</div>

        <textarea
          className="w-full border p-2 rounded"
          placeholder="Optional note"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />

        <button className="px-4 py-2 bg-black text-white rounded" type="submit">
          Submit
        </button>

        {status && (
          <p className="text-sm text-gray-700 whitespace-pre-wrap">{status}</p>
        )}
      </form>
    </main>
  );
}

