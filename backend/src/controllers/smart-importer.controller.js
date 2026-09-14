const Book = require("../models/Book");
const { findOrCreateAuthor, findOrCreateCategory } = require("../services/book.service");

const IA_SEARCH_URL = "https://archive.org/advancedsearch.php";
const IA_METADATA_URL = "https://archive.org/metadata";
const SOURCE = "internet-archive";

function text(value) {
  if (Array.isArray(value)) return value.filter(Boolean).map(String).join(", ");
  return value == null ? "" : String(value).trim();
}

function first(value) {
  if (Array.isArray(value)) return value.find(Boolean) || "";
  return value || "";
}

function parseYear(value) {
  const match = String(value || "").match(/\b(1[5-9]\d{2}|20\d{2}|21\d{2})\b/);
  return match ? Number(match[1]) : undefined;
}

function isArabic(metadata) {
  const languages = Array.isArray(metadata.language) ? metadata.language : [metadata.language];
  return languages.some((value) => /^(ara|ar)([-_].*)?$/i.test(String(value || "").trim()) || /arabic|عربي/i.test(String(value || "")));
}

function rightsText(metadata) {
  return text(first(metadata.rights)) || text(first(metadata.licenseurl));
}

function isOpenRights(metadata) {
  const values = [metadata.rights, metadata.licenseurl, metadata.license]
    .flatMap((value) => Array.isArray(value) ? value : [value])
    .filter(Boolean)
    .map((value) => String(value).toLowerCase());

  return values.some((value) =>
    value.includes("public domain") ||
    value.includes("creativecommons") ||
    value.includes("creative commons") ||
    value.includes("cc0") ||
    value.includes("open access") ||
    value.includes("publicdomain")
  );
}

function findPdf(files = []) {
  return files.find((file) => {
    const name = String(file.name || "").toLowerCase();
    return name.endsWith(".pdf") && file.private !== "true" && file.private !== true;
  });
}

function mapItem(doc) {
  const metadata = doc.metadata || doc;
  const identifier = text(doc.identifier || metadata.identifier);
  const pdf = findPdf(doc.files || []);
  const rights = rightsText(metadata);
  const downloadable = Boolean(pdf);
  const openRights = isOpenRights(metadata);

  return {
    sourceId: identifier,
    source: SOURCE,
    sourceProvider: "Internet Archive",
    sourceUrl: `https://archive.org/details/${encodeURIComponent(identifier)}`,
    sourceFileUrl: pdf ? `https://archive.org/download/${encodeURIComponent(identifier)}/${encodeURIComponent(pdf.name)}` : "",
    title: text(first(metadata.title)) || identifier,
    author: text(first(metadata.creator || metadata.author)),
    description: text(first(metadata.description)),
    publishedYear: parseYear(first(metadata.date || metadata.year || metadata.publicdate)),
    language: text(metadata.language),
    rights,
    subjects: (Array.isArray(metadata.subject) ? metadata.subject : [metadata.subject]).filter(Boolean).map(String),
    coverUrl: `https://archive.org/services/img/${encodeURIComponent(identifier)}`,
    pdfAvailable: downloadable,
    openRights,
    importable: isArabic(metadata) && downloadable && openRights,
    reason: !isArabic(metadata) ? "Not Arabic" : !downloadable ? "No public PDF file found" : !openRights ? "Open/public-domain rights not confirmed" : ""
  };
}

async function fetchJson(url) {
  const response = await fetch(url, { headers: { Accept: "application/json" } });
  if (!response.ok) throw new Error(`Internet Archive request failed (${response.status}).`);
  return response.json();
}

async function fetchItem(identifier) {
  return fetchJson(`${IA_METADATA_URL}/${encodeURIComponent(identifier)}`);
}

async function preview(req, res) {
  try {
    const page = Math.max(Number.parseInt(req.body?.page, 10) || 1, 1);
    const requestedRows = Number.parseInt(req.body?.rows, 10) || 20;
    const rows = Math.min(Math.max(requestedRows, 1), 50);
    const q = String(req.body?.query || "language:ara AND mediatype:texts").trim();
    const onlyImportable = req.body?.onlyImportable !== false;

    const url = new URL(IA_SEARCH_URL);
    url.searchParams.set("q", q);
    ["identifier", "title", "creator", "language", "date", "rights", "licenseurl", "description", "subject"].forEach((field) => {
      url.searchParams.append("fl[]", field);
    });
    url.searchParams.set("rows", String(rows));
    url.searchParams.set("page", String(page));
    url.searchParams.set("output", "json");

    const search = await fetchJson(url.toString());
    const docs = search?.response?.docs || [];
    const books = [];
    for (const doc of docs) {
      try {
        const metadata = await fetchItem(doc.identifier);
        const item = mapItem(metadata);
        if (!onlyImportable || item.importable) books.push(item);
      } catch (error) {
        console.warn(`Skipping Internet Archive item ${doc.identifier}: ${error.message}`);
      }
    }

    res.json({
      source: SOURCE,
      query: q,
      page,
      rows,
      total: Number(search?.response?.numFound || 0),
      books,
      note: "Preview only. Nothing is written to MongoDB until /approve is called."
    });
  } catch (error) {
    console.error(error);
    res.status(502).json({ message: error.message || "Failed to fetch Arabic books preview." });
  }
}

async function approve(req, res) {
  try {
    const selectedIds = Array.isArray(req.body?.sourceIds) ? [...new Set(req.body.sourceIds.map(String).filter(Boolean))] : [];
    if (!selectedIds.length) return res.status(400).json({ message: "Select at least one book." });
    if (selectedIds.length > 50) return res.status(400).json({ message: "You can import at most 50 books per request." });

    const imported = [];
    const skipped = [];

    for (const sourceId of selectedIds) {
      const existing = await Book.findOne({ source: SOURCE, sourceId });
      if (existing) {
        skipped.push({ sourceId, reason: "Already exists in your library" });
        continue;
      }

      const item = mapItem(await fetchItem(sourceId));
      if (!item.importable) {
        skipped.push({ sourceId, reason: item.reason || "Book does not pass Arabic/open-rights checks" });
        continue;
      }

      const authorName = item.author || "Unknown Author";
      const categoryName = item.subjects[0] || "Arabic Books";
      const author = await findOrCreateAuthor(authorName);
      const category = await findOrCreateCategory(categoryName);

      const book = await Book.create({
        title: item.title,
        author: author._id,
        category: category._id,
        description: item.description,
        publishedYear: item.publishedYear,
        language: "Arabic",
        isAvailable: true,
        filePath: "",
        coverImage: item.coverUrl,
        status: "approved",
        submittedBy: req.user._id,
        reviewedAt: new Date(),
        source: SOURCE,
        sourceId: item.sourceId,
        sourceUrl: item.sourceUrl,
        sourceFileUrl: item.sourceFileUrl,
        sourceProvider: item.sourceProvider,
        rights: item.rights,
        subjects: item.subjects
      });

      imported.push({ id: book._id, sourceId: item.sourceId, title: item.title });
    }

    res.status(201).json({
      message: `Imported ${imported.length} book(s).`,
      imported,
      skipped,
      totalRequested: selectedIds.length
    });
  } catch (error) {
    console.error(error);
    res.status(502).json({ message: error.message || "Failed to import selected books." });
  }
}

module.exports = { preview, approve };
