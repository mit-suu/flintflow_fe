import Icon from "./Icon";

export interface FilterOption<T extends string> {
  value: T;
  label: string;
}

interface FilterSelectProps<T extends string> {
  label: string;
  value: T;
  options: readonly FilterOption<T>[];
  onChange: (value: T) => void;
  className?: string;
}

/**
 * Pill "Trạng thái: Đang làm ▾". Dùng `<select>` gốc phủ trong suốt lên pill để giữ bàn phím,
 * trình đọc màn hình và picker native trên mobile.
 */
export default function FilterSelect<T extends string>({ label, value, options, onChange, className }: FilterSelectProps<T>) {
  const current = options.find((o) => o.value === value)?.label ?? "";
  return (
    <div
      className={`relative inline-flex items-center gap-1.5 h-9 px-3.5 rounded-full bg-surface-container-lowest border border-outline text-[12.5px] focus-within:ring-2 focus-within:ring-primary/30 ${className ?? ""}`}
    >
      <span className="text-on-surface-muted font-semibold">{label}:</span>
      <span className="text-on-surface font-bold">{current}</span>
      <Icon name="chevron-down" size={13} className="text-on-surface-muted" />
      <select
        aria-label={label}
        value={value}
        onChange={(e) => onChange(e.target.value as T)}
        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}
