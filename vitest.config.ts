import path from "node:path";
import { fileURLToPath } from "node:url";
import { configDefaults, defineConfig } from "vitest/config";

const rootDir = path.resolve(fileURLToPath(new URL(".", import.meta.url)));

export default defineConfig({
  resolve: {
    alias: { "@": rootDir },
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./test/setup.ts"],
    include: ["**/*.test.{ts,tsx}"],
    // `e2e/` là Playwright (`npm run e2e`), không phải vitest — include ở trên chỉ bắt `*.test.*`
    // nhưng loại tường minh để không ai vô tình đặt `*.test.ts` vào đó rồi chạy hai runner chồng nhau.
    exclude: [...configDefaults.exclude, ".next/**", "e2e/**"],
    /**
     * Coverage (V6 DoD): chỉ đo vùng mode 1 v2 — component, hook và lớp API của nó. Đo cả repo thì
     * con số bị pha loãng bởi trang legacy và không nói lên điều gì về phần vừa viết.
     */
    coverage: {
      provider: "v8",
      reporter: ["text-summary", "json-summary", "lcov"],
      reportsDirectory: "coverage",
      include: [
        "app/projects/[id]/_components/mode1/**/*.{ts,tsx}",
        "app/projects/[id]/hooks/mode1/**/*.ts",
        "lib/api/{import,change-requests,versions,export}.ts",
      ],
      exclude: ["**/*.test.{ts,tsx}"],
      thresholds: {
        "app/projects/[id]/_components/mode1/**": { lines: 80 },
        "app/projects/[id]/hooks/mode1/**": { lines: 80 },
      },
    },
  },
});
