/**
 * FLF-461 (BF §1.1 cột "3, 4", §3.1.2): dự án vừa sang Luồng 2 từ file upload vào ở B-0.x (BE đặt `B-0.1`). Phần đã có trong
 * file là đầu vào Brief, AI tự mở lời và chỉ hỏi phần thiếu ⇒ không hiện màn "kể ý tưởng". Khung mẫu trống (chưa có tên hệ
 * thống từ file) vẫn chờ người dùng kể ý tưởng.
 */
export interface Flow2StartInput {
  hasImportState: boolean;
  /** Spine đã có tên hệ thống lấy từ file. */
  hasSystemNameFromFile: boolean;
}

/** Dự án có đầu vào từ file ⇒ AI tự mở lời, không hiện màn ý tưởng. */
export const startsFromFile = (i: Flow2StartInput): boolean => i.hasImportState && i.hasSystemNameFromFile;

export const isFlow2OpeningStep = (step: string | null): boolean => step !== null && (step.startsWith("B-0.") || step.startsWith("B-1."));
