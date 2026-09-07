const UA = "ElectronicLibrary External Image Resolver/1.0";

const clean = (v = "") => String(v).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();

async function json(url) {
  try {
    const r = await fetch(url, {
      redirect: "follow",
      headers: { "User-Agent": UA, Accept: "application/json" }
    });
    if (!r.ok) return null;
    return await r.json();
  } catch {
    return null;
  }
}

async function image(url) {
  if (!url) return null;
  try {
    const r = await fetch(url, {
      redirect: "follow",
      headers: { "User-Agent": UA, Accept: "image/avif,image/webp,image/apng,image/*,*/*;q=0.8" }
    });
    if (!r.ok) return null;
    const contentType = r.headers.get("content-type") || "";
    if (!/^image\//i.test(contentType)) return null;
    const buffer = Buffer.from(await r.arrayBuffer());
    if (!buffer.length || buffer.length > 15 * 1024 * 1024) return null;
    return { buffer, contentType, finalUrl: r.url || url };
  } catch {
    return null;
  }
}

function openLibraryCover(doc) {
  if (doc?.cover_i) return `https://covers.openlibrary.org/b/id/${doc.cover_i}-L.jpg`;
  if (doc?.isbn?.[0]) return `https://covers.openlibrary.org/b/isbn/${encodeURIComponent(doc.isbn[0])}-L.jpg`;
  return "";
}

async function findBookCover({ title, author, isbn } = {}) {
  if (isbn) {
    const direct = await image(`https://covers.openlibrary.org/b/isbn/${encodeURIComponent(isbn)}-L.jpg`);
    if (direct) return { ...direct, provider: "Open Library Covers", query: isbn };
  }

  const q = new URLSearchParams({ title: clean(title), limit: "8" });
  if (author) q.set("author", clean(author));
  const data = await json(`https://openlibrary.org/search.json?${q.toString()}`);
  const docs = Array.isArray(data?.docs) ? data.docs : [];

  for (const doc of docs) {
    const coverUrl = openLibraryCover(doc);
    if (!coverUrl) continue;
    const result = await image(coverUrl);
    if (result) return { ...result, provider: "Open Library Covers", query: clean(title) };
  }
  return null;
}

async function wikipediaSummary(lang, name) {
  const title = encodeURIComponent(clean(name).replace(/ /g, "_"));
  return json(`https://${lang}.wikipedia.org/api/rest_v1/page/summary/${title}`);
}

async function findAuthorImage(name) {
  if (!name) return null;
  for (const lang of ["ar", "en"]) {
    const data = await wikipediaSummary(lang, name);
    const source = data?.thumbnail?.source || data?.originalimage?.source;
    if (!source) continue;
    const result = await image(source);
    if (result) return {
      ...result,
      provider: `${lang === "ar" ? "Arabic" : "English"} Wikipedia`,
      sourcePage: data?.content_urls?.desktop?.page || "",
      query: clean(name)
    };
  }
  return null;
}

module.exports = { findBookCover, findAuthorImage, image };
