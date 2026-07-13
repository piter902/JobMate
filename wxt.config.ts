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
    name: '智能招呼语助手',
    description: '在Boss直聘上根据JD和简历自动生成个性化招呼语',
    version: '0.1.0',
    permissions: ['storage', 'clipboardWrite'],
    host_permissions: ['*://*.zhipin.com/*'],
    content_scripts: [
      {
        matches: ['*://*.zhipin.com/*'],
        js: ['bypass-debugger.js'],
        world: 'MAIN' as const,
        run_at: 'document_start' as const,
        all_frames: true,
      },
    ],
    action: {
      default_title: '智能招呼语助手',
      default_popup: 'popup.html',
    },
  },
});
