const OPENAI_URL = "https://api.openai.com/v1/responses";

function requireKey() {
  const key = String(process.env.OPENAI_API_KEY || "").trim();
  if (!key) throw new Error("مفتاح الذكاء الاصطناعي غير مضبوط في backend/.env");
  return key;
}

const schema = {
  type: "object",
  additionalProperties: false,
  properties: {
    title: { type: "string" },
    authorName: { type: "string" },
    categoryName: { type: "string" },
    description: { type: "string" },
    publishedYear: { type: "string" },
    language: { type: "string" },
    isbn: { type: "string" },
    authorBio: { type: "string" },
    confidence: { type: "number" },
    sources: { type: "array", items: { type: "string" } }
  },
  required: ["title", "authorName", "categoryName", "description", "publishedYear", "language", "isbn", "authorBio", "confidence", "sources"]
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

function missingFields(book) {
  const missing = [];
  if (!String(book.title || "").trim()) missing.push("العنوان");
  if (!String(book.authorName || "").trim()) missing.push("المؤلف");
  if (!String(book.categoryName || "").trim()) missing.push("التصنيف");
  if (!String(book.description || "").trim()) missing.push("الوصف");
  if (!String(book.publishedYear || "").trim()) missing.push("سنة النشر");
  if (!String(book.language || "").trim()) missing.push("اللغة");
  if (!String(book.isbn || "").trim()) missing.push("الرقم الدولي للكتاب");
  return missing;
}

async function researchBook(book, options = {}) {
  const missing = missingFields(book);
  if (!missing.length && !options.force) return { ...book, researched: false, researchSources: [] };

  const key = requireKey();
  const prompt = [
    "أنت باحث ببليوغرافي دقيق لمكتبة إلكترونية.",
    "ابحث في الإنترنت عن المعلومات الناقصة فقط، ثم قارن أكثر من مصدر عند الإمكان.",
    "لا تخترع أي معلومة. إذا لم تجد معلومة موثوقة فاترك الحقل فارغاً.",
    "الأولوية للمصادر الببليوغرافية والناشرين والفهارس الموثوقة ومواقع المؤلفين والمصادر المرجعية المعروفة.",
    "لا تستخدم موقع المكتبة المصدر لإكمال المعلومات؛ الهدف هو الحصول على معلومات خارجية مستقلة.",
    "أعد جميع المعلومات النصية بالعربية. إذا كان الاسم علماً أو عنواناً معروفاً، حافظ على الاسم العربي المتداول إن وجد.",
    "أعد روابط المصادر التي اعتمدت عليها فقط.",
    `المعلومات الموجودة حالياً: ${JSON.stringify(book)}`,
    `المعلومات الناقصة: ${missing.join("، ")}`,
    "لا تبحث عن روابط ملفات PDF ولا تقترح تنزيل كتب محمية بحقوق النشر. البحث هنا للبيانات الوصفية فقط."
  ].join("\n");

  const body = {
    model: process.env.OPENAI_IMPORT_MODEL || "gpt-5.6-luna",
    tools: [{ type: "web_search_preview", search_context_size: "medium" }],
    input: [
      {
        role: "system",
        content: [{ type: "input_text", text: "أنت باحث ببليوغرافي. استخدم البحث على الويب عند الحاجة وأعد JSON مطابقاً للمخطط فقط." }]
      },
      { role: "user", content: [{ type: "input_text", text: prompt }] }
    ],
    text: {
      format: {
        type: "json_schema",
        name: "library_external_research",
        strict: true,
        schema
      }
    },
    max_output_tokens: Number(process.env.OPENAI_IMPORT_RESEARCH_MAX_OUTPUT || 5000)
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
  if (!response.ok) throw new Error(data?.error?.message || `البحث الخارجي فشل: HTTP ${response.status}`);
  const raw = responseText(data);
  if (!raw) throw new Error("البحث الخارجي لم يرجع بيانات منظمة.");

  let result;
  try { result = JSON.parse(raw); } catch { throw new Error("تعذر قراءة نتيجة البحث الخارجي."); }

  return {
    ...book,
    title: String(book.title || result.title || "").trim(),
    authorName: String(book.authorName || result.authorName || "").trim(),
    categoryName: String(book.categoryName || result.categoryName || "").trim(),
    description: String(book.description || result.description || "").trim(),
    publishedYear: String(book.publishedYear || result.publishedYear || "").trim(),
    language: String(book.language || result.language || "").trim(),
    isbn: String(book.isbn || result.isbn || "").trim(),
    authorBio: String(result.authorBio || "").trim(),
    confidence: Number(result.confidence || 0),
    researchSources: Array.isArray(result.sources) ? result.sources.filter(Boolean).slice(0, 10) : [],
    researched: true
  };
}

module.exports = { researchBook, missingFields };
