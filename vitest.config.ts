import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { storybookTest } from '@storybook/addon-vitest/vitest-plugin';
import { playwright } from '@vitest/browser-playwright';
const dirname = typeof __dirname !== 'undefined' ? __dirname : path.dirname(fileURLToPath(import.meta.url));

// More info at: https://storybook.js.org/docs/next/writing-tests/integrations/vitest-addon
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'happy-dom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: ['node_modules/', 'src/test/', '**/*.test.ts', '**/*.test.tsx', 'vite.config.ts', 'vitest.config.ts']
    },
    projects: [{
      extends: true,
      plugins: [
      storybookTest({
        configDir: path.join(dirname, '.storybook')
      })],
      test: {
        name: 'storybook',
        browser: {
          enabled: true,
          headless: true,
          provider: playwright({}),
          instances: [{
            browser: 'chromium'
          }]
        },
        setupFiles: ['.storybook/vitest.setup.ts'],
      }
    }, {
      extends: true,
      test: {
        name: 'normal',
        include: ['**/*.test.ts', '**/*.test.tsx'],
        exclude: ['**/node_modules/**', '**/.git/**', 'src/test/**'],
      }
    }, {
      extends: true,
      test: {
        name: 'visual',
        include: ['src/test/*.visual.test.tsx'],
        browser: {
          enabled: true,
          headless: true,
          provider: playwright({}),
          instances: [{ browser: 'chromium' }],
          commands: {
            matchScreenshot(_ctx, name: string, base64: string, update: boolean) {
              const dir = path.join(dirname, 'src/test/screenshots');
              fs.mkdirSync(dir, { recursive: true });
              const file = path.join(dir, `${name}.png`);
              const incoming = Buffer.from(base64, 'base64');
              if (!fs.existsSync(file) || update) {
                fs.writeFileSync(file, incoming);
                return null;
              }
              const baseline = fs.readFileSync(file);
              return baseline.equals(incoming) ? null : baseline.toString('base64');
            },
          },
        },
        setupFiles: ['.storybook/vitest.setup.ts'],
        snapshotOptions: {
          resolveSnapshotPath: (testPath: string, ext: string) =>
            path.join(dirname, 'src/test/screenshots', path.basename(testPath) + ext),
        },
      }
    }]
  }
});
