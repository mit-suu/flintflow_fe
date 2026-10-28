/**
 * FLF-332 — business-flow §2 "Lỗi khi gọi AI": BE tự thử lại 2 lần rồi hoàn credit; người dùng chọn **Thử lại ngay** hoặc
 * **Để sau**. Nhóm mã này (cùng bảng với pipeline-contract §0.3) là "AI lỗi" — không gồm hết credit (402, luồng nạp) hay lỗi
 * dữ liệu (đầu vào, xung đột version) vốn có câu và nút riêng ở `friendlyError`.
 */
export const AI_ERROR_CODES: ReadonlySet<string> = new Set(["AI_PROVIDER_ERROR", "RATE_LIMIT_EXCEEDED", "AI_EXECUTION_FAILED", "PARSE_FAILED", "SCHEMA_MISMATCH"]);

export const isAiErrorCode = (code: string | null | undefined): boolean => code != null && AI_ERROR_CODES.has(code);
