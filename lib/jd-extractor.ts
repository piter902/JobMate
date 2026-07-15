// Boss直聘 JD/公司/岗位提取器 —— 兼容列表页和详情页

const DETAIL_SELECTORS = [
  '.job-sec .job-sec-text',
  '.job-detail .detail-content',
  '.job-main .job-detail',
  '.detail-box .text',
  '.job-detail-box .job-detail-content',
  '[class*="job-detail"] [class*="content"]',
  '[class*="detail"] [class*="desc"]',
];

const LIST_SELECTORS = [
  '.job-card-body .job-info',
  '.job-card .job-text',
  '[class*="job-card"] [class*="desc"]',
  '[class*="job-card"] [class*="info"]',
];

const EXCLUDE = ['[class*="recommend"]', '[class*="related"]', '[class*="sidebar"]', '[class*="guess"]', '[class*="similar"]'];
const JD_KEYWORDS = ['任职要求', '岗位职责', '职位描述', '工作内容', '能力要求', '任职资格', '岗位要求', '职位要求'];
const MIN_LEN = 50;

export function extractJD(): string | null {
  const isList = isListingPage();
  const selectors = isList ? [...LIST_SELECTORS, ...DETAIL_SELECTORS] : DETAIL_SELECTORS;
  for (const sel of selectors) {
    for (const el of document.querySelectorAll(sel)) {
      if (isExcluded(el)) continue;
      const text = clean(el.textContent || '');
      if (text.length >= MIN_LEN && containsJD(text)) return text;
    }
  }

  const btn = findChatButton();
  if (btn) {
    const section = walkUp(btn);
    if (section) { const t = clean(section.textContent || ''); if (t.length >= MIN_LEN) return t; }
  }

  const scope = document.querySelector('main, [role="main"], .main, .container') || document.body;
  const candidates: Array<{ len: number; text: string }> = [];
  for (const el of scope.querySelectorAll('div, section, article')) {
    if (isExcluded(el) || el.children.length > 10) continue;
    const text = clean(el.textContent || '');
    if (text.length > 100 && containsJD(text)) candidates.push({ len: text.length, text: el.textContent?.trim() || '' });
  }
  if (candidates.length > 0) {
    candidates.sort((a, b) => a.len - b.len);
    return candidates[Math.floor(candidates.length / 2)].text;
  }
  return null;
}

// ---- 公司名 ----
// 列表页: .boss-name    详情页: .boss-info-attr

export function extractCompany(): string {
  for (const sel of ['.boss-info-attr', '.boss-name', '[class*="boss-name"]']) {
    for (const el of document.querySelectorAll(sel)) {
      const text = (el.textContent || '').trim();
      if (text.length >= 2 && text.length <= 50) return text;
    }
  }
  return '';
}

// ---- 岗位名 ----
// 详情页: h1 或 .job-title    列表页: .job-name

export function extractJobTitle(): string {
  // 详情页优先 h1
  for (const el of document.querySelectorAll('h1')) {
    const raw = (el.textContent || '').trim();
    const text = stripSalary(raw);
    if (text.length >= 2 && text.length <= 60) return text;
  }
  // .job-title (详情页)
  for (const el of document.querySelectorAll('.job-title, [class*="job-title"]')) {
    const raw = (el.textContent || '').trim();
    const text = stripSalary(raw);
    if (text.length >= 2 && text.length <= 60) return text;
  }
  // .job-name (列表页)
  for (const el of document.querySelectorAll('.job-name, [class*="job-name"]')) {
    const raw = (el.textContent || '').trim();
    const text = stripSalary(raw);
    if (text.length >= 2 && text.length <= 60) return text;
  }
  return '';
}

function stripSalary(text: string): string {
  return text.replace(/\s*\d{1,3}-\d{1,3}[kK](\s*·\s*\d+薪)?/, '').replace(/\s*\d{1,2}[kK]-\d{1,2}[kK]/, '').trim();
}

// ---- 工具 ----

function isListingPage(): boolean {
  return document.querySelectorAll('[class*="job-card"]').length >= 2;
}

function findChatButton(): Element | null {
  for (const el of document.querySelectorAll('a, button, span, div')) {
    if ((el.textContent || '').trim() === '立即沟通' && isVisible(el as HTMLElement)) return el;
  }
  return null;
}

function walkUp(el: Element): Element | null {
  let cur = el.parentElement;
  for (let i = 0; i < 12 && cur; i++) {
    const text = cur.textContent?.trim() || '';
    if (text.length > 80 && (containsJD(text) || text.length > 300)) return cur;
    cur = cur.parentElement;
  }
  return null;
}

function isVisible(el: HTMLElement): boolean {
  const s = window.getComputedStyle(el);
  return s.display !== 'none' && s.visibility !== 'hidden' && el.offsetWidth > 0;
}

function isExcluded(el: Element): boolean {
  for (const sel of EXCLUDE) { try { if (el.matches(sel) || el.closest(sel)) return true; } catch {} }
  return false;
}

function containsJD(text: string): boolean { return JD_KEYWORDS.some(k => text.includes(k)); }
function clean(text: string): string { return text.replace(/[\t ]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim(); }
