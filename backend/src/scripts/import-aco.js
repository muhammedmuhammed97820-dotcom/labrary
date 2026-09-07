require("dotenv").config();

const fs = require("fs");
const fsp = fs.promises;
const path = require("path");
const os = require("os");

const connectDatabase = require("../config/database");
const Book = require("../models/Book");
const { findOrCreateAuthor, findOrCreateCategory } = require("../services/book.service");
const { uploadBuffer } = require("../services/gridfs.service");

const ACO_SITE = "https://aco.dlib.nyu.edu";
const ACO_RAW = "https://raw.githubusercontent.com/NYULibraries/aco-karms/master/work";
const IIIF_SITE = "https://sites.dlib.nyu.edu/viewer/api";
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

function normalizeRecord(record) {
  const sourceId = String(record.sourceId || "").trim();
  return {
    ...record,
    sourceId,
    title: clean(record.title),
    author: clean(record.author) || "مؤلف غير محدد",
    category: clean(record.category) || "غير مصنف",
    description: clean(record.description),
    publisher: clean(record.publisher),
    publishedYear: record.publishedYear,
    isbn: clean(record.isbn).split(/\s+/)[0] || "",
    subjects: [...new Set((record.subjects || []).map(clean).filter(Boolean))],
    sourceUrl: clean(record.sourceUrl)
  };
}

function extractAcoId(value) {
  const match = String(value || "").match(/(?:^|[^a-z0-9])([a-z0-9]+_aco\d{4,})(?:[^a-z0-9]|$)/i);
  return match ? match[1] : "";
}
function extractYear(value) {
  const match = String(value || "").match(/(1[0-9]{3}|20[0-9]{2})/);
  return match ? Number(match[1]) : undefined;
}

function xmlField(xml, tag) {
  const match = xml.match(new RegExp(`<datafield\\b[^>]*tag=["']${tag}["'][^>]*>([\\s\\S]*?)</datafield>`, "i"));
  return match ? match[1] : "";
}
function xmlValues(xml, tag, codes) {
  const block = xmlField(xml, tag);
  if (!block) return [];
  const out = [];
  for (const code of codes) {
    const re = new RegExp(`<subfield\\b[^>]*code=["']${code}["'][^>]*>([\\s\\S]*?)</subfield>`, "gi");
    let match;
    while ((match = re.exec(block))) out.push(clean(match[1]));
  }
  return out.filter(Boolean);
}
function firstXml(xml, tags, codes) {
  for (const tag of tags) {
    const value = xmlValues(xml, tag, codes)[0];
    if (value) return value;
  }
  return "";
}
function parseMarcXml(xml) {
  const control = xml.match(/<controlfield\b[^>]*tag=["']001["'][^>]*>([\s\S]*?)<\/controlfield>/i);
  const control001 = clean(control ? control[1] : "");
  const sourceUrl = firstXml(xml, ["856"], ["u"]);
  return normalizeRecord({
    control001,
    sourceId: extractAcoId(sourceUrl) || control001,
    title: firstXml(xml, ["245", "246"], ["a", "b", "c"]),
    author: firstXml(xml, ["100", "110", "111", "700"], ["a"]),
    category: firstXml(xml, ["650", "651", "655"], ["a", "x"]),
    description: firstXml(xml, ["520", "500"], ["a"]),
    publisher: firstXml(xml, ["264", "260"], ["b"]),
    publishedYear: extractYear(firstXml(xml, ["264", "260"], ["c"])),
    isbn: firstXml(xml, ["020"], ["a"]),
    subjects: ["650", "651", "655"].flatMap((tag) => xmlValues(xml, tag, ["a", "x", "y", "z"])),
    sourceUrl
  });
}

// ISO-2709 must be parsed with byte offsets. Converting the whole record to UTF-8
// first corrupts directory offsets when Arabic UTF-8 characters are present.
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

  const control = (tag) => clean((fields.get(tag) || "").split("\x1e")[0]);
  const values = (tag, codes) => {
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
  };
  const first = (tags, codes) => {
    for (const tag of tags) {
      const value = values(tag, codes)[0];
      if (value) return value;
    }
    return "";
  };

  const control001 = control("001");
  const sourceUrl = first(["856"], ["u"]);
  return normalizeRecord({
    control001,
    sourceId: extractAcoId(sourceUrl) || control001,
    title: first(["245", "246"], ["a", "b", "c"]),
    author: first(["100", "110", "111", "700"], ["a"]),
    category: first(["650", "651", "655"], ["a", "x"]),
    description: first(["520", "500"], ["a"]),
    publisher: first(["264", "260"], ["b"]),
    publishedYear: extractYear(first(["264", "260"], ["c"])),
    isbn: first(["020"], ["a"]),
    subjects: [...new Set(["650", "651", "655"].flatMap((tag) => values(tag, ["a", "x", "y", "z"])))],
    sourceUrl
  });
}

function parseMarcFile(buffer) {
  const records = [];
  let cursor = 0;
  while (cursor + 24 <= buffer.length) {
    while (cursor < buffer.length && (buffer[cursor] === 0x1e || buffer[cursor] === 0x0a || buffer[cursor] === 0x0d || buffer[cursor] === 0x20)) cursor++;
    if (cursor + 24 > buffer.length) break;
    const lengthText = buffer.subarray(cursor, cursor + 5).toString("ascii");
    const recordLength = Number.parseInt(lengthText, 10);
    if (!Number.isFinite(recordLength) || recordLength < 25 || cursor + recordLength > buffer.length) break;
    const record = parseIso2709Record(buffer.subarray(cursor, cursor + recordLength));
    if (record) records.push(record);
    cursor += recordLength;
  }
  return records;
}

async function downloadToFile(url, destination) {
  if (fs.existsSync(destination)) return fsp.readFile(destination);
  const response = await fetch(url, { headers: { "User-Agent": "ElectronicLibrary/1.0 ACO importer" } });
  if (!response.ok) throw new Error(`HTTP ${response.status} while downloading ${url}`);
  const buffer = Buffer.from(await response.arrayBuffer());
  await fsp.mkdir(path.dirname(destination), { recursive: true });
  await fsp.writeFile(destination, buffer);
  return buffer;
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
      console.log(`${source.name}: ${records.length} سجل MARC`);
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

function sourceParts(sourceId) {
  const match = String(sourceId || "").match(/^([^_]+)_aco(\d+)$/i);
  return match ? { id: `${match[1]}_aco${match[2]}`, provider: match[1] } : null;
}
function pdfUrl(sourceId, high = false) {
  const parts = sourceParts(sourceId);
  return parts ? `https://mc.dlib.nyu.edu/files/books/${parts.id}/${parts.id}_${high ? "hi" : "lo"}.pdf` : "";
}
function coverUrl(sourceId) {
  const parts = sourceParts(sourceId);
  return parts ? `${IIIF_SITE}/image/books/${parts.id}/1/full/1200,/0/default.jpg` : "";
}

async function importOne(record, index, total) {
  if (!record.title || !record.sourceId) return { status: "skipped" };
  const existing = await Book.findOne({ source: "ACO", sourceId: record.sourceId }).select("_id fileId coverImageId").lean();
  let fileId = existing?.fileId || null;
  let coverImageId = existing?.coverImageId || null;
  const lowUrl = pdfUrl(record.sourceId, false);
  const highUrl = pdfUrl(record.sourceId, true);

  if (!fileId && (pdfMode === "low" || pdfMode === "high") && lowUrl) {
    try {
      const url = pdfMode === "high" ? highUrl : lowUrl;
      const name = `${record.sourceId}_${pdfMode}.pdf`;
      const buffer = await downloadToFile(url, path.join(PDF_DIR, name));
      fileId = await uploadBuffer(buffer, name, "application/pdf", { type: "book-file", source: "ACO", sourceId: record.sourceId, rights: "Public Domain" }, "libraryBooks");
    } catch (error) { console.warn(`  PDF skipped: ${record.title} -> ${error.message}`); }
  }

  if (!coverImageId && downloadCovers) {
    try {
      const url = coverUrl(record.sourceId);
      if (url) {
        const name = `${record.sourceId}.jpg`;
        const buffer = await downloadToFile(url, path.join(COVER_DIR, name));
        coverImageId = await uploadBuffer(buffer, name, "image/jpeg", { type: "book-cover", source: "ACO", sourceId: record.sourceId, rights: "Public Domain", sourceUrl: url }, "libraryCovers");
      }
    } catch (error) { console.warn(`  Cover skipped: ${record.title} -> ${error.message}`); }
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
    rating: 0,
    isAvailable: Boolean(fileId || lowUrl),
    fileId,
    coverImageId,
    filePath: fileId ? "" : lowUrl,
    coverImage: "",
    status: "approved",
    submittedBy: null,
    reviewedAt: new Date(),
    rejectionReason: "",
    source: "ACO",
    sourceId: record.sourceId,
    sourceUrl: record.sourceUrl || `${ACO_SITE}/`,
    sourceFileUrl: lowUrl,
    sourceProvider: sourceParts(record.sourceId)?.provider || "",
    rights: "Public Domain",
    isbn: record.isbn,
    subjects: record.subjects
  };
  if (existing) await Book.updateOne({ _id: existing._id }, { $set: payload });
  else await Book.create(payload);

  console.log(`[${index}/${total}] ${record.title} | PDF: ${fileId ? "محلي" : "رابط"} | الغلاف: ${coverImageId ? "محلي" : "غير متوفر"}`);
  return { status: "imported", fileId: Boolean(fileId), coverImageId: Boolean(coverImageId) };
}

async function main() {
  console.log("\n=== مستورد Arabic Collections Online لمكتبة Electronic Library ===");
  console.log(`وضع PDF: ${pdfMode} | تنزيل الأغلفة: ${downloadCovers ? "نعم" : "لا"}`);
  console.log(`الحد: ${limit || "كل الكتب"} | البداية: ${offset} | التوازي: ${concurrency}`);

  if (!["none", "low", "high"].includes(pdfMode)) throw new Error(`وضع PDF غير صالح: ${pdfMode}`);
  if ((pdfMode !== "none" || downloadCovers) && !confirm) throw new Error("هذه العملية قد تحتاج مساحة تخزين ضخمة. أضف --confirm للتنفيذ.");

  console.log("[1/4] الاتصال بقاعدة البيانات...");
  await connectDatabase();
  console.log("[2/4] جلب فهرس ACO الرسمي...");
  const allRecords = await getAcoRecords();
  console.log(`[3/4] إجمالي سجلات ACO بعد إزالة التكرار: ${allRecords.length}`);
  if (!allRecords.length) throw new Error("لم يتم استخراج أي سجلات من ملفات MARC الرسمية في ACO.");

  const selected = allRecords.slice(offset, limit ? offset + limit : undefined);
  console.log(`[4/4] ستتم معالجة ${selected.length} كتاباً.`);

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
  console.log("صورة المؤلف لا تُختلق ولا تُنزّل دون مصدر موثوق وحقوق واضحة.");
  await require("mongoose").connection.close();
}

main().catch(async (error) => {
  console.error(`خطأ عام في مستورد ACO: ${error.stack || error.message}`);
  try { await require("mongoose").connection.close(); } catch (_) {}
  process.exitCode = 1;
});
