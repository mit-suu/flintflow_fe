"use client";

import { useTranslations } from "next-intl";
import type { BrokenLink } from "@/types/template-migration";

interface BrokenLinksNoticeProps {
  /** Liên kết gãy do BE chạy khô (`broken_links`) cộng thông báo 409 lúc áp dụng; rỗng ⇒ không hiện. */
  links: readonly BrokenLink[];
}

/** Đổi ngược mà bỏ sửa làm gãy liên kết giữa các mục: hiện trước khi áp dụng, nút Áp dụng khoá tới khi hết. */
export default function BrokenLinksNotice({ links }: BrokenLinksNoticeProps) {
  const t = useTranslations("mode1.templateMigration.summary");
  if (links.length === 0) return null;
  return (
    <div role="alert" className="rounded-card bg-error-container p-3 text-body text-on-error-container flex flex-col gap-1.5">
      <p className="font-bold">{t("linksBroken")}</p>
      <p className="text-caption">{t("linksBrokenHelp")}</p>
      <ul className="list-disc pl-5">
        {links.map((l, i) => (
          <li key={`${l.path ?? l.rule}-${i}`} className="break-words">
            {l.message}
          </li>
        ))}
      </ul>
    </div>
  );
}
