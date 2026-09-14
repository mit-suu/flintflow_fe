/**
 * msw trong trình duyệt — chỉ khi `NEXT_PUBLIC_API_MOCK=1`.
 * Service worker: `public/mockServiceWorker.js` (sinh bằng `npx msw init public`).
 */
import { setupWorker } from "msw/browser";
import { handlers } from "./handlers";

export const MOCK_ENABLED = process.env.NEXT_PUBLIC_API_MOCK === "1";

let started: Promise<void> | null = null;

export const startMockWorker = (): Promise<void> => {
  if (!started) {
    started = setupWorker(...handlers)
      .start({ onUnhandledRequest: "bypass", quiet: true })
      .then(() => undefined);
  }
  return started;
};
