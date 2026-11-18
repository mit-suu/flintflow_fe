import { useEffect, useState } from "react";

/**
 * Trả về `value` sau khi nó ngừng đổi `delay` ms. Dùng cho ô tìm kiếm gọi BE: gõ liên tục chỉ bắn
 * một request sau khi dừng gõ.
 */
export function useDebounce<T>(value: T, delay = 400): T {
  const [debounced, setDebounced] = useState<T>(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debounced;
}
