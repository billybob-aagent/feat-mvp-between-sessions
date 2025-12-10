import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-screen bg-white text-gray-900">
      <header className="max-w-6xl mx-auto px-6 py-8 flex items-center justify-between">
        <div className="text-2xl font-bold">Between Sessions™</div>
        <nav className="flex gap-6 text-sm">
          <Link href="/pricing" className="hover:underline">Pricing</Link>
          <Link href="/auth/login" className="hover:underline">Login</Link>
          <Link href="/auth/signup" className="px-4 py-2 bg-black text-white rounded-md">Get Started</Link>
        </nav>
      </header>

      <section className="max-w-6xl mx-auto px-6 py-20 grid md:grid-cols-2 gap-12 items-center">
        <div>
          <h1 className="text-4xl md:text-5xl font-bold leading-tight">The paid asynchronous care platform for therapists and clients</h1>
          <p className="mt-6 text-lg text-gray-700">Assign between-session exercises, receive client reflections, and send short feedback — all with privacy-first architecture.</p>
          <div className="mt-8 flex gap-4">
            <Link href="/auth/signup" className="px-6 py-3 bg-black text-white rounded-md">Start 14-day free trial</Link>
            <Link href="/pricing" className="px-6 py-3 border rounded-md">See pricing</Link>
          </div>
          <p className="mt-4 text-xs text-gray-500">No medical advice. Not a replacement for therapy. Clinical support tool only.</p>
        </div>
        <div className="border rounded-lg p-6 shadow-sm">
          <ul className="space-y-3 text-sm">
            <li>• Assign prompts with due dates and recurrence</li>
            <li>• Collect text and voice reflections</li>
            <li>• Daily mood check-ins</li>
            <li>• Therapist feedback loop</li>
            <li>• Engagement and mood trends</li>
          </ul>
        </div>
      </section>

      <footer className="border-t py-10 text-center text-sm text-gray-600">
        <div className="space-x-6">
          <Link href="/privacy">Privacy Policy</Link>
          <Link href="/terms">Terms</Link>
        </div>
        <p className="mt-4">© {new Date().getFullYear()} Therapy Is Us</p>
      </footer>
    </main>
  );
}
