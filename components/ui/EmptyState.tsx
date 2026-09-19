import type { ReactNode } from "react";
import Icon, { type IconName } from "./Icon";

interface EmptyStateProps {
  icon: IconName;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}

/** Trạng thái rỗng: icon + tiêu đề + mô tả + nút hành động tuỳ chọn. */
export default function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div className={`flex flex-col items-center text-center gap-2 py-14 px-6 ${className ?? ""}`}>
      <span className="w-11 h-11 rounded-full bg-surface-container-high text-on-surface-muted flex items-center justify-center mb-1">
        <Icon name={icon} size={20} />
      </span>
      <h3 className="text-[14.5px] font-extrabold text-on-surface">{title}</h3>
      {description && <p className="text-[12.5px] text-on-surface-muted max-w-[360px] leading-[1.55]">{description}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
