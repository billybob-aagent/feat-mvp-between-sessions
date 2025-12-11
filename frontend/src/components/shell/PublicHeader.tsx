import Link from "next/link";
import { Button } from "../ui/button";

export function PublicHeader() {
  return (
    <header className="max-w-6xl mx-auto px-6 py-6 flex items-center justify-between">
      <div className="text-2xl font-bold tracking-tight">Between Sessions™</div>
      <nav className="flex items-center gap-6 text-sm">
        <Link href="/pricing" className="hover:underline">Pricing</Link>
        <Link href="/auth/login" className="hover:underline">Login</Link>
        <Link href="/auth/signup" className="">
          <Button>Get Started</Button>
        </Link>
      </nav>
    </header>
  );
}
