import Link from "next/link";

export default function MarketingHome() {
  return (
    <main style={{ padding: 24 }}>
      <h1>G3netic Crypto</h1>
      <p>Marketing site placeholder.</p>
      <ul>
        <li>
          <Link href="/dashboard">Go to dashboard</Link>
        </li>
        <li>
          <Link href="/login">Login</Link>
        </li>
        <li>
          <Link href="/signup">Sign up</Link>
        </li>
      </ul>
    </main>
  );
}
