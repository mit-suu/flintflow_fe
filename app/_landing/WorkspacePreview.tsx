import { GridBackdrop } from "./ui";

/*
 * Minh hoạ workspace: chat BA bên trái, section nháp chờ duyệt + fact/assumption/xung đột bên phải.
 * Ví dụ tĩnh, không gọi API. Dưới md hai cột xếp chồng.
 */
export default function WorkspacePreview() {
  return (
    <section
      id="workspace"
      aria-labelledby="workspace-title"
      className="relative scroll-mt-24 border-t border-outline-variant bg-white px-4 pb-16 pt-10 sm:px-8 lg:px-[72px] lg:pb-[88px]"
    >
      <GridBackdrop mask="linear-gradient(transparent, #000 40%, transparent)" className="opacity-50" />

      <div className="relative mb-9 pt-8 text-center">
        <p className="font-mono text-xs tracking-[0.16em] text-[#8B5CF0]">BÊN TRONG WORKSPACE</p>
        <h2
          id="workspace-title"
          className="mt-2.5 text-3xl font-extrabold tracking-[-0.02em] text-on-surface sm:text-[40px] sm:leading-tight"
        >
          Không gì vào tài liệu
          <br />
          khi <span className="landing-gradient-text">chưa được bạn duyệt.</span>
        </h2>
      </div>

      <figure
        aria-label="Minh hoạ workspace FlintFlow"
        className="relative mx-auto max-w-[1080px] overflow-hidden rounded-3xl border border-outline-variant bg-surface shadow-[0_40px_100px_rgba(91,46,196,0.14)]"
      >
        {/* Title bar */}
        <div className="flex h-[46px] items-center gap-[9px] border-b border-outline-variant bg-white px-4 sm:px-[22px]">
          <span aria-hidden="true" className="size-2.5 rounded-full bg-accent-gold-border" />
          <span aria-hidden="true" className="size-2.5 rounded-full bg-[#C7E8D2]" />
          <span aria-hidden="true" className="size-2.5 rounded-full bg-[#DDD9F6]" />
          <p className="ml-3.5 min-w-0 truncate text-xs text-on-surface-muted">Lumen — SaaS quản lý khoá học</p>
          <span className="ml-auto hidden shrink-0 rounded-full bg-success-soft px-[13px] py-[5px] text-[11px] font-bold text-success sm:inline">
            ● Ready to plan implementation
          </span>
        </div>

        <div className="flex flex-col md:h-[320px] md:flex-row">
          {/* Chat */}
          <div className="flex flex-col gap-[11px] border-b border-outline-variant bg-surface-container-low px-5 py-[18px] md:w-[37%] md:border-b-0 md:border-r">
            <p className="max-w-[88%] self-end rounded-[14px_14px_4px_14px] bg-on-surface px-3.5 py-2.5 text-xs leading-[1.55] text-surface">
              Mình muốn làm app đặt lịch spa tại nhà…
            </p>
            <div className="rounded-[4px_14px_14px_14px] border border-outline-variant bg-white px-[15px] py-[13px] text-xs leading-relaxed text-on-surface-dark">
              <b className="text-[#8B5CF0]">3 câu hỏi trước khi viết scope:</b>
              <br />
              1. Ai trả tiền — khách hay spa?
              <br />
              2. Kỹ thuật viên là nhân viên hay đối tác?
              <p className="mt-[9px] rounded-[9px] bg-[#F4F3FE] px-[11px] py-2 text-[11px] text-[#5B2EC4]">
                💡 Câu 2 quyết định 40% khối lượng MVP
              </p>
            </div>
          </div>

          {/* Tài liệu */}
          <div className="flex flex-1 flex-col gap-[11px] bg-white px-[22px] py-[18px]">
            <div className="landing-gradient-border rounded-[14px] px-[17px] py-3.5 shadow-[0_12px_32px_rgba(139,92,240,0.14)] [--landing-fill:#FBFAFF]">
              <div className="mb-[7px] flex items-center justify-between gap-2">
                <p className="text-[13px] font-extrabold text-on-surface">3. Value proposition</p>
                <span className="shrink-0 rounded-full bg-[#F4F3FE] px-2.5 py-[3px] text-[9.5px] font-bold text-[#5B2EC4]">
                  ◔ Draft — chờ duyệt
                </span>
              </div>
              <p className="text-[11.5px] leading-relaxed text-on-surface-medium">
                &ldquo;Nền tảng duy nhất giúp spa solo giữ chân khách quen bằng nhắc lịch tự động…&rdquo;
              </p>
              <div className="mt-[11px] flex flex-wrap gap-2 text-[10.5px] font-bold" aria-hidden="true">
                <span className="landing-gradient rounded-full px-[15px] py-[7px] text-white shadow-[0_8px_18px_rgba(139,92,240,0.3)]">
                  ✓ Duyệt
                </span>
                <span className="rounded-full border-[1.5px] border-[#C9C3F2] px-[15px] py-[7px] text-[#5B2EC4]">✎ Sửa</span>
                <span className="rounded-full border-[1.5px] border-outline px-[15px] py-[7px] font-semibold text-on-surface-variant">
                  ↻ Tạo lại
                </span>
              </div>
            </div>

            <div className="flex flex-col gap-2.5 sm:flex-row">
              <div className="flex-1 rounded-[10px] border-l-[3px] border-success-dark bg-surface-container-low px-[13px] py-2.5">
                <p className="text-[9px] font-extrabold text-success">FACT · từ bạn</p>
                <p className="mt-[3px] text-[11px] text-on-surface-dark">Khách trả tiền trực tiếp cho spa</p>
              </div>
              <div className="flex-1 rounded-[10px] border-l-[3px] border-accent-gold bg-surface-container-low px-[13px] py-2.5">
                <p className="text-[9px] font-extrabold text-accent-gold-text">ASSUMPTION · do AI</p>
                <p className="mt-[3px] text-[11px] text-on-surface-dark">Kỹ thuật viên dùng smartphone riêng</p>
              </div>
            </div>

            <p className="rounded-[10px] border border-accent-gold-border bg-[#FDF6EC] px-[13px] py-2.5 text-[11px] font-semibold text-accent-gold-text">
              ⚠ Xung đột: &ldquo;solo spa&rdquo; ↔ flow &ldquo;phân ca 5 nhân viên&rdquo; — bấm để xem
            </p>
          </div>
        </div>
      </figure>
    </section>
  );
}
