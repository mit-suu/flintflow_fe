import Icon from "./Icon";

interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  /** Tên cho trình đọc màn hình (placeholder không thay được label). */
  label: string;
  className?: string;
}

/** Ô tìm kiếm bo tròn có icon; nút xoá hiện khi có nội dung. */
export default function SearchInput({ value, onChange, placeholder, label, className }: SearchInputProps) {
  return (
    <div
      className={`flex items-center gap-2 h-9 bg-surface-container-lowest border border-outline rounded-full px-3.5 text-on-surface-subtle focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/15 transition-colors ${className ?? ""}`}
    >
      <Icon name="search" size={15} />
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={label}
        className="flex-1 min-w-0 bg-transparent outline-none text-[12.5px] text-on-surface placeholder:text-on-surface-subtle [&::-webkit-search-cancel-button]:hidden"
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange("")}
          aria-label="Xoá tìm kiếm"
          className="text-on-surface-subtle hover:text-on-surface cursor-pointer"
        >
          <Icon name="close" size={14} />
        </button>
      )}
    </div>
  );
}
