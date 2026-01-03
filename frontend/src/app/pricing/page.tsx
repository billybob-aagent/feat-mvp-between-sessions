import Link from 'next/link';

export default function PricingPage() {
  return (
    <main className="max-w-3xl mx-auto px-6 py-16">
      <h1 className="text-4xl font-bold">Pricing</h1>
      <p className="mt-4 text-gray-700">14-day free trial. No commitment. Cancel anytime.</p>
      <div className="mt-10 grid md:grid-cols-2 gap-6">
        <div className="border rounded-lg p-6">
          <h2 className="text-xl font-semibold">Monthly</h2>
          <p className="mt-2 text-3xl font-bold">$49<span className="text-base font-normal">/mo</span></p>
          <ul className="mt-4 text-sm space-y-2">
            <li>• Full therapist features</li>
            <li>• Unlimited clients</li>
          </ul>
          <Link href="/auth/signup" className="mt-6 inline-block px-4 py-2 bg-black text-white rounded-md">Start trial</Link>
        </div>
        <div className="border rounded-lg p-6">
          <h2 className="text-xl font-semibold">Annual</h2>
          <p className="mt-2 text-3xl font-bold">$490<span className="text-base font-normal">/yr</span></p>
          <ul className="mt-4 text-sm space-y-2">
            <li>• 2 months free</li>
            <li>• All monthly features</li>
          </ul>
          <Link href="/auth/signup" className="mt-6 inline-block px-4 py-2 bg-black text-white rounded-md">Start trial</Link>
        </div>
      </div>
    </main>
  );
}