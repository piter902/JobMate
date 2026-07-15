import { defineConfig } from 'wxt';
import { resolve } from 'path';

export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  vite: () => ({
    resolve: {
      alias: {
        '@': resolve(__dirname, '.'),
      },
    },
  }),
  manifest: {
    name: 'JobMate',
    description: 'AI 求职助手 — 智能招呼语、JD-简历匹配度分析、面试评估',
    version: '0.1.0',
    permissions: ['storage', 'clipboardWrite'],
    host_permissions: ['*://*.zhipin.com/*', '*://*.posthog.com/*'],
    content_scripts: [
      {
        matches: ['*://*.zhipin.com/*'],
        js: ['bypass-debugger.js'],
        world: 'MAIN' as const,
        run_at: 'document_start' as const,
      },
    ],
    icons: {
      16: 'icons/icon-16.png',
      32: 'icons/icon-32.png',
      48: 'icons/icon-48.png',
      128: 'icons/icon-128.png',
    },

    action: {
      default_title: 'JobMate',
      default_popup: 'popup.html',
      default_icon: {
        16: 'icons/icon-16.png',
        32: 'icons/icon-32.png',
        48: 'icons/icon-48.png',
        128: 'icons/icon-128.png',
      },
    },
  },
});
