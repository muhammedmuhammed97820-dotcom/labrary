const express = require("express");
const path = require("path");
const { spawn } = require("child_process");
const { authenticate, requireAdmin } = require("../middleware/auth.middleware");

const router = express.Router();

let job = {
  running: false,
  startedAt: null,
  finishedAt: null,
  exitCode: null,
  output: []
};

router.get("/aco/status", authenticate, requireAdmin, (req, res) => {
  res.json({ ...job, output: job.output.slice(-80) });
});

router.post("/aco/full", authenticate, requireAdmin, (req, res) => {
  if (job.running) {
    return res.status(409).json({ message: "استيراد ACO يعمل حالياً.", job: { ...job, output: job.output.slice(-40) } });
  }

  const pdf = String(req.body?.pdf || "low").toLowerCase() === "high" ? "high" : "low";
  const limit = Number.parseInt(req.body?.limit, 10) || 0;
  const offset = Math.max(Number.parseInt(req.body?.offset, 10) || 0, 0);
  const concurrency = Math.min(Math.max(Number.parseInt(req.body?.concurrency, 10) || 1, 1), 3);
  const script = path.resolve(__dirname, "../scripts/import-aco.js");
  const args = [script, `--pdf=${pdf}`, "--cover", "--confirm", `--offset=${offset}`, `--concurrency=${concurrency}`];
  if (limit > 0) args.push(`--limit=${limit}`);

  job = { running: true, startedAt: new Date().toISOString(), finishedAt: null, exitCode: null, output: [] };
  const child = spawn(process.execPath, args, {
    cwd: path.resolve(__dirname, "../.."),
    env: process.env,
    windowsHide: true,
    stdio: ["ignore", "pipe", "pipe"]
  });

  const append = (chunk) => {
    const lines = String(chunk).split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    job.output.push(...lines);
    if (job.output.length > 200) job.output = job.output.slice(-200);
  };

  child.stdout.on("data", append);
  child.stderr.on("data", append);
  child.on("error", (error) => append(`خطأ في تشغيل المستورد: ${error.message}`));
  child.on("close", (code) => {
    job.running = false;
    job.finishedAt = new Date().toISOString();
    job.exitCode = code;
  });

  return res.status(202).json({
    message: "بدأ تنزيل كتب ACO وملفات PDF والأغلفة إلى قاعدة البيانات.",
    job: { running: true, startedAt: job.startedAt, pdf, limit, offset, concurrency }
  });
});

module.exports = router;
