import { defineConfig } from 'vite';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

// Production blocks application network connections; dev keeps Vite's local HMR.
const csp = "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'";
export default defineConfig(async ({ command }) => {
  const plugins = command === 'build' ? [{
    name: 'local-only-policy',
    transformIndexHtml() {
      return [{ tag: 'meta', attrs: { 'http-equiv': 'Content-Security-Policy', content: csp }, injectTo: 'head-prepend' }];
    }
  }] : [];
  const tools = process.env.XSSI_BUILD_TOOLS_DIR;
  const metadata = process.env.XSSI_FRONTEND_METADATA_FILE;
  if (command === 'build' && (tools || metadata)) {
    if (!tools || !metadata) throw new Error('The runtime inventory needs both exact tools and its output path');
    const { runtimeInventory } = await import(pathToFileURL(resolve(tools, 'scripts/frontend_build.mjs')).href);
    plugins.push(runtimeInventory({ root: resolve('.'), output: resolve(metadata) }));
  }
  return {
  plugins,
  server: { host: '127.0.0.1' },
  preview: { host: '127.0.0.1' }
  };
});
