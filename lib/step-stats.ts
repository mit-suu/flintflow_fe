/**
 * Số liệu thật của những lần chạy trước (03-live-status-flow §6): thời gian và credit của mỗi bước, lấy
 * từ chính `gate_ready` (BE đo), nhớ lại trong trình duyệt để lần sau nói được "lần trước mất khoảng 1
 * phút · 4 credit".
 *
 * Cố ý KHÔNG bịa ước lượng: chưa từng chạy bước đó thì không hiện gì. Một con số đoán bừa còn tệ hơn
 * không có số — user sẽ tin nó rồi thấy mình bị lừa ở lần chờ thứ hai.
 *
 * Lưu theo **id template** (`S-5.4`, bỏ `@màn`) để mọi màn dùng chung kinh nghiệm của nhau.
 */

const KEY = "flintflow_step_stats";
const MAX_ENTRIES = 120;

export interface StepStat {
  duration_ms: number;
  credits: number;
}

type StatMap = Record<string, StepStat>;

const templateOf = (stepId: string): string => stepId.split("@")[0];

const read = (): StatMap => {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as StatMap) : {};
  } catch {
    return {};
  }
};

export const getStepStat = (stepId: string): StepStat | null => read()[templateOf(stepId)] ?? null;

/** Ghi lại lần chạy vừa xong. Giá trị mới trộn với giá trị cũ (trung bình trượt nhẹ) cho đỡ nhảy. */
export const recordStepStat = (stepId: string, stat: StepStat): void => {
  if (typeof window === "undefined") return;
  try {
    const all = read();
    const key = templateOf(stepId);
    const previous = all[key];
    const merged: StepStat = previous
      ? { duration_ms: Math.round((previous.duration_ms + stat.duration_ms) / 2), credits: Math.round((previous.credits + stat.credits) / 2) }
      : stat;
    const entries = Object.entries({ ...all, [key]: merged }).slice(-MAX_ENTRIES);
    window.localStorage.setItem(KEY, JSON.stringify(Object.fromEntries(entries)));
  } catch {
    // Trình duyệt chặn localStorage: thiếu ước lượng không đáng để hỏng màn hình
  }
};
