/**
 * FLF-398 — dấu nội dung của file chọn trên trình duyệt (SHA-256, cùng cách BE tính `contentHash`) để nhận ra file trùng ngay lúc
 * chọn, kể cả khi đã đổi tên. Trình duyệt không đọc / không băm được ⇒ lùi về tên + cỡ + ngày sửa (chỉ bắt được đúng một file
 * chọn hai lần).
 */
const readBytes = (file: File): Promise<ArrayBuffer> =>
  typeof file.arrayBuffer === "function"
    ? file.arrayBuffer()
    : new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as ArrayBuffer);
        reader.onerror = () => reject(reader.error);
        reader.readAsArrayBuffer(file);
      });

export async function fileFingerprint(file: File): Promise<string> {
  try {
    const digest = await crypto.subtle.digest("SHA-256", new Uint8Array(await readBytes(file)));
    return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
  } catch {
    return `${file.name}|${file.size}|${file.lastModified}`;
  }
}

/**
 * Tách các file mới thành giữ / trùng: trùng một dấu đã có (`known`) hoặc trùng file đứng trước trong cùng lượt chọn. Trả kèm dấu
 * của từng file giữ lại để lần chọn sau so tiếp.
 */
export async function splitDuplicateFiles(
  files: readonly File[],
  known: ReadonlySet<string>
): Promise<{ kept: { file: File; fingerprint: string }[]; duplicates: File[] }> {
  const seen = new Set(known);
  const kept: { file: File; fingerprint: string }[] = [];
  const duplicates: File[] = [];
  for (const file of files) {
    const fingerprint = await fileFingerprint(file);
    if (seen.has(fingerprint)) duplicates.push(file);
    else {
      seen.add(fingerprint);
      kept.push({ file, fingerprint });
    }
  }
  return { kept, duplicates };
}
