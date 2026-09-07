const OPENAI_URL = 'https://api.openai.com/v1/responses';

const schema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    title: { type: 'string' },
    author: { type: 'string' },
    category: { type: 'string' },
    description: { type: 'string' },
    publishedYear: { type: 'string' },
    language: { type: 'string' },
    isbn: { type: 'string' },
    pages: { type: 'string' },
    authorBio: { type: 'string' },
    authorImage: { type: 'string' },
    confidence: { type: 'number' },
    notes: { type: 'string' }
  },
  required: ['title', 'author', 'category', 'description', 'publishedYear', 'language', 'isbn', 'pages', 'authorBio', 'authorImage', 'confidence', 'notes']
};

function enabled() {
  return Boolean(process.env.OPENAI_API_KEY);
}

function extractOutputText(data) {
  if (typeof data.output_text === 'string') return data.output_text;
  const chunks = [];
  for (const item of data.output || []) {
    for (const part of item.content || []) {
      if (part.type === 'output_text' && part.text) chunks.push(part.text);
    }
  }
  return chunks.join('\n');
}

function clean(value = '') {
  return String(value)
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function looksLikeSiteNoise(value = '') {
  const text = clean(value).toLowerCase();
  if (!text) return true;
  const markers = [
    'إقتباسات', 'المزيد', 'القوائم', 'سلاسل وموسوعات', 'مهمتنا', 'انشر معنا',
    'اتصل بنا', 'دخول', 'حساب جديد', 'التصنيفات كل الكتب', 'الرئيسية التصنيفات',
    'quotes', 'lists', 'login', 'register', 'contact us', 'our mission'
  ];
  const hits = markers.filter(marker => text.includes(marker.toLowerCase())).length;
  return hits >= 2 || text.length > 6000;
}

function normalizeCategory(value, fallback = '') {
  const text = clean(value);
  if (!text || looksLikeSiteNoise(text) || /^(ات|ذات|غير معروف|غير محدد|لا يوجد|none|null|n\/a)$/i.test(text)) return clean(fallback);
  if (text.length > 100 || /\b(الرئيسية|التصنيفات|كل الكتب|سلاسل|موسوعات)\b/i.test(text)) return clean(fallback);
  return text;
}

function normalizeDescription(value, fallback = '') {
  const text = clean(value);
  if (!text || looksLikeSiteNoise(text)) return clean(fallback);
  return text;
}

async function enrichBook(candidate) {
  if (!enabled()) {
    return {
      ...candidate,
      ai: { enabled: false, confidence: 0, notes: 'OPENAI_API_KEY is not configured.' }
    };
  }

  const sourceText = clean(candidate.rawText || '').slice(0, 14000);
  const sourcePayload = {
    title: candidate.title,
    author: candidate.author,
    category: candidate.category,
    description: candidate.description,
    pages: candidate.pages,
    isbn: candidate.isbn,
    publishedYear: candidate.publishedYear,
    language: candidate.language,
    sourceUrl: candidate.sourceUrl,
    sourceFileUrl: candidate.sourceFileUrl,
    sourceText
  };

  const prompt = `أنت محرر بيانات محترف لمكتبة عربية رقمية.
استخرج بيانات هذا الكتاب من صفحة المصدر، واستخدم البحث على الويب فقط للتحقق عند الحاجة.

قواعد مهمة جداً:
1) لا تخترع أي معلومة. إذا لم تجدها بوضوح أعد قيمة فارغة.
2) تعامل مع نص الصفحة كصفحة ويب: تجاهل شريط التنقل، القوائم، التذييل، الإعلانات، روابط الموقع، وعبارات مثل «المزيد» و«إقتباسات» و«القوائم» و«مهمتنا» و«دخول» و«حساب جديد».
3) category يجب أن تكون تصنيفاً واحداً قصيراً للكتاب فقط، وليس قائمة تصنيفات الموقع. إذا لم يوجد تصنيف واضح اتركها فارغة.
4) description يجب أن تكون نبذة الكتاب فقط، بدون أي نص من قائمة الموقع أو التنقل.
5) title يجب أن يكون عنوان الكتاب الحقيقي، واحذف «تحميل كتاب» و«pdf» و«تأليف» من العنوان إذا كانت جزءاً من عنوان الصفحة وليست من اسم الكتاب.
6) author يجب أن يكون اسم المؤلف الحقيقي فقط، بدون «تأليف» أو نص إضافي.
7) pages وpublishedYear وisbn لا تملأها إلا إذا كانت ظاهرة أو مؤكدة.
8) language = العربية فقط إذا كانت نسخة الكتاب عربية فعلاً، وإلا language = غير عربي.
9) confidence من 0 إلى 100 ويعكس جودة البيانات المستخرجة، وليس ثقة عامة في الموقع.
10) لا تعتبر عبارة «حقوق الكتاب محفوظة لصاحبها» أو «جميع الحقوق محفوظة» تصريحاً بالنشر.

بيانات المصدر:
${JSON.stringify(sourcePayload, null, 2)}`;

  const response = await fetch(OPENAI_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL || 'gpt-5.6-luna',
      tools: [{ type: 'web_search' }],
      input: prompt,
      text: {
        format: {
          type: 'json_schema',
          name: 'arabic_book_metadata',
          strict: true,
          schema
        }
      },
      max_output_tokens: 1800
    })
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(`OpenAI request failed (${response.status}): ${message.slice(0, 500)}`);
  }

  const data = await response.json();
  const text = extractOutputText(data);
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error('OpenAI returned invalid structured metadata.');
  }

  const title = clean(parsed.title) || clean(candidate.title);
  const author = clean(parsed.author) || clean(candidate.author);
  const category = normalizeCategory(parsed.category, candidate.category);
  const description = normalizeDescription(parsed.description, candidate.description);

  return {
    ...candidate,
    title,
    author,
    category,
    description,
    publishedYear: clean(parsed.publishedYear) || clean(candidate.publishedYear),
    language: clean(parsed.language) || clean(candidate.language) || 'العربية',
    isbn: clean(parsed.isbn) || clean(candidate.isbn),
    pages: clean(parsed.pages) || clean(candidate.pages),
    authorBio: clean(parsed.authorBio),
    authorImage: clean(parsed.authorImage) || clean(candidate.authorImage),
    ai: {
      enabled: true,
      confidence: Math.max(0, Math.min(100, Number(parsed.confidence || 0))),
      notes: clean(parsed.notes)
    }
  };
}

async function enrichMany(candidates) {
  const batchSize = Math.max(1, Number(process.env.OPENAI_IMPORT_BATCH_SIZE || 5));
  const result = [];
  for (let i = 0; i < candidates.length; i += batchSize) {
    const batch = candidates.slice(i, i + batchSize);
    for (const candidate of batch) {
      try {
        result.push(await enrichBook(candidate));
      } catch (error) {
        result.push({
          ...candidate,
          ai: { enabled: false, confidence: 0, notes: error.message }
        });
      }
    }
  }
  return result;
}

module.exports = { enabled, enrichBook, enrichMany };
