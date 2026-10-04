/**
 * Số credit mỗi tháng của từng gói — phải khớp `planConfig` ở `flintflow_be/src/modules/billing/plan.config.ts`
 * (`free.initialCredits` / `free.monthlyCredits`, `pro.monthlyCredits`). Trang công khai (landing, đăng ký) không gọi
 * được `GET /billing/packages` (cần đăng nhập) nên giữ bản sao ở đây — đổi ở BE thì đổi ở đây.
 */
export const FREE_PLAN_CREDITS = 300;
export const PRO_PLAN_CREDITS = 1000;
