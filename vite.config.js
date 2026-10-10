import { defineConfig } from 'vite';

// Production blocks application network connections; dev keeps Vite's local HMR.
const csp = "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'";
export default defineConfig(({ command }) => ({
  plugins: command === 'build' ? [{
    name: 'local-only-policy',
    transformIndexHtml() {
      return [{ tag: 'meta', attrs: { 'http-equiv': 'Content-Security-Policy', content: csp }, injectTo: 'head-prepend' }];
    }
  }] : [],
  server: { host: '127.0.0.1' },
  preview: { host: '127.0.0.1' }
}));
