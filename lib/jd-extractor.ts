// Boss直聘 JD 提取器 —— 支持列表页和详情页

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

  // 1. 选择器直接匹配
  const selectors = isList ? [...LIST_SELECTORS, ...DETAIL_SELECTORS] : DETAIL_SELECTORS;
  for (const sel of selectors) {
    for (const el of document.querySelectorAll(sel)) {
      if (isExcluded(el)) continue;
      const text = clean(el.textContent || '');
      if (text.length >= MIN_LEN && containsJD(text)) return text;
    }
  }

  // 2. 从"立即沟通"按钮定位所属职位区块
  const btn = findChatButton();
  if (btn) {
    const section = walkUp(btn);
    if (section) {
      const text = clean(section.textContent || '');
      if (text.length >= MIN_LEN) return text;
    }
  }

  // 3. 全局扫描含 JD 关键词的节点
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

function isListingPage(): boolean {
  const cards = document.querySelectorAll('[class*="job-card"], [class*="job-item"], [class*="job-list"] li');
  return cards.length >= 2 || /web\/geek|search|query/.test(location.pathname);
}

function findChatButton(): Element | null {
  for (const el of document.querySelectorAll('a, button, span, div')) {
    const t = (el.textContent || '').trim();
    if (t === '立即沟通' && isVisible(el as HTMLElement)) return el;
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


// ---- 公司名 & 岗位名提取 ----

export function extractCompany(): string {
  // 只从明确含 company/biz 类名的元素提取
  const selectors = [
    '[class*="company"] [class*="name"]',
    '[class*="biz"] [class*="name"]',
    '.biz-name',
    '[class*="company-name"]',
    '[class*="employer"]',
  ];
  for (const sel of selectors) {
    for (const el of document.querySelectorAll(sel)) {
      const text = el.textContent?.trim() || '';
      if (text.length >= 2 && text.length <= 50) return text;
    }
  }
  return '';
}

export function extractJobTitle(): string {
  // 只从明确含 job/title/position 类名的元素提取
  const selectors = [
    '[class*="job"] [class*="title"]',
    '[class*="job-name"]',
    '[class*="position"]',
    '.detail-top .name h1',
    '.job-detail h1',
    '.job-detail [class*="title"]',
  ];
  for (const sel of selectors) {
    for (const el of document.querySelectorAll(sel)) {
      const text = el.textContent?.trim() || '';
      // 排除公司名（通常较短且不含岗位特征词）
      if (text.length >= 3 && text.length <= 60) return text;
    }
  }

  // 最后的兜底：找 h1（但要排除公司名的可能）
  const h1s = document.querySelectorAll('h1');
  for (const el of h1s) {
    const text = el.textContent?.trim() || '';
    if (text.length >= 3 && text.length <= 60) return text;
  }
  return '';
}
