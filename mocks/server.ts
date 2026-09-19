/** msw cho Node (vitest). */
import { setupServer } from "msw/node";
import { handlers } from "./handlers";
<<<<<<< HEAD

export const mockServer = setupServer(...handlers);
=======
import { mode1Handlers } from "./mode1/handlers";

/** Handlers mode 1 đứng trước: route trùng chỉ chặn project mode 1, còn lại rơi xuống handlers pipeline. */
export const mockServer = setupServer(...mode1Handlers, ...handlers);
>>>>>>> 64c5c9d6d2ef9995dd4ae90e2421caaeb2a87099
