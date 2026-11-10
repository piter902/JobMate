// Boss直聘提取器 —— 基于真实 HTML 验证

const JD_KEYWORDS = ['任职要求', '岗位职责', '职位描述', '工作内容', '能力要求', '任职资格', '岗位要求', '职位要求'];
const MIN_JD = 50;

export function extractCurrentJD(): { text: string; status: 'valid' | 'incomplete' | 'missing' | 'ambiguous'; reason: string } {
  const excluded = 'nav, aside, [hidden], [aria-hidden="true"], [class*="recommend"], [class*="related"], [class*="sidebar"], [class*="message-list"], [class*="chat-message"]';
  const nodes = Array.from(document.querySelectorAll('.job-sec-text, .job-detail, [class*="job-detail"], [class*="detail-content"]'))
    .filter(el => !el.closest(excluded) && el.getClientRects().length > 0 && window.getComputedStyle(el).visibility !== 'hidden');
  const leaves = nodes.filter(el => !nodes.some(other => other !== el && el.contains(other)));
  const texts = leaves.map(el => {
    const clone = el.cloneNode(true) as HTMLElement;
    clone.querySelectorAll(excluded + ', script, style, button').forEach(node => node.remove());
    clone.querySelectorAll('br').forEach(node => node.replaceWith('\n'));
    clone.querySelectorAll('p, div, li').forEach(node => node.append('\n'));
    return clean(clone.textContent || '');
  }).filter(Boolean);
  const unique = [...new Set(texts)];
  if (!unique.length) return { text: '', status: 'missing', reason: '未找到当前岗位JD，请打开职位详情' };
  if (unique.length > 1) return { text: '', status: 'ambiguous', reason: '检测到多个职位详情，请只打开目标岗位' };
  const text = unique[0];
  const incomplete = text.length < MIN_JD || !/任职要求|岗位要求|职位要求|任职资格|能力要求|要求[:：]/.test(text) ||
    leaves.some(el => /展开全部|展开更多|查看完整/.test((el.closest('.job-detail')?.parentElement || el.parentElement)?.innerText || '') ||
      (['hidden', 'clip'].includes(window.getComputedStyle(el).overflowY) && el.scrollHeight > el.clientHeight + 2));
  return { text, status: incomplete ? 'incomplete' : 'valid', reason: incomplete ? 'JD可能不完整，请展开完整职位要求后重试' : '' };
}

export function extractJD(): string | null {
  const result = extractCurrentJD();
  return result.status === 'valid' ? result.text : null;
}

// ---- 公司名 ----
export function extractCompany(): string {
  // .boss-info-attr（列表页 + 详情页通用），去掉后缀如" · hr"
  for (const el of document.querySelectorAll('.boss-info-attr, .boss-name')) {
    const raw = trimField(el.textContent || '');
    const text = raw.split('·')[0].trim(); // "大族数控 · hr" → "大族数控"
    if (text.length >= 2 && text.length <= 50) return text;
  }
  return '';
}

// ---- 岗位名 ----
export function extractJobTitle(): string {
  // 聊天页
  for (const el of document.querySelectorAll('.position-name')) {
    const text = trimField(stripSalary(el.textContent || ''));
    if (text.length >= 2 && text.length <= 60) return text;
  }
  // 详情页: .job-title
  for (const el of document.querySelectorAll('.job-title')) {
    const text = trimField(stripSalary(el.textContent || ''));
    if (text.length >= 2 && text.length <= 60) return text;
  }
  // 详情页 h1
  for (const el of document.querySelectorAll('h1')) {
    const text = trimField(stripSalary(el.textContent || ''));
    if (text.length >= 2 && text.length <= 60) return text;
  }
  // 列表页: .job-name
  for (const el of document.querySelectorAll('.job-name')) {
    const text = trimField(stripSalary(el.textContent || ''));
    if (text.length >= 2 && text.length <= 60) return text;
  }
  return '';
}

// ---- 发布人 ----
export function extractBossName(): string {
  // 聊天页: 从 .position-name 定位当前对话区域
  const pos = document.querySelector('.position-name');
  if (pos) {
    let el: Element | null = pos.parentElement;
    for (let i = 0; i < 6 && el; i++) {
      const nameEl = el.querySelector('.name-text');
      if (nameEl) {
        const text = trimField(nameEl.textContent || '');
        if (text.length >= 2 && text.length <= 20) return text;
      }
      el = el.parentElement;
    }
  }
  // 详情/列表页: .name-text（HR 的名字）
  for (const el of document.querySelectorAll('.name-text')) {
    const text = trimField(el.textContent || '');
    if (text.length >= 2 && text.length <= 20) return text;
  }
  return '';
}

// ---- 工具 ----
function stripSalary(text: string): string {
  return text.replace(/\s*\d{1,3}-\d{1,3}[kK](\s*·\s*\d+薪)?/, '').replace(/\s*\d{1,2}[kK]-\d{1,2}[kK]/, '').trim();
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
    if ((cur.textContent?.trim()?.length || 0) > 80) return cur;
    cur = cur.parentElement;
  }
  return null;
}

function isVisible(el: HTMLElement): boolean {
  const s = window.getComputedStyle(el);
  return s.display !== 'none' && s.visibility !== 'hidden' && el.offsetWidth > 0;
}

function isExcluded(el: Element): boolean {
  const ex = ['[class*="recommend"]', '[class*="related"]', '[class*="sidebar"]', '[class*="guess"]', '[class*="similar"]'];
  for (const sel of ex) { try { if (el.matches(sel) || el.closest(sel)) return true; } catch {} }
  return false;
}

function containsJD(text: string): boolean { return JD_KEYWORDS.some(k => text.includes(k)); }

function clean(text: string): string {
  return text.replace(/&[a-z]+;/gi, '').replace(/[\t  　]+/g, ' ').replace(/\n{2,}/g, '\n').replace(/ {2,}/g, ' ').replace(/^\s+|\s+$/gm, '').trim();
}

function trimField(text: string): string {
  return text.replace(/&[a-z]+;/gi, '').replace(/[\t  　]+/g, ' ').replace(/\s{2,}/g, ' ').trim();
}
