import { useSyncExternalStore } from "react";

const MOBILE_BREAKPOINT = 768;

/**
 * Bề rộng cửa sổ là trạng thái của trình duyệt, không của React — đọc qua `useSyncExternalStore` thay vì
 * `useEffect` + `setState` (cách đó làm thêm một lượt render và vướng `react-hooks/set-state-in-effect`).
 */
const subscribe = (onChange: () => void) => {
  const query = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
};

const getSnapshot = () => window.innerWidth < MOBILE_BREAKPOINT;

/** Server không biết bề rộng màn hình; dựng bản desktop rồi để client chỉnh lại nếu là màn nhỏ. */
const getServerSnapshot = () => false;

export function useIsMobile() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
