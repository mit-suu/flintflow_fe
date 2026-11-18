/**
 * Thanh dính (sticky) của các trang có tìm kiếm / lọc: cuộn danh sách thì thanh vẫn nằm trong tầm mắt.
 *
 * Mép dưới mềm: một dải nền trắng đặc 40% rồi dốc đều về trong suốt, để nội dung cuộn qua mờ dần thay vì bị cắt thẳng.
 * Không có điểm `via` — ép độ mờ ở giữa làm gãy dốc, nhìn ra thành một đường. Dải cao 16px ≈ khoảng cách tiêu đề→card,
 * nên lúc chưa dính không phủ lên nội dung.
 */
export const STICKY_FADE =
  "after:content-[''] after:absolute after:inset-x-0 after:top-full after:h-4 after:pointer-events-none after:bg-linear-to-b after:from-surface-container-lowest after:from-40% after:to-transparent";

/**
 * Nền của thanh dính tràn ra cả lề ngang của vùng cuộn (âm margin = padding của vùng cuộn), để nội dung cuộn qua bên dưới
 * không lộ ở hai lề. Vùng cuộn phải dùng đúng padding `PAGE_GUTTER`; đổi một chỗ thì đổi cả hai.
 */
export const STICKY_BLEED = "-mx-4 px-4 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8";

/** Padding ngang của vùng cuộn đi cùng `STICKY_BLEED`. */
export const PAGE_GUTTER = "px-4 sm:px-6 lg:px-8";
