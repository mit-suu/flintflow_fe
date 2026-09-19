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
  },
});
