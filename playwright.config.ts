import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright e2e (T23) — chạy FE thật trên BE thật, **không có msw**.
 *
 * Hai địa chỉ lấy từ môi trường để chạy được ở cả ba nơi:
 *   - máy dev: FE `next dev` :3000, BE `tsx watch` :5000 (mặc định bên dưới)
 *   - CI: cùng cổng, BE + Mongo dựng trong job
 *   - docker compose (T24): trỏ `E2E_BASE_URL` / `E2E_API_URL` vào service tương ứng
 *
 * `webServer` chỉ tự khởi FE khi biến `E2E_BASE_URL` không được đặt — để trên máy dev không đá nhau với
 * server đang chạy sẵn.
 */
const baseURL = process.env.E2E_BASE_URL ?? "http://localhost:3000";
const apiURL = process.env.E2E_API_URL ?? "http://localhost:5000/api/v1";
const reuseExisting = Boolean(process.env.E2E_BASE_URL) || !process.env.CI;

export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  expect: { timeout: 10_000 },
  // Kịch bản đụng dữ liệu thật (tạo project) nên chạy tuần tự, không song song.
  fullyParallel: false,
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["list"]] : [["list"]],
  use: {
    baseURL,
    // `apiURL` cho `request` fixture — test gọi thẳng BE để gieo dữ liệu, không giả lập gì
    extraHTTPHeaders: {},
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "off",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  ...(reuseExisting
    ? {}
    : {
        webServer: {
          command: "npm run start",
          url: baseURL,
          timeout: 120_000,
          reuseExistingServer: false,
        },
      }),
});

export const E2E_API_URL = apiURL;
