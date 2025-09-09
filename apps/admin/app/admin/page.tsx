import { PLAN_LIMITS, SUBJECTS } from "@brainbot/shared";

export default function AdminHome() {
  return (
    <main>
      <h1>BrainBot Admin</h1>
      <p>We currently support {SUBJECTS.length} subjects.</p>
      <pre>{JSON.stringify(PLAN_LIMITS.free)}</pre>
    </main>
  );
}
