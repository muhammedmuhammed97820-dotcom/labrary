const express = require("express");
const path = require("path");
const { spawn } = require("child_process");
const { authenticate, requireAdmin } = require("../middleware/auth.middleware");

const router = express.Router();

let heartbeatTimer = null;
let job = {
  running: false,
  startedAt: null,
  finishedAt: null,
  exitCode: null,
  output: [],
  total: 0,
  processed: 0,
  remaining: 0,
  percent: 0,
  pdfDownloaded: 0,
  coversDownloaded: 0,
  current: "",
  etaSeconds: null,
  stage: "idle"
};

function addOutput(message) {
  const text = String(message || "").trim();
  if (!text) return;
  job.output.push(text);
  if (job.output.length > 200) job.output = job.output.slice(-200);
}

function updateProgressFromLine(line) {
  const text = String(line).trim();

  const totalMatch = text.match(/تم العثور على\s+(\d+)\s+سجل XML؛\s*ستتم معالجة\s+(\d+)/);
  if (totalMatch) {
    const total = Number(totalMatch[2]) || 0;
    job.total = Math.max(job.total, total);
    job.remaining = Math.max(job.total - job.processed, 0);
    job.stage = total > 0 ? "importing" : "empty";
    if (job.total === 0) job.percent = 100;
    return;
  }

  const match = text.match(/^\[(\d+)\/(\d+)\]\s+(.+?)\s+\|\s+PDF:\s+(.+?)\s+\|\s+الغلاف:\s+(.+)$/);
  if (!match) return;

  const processed = Number(match[1]) || 0;
  const total = Number(match[2]) || 0;
  const current = match[3].trim();
  const pdfState = match[4].trim();
  const coverState = match[5].trim();

  job.processed = Math.max(job.processed, processed);
  job.total = Math.max(job.total, total);
  job.remaining = Math.max(job.total - job.processed, 0);
  job.percent = job.total ? Math.min(100, Math.round((job.processed / job.total) * 1000) / 10) : 0;
  job.current = current;
  job.stage = "importing";
  if (pdfState === "محلي") job.pdfDownloaded += 1;
  if (coverState === "محلي") job.coversDownloaded += 1;

  if (job.startedAt && job.processed > 0) {
    const elapsedSeconds = (Date.now() - new Date(job.startedAt).getTime()) / 1000;
    const rate = job.processed / Math.max(elapsedSeconds, 1);
    job.etaSeconds = rate > 0 ? Math.round(job.remaining / rate) : null;
  }
}

router.get("/aco/status", authenticate, requireAdmin, (req, res) => {
  res.json({ ...job, output: job.output.slice(-80) });
});

router.post("/aco/full", authenticate, requireAdmin, (req, res) => {
  if (job.running) {
    return res.status(409).json({ message: "استيراد ACO يعمل حالياً.", job: { ...job, output: job.output.slice(-40) } });
  }

  const requestedPdf = String(req.body?.pdf || "low").toLowerCase();
  const pdf = ["none", "low", "high"].includes(requestedPdf) ? requestedPdf : "low";
  const limit = Number.parseInt(req.body?.limit, 10) || 0;
  const offset = Math.max(Number.parseInt(req.body?.offset, 10) || 0, 0);
  const concurrency = Math.min(Math.max(Number.parseInt(req.body?.concurrency, 10) || 1, 1), 3);
  const script = path.resolve(__dirname, "../scripts/import-aco.js");
  const args = [script, `--pdf=${pdf}`, "--cover", "--confirm", `--offset=${offset}`, `--concurrency=${concurrency}`];
  if (limit > 0) args.push(`--limit=${limit}`);

  job = {
    running: true,
    startedAt: new Date().toISOString(),
    finishedAt: null,
    exitCode: null,
    output: [],
    total: 0,
    processed: 0,
    remaining: 0,
    percent: 0,
    pdfDownloaded: 0,
    coversDownloaded: 0,
    current: "بدء تشغيل المستورد...",
    etaSeconds: null,
    stage: "starting"
  };

  addOutput(`بدأ مستورد ACO. وضع PDF: ${pdf === "none" ? "بدون تنزيل PDF" : pdf === "low" ? "منخفض" : "عالي"}.`);
  addOutput("جاري الاتصال بقاعدة البيانات وتجهيز فهرس ACO...");

  const child = spawn(process.execPath, args, {
    cwd: path.resolve(__dirname, "../.."),
    env: process.env,
    windowsHide: true,
    stdio: ["ignore", "pipe", "pipe"]
  });

  const append = (chunk) => {
    const lines = String(chunk).split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    for (const line of lines) {
      addOutput(line);
      updateProgressFromLine(line);
    }
  };

  child.stdout.on("data", append);
  child.stderr.on("data", append);
  child.on("error", (error) => {
    job.stage = "error";
    append(`خطأ في تشغيل المستورد: ${error.message}`);
  });
  child.on("close", (code) => {
    if (heartbeatTimer) {
      clearInterval(heartbeatTimer);
      heartbeatTimer = null;
    }
    job.running = false;
    job.finishedAt = new Date().toISOString();
    job.exitCode = code;
    job.remaining = Math.max(job.total - job.processed, 0);
    job.stage = code === 0 ? "completed" : "failed";
    if (code === 0) job.percent = 100;
    addOutput(code === 0 ? "اكتمل الاستيراد بنجاح." : `انتهى المستورد بفشل. رمز الخروج: ${code}.`);
  });

  heartbeatTimer = setInterval(() => {
    if (!job.running) return;
    const elapsed = Math.round((Date.now() - new Date(job.startedAt).getTime()) / 1000);
    if (job.processed === 0 && elapsed > 0 && elapsed % 5 === 0) {
      addOutput(`ما زال المستورد يعمل... المرحلة: ${job.stage}. الزمن المنقضي: ${elapsed} ثانية.`);
    }
  }, 1000);

  return res.status(202).json({
    message: "بدأ تنزيل كتب ACO وملفات PDF والأغلفة إلى قاعدة البيانات.",
    job: { running: true, startedAt: job.startedAt, pdf, limit, offset, concurrency }
  });
});

module.exports = router;
