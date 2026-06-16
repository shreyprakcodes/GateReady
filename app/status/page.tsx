import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default function StatusPage() {
  return (
    <main className="flex flex-col min-h-screen max-w-md mx-auto px-4 py-6">
      <header className="flex items-center gap-3 mb-8">
        <Link href="/" className="text-zinc-400 hover:text-white transition-colors">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className="text-sm font-semibold text-white">Flight Status</h1>
      </header>
      <p className="text-zinc-500 text-sm">
        Live flight status is shown on your dashboard and updated automatically by the background monitor.
      </p>
      <Link
        href="/agent?prompt=What+is+the+current+status+of+my+flight"
        className="mt-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-sm text-white font-medium py-3 text-center transition-colors"
      >
        Ask GateReady
      </Link>
    </main>
  );
}
