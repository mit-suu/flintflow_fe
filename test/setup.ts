import "@testing-library/jest-dom/vitest";
import { cleanup, configure } from "@testing-library/react";
import { afterEach } from "vitest";

/**
 * Nợ T12 — test trượt lúc chạy cả suite: `waitFor`/`findBy*` mặc định chờ 1 s, đủ khi chạy một file (màn workspace
 * dựng xong trong ~0,3 s) nhưng không đủ khi hàng chục worker vitest cùng giành CPU (cùng một test chậm gấp 15 lần).
 * Nguyên nhân là tranh tài nguyên, không phải logic — nới hạn chờ **một chỗ** cho mọi test thay vì rải `timeout`
 * theo từng lời gọi rồi vẫn trượt chỗ khác. Test hỏng thật vẫn trượt, chỉ chậm hơn khi báo.
 */
configure({ asyncUtilTimeout: 15_000 });

afterEach(() => {
  cleanup();
});
