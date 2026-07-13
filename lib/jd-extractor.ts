const JD_SELECTORS = [
  '.job-sec .job-sec-text',
  '.job-detail .detail-content',
  '.job-main .job-detail',
];

const MIN_JD_LENGTH = 50;

export function extractJD(): string | null {
  for (const selector of JD_SELECTORS) {
    const el = document.querySelector(selector);
    if (!el) continue;
    const text = el.textContent?.trim() || '';
    if (text.length >= MIN_JD_LENGTH) return cleanText(text);
  }
  return fallbackScan();
}

function fallbackScan(): string | null {
  const candidates: { node: Element; length: number }[] = [];
  const all = document.querySelectorAll('div, section, article, p');

  for (const el of all) {
    if (el.children.length > 5) continue;
    const text = el.textContent?.trim() || '';
    if (text.length > 200) {
      candidates.push({ node: el, length: text.length });
    }
  }

  candidates.sort((a, b) => b.length - a.length);

  for (const { node } of candidates) {
    const text = node.textContent?.trim() || '';
    if (containsJDKeywords(text)) return cleanText(text);
  }

  return null;
}

function containsJDKeywords(text: string): boolean {
  const keywords = ['任职要求', '岗位职责', '职位描述', '工作内容', '能力要求'];
  return keywords.some((kw) => text.includes(kw));
}

function cleanText(text: string): string {
  return text.replace(/[\t ]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
}
