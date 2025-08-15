export default function Dashboard() {
  return (
    <div className="grid gap-6">
      <h1 className="text-3xl font-bold text-white">My Space</h1>
      <div className="grid md:grid-cols-3 gap-4">
        <div className="card">
          <h3>This Week</h3>
          <p className="mt-2">Your Smart-8 plan will appear here once you study in Telegram.</p>
        </div>
        <div className="card">
          <h3>PDF Library</h3>
          <p className="mt-2">Notes & marking sheets you download will show up here.</p>
        </div>
        <div className="card">
          <h3>Weak-Topic Heatmap</h3>
          <p className="mt-2">We’ll light up topics that need love after a few sessions.</p>
        </div>
      </div>
    </div>
  );
}
