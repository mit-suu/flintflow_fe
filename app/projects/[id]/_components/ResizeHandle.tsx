"use client";

interface ResizeHandleProps {
  /** Đang kéo ⇒ vạch sáng tím. */
  active: boolean;
  onStart: () => void;
  /** Nháy đúp ⇒ về bề rộng mặc định. */
  onReset: () => void;
  /** Tên khung đang đổi cỡ — cho trình đọc màn hình. */
  label: string;
}

/**
 * Thanh kéo đổi cỡ giữa hai khung: vùng bắt chuột 10px nằm đè lên khe, chỉ hiện một vạch ngắn bo tròn ở giữa
 * (không chạy suốt chiều cao, khỏi đâm qua góc bo của khung bên cạnh).
 */
export default function ResizeHandle({ active, onStart, onReset, label }: ResizeHandleProps) {
  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label={label}
      onMouseDown={(e) => {
        e.preventDefault();
        onStart();
      }}
      onDoubleClick={onReset}
      className="relative w-[10px] -mx-[5px] z-20 cursor-col-resize group shrink-0 select-none flex items-center justify-center"
      title="Kéo để thay đổi kích thước (nháy đúp để về mặc định)"
    >
      <div className={`h-12 w-1 rounded-full transition-colors ${active ? "bg-primary" : "bg-transparent group-hover:bg-primary/60"}`} />
    </div>
  );
}
