import { chromium } from 'playwright';

// 用系统安装的 Chrome（复用 cookie）
const browser = await chromium.launch({
  headless: false,
  channel: 'chrome',
});

const page = await browser.newPage();
await page.goto('https://www.zhipin.com/web/geek/job?query=前端开发&city=100010000', {
  waitUntil: 'domcontentloaded', timeout: 30000,
});

console.log('等待加载...');
await page.waitForTimeout(6000);

const currentUrl = page.url();
console.log('当前 URL:', currentUrl);

// 检查是否跳到登录页
if (currentUrl.includes('user') || currentUrl.includes('login') || currentUrl.includes('passport')) {
  console.log('需要登录。请在浏览器中手动登录，然后按 Ctrl+C 继续...');
  // 等待用户登录并导航
  await page.waitForURL('**/web/geek/**', { timeout: 120000 });
  await page.waitForTimeout(3000);
}

await page.screenshot({ path: '/tmp/zhipin_screen.png' });
console.log('截图: /tmp/zhipin_screen.png');

const info = await page.evaluate(() => {
  const result = { url: location.href, title: document.title, top: [] };
  for (const el of document.querySelectorAll('h1, h2, [class*="name"], [class*="title"], [class*="company"], [class*="biz"], [class*="salary"], [class*="job-name"], [class*="job-title"]')) {
    const text = (el.textContent || '').trim().slice(0, 80);
    if (text.length >= 2 && text.length <= 80) {
      result.top.push({ tag: el.tagName, cls: (el.className || '').slice(0, 150), text });
    }
  }
  const jd = document.querySelector('.job-sec, .job-detail, [class*="detail-content"], [class*="job-detail"]');
  result.jdHTML = jd ? jd.outerHTML.slice(0, 2500) : 'NOT FOUND';
  // 也找 job-card
  result.cards = [];
  for (const card of document.querySelectorAll('[class*="job-card"], [class*="job-item"]')) {
    const els = card.querySelectorAll('[class*="name"], [class*="title"], [class*="company"], [class*="salary"]');
    result.cards.push(Array.from(els).map(el => ({
      tag: el.tagName,
      cls: (el.className || '').slice(0, 120),
      text: (el.textContent || '').trim().slice(0, 60),
    })));
    if (result.cards.length >= 2) break;
  }
  return result;
});

console.log('\n=== 页面信息 ===');
console.log('URL:', info.url);
console.log('Title:', info.title);

if (info.cards.length) {
  console.log('\n=== job-card 结构 ===');
  info.cards.forEach((card, i) => {
    console.log(`\nCard ${i + 1}:`);
    card.forEach(e => console.log(`  <${e.tag} class="${e.cls}"> ${e.text}`));
  });
}

console.log('\n=== 顶部元素 ===');
info.top.forEach((e, i) => console.log(`[${i}] <${e.tag} class="${e.cls}"> ${e.text}`));

console.log('\n=== JD HTML ===');
console.log(info.jdHTML);

await browser.close();
