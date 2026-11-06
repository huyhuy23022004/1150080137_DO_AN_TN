import { fileURLToPath, URL } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const ANTD_CHUNK_COUNT = 4;

function normalizeId(id: string): string {
  return id.replaceAll('\\', '/');
}

function antdChunk(id: string): string {
  let hash = 0;

  for (let index = 0; index < id.length; index += 1) {
    hash = (hash * 31 + id.charCodeAt(index)) >>> 0;
  }

  return `antd-${(hash % ANTD_CHUNK_COUNT) + 1}`;
}

function manualChunks(id: string): string | undefined {
  const path = normalizeId(id);

  if (!path.includes('/node_modules/')) {
    return undefined;
  }

  if (/\/node_modules\/(recharts|react-smooth|react-is)\//.test(path)) {
    return 'recharts';
  }

  if (/\/node_modules\/(victory-vendor|d3-[^/]+)\//.test(path)) {
    return 'charts-vendor';
  }

  if (
    /\/node_modules\/(socket\.io-client|socket\.io-parser|engine\.io-client|engine\.io-parser|xmlhttprequest-ssl)\//.test(
      path,
    )
  ) {
    return 'socket';
  }

  if (
    /\/node_modules\/(react|react-dom|scheduler|react-router|react-router-dom|use-sync-external-store|@remix-run)\//.test(
      path,
    )
  ) {
    return 'react-vendor';
  }

  if (/\/node_modules\/@tanstack\//.test(path)) {
    return 'query-vendor';
  }

  if (/\/node_modules\/(axios|dayjs|zustand)\//.test(path)) {
    return 'app-vendor';
  }

  if (/\/node_modules\/@ant-design\/icons(-svg)?\//.test(path)) {
    return 'antd-icons';
  }

  if (
    /\/node_modules\/(antd|@ant-design|@rc-component|rc-[^/]+)\//.test(path) ||
    /\/node_modules\/(classnames|copy-to-clipboard|json2mq|resize-observer-polyfill|scroll-into-view-if-needed|throttle-debounce|toggle-selection)\//.test(
      path,
    )
  ) {
    return antdChunk(path);
  }

  return 'vendor';
}

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    port: 5174,
    strictPort: true,
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks,
      },
      onwarn(warning, warn) {
        if (warning.code === 'CIRCULAR_CHUNK') {
          return;
        }

        warn(warning);
      },
    },
  },
});
