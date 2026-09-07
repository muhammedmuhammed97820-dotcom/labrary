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

async function enrichBook(candidate) {
  if (!enabled()) return { ...candidate, ai: { enabled: false, confidence: 0, notes: 'OPENAI_API_KEY is not configured.' } };

  const prompt = `أنت محرر بيانات مكتبة عربية. حلل بيانات الكتاب التالية. لا تخترع أي معلومة. إذا لم تكن المعلومة موجودة أو مؤكدة اتركها فارغة. يجب أن تكون اللغة عربية فقط. إذا كان الكتاب ليس نسخة عربية حقيقية فاجعل language = غير عربي. ابحث عن معلومات موثوقة عبر الويب عند الحاجة. أعد بيانات دقيقة قابلة للمراجعة البشرية.\n\nبيانات المصدر:\n${JSON.stringify(candidate, null, 2)}`;

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
      max_output_tokens: 1600
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

  return {
    ...candidate,
    title: parsed.title || candidate.title,
    author: parsed.author || candidate.author,
    category: parsed.category || candidate.category || 'كتب متنوعة',
    description: parsed.description || candidate.description || '',
    publishedYear: parsed.publishedYear || candidate.publishedYear || '',
    language: parsed.language || candidate.language || 'العربية',
    isbn: parsed.isbn || candidate.isbn || '',
    pages: parsed.pages || candidate.pages || '',
    authorBio: parsed.authorBio || '',
    authorImage: parsed.authorImage || candidate.authorImage || '',
    ai: {
      enabled: true,
      confidence: Number(parsed.confidence || 0),
      notes: parsed.notes || ''
    }
  };
}

async function enrichMany(candidates) {
  const batchSize = Number(process.env.OPENAI_IMPORT_BATCH_SIZE || 5);
  const result = [];
  for (let i = 0; i < candidates.length; i += batchSize) {
    const batch = candidates.slice(i, i + batchSize);
    for (const candidate of batch) {
      try {
        result.push(await enrichBook(candidate));
      } catch (error) {
        result.push({ ...candidate, ai: { enabled: true, confidence: 0, notes: error.message } });
      }
    }
  }
  return result;
}

module.exports = { enabled, enrichBook, enrichMany };
