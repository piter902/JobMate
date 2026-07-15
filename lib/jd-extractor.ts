// Boss直聘 JD 提取器

const DETAIL_SELECTORS = [
  '.job-sec .job-sec-text',
  '.job-detail .detail-content',
  '.job-main .job-detail',
  '.detail-box .text',
  '.job-detail-box .job-detail-content',
  '[class*="job-detail"] [class*="content"]',
  '[class*="detail"] [class*="desc"]',
  '[class*="job"] [class*="detail"]',
];

const LIST_SELECTORS = [
  '.job-card-body .job-info',
  '.job-card .job-text',
  '[class*="job-card"] [class*="desc"]',
  '[class*="job-card"] [class*="info"]',
  '[class*="job-card"] [class*="text"]',
];

const EXCLUDE = ['[class*="recommend"]', '[class*="related"]', '[class*="sidebar"]', '[class*="guess"]'];
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
    if (section) {
      const text = clean(section.textContent || '');
      if (text.length >= MIN_LEN) return text;
    }
  }

  const scope = document.querySelector('main, [role="main"], .main, .container') || document.body;
  const candidates: Array<{ el: Element; len: number }> = [];
  for (const el of scope.querySelectorAll('div, section, article')) {
    if (isExcluded(el) || el.children.length > 10) continue;
    const text = clean(el.textContent || '');
    if (text.length > 100 && containsJD(text)) {
      candidates.push({ el, len: text.length });
    }
  }

  if (candidates.length > 0) {
    candidates.sort((a, b) => a.len - b.len);
    return candidates[Math.floor(candidates.length / 2)].el.textContent?.trim() || null;
  }

  return null;
}

// ---- 公司名提取 ----

export function extractCompany(): string {
  // 策略：找明确包含 company/biz 类名的元素，且内容不像岗位名
  const selectors = [
    '[class*="company-name"]',
    '[class*="company"] [class*="name"]',
    '[class*="biz-name"]',
    '[class*="employer"]',
    '.name-box .name',
  ];
  for (const sel of selectors) {
    for (const el of document.querySelectorAll(sel)) {
      const text = (el.textContent || '').trim();
      if (isCompanyName(text)) return text;
    }
  }
  return '';
}

function isCompanyName(text: string): boolean {
  if (text.length < 2 || text.length > 50) return false;
  // 排除包含薪资格式的内容
  if (/\d{1,2}[kK万]/.test(text)) return false;
  if (/\d+-\d+[kK]?/.test(text)) return false;
  // 排除纯岗位描述
  if (/前端|后端|工程师|经理|总监|专员|实习|开发|设计|运营|产品/.test(text) && !/[公司|集团|科技|网络|信息|软件|数据]/.test(text)) return false;
  return true;
}

// ---- 岗位名提取 ----

export function extractJobTitle(): string {
  // 策略：找主标题，但剥离薪资
  const selectors = [
    '.job-detail .job-name',
    '[class*="job-name"]',
    '[class*="job-title"]',
    '.detail-top .name h1',
    '.detail-top .name',
    '.job-detail h1',
  ];
  for (const sel of selectors) {
    for (const el of document.querySelectorAll(sel)) {
      const raw = (el.textContent || '').trim();
      const text = stripSalary(raw);
      if (text.length >= 2 && text.length <= 60) return text;
    }
  }

  // 兜底：找第一个 h1，排除公司特征
  for (const el of document.querySelectorAll('h1')) {
    const raw = (el.textContent || '').trim();
    const text = stripSalary(raw);
    if (text.length >= 2 && text.length <= 60 && !isCompanyName(text)) return text;
  }
  return '';
}

// 剥离薪资后缀 如 "前端开发 20-30K" → "前端开发"
function stripSalary(text: string): string {
  return text
    .replace(/\s*\d{1,3}-\d{1,3}[kK]?(\s*·\s*\d+薪)?/, '')
    .replace(/\s*\d{1,2}[kK]-\d{1,2}[kK]/, '')
    .trim();
}

// ---- 工具 ----

function isListingPage(): boolean {
  const cards = document.querySelectorAll('[class*="job-card"], [class*="job-item"], [class*="job-list"] li');
  return cards.length >= 2 || /web\/geek|search|query/.test(location.pathname);
}

function findChatButton(): Element | null {
  for (const el of document.querySelectorAll('a, button, span, div')) {
    if ((el.textContent || '').trim() === '立即沟通' && isVisible(el as HTMLElement)) return el;
  }
  return null;
}

function walkUp(el: Element): Element | null {
  let cur: Element | null = el.parentElement;
  for (let i = 0; i < 12 && cur; i++) {
    const text = cur.textContent?.trim() || '';
    if (text.length > 80 && (containsJD(text) || text.length > 300)) {
      let p = cur.parentElement;
      for (let j = 0; j < 2 && p; j++) {
        const pt = p.textContent?.trim() || '';
        if (pt.length > text.length * 2) break;
        if (pt.length >= text.length && (containsJD(pt) || pt.length > 300)) cur = p;
        p = p.parentElement;
      }
      return cur;
    }
    cur = cur.parentElement;
  }
  return null;
}

function isVisible(el: HTMLElement): boolean {
  const s = window.getComputedStyle(el);
  return s.display !== 'none' && s.visibility !== 'hidden' && el.offsetWidth > 0;
}

function isExcluded(el: Element): boolean {
  for (const sel of EXCLUDE) {
    try { if (el.matches(sel) || el.closest(sel)) return true; } catch {}
  }
  return false;
}

function containsJD(text: string): boolean {
  return JD_KEYWORDS.some(k => text.includes(k));
}

function clean(text: string): string {
  return text.replace(/[\t ]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
}
