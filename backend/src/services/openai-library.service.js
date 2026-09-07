const MAX_HTML_CHARS = 45000;
const OPENAI_URL = "https://api.openai.com/v1/responses";

function requireKey() {
  const key = String(process.env.OPENAI_API_KEY || "").trim();
  if (!key) throw new Error("OPENAI_API_KEY غير مضبوط في backend/.env");
  return key;
}

function stripHtml(html = "") {
  return String(html)
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#(\d+);/g, (_, n) => {
      try { return String.fromCodePoint(Number(n)); } catch { return ""; }
    })
    .replace(/\s+/g, " ")
    .trim();
}

function extractLinks(html = "", baseUrl = "") {
  const result = [];
  const re = /<a\b([^>]*)>([\s\S]*?)<\/a>/gi;
  let match;
  while ((match = re.exec(html))) {
    const attrs = match[1] || "";
    const href = attrs.match(/(?:href|data-href)=["']([^"']+)["']/i)?.[1] || "";
    if (!href) continue;
    try {
      const url = new URL(href, baseUrl).href;
      const text = stripHtml(match[2]).slice(0, 300);
      if (text || /book|books|author|category|كتاب|كتب|مؤلف|تصنيف/i.test(url)) result.push({ url, text });
    } catch {}
  }
  const seen = new Set();
  return result.filter(x => !seen.has(x.url) && seen.add(x.url)).slice(0, 800);
}

async function fetchHtml(url) {
  const response = await fetch(url, {
    headers: {
      "user-agent": "ElectronicLibrary AI Importer/1.0",
      accept: "text/html,application/xhtml+xml"
    },
    redirect: "follow",
    signal: AbortSignal.timeout(20000)
  });
  if (!response.ok) throw new Error(`تعذر جلب الرابط: HTTP ${response.status}`);
  const type = response.headers.get("content-type") || "";
  if (!/html|xhtml/i.test(type)) throw new Error("الرابط لا يعيد صفحة HTML.");
  const html = await response.text();
  return { html, finalUrl: response.url || url };
}

const schema = {
  type: "object",
  additionalProperties: false,
  properties: {
    siteType: { type: "string", enum: ["library", "book", "author", "category", "unknown"] },
    siteName: { type: "string" },
    books: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          title: { type: "string" },
          authorName: { type: "string" },
          authorUrl: { type: "string" },
          categoryName: { type: "string" },
          categoryUrl: { type: "string" },
          description: { type: "string" },
          publishedYear: { type: "string" },
          language: { type: "string" },
          isbn: { type: "string" },
          bookUrl: { type: "string" },
          fileUrl: { type: "string" },
          confidence: { type: "number" }
        },
        required: ["title", "authorName", "authorUrl", "categoryName", "categoryUrl", "description", "publishedYear", "language", "isbn", "bookUrl", "fileUrl", "confidence"]
      }
    },
    authors: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          name: { type: "string" },
          url: { type: "string" },
          bio: { type: "string" }
        },
        required: ["name", "url", "bio"]
      }
    },
    categories: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          name: { type: "string" },
          url: { type: "string" },
          description: { type: "string" }
        },
        required: ["name", "url", "description"]
      }
    },
    nextUrls: { type: "array", items: { type: "string" } }
  },
  required: ["siteType", "siteName", "books", "authors", "categories", "nextUrls"]
};

function responseText(data) {
  if (typeof data.output_text === "string" && data.output_text.trim()) return data.output_text;
  const chunks = [];
  for (const item of data.output || []) {
    for (const content of item.content || []) {
      if (typeof content.text === "string") chunks.push(content.text);
    }
  }
  return chunks.join("\n");
}

async function analyzePage(url, html, options = {}) {
  const key = requireKey();
  const text = stripHtml(html).slice(0, MAX_HTML_CHARS);
  const links = extractLinks(html, url);
  const prompt = [
    "أنت محرك تنظيم واستيراد لمكتبة إلكترونية.",
    "حلل الصفحة المرسلة فقط، ولا تخترع أي معلومة غير موجودة فيها أو في الروابط الظاهرة.",
    "استخرج الكتب الحقيقية فقط، وليس عناصر القائمة أو المقالات أو الإعلانات.",
    "اربط كل كتاب بالمؤلف والتصنيف إذا كان ذلك واضحاً من الصفحة أو الرابط.",
    "إذا كانت الصفحة لمؤلف أو تصنيف، أعد معلوماته في authors/categories.",
    "احتفظ بروابط المصدر كما هي بعد تحويل الروابط النسبية إلى مطلقة.",
    "fileUrl يجب أن يكون رابط تنزيل PDF/كتاب فقط إذا كان واضحاً من الصفحة، ولا يعني ذلك أن الملف مسموح تنزيله.",
    "لا تستخرج صوراً من الموقع المصدر؛ الصور ستبحث عنها طبقة أخرى من النظام من مصادر خارجية.",
    `الرابط: ${url}`,
    `نوع الاستيراد المطلوب: ${options.mode || "automatic"}`,
    "\nنص الصفحة:\n" + text,
    "\nالروابط المهمة في الصفحة:\n" + JSON.stringify(links)
  ].join("\n");

  const body = {
    model: process.env.OPENAI_IMPORT_MODEL || "gpt-5.6-luna",
    input: [
      {
        role: "system",
        content: [{ type: "input_text", text: "أنت مستخرج بيانات مكتبات إلكترونية دقيق. أعد JSON مطابقاً للمخطط فقط." }]
      },
      { role: "user", content: [{ type: "input_text", text: prompt }] }
    ],
    text: {
      format: {
        type: "json_schema",
        name: "library_import",
        strict: true,
        schema
      }
    },
    max_output_tokens: Number(process.env.OPENAI_IMPORT_MAX_OUTPUT || 12000)
  };

  const response = await fetch(OPENAI_URL, {
    method: "POST",
    headers: {
      authorization: `Bearer ${key}`,
      "content-type": "application/json"
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(120000)
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = data?.error?.message || `OpenAI HTTP ${response.status}`;
    throw new Error(message);
  }

  const raw = responseText(data);
  if (!raw) throw new Error("OpenAI لم يرجع بيانات منظمة.");
  try {
    return JSON.parse(raw);
  } catch {
    throw new Error("تعذر تحويل استجابة OpenAI إلى JSON.");
  }
}

module.exports = { analyzePage, fetchHtml, extractLinks, stripHtml };
