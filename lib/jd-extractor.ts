const JD_SELECTORS = [
  '.job-sec .job-sec-text',
  '.job-detail .detail-content',
  '.job-main .job-detail',
  '.detail-box .text',
  '[class*="job-detail"] [class*="content"]',
  '[class*="detail"] [class*="desc"]',
];

const EXCLUDE_SELECTORS = [
  '[class*="recommend"]', '[class*="related"]', '[class*="sidebar"]',
  '[class*="guess"]', '[class*="guess-you"]',
];

const MIN_JD_LENGTH = 80;

export function extractJD(): string | null {
  // 1. 优先用选择器直接匹配
  for (const selector of JD_SELECTORS) {
    const el = document.querySelector(selector);
    if (!el || isExcluded(el)) continue;
    const text = el.textContent?.trim() || '';
    if (text.length >= MIN_JD_LENGTH) return cleanText(text);
  }

  // 2. 从"立即沟通"按钮向上找所属的职位区块
  const chatBtn = findChatButton();
  if (chatBtn) {
    const section = findJobSection(chatBtn);
    if (section) {
      const text = section.textContent?.trim() || '';
      if (text.length >= MIN_JD_LENGTH && containsJDKeywords(text)) {
        return cleanText(text);
      }
    }
  }

  // 3. 精准降级：在主内容区找包含 JD 关键词的区块
  const mainArea = document.querySelector('main, [role="main"], .main, .container, .content, .wrap');
  const scope = mainArea || document.body;
  const candidates: { node: Element; length: number }[] = [];
  const all = scope.querySelectorAll('div, section, article');

  for (const el of all) {
    if (isExcluded(el)) continue;
    if (el.children.length > 8) continue;
    const text = el.textContent?.trim() || '';
    if (text.length > 200 && containsJDKeywords(text)) {
      candidates.push({ node: el, length: text.length });
    }
  }

  // 取中位数长度的（最长可能是页面级容器，最短可能是导航）
  candidates.sort((a, b) => a.length - b.length);
  if (candidates.length > 0) {
    const mid = candidates[Math.floor(candidates.length / 2)];
    return cleanText(mid.node.textContent?.trim() || '');
  }

  return null;
}

function findChatButton(): Element | null {
  const all = document.querySelectorAll('a, button, span, div');
  for (const el of all) {
    if ((el.textContent || '').trim() === '立即沟通') {
      const htmlEl = el as HTMLElement;
      const style = window.getComputedStyle(htmlEl);
      if (style.display !== 'none' && style.visibility !== 'hidden') return el;
    }
  }
  return null;
}

function findJobSection(btn: Element): Element | null {
  // 向上遍历 DOM，找到包含 JD 关键词的祖先区块
  let el: Element | null = btn.parentElement;
  let depth = 0;
  while (el && depth < 10) {
    const text = el.textContent?.trim() || '';
    if (text.length > 300 && containsJDKeywords(text)) {
      // 再往上走1-2层找更完整的区块
      let parent = el.parentElement;
      let parentDepth = 0;
      while (parent && parentDepth < 3) {
        const pt = parent.textContent?.trim() || '';
        if (pt.length > text.length * 1.5) break; // 父级包含太多额外内容
        if (pt.length >= text.length && containsJDKeywords(pt)) {
          el = parent;
        }
        parent = parent.parentElement;
        parentDepth++;
      }
      return el;
    }
    el = el.parentElement;
    depth++;
  }
  return null;
}

function isExcluded(el: Element): boolean {
  for (const sel of EXCLUDE_SELECTORS) {
    try {
      if (el.matches(sel) || el.closest(sel)) return true;
    } catch {}
  }
  return false;
}

function containsJDKeywords(text: string): boolean {
  const keywords = ['任职要求', '岗位职责', '职位描述', '工作内容', '能力要求', '任职资格', '岗位要求'];
  return keywords.some((kw) => text.includes(kw));
}

function cleanText(text: string): string {
  return text.replace(/[\t ]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
}
