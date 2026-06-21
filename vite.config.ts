import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

export default defineConfig(() => {
  const hmrPort = Number(process.env.HMR_PORT || ((Number(process.env.PORT || 3000)) + 1));
  const disableHmr = process.env.DISABLE_HMR === 'true';
  const isReactVendor = (id: string) =>
    /[\\/]node_modules[\\/](react|react-dom|scheduler)[\\/]/.test(id);
  const getPackageChunkName = (id: string) => {
    const [, packagePath = ''] = id.split(/node_modules[\\/]/);
    const parts = packagePath.split(/[\\/]/).filter(Boolean);
    if (parts.length === 0) {
      return 'vendor';
    }
    const packageName = parts[0].startsWith('@')
      ? `${parts[0]}-${parts[1] || 'pkg'}`
      : parts[0];
    return packageName.replace('@', '').replace(/[^\w-]/g, '_');
  };

  return {
    build: {
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (!id.includes('node_modules')) {
              return undefined;
            }
            if (id.includes('recharts')) {
              return 'charts';
            }
            if (id.includes('motion')) {
              return 'motion';
            }
            if (id.includes('@sentry')) {
              return 'sentry';
            }
            if (id.includes('firebase')) {
              return 'firebase';
            }
            if (id.includes('lucide-react')) {
              return 'icons';
            }
            if (id.includes('sonner')) {
              return 'ui';
            }
            if (isReactVendor(id)) {
              return 'react-vendor';
            }
            return getPackageChunkName(id);
          },
        },
      },
    },
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // The app is served through the Express wrapper in server.ts, so HMR is
      // optional and disabling it avoids websocket port collisions with other
      // local Vite projects.
      hmr: disableHmr
        ? false
        : {
            port: hmrPort,
            clientPort: hmrPort,
          },
    },
  };
});
