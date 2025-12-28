import path from 'path';
import { defineConfig, loadEnv } from 'vite';


export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  return {
    base: "/Interactive-App-Deployment-Launchpad-/",
    server: {
      port: 3021,
      host: '0.0.0.0',
      proxy: {
        '/api': 'http://localhost:3000'
      }
    },
    plugins: [],
    define: {},
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      }
    }
  };
});
