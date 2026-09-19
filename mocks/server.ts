/** msw cho Node (vitest). */
import { setupServer } from "msw/node";
import { handlers } from "./handlers";
import { mode1Handlers } from "./mode1/handlers";

/** Handlers mode 1 đứng trước: route trùng chỉ chặn project mode 1, còn lại rơi xuống handlers pipeline. */
export const mockServer = setupServer(...mode1Handlers, ...handlers);
