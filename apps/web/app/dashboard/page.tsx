export default function DashboardHome() {
  // TODO: Gate this route by Appwrite auth + paid team membership.
  // MVP placeholder.
  return (
    <main style={{ padding: 24 }}>
      <h1>Dashboard</h1>
      <p>Authenticated user dashboard placeholder.</p>
      <p>
        Next steps: Appwrite login, subscription gate, signal feed, alerts, Discord
        linking.
      </p>
    </main>
  );
}
