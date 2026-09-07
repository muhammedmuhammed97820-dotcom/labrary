const Book = require("../models/Book");
const Author = require("../models/Author");
const Category = require("../models/Category");
const { uploadBuffer } = require("./gridfs.service");

const MAX_PAGE_BYTES = 4 * 1024 * 1024;
const MAX_PAGES = 200;
const MAX_ENTITY_PAGES = 200;
const MODEL = process.env.AI_IMPORT_MODEL || "gpt-5.6-luna";
const USER_AGENT = "ElectronicLibrary Smart Library Agent/3.0";
const SITE_NOISE = /foulabook|فولة\s*بوك|مكتبة\s*فولة|digital\s*library|المكتبة\s*الرقمية/i;

function decodeEntities(value) {
  const named = { nbsp:" ",amp:"&",lt:"<",gt:">",quot:'"',apos:"'",laquo:"«",raquo:"»",hellip:"…",ndash:"–",mdash:"—" };
  return String(value ?? "").replace(/&(#x?[0-9a-f]+|[a-z][a-z0-9]+);/gi, (m, code) => {
    const c = String(code).toLowerCase();
    if (c[0] === "#") { const hex = c[1] === "x"; const n = parseInt(c.slice(hex ? 2 : 1), hex ? 16 : 10); try { return Number.isFinite(n) ? String.fromCodePoint(n) : m; } catch { return m; } }
    return named[c] ?? m;
  });
}

function clean(value) {
  return decodeEntities(value).replace(/<script[\s\S]*?<\/script>/gi," ").replace(/<style[\s\S]*?<\/style>/gi," ").replace(/<noscript[\s\S]*?<\/noscript>/gi," ").replace(/<[^>]+>/g," ").replace(/\s+/g," ").trim();
}
function absolute(base, value) { try { return new URL(String(value || ""), base).href; } catch { return ""; } }
function sameOrigin(a,b) { try { return new URL(a).origin === new URL(b).origin; } catch { return false; } }
function escapeRegex(v) { return String(v).replace(/[.*+?^${}()|[\]\\]/g,"\\$&"); }
function safeName(v,ext) { return `${clean(v).replace(/[^\p{L}\p{N}]+/gu,"_").slice(0,120)||"file"}.${ext}`; }
function htmlText(html) { return clean(String(html || "").replace(/<script[\s\S]*?<\/script>/gi," ").replace(/<style[\s\S]*?<\/style>/gi," ")); }

function firstTag(html, tag) {
  const m = String(html || "").match(new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)<\\/${tag}>`,"i"));
  return clean(m?.[1] || "");
}
function allTags(html, tag) {
  const out=[]; const re=new RegExp(`<${tag}\\b([^>]*)>([\\s\\S]*?)<\\/${tag}>`,"gi"); let m;
  while((m=re.exec(String(html||"")))) out.push({attrs:m[1],text:clean(m[2])});
  return out;
}
function meta(html,name) {
  const n=escapeRegex(name);
  for(const re of [new RegExp(`<meta[^>]+(?:name|property)=["']${n}["'][^>]+content=["']([^"']*)["'][^>]*>`,"i"),new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]+(?:name|property)=["']${n}["'][^>]*>`,"i")]) {
    const m=String(html||"").match(re); if(m?.[1]) return clean(m[1]);
  }
  return "";
}
function jsonLd(html) {
  const out=[]; const re=/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi; let m;
  while((m=re.exec(String(html||"")))) { try { const v=JSON.parse(decodeEntities(m[1]).trim()); const add=x=>{ if(!x)return; if(Array.isArray(x))x.forEach(add); else if(x["@graph"]){out.push(x);x["@graph"].forEach(add);} else out.push(x); }; add(v); } catch(_){} }
  return out;
}
function anchors(html,pageUrl) {
  const out=[]; const re=/<a\b([^>]*)>([\s\S]*?)<\/a>/gi; let m;
  while((m=re.exec(String(html||"")))) { const href=m[1].match(/(?:href|data-href)=["']([^"']+)["']/i)?.[1]; if(!href||/^(?:javascript:|mailto:|tel:|#)/i.test(href))continue; const url=absolute(pageUrl,href); if(url)out.push({url,text:clean(m[2]).slice(0,500),attrs:m[1]}); }
  return out;
}
function images(html,pageUrl) {
  const out=[]; const re=/<img\b([^>]*)>/gi; let m;
  while((m=re.exec(String(html||"")))) { const a=m[1], vals=[]; for(const k of ["src","data-src","data-lazy-src","data-original","data-image"]){const v=a.match(new RegExp(`${k}=["']([^"']+)["']`,`i`))?.[1];if(v)vals.push(v);} const ss=a.match(/(?:srcset|data-srcset)=["']([^"']+)["']/i)?.[1]; if(ss)vals.push(...ss.split(",").map(x=>x.trim().split(/\s+/)[0])); for(const v of vals){const url=absolute(pageUrl,v);if(url)out.push({url,alt:clean(a.match(/alt=["']([^"']*)["']/i)?.[1]),attrs:a});} }
  const bg=/(?:background-image\s*:\s*url|data-background)\s*\(?["']?([^\)"']+)["']?\)?/gi; while((m=bg.exec(String(html||"")))){const url=absolute(pageUrl,m[1]);if(url)out.push({url,alt:"",attrs:"background"});}
  return out;
}

function cleanBookTitle(value) {
  let t=clean(value); if(!t)return "";
  t=t.replace(/^تحميل\s+كتاب\s+/iu,"");
  t=t.replace(/\s+(?:تحميل\s+كتاب)\s+/giu," ");
  t=t.replace(/\s+تأليف\s+.+?(?=\s+(?:pdf|الكاتب|المؤلف)\b|$)/iu,"");
  t=t.replace(/\s+(?:الكاتب|المؤلف)\s*[:：-]?\s*.+?(?=\s+pdf\b|$)/iu,"");
  t=t.replace(/\s*[-|–—:]\s*(?:فولة\s*بوك|مكتبة\s*فولة\s*بوك|foulabook).*$/iu,"");
  t=t.replace(/\s+(?:كتاب\s+)?pdf\s*$/iu,"");
  t=t.replace(/^(?:كتاب\s+)+/iu,"");
  return t.trim();
}
function validPersonName(value) {
  const n=clean(value).replace(/^(?:الكاتب|المؤلف|بقلم|تأليف)\s*[:：-]?\s*/iu,"").trim();
  if(!n||n.length<2||n.length>160||SITE_NOISE.test(n))return "";
  if(/تحميل\s+كتاب|حقوق|الحقوق|pdf\b|مكتبة|library|book\b/i.test(n))return "";
  return n;
}
function findAuthor(links,text,book,pageUrl) {
  let name=validPersonName(typeof book.author==="string"?book.author:book.author?.name);
  if(name){const a=links.find(x=>validPersonName(x.text).toLowerCase()===name.toLowerCase());return {name,url:a?.url||absolute(pageUrl,book.author?.url||"")};}
  for(const re of [/(?:الكاتب|المؤلف|تأليف|بقلم)\s*[:：-]?\s*([^|،,؛;\n]{2,120})/iu,/(?:هذا الكتاب|الكتاب)\s+من\s+تأليف\s+([^|،,؛;\n]{2,120})/iu]){const m=text.match(re);name=validPersonName(m?.[1]);if(name)break;}
  if(name){const a=links.find(x=>validPersonName(x.text).toLowerCase()===name.toLowerCase())||links.find(x=>validPersonName(x.text).toLowerCase().includes(name.toLowerCase()));return {name,url:a?.url||""};}
  const a=links.find(x=>/(?:author|writer|مؤلف|كاتب)/iu.test(`${x.url} ${x.text}`)&&validPersonName(x.text));
  return {name:validPersonName(a?.text),url:a?.url||""};
}
function findCategory(links,book,text) {
  const g=Array.isArray(book.genre)?book.genre[0]:book.genre; const gn=clean(typeof g==="object"?g?.name:g);
  if(gn){const a=links.find(x=>clean(x.text).toLowerCase()===gn.toLowerCase());return {name:gn,url:a?.url||""};}
  const a=links.find(x=>/(?:category|categories|genre|تصنيف|قسم|الأقسام)/iu.test(`${x.url} ${x.text}`)&&clean(x.text).length>=2&&clean(x.text).length<=100);
  if(a)return {name:clean(a.text),url:a.url};
  const m=text.match(/(?:التصنيف|القسم)\s*[:：-]\s*([^|،,؛;\n]{2,100})/iu); return {name:clean(m?.[1]),url:""};
}
function extractRights(text) {
  const t=clean(text); const clear=/(?:public domain|public-domain|creative commons|cc0|open access|open license|free to use|publicly licensed|ملك عام|المجال العام|رخصة المشاع الإبداعي|رخصة حرة|متاح للاستخدام الحر)/i; const restricted=/(?:all rights reserved|جميع الحقوق محفوظة|حقوق الطبع محفوظة|حقوق الكتاب محفوظة|للاستخدام الشخصي فقط)/i;
  for(const p of [clear,restricted]){const m=t.match(new RegExp(`[^.!?]{0,220}${p.source}[^.!?]{0,300}`,p.flags));if(m)return clean(m[0]);} return "";
}
function rightsAllowDownload(r){return Boolean(clean(r)&&!/(?:all rights reserved|جميع الحقوق محفوظة|حقوق الطبع محفوظة|حقوق الكتاب محفوظة|للاستخدام الشخصي فقط)/i.test(r)&&/(?:public domain|public-domain|creative commons|cc0|open access|open license|free to use|publicly licensed|ملك عام|المجال العام|رخصة المشاع الإبداعي|رخصة حرة|متاح للاستخدام الحر)/i.test(r));}

function isBookPage(pageUrl,html,data){
  const types=jsonLd(html).map(x=>String(x?.["@type"]||"").toLowerCase()); if(types.some(t=>t==="book"||t.includes("book")))return true;
  let path="";try{path=new URL(pageUrl).pathname;}catch(_){}
  if(/\/(?:ar\/)?book(?:\/|[-_])/i.test(path))return true;
  const titleOk=data.title&&data.title.length>=2&&!SITE_NOISE.test(data.title); const fields=[data.authorName,data.categoryName,data.isbn,data.pdfUrl].filter(Boolean).length; const body=/(?:تحميل\s+كتاب|تأليف|الكاتب|المؤلف|isbn|عدد\s+الصفحات|دار\s+النشر|سنة\s+النشر|حقوق\s+(?:الكتاب|الطبع))/iu.test(data.rawText||"");
  return Boolean(titleOk&&body&&fields>=1);
}
function extractBook(pageUrl,html){
  const nodes=jsonLd(html),book=nodes.find(x=>{const t=String(x?.["@type"]||"").toLowerCase();return t==="book"||t.includes("book");})||{}; const links=anchors(html,pageUrl),rawText=htmlText(html).slice(0,18000); const h1=firstTag(html,"h1"); const title=cleanBookTitle(book.name||h1||meta(html,"og:title")||html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]||""); const author=findAuthor(links,rawText,book,pageUrl); const category=findCategory(links,book,rawText); const pdfUrl=links.map(x=>x.url).find(x=>/\.pdf(?:$|[?#])/i.test(x))||"";
  const candidates=[]; const ji=typeof book.image==="string"?book.image:book.image?.url; if(ji)candidates.push({url:absolute(pageUrl,ji),score:100}); const og=meta(html,"og:image");if(og)candidates.push({url:absolute(pageUrl,og),score:95});
  for(const img of images(html,pageUrl)){const hint=`${img.alt} ${img.attrs}`;let score=20;if(/cover|book-cover|bookcover|غلاف|صورة\s*الكتاب/i.test(hint))score+=80;if(title&&hint.toLowerCase().includes(title.toLowerCase()))score+=40;if(/logo|favicon|avatar|author|profile|placeholder|default|icon|sprite|pixel/i.test(hint))score-=120;if(/\.svg(?:$|[?#])/i.test(img.url))score-=50;candidates.push({url:img.url,score});}
  candidates.sort((a,b)=>b.score-a.score); const coverUrl=candidates.find(x=>x.url&&x.score>0)?.url||"";
  const articles=allTags(html,"article").map(x=>x.text).sort((a,b)=>b.length-a.length); const description=clean(book.description||meta(html,"description")||articles[0]||""); const dateValue=book.datePublished||book.dateCreated||""; const ym=String(dateValue).match(/\b(1[5-9]\d{2}|20\d{2}|21\d{2})\b/); const year=ym?Number(ym[1]):undefined; const keywords=Array.isArray(book.keywords)?book.keywords:clean(book.keywords).split(/[,،]/).map(clean).filter(Boolean);
  return {isBook:isBookPage(pageUrl,html,{title,authorName:author.name,categoryName:category.name,pdfUrl,isbn:clean(book.isbn),rawText}),title,authorName:author.name,authorUrl:author.url,categoryName:category.name,categoryUrl:category.url,description,publishedYear:year,language:clean(book.inLanguage),isbn:clean(book.isbn||book.isbn13||book.isbn10),subjects:keywords.map(clean).filter(Boolean),coverUrl,pdfUrl,sourceUrl:pageUrl,rights:extractRights(rawText),rawText};
}

async function fetchPage(url){
  const response=await fetch(url,{redirect:"follow",headers:{"User-Agent":USER_AGENT,Accept:"text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8","Accept-Language":"ar,en;q=0.8"}}); if(!response.ok)throw new Error(`HTTP ${response.status}`); const type=response.headers.get("content-type")||""; if(!/text\/html|application\/xhtml|application\/xml|text\/xml/i.test(type))return null; const len=Number(response.headers.get("content-length")||0);if(len>MAX_PAGE_BYTES)throw new Error("الصفحة أكبر من الحد المسموح."); const text=await response.text();if(Buffer.byteLength(text,"utf8")>MAX_PAGE_BYTES)throw new Error("الصفحة أكبر من الحد المسموح.");return text;
}
function crawlLinks(html,pageUrl,root){return anchors(html,pageUrl).map(x=>x.url).filter(u=>sameOrigin(root,u)).filter(u=>!/\.(?:jpg|jpeg|png|gif|webp|svg|ico|css|js|zip|rar|mp3|mp4|avi|docx?|xlsx?|pptx?)(?:$|[?#])/i.test(u)).filter(u=>!/[?&](?:replytocom|share|print)=/i.test(u));}
async function crawlLibrary(rootUrl,maxPages=MAX_PAGES){const root=new URL(rootUrl);root.hash="";const queue=[root.href],queued=new Set(queue),visited=new Set(),records=[];const limit=Math.max(1,Math.min(Number(maxPages)||MAX_PAGES,MAX_PAGES));while(queue.length&&visited.size<limit){const url=queue.shift();if(visited.has(url))continue;visited.add(url);try{const html=await fetchPage(url);if(!html)continue;const r=extractBook(url,html);if(r.isBook&&r.title)records.push(r);for(const next of crawlLinks(html,url,root.origin)){if(!queued.has(next)&&!visited.has(next)&&visited.size+queue.length<limit*3){queued.add(next);queue.push(next);}}}catch(_){} }return {pages:visited.size,records};}

function parseAuthor(pageUrl,html,fallback){const nodes=jsonLd(html),person=nodes.find(x=>String(x?.["@type"]||"").toLowerCase()==="person")||{};const name=validPersonName(person.name)||validPersonName(firstTag(html,"h1"))||validPersonName(meta(html,"og:title"))||validPersonName(fallback);const article=allTags(html,"article").map(x=>x.text).sort((a,b)=>b.length-a.length)[0]||"";const bio=clean(person.description||article||meta(html,"description"));const vals=[];const pi=typeof person.image==="string"?person.image:person.image?.url;if(pi)vals.push(absolute(pageUrl,pi));const og=meta(html,"og:image");if(og)vals.push(absolute(pageUrl,og));for(const img of images(html,pageUrl)){const hint=`${img.alt} ${img.attrs}`;if(!/logo|favicon|placeholder|default|icon/i.test(hint))vals.push(img.url);}return {name,bio,imageUrl:vals.find(Boolean)||"",birthDate:clean(person.birthDate),deathDate:clean(person.deathDate),birthPlace:clean(typeof person.birthPlace==="string"?person.birthPlace:person.birthPlace?.name),nationality:clean(typeof person.nationality==="string"?person.nationality:person.nationality?.name),occupation:clean(typeof person.jobTitle==="string"?person.jobTitle:person.occupation?.name),website:clean(person.url||(Array.isArray(person.sameAs)?person.sameAs[0]:person.sameAs)),sourceUrl:pageUrl};}
function parseCategory(pageUrl,html,fallback){const nodes=jsonLd(html),cat=nodes.find(x=>/collectionpage|itemlist|category/i.test(String(x?.["@type"]||"")))||{};const article=allTags(html,"article").map(x=>x.text).sort((a,b)=>b.length-a.length)[0]||"";return {name:clean(firstTag(html,"h1")||cat.name||meta(html,"og:title")||fallback),description:clean(cat.description||meta(html,"description")||article),sourceUrl:pageUrl};}
async function enrichEntities(records,rootUrl,maxPages=MAX_ENTITY_PAGES){const cache=new Map(),authors=new Map(),cats=new Map();for(const r of records){if(r.authorUrl&&r.authorName&&sameOrigin(rootUrl,r.authorUrl))authors.set(r.authorUrl,r.authorName);if(r.categoryUrl&&r.categoryName&&sameOrigin(rootUrl,r.categoryUrl))cats.set(r.categoryUrl,r.categoryName);}let count=0;for(const [url,name] of authors){if(count++>=maxPages)break;try{const html=await fetchPage(url);if(html)cache.set(`a:${url}`,parseAuthor(url,html,name));}catch(_){} }for(const [url,name] of cats){if(count++>=maxPages)break;try{const html=await fetchPage(url);if(html)cache.set(`c:${url}`,parseCategory(url,html,name));}catch(_){} }return records.map(r=>({...r,authorData:cache.get(`a:${r.authorUrl}`)||null,categoryData:cache.get(`c:${r.categoryUrl}`)||null}));}

function responseText(data){if(typeof data?.output_text==="string")return data.output_text;return (data?.output||[]).flatMap(x=>x?.content||[]).map(x=>typeof x?.text==="string"?x.text:"").join("\n");}
async function aiNormalize(records){
  const fallback=records.map(r=>({...r,title:cleanBookTitle(r.title),authorName:validPersonName(r.authorData?.name)||validPersonName(r.authorName),authorBio:clean(r.authorData?.bio),authorImageUrl:r.authorData?.imageUrl||"",birthDate:clean(r.authorData?.birthDate),deathDate:clean(r.authorData?.deathDate),birthPlace:clean(r.authorData?.birthPlace),nationality:clean(r.authorData?.nationality),occupation:clean(r.authorData?.occupation),website:clean(r.authorData?.website),categoryName:clean(r.categoryData?.name||r.categoryName)||"غير مصنف",categoryDescription:clean(r.categoryData?.description),description:clean(r.description),language:clean(r.language)||(/^[\u0600-\u06ff]/u.test(r.title||"")?"ar":""),rights:clean(r.rights),subjects:Array.isArray(r.subjects)?r.subjects.map(clean).filter(Boolean):[]}));
  if(!process.env.OPENAI_API_KEY)return fallback;
  const batch=fallback.slice(0,20).map(r=>({sourceUrl:r.sourceUrl,titleCandidate:r.title,pageText:r.rawText,authorPage:r.authorData,categoryPage:r.categoryData,authorCandidate:r.authorName,categoryCandidate:r.categoryName}));
  const prompt=`أنت وكيل فهرسة لمكتبة إلكترونية. أعد JSON array فقط وبنفس عدد العناصر وبنفس sourceUrl. لا تخترع أي معلومة.\nقواعد: title اسم الكتاب الحقيقي فقط؛ احذف تحميل كتاب وتأليف وpdf واسم الموقع. authorName اسم المؤلف الحقيقي فقط؛ ممنوع استخدام اسم الموقع أو عبارة SEO كمؤلف. استخدم صفحة المؤلف والتصنيف. description نص نظيف بلا HTML. لا تستنتج الحقوق. لا تغير sourceUrl ولا تخترع روابط. الحقول: title, authorName, authorBio, authorImageUrl, birthDate, deathDate, birthPlace, nationality, occupation, website, categoryName, categoryDescription, description, publishedYear, language, isbn, subjects, rights, sourceUrl, pdfUrl, coverUrl.\nDATA:\n${JSON.stringify(batch)}`;
  try{const response=await fetch("https://api.openai.com/v1/responses",{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${process.env.OPENAI_API_KEY}`},body:JSON.stringify({model:MODEL,input:prompt})});if(!response.ok)return fallback;const data=await response.json();const text=responseText(data).replace(/^```json\s*/i,"").replace(/\s*```$/i,"").trim();const parsed=JSON.parse(text);if(!Array.isArray(parsed))return fallback;const byUrl=new Map(parsed.map(x=>[String(x?.sourceUrl||""),x]));return fallback.map(r=>{const x=byUrl.get(r.sourceUrl);if(!x)return r;return {...r,...x,title:cleanBookTitle(x.title||r.title),authorName:validPersonName(x.authorName)||r.authorName,categoryName:clean(x.categoryName)||r.categoryName,description:clean(x.description)||r.description,authorBio:clean(x.authorBio)||r.authorBio,categoryDescription:clean(x.categoryDescription)||r.categoryDescription,subjects:Array.isArray(x.subjects)?x.subjects.map(clean).filter(Boolean):r.subjects};});}catch(_){return fallback;}
}
async function downloadAsset(url,type){if(!url)return null;try{const response=await fetch(url,{redirect:"follow",headers:{"User-Agent":USER_AGENT,Accept:"*/*"}});if(!response.ok)return null;const buffer=Buffer.from(await response.arrayBuffer());if(!buffer.length||buffer.length>80*1024*1024)return null;return {buffer,contentType:response.headers.get("content-type")||type||"application/octet-stream",finalUrl:response.url||url};}catch(_){return null;}}
function parseDate(v){const d=v?new Date(v):null;return d&&!Number.isNaN(d.getTime())?d:undefined;}
async function upsertAuthor(d,options){const name=validPersonName(d?.name);if(!name)return null;let a=await Author.findOne({name});if(!a)a=new Author({name});for(const [k,v] of Object.entries({bio:clean(d.bio),birthDate:parseDate(d.birthDate),deathDate:parseDate(d.deathDate),birthPlace:clean(d.birthPlace),nationality:clean(d.nationality),occupation:clean(d.occupation),website:clean(d.website)})){if(v!==undefined&&v!=="")a[k]=v;}if(options.downloadFiles&&d.imageUrl&&!a.imageId){const asset=await downloadAsset(d.imageUrl,"image/jpeg");if(asset&&/^image\//i.test(asset.contentType)){const ext=/png/i.test(asset.contentType)?"png":/webp/i.test(asset.contentType)?"webp":"jpg";const up=await uploadBuffer(asset.buffer,safeName(name,ext),asset.contentType,{entity:"author",sourceUrl:d.sourceUrl||d.imageUrl},"libraryAuthors");a.imageId=up.id;}}if(d.imageUrl)a.image=d.imageUrl;await a.save();return a;}
async function upsertCategory(d){const name=clean(d?.name);if(!name)return null;let c=await Category.findOne({name});if(!c)c=new Category({name});if(clean(d.description))c.description=clean(d.description);await c.save();return c;}
async function importBooks(records,options){const results=[];for(const r of records){try{const title=cleanBookTitle(r.title);if(!title||SITE_NOISE.test(title)){results.push({status:"skipped",reason:"invalid-title",sourceUrl:r.sourceUrl});continue;}const authorName=validPersonName(r.authorName);const author=authorName?await upsertAuthor({name:authorName,bio:r.authorBio,imageUrl:r.authorImageUrl,birthDate:r.birthDate,deathDate:r.deathDate,birthPlace:r.birthPlace,nationality:r.nationality,occupation:r.occupation,website:r.website,sourceUrl:r.authorUrl},options):null;const category=await upsertCategory({name:clean(r.categoryName)||"غير مصنف",description:r.categoryDescription});const provider=(()=>{try{return new URL(r.sourceUrl).hostname}catch{return ""}})();const sourceId=r.sourceUrl||`${title}|${authorName||""}`;let book=await Book.findOne({source:"SMART",sourceId});if(book&&options.updateExisting!==true){results.push({status:"exists",id:book._id,title,sourceUrl:r.sourceUrl});continue;}const wasNew=!book;if(!book)book=new Book({source:"SMART",sourceId});book.title=title;book.author=author?._id||null;book.category=category?._id||null;book.submittedAuthorName=authorName||"";book.submittedCategoryName=clean(r.categoryName)||"غير مصنف";book.description=clean(r.description);book.publishedYear=Number.isFinite(Number(r.publishedYear))?Number(r.publishedYear):undefined;book.language=clean(r.language);book.isbn=clean(r.isbn);book.subjects=Array.isArray(r.subjects)?r.subjects.map(clean).filter(Boolean):[];book.source="SMART";book.sourceId=sourceId;book.sourceUrl=r.sourceUrl||"";book.sourceFileUrl=r.pdfUrl||"";book.sourceProvider=provider;book.rights=clean(r.rights);book.status="approved";book.isAvailable=Boolean(book.fileId);if(options.downloadFiles&&rightsAllowDownload(r.rights)&&r.pdfUrl){const pdf=await downloadAsset(r.pdfUrl,"application/pdf");if(pdf&&/application\/pdf|\.pdf(?:$|[?#])/i.test(`${pdf.contentType} ${pdf.finalUrl}`)){const up=await uploadBuffer(pdf.buffer,safeName(title,"pdf"),"application/pdf",{entity:"book",sourceUrl:r.sourceUrl,rights:r.rights},"libraryBooks");book.fileId=up.id;book.isAvailable=true;}}if(options.downloadFiles&&r.coverUrl){const cover=await downloadAsset(r.coverUrl,"image/jpeg");if(cover&&/^image\//i.test(cover.contentType)){const ext=/png/i.test(cover.contentType)?"png":/webp/i.test(cover.contentType)?"webp":"jpg";const up=await uploadBuffer(cover.buffer,safeName(title,ext),cover.contentType,{entity:"book-cover",sourceUrl:r.sourceUrl},"libraryCovers");book.coverImageId=up.id;book.coverImage="";}}await book.save();results.push({status:wasNew?"imported":"updated",id:book._id,title,author:author?.name||"",category:category?.name||"",sourceUrl:r.sourceUrl,hasCover:Boolean(book.coverImageId),hasPdf:Boolean(book.fileId)});}catch(error){results.push({status:"error",title:r.title,sourceUrl:r.sourceUrl,error:error.message});}}return results;}
function dedupeRecords(records){const map=new Map();for(const r of records){const key=r.sourceUrl||`${cleanBookTitle(r.title).toLowerCase()}|${validPersonName(r.authorName).toLowerCase()}`;if(!map.has(key))map.set(key,r);}return [...map.values()];}
async function scanAndImport(rootUrl,options={}){if(!/^https?:\/\//i.test(rootUrl))throw new Error("الرابط يجب أن يبدأ بـ http أو https.");const maxPages=Math.max(1,Math.min(Number(options.maxPages)||MAX_PAGES,MAX_PAGES));const crawl=await crawlLibrary(rootUrl,maxPages);const enriched=await enrichEntities(crawl.records,rootUrl,Number(options.maxEntityPages)||MAX_ENTITY_PAGES);const normalized=await aiNormalize(enriched);const cleanRecords=dedupeRecords(normalized).filter(r=>r.title&&!SITE_NOISE.test(r.title));const preview=cleanRecords.map(r=>({title:r.title,author:r.authorName||"مؤلف غير معروف",category:r.categoryName||"غير مصنف",description:r.description||"",sourceUrl:r.sourceUrl,authorUrl:r.authorUrl||"",categoryUrl:r.categoryUrl||"",coverUrl:r.coverUrl||"",pdfUrl:r.pdfUrl||"",rights:r.rights||"",authorImageUrl:r.authorImageUrl||""}));let results=[];if(options.import!==false)results=await importBooks(cleanRecords,options);return {pages:crawl.pages,discovered:crawl.records.length,normalized:cleanRecords.length,imported:results.filter(x=>x.status==="imported"||x.status==="updated").length,skipped:results.filter(x=>x.status==="skipped").length,existing:results.filter(x=>x.status==="exists").length,errors:results.filter(x=>x.status==="error").length,preview,results};}

module.exports={scanAndImport,crawlLibrary,extractBook,cleanBookTitle,extractRights,rightsAllowDownload};
