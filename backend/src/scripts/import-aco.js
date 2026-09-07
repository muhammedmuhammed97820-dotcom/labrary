require("dotenv").config();

const fs = require("fs");
const fsp = fs.promises;
const path = require("path");
const os = require("os");
const mongoose = require("mongoose");

const connectDatabase = require("../config/database");
const Book = require("../models/Book");
const { findOrCreateAuthor, findOrCreateCategory } = require("../services/book.service");
const { uploadBuffer } = require("../services/gridfs.service");

const ACO_SITE = "https://aco.dlib.nyu.edu";
const ACO_RAW = "https://raw.githubusercontent.com/NYULibraries/aco-karms/master/work";
const WORK_DIR = path.resolve(process.env.ACO_IMPORT_DIR || path.join(os.tmpdir(), "electronic-library-aco"));
const PDF_DIR = path.join(WORK_DIR, "pdf-cache");
const COVER_DIR = path.join(WORK_DIR, "cover-cache");

function arg(name, fallback = null) {
  const prefix = `--${name}=`;
  const value = process.argv.find((item) => item.startsWith(prefix));
  return value ? value.slice(prefix.length) : fallback;
}
function hasFlag(name) { return process.argv.includes(`--${name}`); }

const limit = Math.max(Number.parseInt(arg("limit", "0"), 10) || 0, 0);
const offset = Math.max(Number.parseInt(arg("offset", "0"), 10) || 0, 0);
const pdfMode = String(arg("pdf", "none")).toLowerCase();
const downloadCovers = hasFlag("cover");
const concurrency = Math.min(Math.max(Number.parseInt(arg("concurrency", "1"), 10) || 1, 1), 3);
const confirm = hasFlag("confirm");

function clean(value) {
  return String(value || "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/\s+/g, " ").trim();
}

function hasArabic(value) {
  return /[\u0600-\u06ff\u0750-\u077f\u08a0-\u08ff]/u.test(String(value || ""));
}

function extractYear(value) {
  const match = String(value || "").match(/(1[0-9]{3}|20[0-9]{2})/);
  return match ? Number(match[1]) : undefined;
}

function extractAcoId(value) {
  const match = String(value || "").match(/(?:^|[^a-z0-9])([a-z0-9]+_aco\d{4,})(?:[^a-z0-9]|$)/i);
  return match ? match[1] : "";
}

function sourceParts(sourceId) {
  const match = String(sourceId || "").match(/^([^_]+)_aco(\d+)$/i);
  return match ? { id: `${match[1]}_aco${match[2]}`, provider: match[1] } : null;
}

function normalizeRecord(record) {
  const sourceId = String(record.sourceId || "").trim();
  const title = clean(record.arabicTitle || record.title);
  const author = clean(record.arabicAuthor || record.author) || "مؤلف غير محدد";
  return {
    ...record,
    sourceId,
    title,
    author,
    category: clean(record.category) || "غير مصنف",
    description: clean(record.description),
    publisher: clean(record.publisher),
    publishedYear: record.publishedYear,
    isbn: clean(record.isbn).split(/\s+/)[0] || "",
    subjects: [...new Set((record.subjects || []).map(clean).filter(Boolean))],
    sourceUrl: clean(record.sourceUrl),
    language: "ara"
  };
}

function fieldValues(fields, tag, codes) {
  const raw = fields.get(tag) || "";
  const out = [];
  for (const field of raw.split("\x1e")) {
    const parts = field.split("\x1f");
    for (let i = 1; i < parts.length; i++) {
      const code = parts[i][0];
      if (codes.includes(code)) {
        const value = clean(parts[i].slice(1));
        if (value) out.push(value);
      }
    }
  }
  return out;
}

function firstField(fields, tags, codes) {
  for (const tag of tags) {
    const value = fieldValues(fields, tag, codes)[0];
    if (value) return value;
  }
  return "";
}

function linkedArabicField(fields, targetTag, codes) {
  const raw = fields.get("880") || "";
  const candidates = [];
  for (const field of raw.split("\x1e")) {
    const parts = field.split("\x1f");
    let link = "";
    const values = [];
    for (let i = 1; i < parts.length; i++) {
      const code = parts[i][0];
      const value = clean(parts[i].slice(1));
      if (code === "6") link = value;
      if (codes.includes(code) && value) values.push(value);
    }
    if (link.startsWith(`${targetTag}-`) && values.length) candidates.push(values.join(" "));
  }
  return candidates.find(hasArabic) || "";
}

function isArabicMarc(fields) {
  const fixed008 = (fields.get("008") || "").split("\x1e")[0];
  const language008 = fixed008.length >= 38 ? fixed008.slice(35, 38).toLowerCase() : "";
  const language041 = fieldValues(fields, "041", ["a", "d", "e", "j"]).map((v) => v.toLowerCase());
  if (language008 === "ara" || language041.some((v) => /(^|[^a-z])ara([^a-z]|$)/i.test(v))) return true;
  if (language008 && language008 !== "|||" && language008 !== "###" && /^[a-z]{3}$/.test(language008)) return false;
  if (language041.length && language041.some((v) => /^[a-z]{3}$/.test(v)) && !language041.includes("ara")) return false;
  // Some older ACO records have incomplete language coding. Require Arabic text
  // in the Arabic linked title when the MARC language field is missing.
  return hasArabic(linkedArabicField(fields, "245", ["a", "b", "c"])) || hasArabic(firstField(fields, ["245"], ["a", "b", "c"]));
}

function parseIso2709Record(recordBuffer) {
  if (recordBuffer.length < 25) return null;
  const leader = recordBuffer.subarray(0, 24).toString("ascii");
  const baseAddress = Number.parseInt(leader.slice(12, 17), 10);
  if (!Number.isFinite(baseAddress) || baseAddress < 25 || baseAddress > recordBuffer.length) return null;

  const directory = recordBuffer.subarray(24, baseAddress - 1);
  const fields = new Map();
  for (let i = 0; i + 12 <= directory.length; i += 12) {
    const tag = directory.subarray(i, i + 3).toString("ascii");
    const length = Number.parseInt(directory.subarray(i + 3, i + 7).toString("ascii"), 10);
    const start = Number.parseInt(directory.subarray(i + 7, i + 12).toString("ascii"), 10);
    if (!/^\d{3}$/.test(tag) || !Number.isFinite(length) || !Number.isFinite(start)) continue;
    const raw = recordBuffer.subarray(baseAddress + start, baseAddress + start + Math.max(length - 1, 0));
    const value = raw.toString("utf8");
    fields.set(tag, fields.has(tag) ? `${fields.get(tag)}\x1e${value}` : value);
  }

  if (!isArabicMarc(fields)) return null;

  const control001 = clean((fields.get("001") || "").split("\x1e")[0]);
  const sourceUrl = firstField(fields, ["856"], ["u"]);
  const arabicTitle = linkedArabicField(fields, "245", ["a", "b", "c"]);
  const arabicAuthor = linkedArabicField(fields, "100", ["a", "b", "c", "d", "q", "e"]);
  const primaryAuthor = ["100", "110", "111", "700", "710", "711"]
    .flatMap((tag) => fieldValues(fields, tag, ["a", "b", "c", "d", "q", "e"]))
    .find(Boolean) || "";
  const title = arabicTitle || firstField(fields, ["245", "246"], ["a", "b", "c"]);
  const author = arabicAuthor || primaryAuthor;
  const subjects = ["650", "651", "655"].flatMap((tag) => fieldValues(fields, tag, ["a", "x", "y", "z"]));

  return normalizeRecord({
    control001,
    sourceId: extractAcoId(sourceUrl) || control001,
    title,
    arabicTitle,
    author,
    arabicAuthor,
    category: firstField(fields, ["650", "651", "655"], ["a", "x"]),
    description: firstField(fields, ["520", "500"], ["a"]),
    publisher: firstField(fields, ["264", "260"], ["b"]),
    publishedYear: extractYear(firstField(fields, ["264", "260"], ["c"])),
    isbn: firstField(fields, ["020"], ["a"]),
    subjects,
    sourceUrl
  });
}

function parseMarcFile(buffer) {
  const records = [];
  let cursor = 0;
  while (cursor + 24 <= buffer.length) {
    while (cursor < buffer.length && [0x1e, 0x0a, 0x0d, 0x20].includes(buffer[cursor])) cursor++;
    if (cursor + 24 > buffer.length) break;
    const recordLength = Number.parseInt(buffer.subarray(cursor, cursor + 5).toString("ascii"), 10);
    if (!Number.isFinite(recordLength) || recordLength < 25 || cursor + recordLength > buffer.length) break;
    const record = parseIso2709Record(buffer.subarray(cursor, cursor + recordLength));
    if (record) records.push(record);
    cursor += recordLength;
  }
  return records;
}

async function fetchResponse(url) {
  const response = await fetch(url, {
    headers: {
      "User-Agent": "ElectronicLibrary/1.0 ACO importer",
      Accept: "text/html,application/pdf,image/*,*/*;q=0.8"
    },
    redirect: "follow"
  });
  if (!response.ok) throw new Error(`HTTP ${response.status} ${response.statusText}`);
  return response;
}

async function downloadToFile(url, destination, validator) {
  if (fs.existsSync(destination)) {
    const cached = await fsp.readFile(destination);
    if (!validator || validator(cached)) return cached;
    await fsp.unlink(destination).catch(() => {});
  }
  const response = await fetchResponse(url);
  const buffer = Buffer.from(await response.arrayBuffer());
  if (validator && !validator(buffer, response.headers.get("content-type") || "")) {
    throw new Error(`المحتوى المستلم ليس الملف المطلوب: ${response.headers.get("content-type") || "unknown"}`);
  }
  await fsp.mkdir(path.dirname(destination), { recursive: true });
  await fsp.writeFile(destination, buffer);
  return buffer;
}

function isPdf(buffer, contentType = "") {
  return buffer.subarray(0, 5).toString("ascii") === "%PDF-" || /application\/pdf/i.test(contentType);
}
function isImage(buffer, contentType = "") {
  const magic = buffer.subarray(0, 12);
  return magic.subarray(0, 3).toString("binary") === "\xff\xd8\xff" ||
    magic.subarray(0, 8).toString("binary") === "\x89PNG\r\n\x1a\n" ||
    magic.subarray(0, 4).toString("ascii") === "RIFF" ||
    /image\/(jpeg|png|webp)/i.test(contentType);
}

function absoluteUrl(base, href) {
  try { return new URL(href, base).href; } catch (_) { return ""; }
}

function extractHtmlLinks(html, pageUrl) {
  const links = [];
  const re = /<(?:a|link|img|source|meta)\b[^>]+(?:href|src|content)=["']([^"']+)["'][^>]*>/gi;
  let match;
  while ((match = re.exec(html))) {
    const url = absoluteUrl(pageUrl, match[1]);
    if (url) links.push(url);
  }
  return [...new Set(links)];
}

async function resolveAcoAssets(record) {
  const pageUrl = `${ACO_SITE}/book/${encodeURIComponent(record.sourceId)}/1`;
  let html = "";
  try {
    const response = await fetchResponse(pageUrl);
    html = await response.text();
  } catch (error) {
    if (record.sourceUrl && /^https?:\/\//i.test(record.sourceUrl)) {
      try {
        const response = await fetchResponse(record.sourceUrl);
        html = await response.text();
      } catch (_) {}
    }
  }

  const links = html ? extractHtmlLinks(html, pageUrl) : [];
  const pdfs = links.filter((url) => /\.pdf(?:[?#]|$)/i.test(url));
  const lowPdf = pdfs.find((url) => /(^|[-_./])(lo|low)([-_./]|$)|low-resolution/i.test(url));
  const highPdf = pdfs.find((url) => /(^|[-_./])(hi|high)([-_./]|$)|high-resolution/i.test(url));
  const anyPdf = pdfs[0] || "";

  let cover = "";
  const metaImage = html.match(/<meta\b[^>]*(?:property|name)=["'](?:og:image|twitter:image)["'][^>]*content=["']([^"']+)["'][^>]*>/i);
  if (metaImage) cover = absoluteUrl(pageUrl, metaImage[1]);
  if (!cover) {
    cover = links.find((url) => /iiif|image|thumbnail|cover/i.test(url) && !/\.pdf(?:[?#]|$)/i.test(url)) || "";
  }

  return {
    pageUrl,
    lowPdf: lowPdf || anyPdf,
    highPdf: highPdf || anyPdf,
    cover
  };
}

async function getAcoRecords() {
  await fsp.mkdir(WORK_DIR, { recursive: true });
  const sources = [
    { name: "mrc_out_all.mrc", url: `${ACO_RAW}/mrc_out_all.mrc` },
    { name: "mrc_out_all-3.mrc", url: `${ACO_RAW}/mrc_out_all-3.mrc` }
  ];
  const all = [];
  const seen = new Set();
  for (const source of sources) {
    const destination = path.join(WORK_DIR, source.name);
    try {
      console.log(`جاري جلب ${source.name} من مستودع ACO الرسمي...`);
      const buffer = await downloadToFile(source.url, destination);
      const records = parseMarcFile(buffer);
      console.log(`${source.name}: ${records.length} سجل عربي مطابق للغة ara`);
      for (const record of records) {
        const key = record.sourceId || `${record.control001}|${record.title}`;
        if (!key || seen.has(key)) continue;
        seen.add(key);
        all.push(record);
      }
    } catch (error) {
      console.warn(`تعذر جلب ${source.name}: ${error.message}`);
    }
  }
  return all;
}

async function importOne(record, index, total) {
  if (!record.title || !record.sourceId || !hasArabic(record.title)) return { status: "skipped" };

  const existing = await Book.findOne({ source: "ACO", sourceId: record.sourceId })
    .select("_id fileId coverImageId")
    .lean();
  let fileId = existing?.fileId || null;
  let coverImageId = existing?.coverImageId || null;

  const assets = await resolveAcoAssets(record);
  const selectedPdfUrl = pdfMode === "high" ? assets.highPdf : assets.lowPdf;

  if (!fileId && (pdfMode === "low" || pdfMode === "high") && selectedPdfUrl) {
    try {
      const name = `${record.sourceId}_${pdfMode}.pdf`;
      const buffer = await downloadToFile(selectedPdfUrl, path.join(PDF_DIR, name), isPdf);
      if (!isPdf(buffer)) throw new Error("الملف ليس PDF صالحاً");
      fileId = await uploadBuffer(
        buffer,
        name,
        "application/pdf",
        { type: "book-file", source: "ACO", sourceId: record.sourceId, rights: "Public Domain", sourceUrl: selectedPdfUrl },
        "libraryBooks"
      );
    } catch (error) {
      console.warn(`  PDF skipped: ${record.title} -> ${error.message}`);
    }
  }

  if (!coverImageId && downloadCovers && assets.cover) {
    try {
      const name = `${record.sourceId}.jpg`;
      const buffer = await downloadToFile(assets.cover, path.join(COVER_DIR, name), isImage);
      if (!isImage(buffer)) throw new Error("الصورة غير صالحة");
      coverImageId = await uploadBuffer(
        buffer,
        name,
        "image/jpeg",
        { type: "book-cover", source: "ACO", sourceId: record.sourceId, rights: "Public Domain", sourceUrl: assets.cover },
        "libraryCovers"
      );
    } catch (error) {
      console.warn(`  Cover skipped: ${record.title} -> ${error.message}`);
    }
  }

  const author = await findOrCreateAuthor(record.author);
  const category = await findOrCreateCategory(record.category);
  const payload = {
    title: record.title,
    author: author._id,
    category: category._id,
    submittedAuthorName: "",
    submittedCategoryName: "",
    description: record.description,
    publishedYear: record.publishedYear,
    language: "ara",
    rating: 0,
    isAvailable: Boolean(fileId),
    fileId,
    coverImageId,
    filePath: "",
    coverImage: "",
    status: "approved",
    submittedBy: null,
    reviewedAt: new Date(),
    rejectionReason: "",
    source: "ACO",
    sourceId: record.sourceId,
    sourceUrl: assets.pageUrl || record.sourceUrl || `${ACO_SITE}/`,
    sourceFileUrl: selectedPdfUrl || "",
    sourceProvider: sourceParts(record.sourceId)?.provider || "",
    rights: "Public Domain",
    isbn: record.isbn,
    subjects: record.subjects
  };

  if (existing) await Book.updateOne({ _id: existing._id }, { $set: payload });
  else await Book.create(payload);

  console.log(`[${index}/${total}] ${record.title} | المؤلف: ${record.author} | PDF: ${fileId ? "محلي" : "غير محفوظ"} | الغلاف: ${coverImageId ? "محلي" : "غير متوفر"}`);
  return { status: "imported", fileId: Boolean(fileId), coverImageId: Boolean(coverImageId) };
}

async function main() {
  console.log("\n=== مستورد Arabic Collections Online — العربية فقط ===");
  console.log(`وضع PDF: ${pdfMode} | تنزيل الأغلفة: ${downloadCovers ? "نعم" : "لا"}`);
  console.log(`الحد: ${limit || "كل الكتب"} | البداية: ${offset} | التوازي: ${concurrency}`);

  if (!["none", "low", "high"].includes(pdfMode)) throw new Error(`وضع PDF غير صالح: ${pdfMode}`);
  if ((pdfMode !== "none" || downloadCovers) && !confirm) throw new Error("أضف --confirm للتنفيذ لأن التنزيل قد يحتاج مساحة كبيرة.");

  await connectDatabase();
  console.log("[1/3] جلب وفهرسة سجلات ACO العربية...");
  const allRecords = await getAcoRecords();
  console.log(`[2/3] إجمالي الكتب العربية بعد إزالة التكرار: ${allRecords.length}`);
  if (!allRecords.length) throw new Error("لم يتم العثور على سجلات عربية. تحقق من ملفات MARC أو ترميز اللغة.");

  const selected = allRecords.slice(offset, limit ? offset + limit : undefined);
  console.log(`[3/3] ستتم معالجة ${selected.length} كتاباً عربياً.`);

  let imported = 0, skipped = 0, failed = 0, withPdf = 0, withCover = 0;
  for (let i = 0; i < selected.length; i += concurrency) {
    const batch = selected.slice(i, i + concurrency);
    const results = await Promise.all(batch.map(async (record, batchIndex) => {
      try { return await importOne(record, offset + i + batchIndex + 1, allRecords.length); }
      catch (error) { console.error(`فشل: ${record.title}: ${error.message}`); return { status: "failed" }; }
    }));
    for (const result of results) {
      if (result.status === "imported") { imported++; if (result.fileId) withPdf++; if (result.coverImageId) withCover++; }
      else if (result.status === "skipped") skipped++;
      else failed++;
    }
  }

  console.log("\n=== اكتمل الاستيراد ===");
  console.log(`تمت الإضافة/التحديث: ${imported}`);
  console.log(`PDF داخل GridFS: ${withPdf}`);
  console.log(`الأغلفة داخل GridFS: ${withCover}`);
  console.log(`تم التجاوز: ${skipped}`);
  console.log(`فشل: ${failed}`);
  console.log("تم حفظ اللغة ara فقط، ولا يتم إنشاء صورة مؤلف من مصدر غير موثوق.");
  await mongoose.connection.close();
}

main().catch(async (error) => {
  console.error(`خطأ عام في مستورد ACO: ${error.stack || error.message}`);
  try { await mongoose.connection.close(); } catch (_) {}
  process.exitCode = 1;
});
