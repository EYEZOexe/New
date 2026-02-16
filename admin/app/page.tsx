import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-screen bg-zinc-50 p-8 text-zinc-900">
      <section className="mx-auto w-full max-w-4xl rounded-xl border border-zinc-200 bg-white p-8 shadow-sm">
        <h1 className="text-2xl font-semibold tracking-tight">Admin</h1>
        <p className="mt-2 text-sm text-zinc-600">
          Connector configuration and ingestion status.
        </p>

        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            className="inline-flex items-center rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium hover:bg-zinc-50"
            href="/connectors"
          >
            Manage connectors
          </Link>
          <Link
            className="inline-flex items-center rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium hover:bg-zinc-50"
            href="/payments/customers"
          >
            Payment customers
          </Link>
          <Link
            className="inline-flex items-center rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium hover:bg-zinc-50"
            href="/discord"
          >
            Discord roles
          </Link>
        </div>
      </section>
    </main>
  );
}
