const Book = require("../models/Book");
const Author = require("../models/Author");
const Category = require("../models/Category");
const { uploadBuffer } = require("./gridfs.service");
const { findBookCover, findAuthorImage } = require("./external-image.service");

const MAX_PAGE_BYTES = 5 * 1024 * 1024;
const MAX_PAGES = 300;
const UA = "ElectronicLibrary Smart Library Agent/6.0";

const clean = (v = "") => String(v)
  .replace(/<script[\\s\\S]*?<\\/script>/gi, " ")
  .replace(/<style[\\s\\S]*?<\\/style>/gi, " ")
  .replace(/<[^>]+>/g, " ")
  .replace(/&nbsp;/gi, " ").replace(/&amp;/gi, "&").replace(/&quot;/gi, '"')
  .replace(/&#(\\d+);/g, (_, n) => { try { return String.fromCodePoint(Number(n)); } catch { return ""; } })
  .replace(/\\s+/g, " ").trim();
const abs = (base, value) => { try { return new URL(String(value || ""), base).href; } catch { return ""; } };
const attr = (s, n) => String(s || "").match(new RegExp(`${n}=[\\"']([^\\"']+)`, "i"))?.[1] || "";
const links = (html, page) => { const out = [], re = /<a\\b([^>]*)>([\\s\\S]*?)<\\/a>/gi; let m; while ((m = re.exec(html))) { const u = abs(page, attr(m[1], "href") || attr(m[1], "data-href")); if (u) out.push({ url:u, text:clean(m[2]), attrs:m[1] }); } return out; };
const meta = (html, name) => { for (const t of html.match(/<meta\\b[^>]*>/gi) || []) if (new RegExp(`(?:name|property)=[\\"']${name}[\\"']`, "i").test(t)) return clean(attr(t,"content")); return ""; };
const firstTag = (html, name) => clean(html.match(new RegExp(`<${name}\\b[^>]*>([\\s\\S]*?)<\\/${name}>`, "i"))?.[1] || "");
const jsonLd = html => { const out=[]; for (const m of html.matchAll(/<script[^>]+type=["']application\\/ld\\+json["'][^>]*>([\\s\\S]*?)<\\/script>/gi)) { try { const x=JSON.parse(m[1].trim()); const add=v=>{ if(!v)return; if(Array.isArray(v))return v.forEach(add); if(v["@graph"])return v["@graph"].forEach(add); out.push(v); }; add(x); } catch {} } return out; };

function validAuthor(v) {
  let n = clean(v).replace(/^(?:الكاتب|المؤلف|بقلم|تأليف)\\s*[:：-]?\\s*/iu, "").trim();
  if (!n || n.length < 4 || n.length > 120) return "";
  if (/^(و|او|أو|من|عن|في|على|مع|هذا|هذه|كتاب|تحميل|pdf)$/iu.test(n)) return "";
  if (/تحميل\\s+كتاب|حقوق|فولة\\s*بوك|مكتبة|library|book|pdf\\b/i.test(n)) return "";
  if (/^[\\W_]+$/u.test(n)) return "";
  return n;
}
function validCategory(v) {
  const n=clean(v); if(!n || n.length<2 || n.length>100) return "";
  if(/^(و|او|أو|من|عن|في|على|مع)$/iu.test(n)) return "";
  return n;
}
function cleanTitle(v) { return clean(v).replace(/^تحميل\\s+كتاب\\s+/iu,"").replace(/^كتاب\\s+/iu,"").replace(/\\s+(?:كتاب\\s+)?pdf\\s*$/iu,"").trim(); }

function extractBook(url, html) {
  const ld = jsonLd(html).find(x => /book/i.test(String(x?.["@type"]||""))) || {};
  const as=links(html,url), text=clean(html);
  const title=cleanTitle(ld.name || firstTag(html,"h1") || meta(html,"og:title") || meta(html,"twitter:title") || firstTag(html,"title"));
  let authorName=validAuthor(typeof ld.author === "string" ? ld.author : ld.author?.name), authorUrl=abs(url, typeof ld.author === "object" ? ld.author?.url : "");
  const authorLinks=as.filter(a => /(?:\\/author\\/|author|كاتب|مؤلف)/i.test(a.url+" "+a.attrs)).map(a=>({ ...a, name:validAuthor(a.text) })).filter(a=>a.name);
  if(!authorName && authorLinks.length) { authorName=authorLinks[0].name; authorUrl=authorLinks[0].url; }
  if(authorName && authorLinks.length && !authorUrl) authorUrl=authorLinks.find(a=>a.name===authorName)?.url || "";
  if(!authorName) { const m=text.match(/(?:المؤلف|الكاتب|تأليف|بقلم)\\s*[:：-]\\s*([^|]{3,120})/iu); authorName=validAuthor(m?.[1]); }

  let categoryName=validCategory(typeof ld.genre === "object" ? ld.genre?.name : ld.genre), categoryUrl=abs(url, typeof ld.genre === "object" ? ld.genre?.url : "");
  const catLinks=as.filter(a=>/(?:\\/books\\/|category|categories|genre|تصنيف|قسم)/i.test(a.url+" "+a.attrs)).map(a=>({ ...a, name:validCategory(a.text) })).filter(a=>a.name);
  if(!categoryName && catLinks.length){ categoryName=catLinks[0].name; categoryUrl=catLinks[0].url; }
  if(!categoryName){ const m=text.match(/(?:التصنيف|القسم)\\s*[:：-]\\s*([^|]{2,100})/iu); categoryName=validCategory(m?.[1]); }

  const pdf=as.find(a=>/(?:تحميل|download|\\.pdf(?:$|[?#]))/i.test(a.text+" "+a.url));
  const rights=clean((text.match(/(?:Creative Commons|public domain|open access|open license|المشاع الإبداعي|ملك عام|المجال العام|جميع الحقوق محفوظة|حقوق الكتاب محفوظة)[^.!?]{0,350}/iu)||[""])[0]);
  const year=String(ld.datePublished||ld.dateCreated||text.match(/(?:سنة\\s+النشر|سنة\\s+الإصدار|تاريخ\\s+النشر)\\s*[:：-]?\\s*(1[5-9]\\d{2}|20\\d{2})/iu)?.[1]||"").match(/\\b(1[5-9]\\d{2}|20\\d{2})\\b/)?.[1];
  const isBook=/\\/book(?:\\/|[-_])/i.test(new URL(url).pathname)||/تحميل\\s+كتاب|المؤلف\\s*[:：-]|نوع\\s+الملف/i.test(text)||/book/i.test(String(ld["@type"]||""));
  return { isBook:Boolean(isBook&&title), title, authorName, authorUrl, categoryName, categoryUrl, description:clean(ld.description||meta(html,"description")), publishedYear:year?Number(year):undefined, language:clean(ld.inLanguage), isbn:clean(ld.isbn), pdfUrl:pdf?.url||"", rights, sourceUrl:url };
}

async function fetchPage(url){ const r=await fetch(url,{redirect:"follow",headers:{"User-Agent":UA,Accept:"text/html,application/xhtml+xml","Accept-Language":"ar,en;q=0.8"}}); if(!r.ok) throw new Error(`HTTP ${r.status}`); const type=r.headers.get("content-type")||""; if(!/html|xhtml|xml/i.test(type)) return null; const s=await r.text(); if(Buffer.byteLength(s)>MAX_PAGE_BYTES)return null; return s; }
async function crawl(rootUrl,maxPages){ const root=new URL(rootUrl); const queue=[root.href],queued=new Set(queue),seen=new Set(),records=[]; const limit=Math.min(Math.max(Number(maxPages)||100,1),MAX_PAGES); while(queue.length&&seen.size<limit){const url=queue.shift();if(seen.has(url))continue;seen.add(url);try{const h=await fetchPage(url);if(!h)continue;const b=extractBook(url,h);if(b.isBook)records.push(b);for(const a of links(h,url)){if(new URL(a.url).origin!==root.origin)continue;if(/\\.(?:jpg|jpeg|png|gif|webp|svg|css|js|zip|rar|mp3|mp4|docx?|xlsx?|pptx?)(?:$|[?#])/i.test(a.url))continue;if(!queued.has(a.url)&&queued.size<limit*4){queued.add(a.url);queue.push(a.url);}}}catch{}}return{pages:seen.size,records}; }

async function parseAuthor(url,fallback){try{const h=await fetchPage(url);if(!h)return{name:validAuthor(fallback),sourceUrl:url};const ld=jsonLd(h).find(x=>/person/i.test(String(x?.["@type"]||"")))||{};const name=validAuthor(ld.name)||validAuthor(firstTag(h,"h1"))||validAuthor(fallback);if(!name)return null;return{name,bio:clean(ld.description||meta(h,"description")),birthDate:clean(ld.birthDate),deathDate:clean(ld.deathDate),birthPlace:clean(typeof ld.birthPlace==="string"?ld.birthPlace:ld.birthPlace?.name),nationality:clean(typeof ld.nationality==="string"?ld.nationality:ld.nationality?.name),occupation:clean(ld.jobTitle),website:clean(ld.url||""),sourceUrl:url};}catch{return null;}}
async function parseCategory(url,fallback){try{const h=await fetchPage(url);return{name:validCategory(firstTag(h,"h1"))||validCategory(meta(h,"og:title"))||validCategory(fallback),description:clean(meta(h,"description")),sourceUrl:url};}catch{return{name:validCategory(fallback),sourceUrl:url};}}
const rightsAllowed=r=>/public\\s*domain|creative\\s*commons|cc0|open\\s+access|open\\s+license|رخصة\\s+المشاع\\s+الإبداعي|ملك\\s+عام|المجال\\s+العام/i.test(r)&&!/all\\s+rights\\s+reserved|جميع\\s+الحقوق\\s+محفوظة|حقوق\\s+الكتاب\\s+محفوظة/i.test(r);
const safe=(n,ext)=>`${clean(n).replace(/[^\\p{L}\\p{N}]+/gu,"_").slice(0,120)||"file"}.${ext}`;
async function downloadFile(url){try{const r=await fetch(url,{redirect:"follow",headers:{"User-Agent":UA}});if(!r.ok)return null;const b=Buffer.from(await r.arrayBuffer());if(!b.length||b.length>80*1024*1024)return null;return{buffer:b,contentType:r.headers.get("content-type")||"application/octet-stream",finalUrl:r.url||url};}catch{return null;}}

async function upsertAuthor(d,downloadFiles){const name=validAuthor(d?.name);if(!name)return null;let a=await Author.findOne({name});if(!a)a=new Author({name});for(const[k,v]of Object.entries({bio:d.bio,birthPlace:d.birthPlace,nationality:d.nationality,occupation:d.occupation,website:d.website}))if(clean(v))a[k]=clean(v);if(d.birthDate&&!Number.isNaN(new Date(d.birthDate).getTime()))a.birthDate=new Date(d.birthDate);if(d.deathDate&&!Number.isNaN(new Date(d.deathDate).getTime()))a.deathDate=new Date(d.deathDate);if(downloadFiles&&!a.imageId){const x=await findAuthorImage(name);if(x){const ext=/png/i.test(x.contentType)?"png":/webp/i.test(x.contentType)?"webp":"jpg";const u=await uploadBuffer(x.buffer,safe(name,ext),x.contentType,{entity:"author",sourceUrl:x.sourcePage||d.sourceUrl,provider:x.provider,query:name},"libraryAuthors");a.imageId=u.id;a.image=x.finalUrl;}}await a.save();return a;}
async function upsertCategory(d){const name=validCategory(d?.name);if(!name)return null;let c=await Category.findOne({name});if(!c)c=new Category({name});if(clean(d.description))c.description=clean(d.description);await c.save();return c;}

async function importOne(r,options,caches){let author=null,category=null;if(r.authorName){const key=r.authorUrl||`name:${r.authorName}`;if(!caches.authors.has(key))caches.authors.set(key,r.authorUrl?await parseAuthor(r.authorUrl,r.authorName):{name:r.authorName});const ad=caches.authors.get(key);if(ad)author=await upsertAuthor(ad,options.downloadFiles!==false);}if(r.categoryName){const key=r.categoryUrl||`name:${r.categoryName}`;if(!caches.categories.has(key))caches.categories.set(key,r.categoryUrl?await parseCategory(r.categoryUrl,r.categoryName):{name:r.categoryName});const cd=caches.categories.get(key);if(cd)category=await upsertCategory(cd);}
  const isNew=!await Book.exists({source:"SMART",sourceUrl:r.sourceUrl}); let book=await Book.findOne({source:"SMART",sourceUrl:r.sourceUrl}); if(!book)book=new Book({title:r.title,source:"SMART",sourceUrl:r.sourceUrl,status:"approved",isAvailable:false});
  book.title=r.title; if(r.description)book.description=r.description;if(r.publishedYear)book.publishedYear=r.publishedYear;if(r.language)book.language=r.language;if(r.isbn)book.isbn=r.isbn;if(r.rights)book.rights=r.rights;book.sourceProvider=new URL(r.sourceUrl).hostname;
  if(author){book.author=author._id;book.submittedAuthorName=author.name;}if(category){book.category=category._id;book.submittedCategoryName=category.name;}
  if(options.downloadFiles!==false&&!book.coverImageId){const x=await findBookCover({title:r.title,author:r.authorName,isbn:r.isbn});if(x){const ext=/png/i.test(x.contentType)?"png":/webp/i.test(x.contentType)?"webp":"jpg";const u=await uploadBuffer(x.buffer,safe(r.title,ext),x.contentType,{entity:"book-cover",sourceUrl:x.finalUrl,provider:x.provider,query:x.query},"libraryCovers");book.coverImageId=u.id;book.coverImage=x.finalUrl;}}
  if(options.downloadFiles&&r.pdfUrl&&rightsAllowed(r.rights)&&!book.fileId){const pdf=await downloadFile(r.pdfUrl);const sig=pdf?.buffer?.subarray(0,5).toString("ascii");if(pdf&&sig==="%PDF-"){const u=await uploadBuffer(pdf.buffer,safe(r.title,"pdf"),"application/pdf",{entity:"book-pdf",sourceUrl:pdf.finalUrl,rights:r.rights},"libraryBooks");book.fileId=u.id;book.filePath=pdf.finalUrl;book.sourceFileUrl=pdf.finalUrl;book.isAvailable=true;}}
  await book.save(); return{bookId:book._id,title:book.title,author:author?.name||"",category:category?.name||"",externalCover:true,isNew}; }

async function scanAndImport(rootUrl,options={}){if(!/^https?:\\/\\//i.test(rootUrl))throw new Error("الرابط يجب أن يبدأ بـ http أو https.");const c=await crawl(rootUrl,options.maxPages);const caches={authors:new Map(),categories:new Map()},books=[];if(options.import!==false)for(const r of c.records){try{books.push(await importOne(r,options,caches));}catch(e){books.push({title:r.title,error:e.message});}}return{pages:c.pages,discovered:c.records.length,normalized:c.records.length,imported:books.filter(x=>!x.error).length,books,externalImages:true,imagePolicy:"external-web-only-v6"};}
module.exports={scanAndImport};
