// apps/bot/src/routes/analytics.ts
import { Router } from "express";
import { buildUserStats, buildTopSubjects } from "../services/analytics.js";
import { listRecent as listRecentDrills } from "../repo/drillsRepo.js";

const router = Router();

// GET /api/analytics/summary?uid=...&subject=...
router.get("/summary", async (req, res) => {
  try {
    const uid = String(req.query.uid || "");
    const subject = (req.query.subject as string) || null;
    if (!uid) return res.status(400).json({ error: "Missing uid" });
    const data = await buildUserStats(uid, { subject });
    res.json(data);
  } catch (e: any) {
    res.status(500).json({ error: String(e?.message || e) });
  }
});

// GET /api/analytics/top?uid=...
router.get("/top", async (req, res) => {
  try {
    const uid = String(req.query.uid || "");
    if (!uid) return res.status(400).json({ error: "Missing uid" });
    const data = await buildTopSubjects(uid, {});
    res.json(data);
  } catch (e: any) {
    res.status(500).json({ error: String(e?.message || e) });
  }
});

// GET /api/analytics/drills?uid=...&subject=...&topic=...&limit=20
router.get("/drills", async (req, res) => {
  try {
    const uid = String(req.query.uid || "");
    if (!uid) return res.status(400).json({ error: "Missing uid" });

    const subjectLabel = (req.query.subject as string) || undefined;
    const topic = (req.query.topic as string) || undefined;
    const limit = Math.max(1, Math.min(100, Number(req.query.limit ?? 20)));

    const drills = await listRecentDrills({ telegramId: uid, subjectLabel, topic, limit });

    // sanitize output a bit
    const out = drills.map((d: any) => ({
      id: String(d._id),
      subjectLabel: d.subjectLabel,
      topic: d.topic,
      difficulty: d.difficulty,
      score: d.score,
      outOf: d.outOf,
      createdAt: d.createdAt,
      questionCount: Array.isArray(d.questions) ? d.questions.length : 0,
    }));

    res.json(out);
  } catch (e: any) {
    res.status(500).json({ error: String(e?.message || e) });
  }
});

export default router;
