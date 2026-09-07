require("dotenv").config();

const fs = require("fs");
const fsp = fs.promises;
const path = require("path");
const os = require("os");
const { execFileSync } = require("child_process");

const connectDatabase = require("../config/database");
const Book = require("../models/Book");
const { findOrCreateAuthor, findOrCreateCategory } = require("../services/book.service");
const { uploadBuffer } = require("../services/gridfs.service");

const ACO_REPO = "https://github.com/NYULibraries/aco-karms.git";
const ACO_SITE = "https://aco.dlib.nyu.edu";
const IIIF_SITE = "https://sites.dlib.nyu.edu/viewer/api";
const WORK_DIR = path.resolve(process.env.ACO_IMPORT_DIR || path.join(os.tmpdir(), "electronic-library-aco"));
const REPO_DIR = path.join(WORK_DIR, "aco-karms");
const PDF_DIR = path.join(WORK_DIR, "pdf-cache");
const COVER_DIR = path.join(WORK_DIR, "cover-cache");
const DEFAULT_BATCH = 25;

function arg(name, fallback = null) {
  const prefix = `--${name}=`;
  const item = process.argv.find((value) => value.startsWith(prefix));
  return item ? item.slice(prefix.length) : fallback;
}

function hasFlag(name) {
  return process.argv.includes(`--${name}`);
}

const limit = Math.max(Number.parseInt(arg("limit", "0"), 10) || 0, 0);
const offset = Math.max(Number.parseInt(arg("offset", "0"), 10) || 0, 0);
const pdfMode = String(arg("pdf", "none")).toLowerCase();
const downloadCovers = hasFlag("cover");
const concurrency = Math.max(Number.parseInt(arg("concurrency", "1"), 10) || 1, 1);
const confirm = hasFlag("confirm");

function xmlUnescape(value) {
  return String(value || "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/gi, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)));
}

function clean(value) {
  return xmlUnescape(String(value || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim());
}

function fieldBlock(xml, tag) {
  const match = xml.match(new RegExp(`<datafield\\b[^>]*tag=["']${tag}["'][^>]*>([\\s\\S]*?)</datafield>`, "i"));
  return match ? match[1] : "";
}

function subfields(block, code) {
  if (!block) return [];
  const values = [];
  const re = new RegExp(`<subfield\\b[^>]*code=["']${code}["'][^>]*>([\\s\\S]*?)</subfield>`, "gi");
  let match;
  while ((match = re.exec(block))) values.push(clean(match[1]));
  return values.filter(Boolean);
}

function firstField(xml, tags, codes) {
  for (const tag of tags) {
    const block = fieldBlock(xml, tag);
    for (const code of codes) {
      const value = subfields(block, code)[0];
      if (value) return value;
    }
  }
  return "";
}

function allFields(xml, tags, codes) {
  const values = [];
  for (const tag of tags) {
    const block = fieldBlock(xml, tag);
    for (const code of codes) values.push(...subfields(block, code));
  }
  return [...new Set(values.filter(Boolean))];
}

function parseMarcXml(xml, map) {
  const controlMatch = xml.match(/<controlfield\b[^>]*tag=["']001["'][^>]*>([\s\S]*?)<\/controlfield>/i);
  const control001 = clean(controlMatch ? controlMatch[1] : "");
  const title = firstField(xml, ["245", "246"], ["a", "b", "c"]);
  const author = firstField(xml, ["100", "110", "111", "700"], ["a"]);
  const category = firstField(xml, ["650", "651", "655"], ["a", "x"]);
  const description = firstField(xml, ["520", "500"], ["a"]);
  const publisher = firstField(xml, ["264", "260"], ["b"]);
  const date = firstField(xml, ["264", "260"], ["c"]);
  const isbn = firstField(xml, ["020"], ["a"]);
  const subjects = allFields(xml, ["650", "651", "655"], ["a", "x", "y", "z"]);
  const sourceUrl = firstField(xml, ["856"], ["u"]);
  const sourceId = map.get(control001) || "";

  return {
    control001,
    sourceId,
    title: clean(title),
    author: clean(author),
    category: clean(category),
    description: clean(description),
    publisher: clean(publisher),
    publishedYear: extractYear(date),
    isbn: clean(isbn).split(/\s+/)[0] || "",
    subjects,
    sourceUrl: clean(sourceUrl)
  };
}

function extractYear(value) {
  const match = String(value || "").match(/(1[0-9]{3}|20[0-9]{2})/);
  return match ? Number(match[1]) : undefined;
}

function loadSourceMap() {
  const files = [];
  walk(REPO_DIR, (file) => {
    if (path.basename(file).toLowerCase() === "bsn-se-map.csv") files.push(file);
  });

  const map = new Map();
  for (const file of files) {
    const content = fs.readFileSync(file, "utf8");
    for (const line of content.split(/\r?\n/)) {
      if (!line.trim() || /^\s*#/.test(line)) continue;
      const [key, values] = line.split(/,(.+)/);
      if (!key || !values) continue;
      const sourceIds = values.split("|").map((item) => item.trim()).filter(Boolean);
      if (!map.has(key.trim()) && sourceIds.length) map.set(key.trim(), sourceIds[0]);
    }
  }
  return map;
}

function walk(directory, callback) {
  if (!fs.existsSync(directory)) return;
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) walk(full, callback);
    else callback(full);
  }
}

function xmlFiles() {
  const files = [];
  walk(path.join(REPO_DIR, "work"), (file) => {
    if (file.toLowerCase().endsWith(".xml") && file.toLowerCase().includes(`${path.sep}marcxml_out${path.sep}`)) files.push(file);
  });
  return files.sort();
}

function sourceParts(sourceId) {
  const value = String(sourceId || "").trim();
  const match = value.match(/^([^_]+)_(aco\d+)$/i);
  if (!match) return null;
  return { provider: match[1], id: `${match[1]}_${match[2]}` };
}

function pdfUrl(sourceId, highResolution = false) {
  const parts = sourceParts(sourceId);
  if (!parts) return "";
  const suffix = highResolution ? "hi" : "lo";
  return `https://mc.dlib.nyu.edu/files/books/${parts.id}/${parts.id}_${suffix}.pdf`;
}

function coverUrl(sourceId) {
  const parts = sourceParts(sourceId);
  if (!parts) return "";
  return `${IIIF_SITE}/image/books/${parts.id}/1/full/1200,/0/default.jpg`;
}

async function downloadToFile(url, destination) {
  const response = await fetch(url, { headers: { "User-Agent": "ElectronicLibrary/1.0 ACO importer" } });
  if (!response.ok) throw new Error(`HTTP ${response.status} while downloading ${url}`);
  const buffer = Buffer.from(await response.arrayBuffer());
  await fsp.mkdir(path.dirname(destination), { recursive: true });
  await fsp.writeFile(destination, buffer);
  return buffer;
}

async function importOne(record, index, total) {
  if (!record.title || !record.author || !record.category) return { status: "skipped", reason: "missing core metadata" };
  if (!record.sourceId) return { status: "skipped", reason: "missing ACO source id" };

  const existing = await Book.findOne({ source: "ACO", sourceId: record.sourceId }).select("_id fileId coverImageId").lean();
  let fileId = existing?.fileId || null;
  let coverImageId = existing?.coverImageId || null;
  const lowPdfUrl = pdfUrl(record.sourceId, false);
  const highPdfUrl = pdfUrl(record.sourceId, true);
  const imageUrl = coverUrl(record.sourceId);

  if ((!existing || !fileId) && (pdfMode === "low" || pdfMode === "high")) {
    const url = pdfMode === "high" ? highPdfUrl : lowPdfUrl;
    if (url) {
      try {
        const cacheName = `${record.sourceId}_${pdfMode}.pdf`;
        const cachePath = path.join(PDF_DIR, cacheName);
        const buffer = fs.existsSync(cachePath) ? await fsp.readFile(cachePath) : await downloadToFile(url, cachePath);
        fileId = await uploadBuffer(buffer, cacheName, "application/pdf", {
          type: "book-file", source: "ACO", sourceId: record.sourceId, rights: "Public Domain"
        }, "libraryBooks");
      } catch (error) {
        console.warn(`  PDF skipped: ${record.title} -> ${error.message}`);
      }
    }
  }

  if ((!existing || !coverImageId) && downloadCovers && imageUrl) {
    try {
      const cacheName = `${record.sourceId}.jpg`;
      const cachePath = path.join(COVER_DIR, cacheName);
      const buffer = fs.existsSync(cachePath) ? await fsp.readFile(cachePath) : await downloadToFile(imageUrl, cachePath);
      coverImageId = await uploadBuffer(buffer, cacheName, "image/jpeg", {
        type: "book-cover", source: "ACO", sourceId: record.sourceId, rights: "Public Domain", sourceUrl: imageUrl
      }, "libraryCovers");
    } catch (error) {
      console.warn(`  Cover skipped: ${record.title} -> ${error.message}`);
    }
  }

  const authorDoc = await findOrCreateAuthor(record.author);
  const categoryDoc = await findOrCreateCategory(record.category);
  const sourceUrl = record.sourceUrl || `${ACO_SITE}/`;

  const payload = {
    title: record.title,
    author: authorDoc._id,
    category: categoryDoc._id,
    submittedAuthorName: "",
    submittedCategoryName: "",
    description: record.description,
    publishedYear: record.publishedYear,
    rating: 0,
    isAvailable: Boolean(fileId || lowPdfUrl),
    fileId,
    coverImageId,
    filePath: fileId ? "" : lowPdfUrl,
    coverImage: "",
    status: "approved",
    submittedBy: null,
    reviewedAt: new Date(),
    rejectionReason: "",
    source: "ACO",
    sourceId: record.sourceId,
    sourceUrl,
    sourceFileUrl: lowPdfUrl,
    sourceProvider: record.publisher || "",
    rights: "Public Domain",
    isbn: record.isbn,
    subjects: record.subjects
  };

  if (existing) await Book.updateOne({ _id: existing._id }, { $set: payload });
  else await Book.create(payload);

  console.log(`[${index}/${total}] ${record.title} | PDF: ${fileId ? "محلي" : "رابط"} | الغلاف: ${coverImageId ? "محلي" : "غير متوفر"}`);
  return { status: "imported", fileId: Boolean(fileId), coverImageId: Boolean(coverImageId) };
}

async function ensureRepository() {
  await fsp.mkdir(WORK_DIR, { recursive: true });
  if (!fs.existsSync(path.join(REPO_DIR, ".git"))) {
    console.log("جلب فهرس ACO الرسمي من GitHub...");
    execFileSync("git", ["clone", "--depth", "1", ACO_REPO, REPO_DIR], { stdio: "inherit" });
  } else {
    console.log("تحديث فهرس ACO الرسمي...");
    execFileSync("git", ["-C", REPO_DIR, "pull", "--ff-only"], { stdio: "inherit" });
  }
}

async function main() {
  console.log("\n=== مستورد Arabic Collections Online لمكتبة Electronic Library ===");
  console.log(`وضع PDF: ${pdfMode} | تنزيل الأغلفة: ${downloadCovers ? "نعم" : "لا"}`);
  console.log(`الحد: ${limit || "كل السجلات"} | البداية: ${offset}`);

  if (!["none", "low", "high"].includes(pdfMode)) {
    console.error(`وضع PDF غير صالح: ${pdfMode}. استخدم none أو low أو high.`);
    process.exitCode = 2;
    return;
  }

  if ((pdfMode !== "none" || downloadCovers) && !confirm) {
    console.error("\nهذه العملية قد تحتاج مساحة تخزين ضخمة. أضف --confirm للتنفيذ.");
    console.error("مثال: npm run import:aco -- --pdf=low --cover --confirm");
    process.exitCode = 2;
    return;
  }

  await connectDatabase();
  await ensureRepository();

  const map = loadSourceMap();
  const files = xmlFiles();
  const selected = files.slice(offset, limit ? offset + limit : undefined);
  console.log(`تم العثور على ${files.length} سجل XML؛ ستتم معالجة ${selected.length}.`);

  let imported = 0;
  let skipped = 0;
  let failed = 0;
  let withPdf = 0;
  let withCover = 0;

  for (let i = 0; i < selected.length; i += concurrency) {
    const batch = selected.slice(i, i + concurrency);
    const results = await Promise.all(batch.map(async (file, batchIndex) => {
      try {
        const xml = await fsp.readFile(file, "utf8");
        const record = parseMarcXml(xml, map);
        return await importOne(record, offset + i + batchIndex + 1, files.length);
      } catch (error) {
        console.error(`فشل: ${file}: ${error.message}`);
        return { status: "failed" };
      }
    }));

    for (const result of results) {
      if (result.status === "imported") {
        imported += 1;
        if (result.fileId) withPdf += 1;
        if (result.coverImageId) withCover += 1;
      } else if (result.status === "skipped") skipped += 1;
      else failed += 1;
    }
  }

  console.log("\n=== اكتمل الاستيراد ===");
  console.log(`تمت الإضافة/التحديث: ${imported}`);
  console.log(`PDF داخل GridFS: ${withPdf}`);
  console.log(`الأغلفة داخل GridFS: ${withCover}`);
  console.log(`تم التجاوز: ${skipped}`);
  console.log(`فشل: ${failed}`);
  console.log("ملاحظة: صورة المؤلف ليست جزءاً مضموناً من بيانات ACO؛ لا يتم اختلاق صورة أو تنزيل صورة غير موثقة الحقوق.");

  await require("mongoose").connection.close();
}

main().catch(async (error) => {
  console.error("خطأ عام في مستورد ACO:", error);
  try { await require("mongoose").connection.close(); } catch (_) {}
  process.exitCode = 1;
});