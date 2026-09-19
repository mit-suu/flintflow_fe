import { WORKSPACE_HEADING } from "./content";
import { Diamond } from "./ui";

/*
 * Khối màu `primary` đặc — điểm nhấn mạnh nhất trang — chứa cửa sổ workspace phẳng: chat làm rõ bên trái,
 * phần SRS nháp chờ duyệt + sự thật / giả định / mâu thuẫn bên phải.
 * Ví dụ tĩnh "Cổng cấp phép xây dựng trực tuyến" (business-flow.md §5), không gọi API.
 */
export default function WorkspacePreview() {
  return (
    <section id="workspace" aria-labelledby="workspace-title" className="scroll-mt-24 px-4 sm:px-6">
      <div className="mx-auto max-w-[1200px] rounded-[28px] bg-primary px-5 py-14 sm:px-10 lg:px-14 lg:py-20">
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:items-end">
          <div>
            <p className="inline-flex items-center gap-2.5 text-[13px] font-bold text-on-primary-container">
              <Diamond />
              {WORKSPACE_HEADING.eyebrow}
            </p>
            <h2 id="workspace-title" className="mt-3 text-4xl font-bold tracking-[-0.03em] text-on-primary sm:text-[52px] sm:leading-[1.05]">
              {WORKSPACE_HEADING.headline}
              <br />
              <span className="text-primary-fixed-dim">{WORKSPACE_HEADING.headlineAccent}</span>
            </h2>
          </div>
          <p className="max-w-md text-base leading-relaxed text-on-primary-container lg:justify-self-end">{WORKSPACE_HEADING.subline}</p>
        </div>

        <figure
          aria-label="Minh hoạ workspace FlintFlow"
          className="mt-10 overflow-hidden rounded-dialog bg-surface-container-lowest shadow-[0_30px_60px_rgba(25,24,23,0.22)] lg:mt-14"
        >
          {/* Title bar */}
          <div className="flex h-12 items-center gap-2 bg-surface-sidebar px-5">
            <span aria-hidden="true" className="size-2.5 rounded-full bg-folder-amber-back" />
            <span aria-hidden="true" className="size-2.5 rounded-full bg-folder-green-back" />
            <span aria-hidden="true" className="size-2.5 rounded-full bg-folder-blue-back" />
            <p className="ml-3 min-w-0 truncate text-[12.5px] font-semibold text-on-surface-variant">Cổng cấp phép xây dựng trực tuyến</p>
            <span className="ml-auto hidden shrink-0 items-center gap-1 rounded-full bg-success-soft px-2.5 py-1 text-[11px] font-bold text-success sm:inline-flex">
              <span aria-hidden="true" className="size-1.5 rounded-full bg-success-dark" />
              Brief đã duyệt
            </span>
          </div>

          <div className="grid md:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
            {/* Chat */}
            <div className="flex flex-col gap-3 bg-surface-container-low p-5 sm:p-6">
              <p className="max-w-[88%] self-end rounded-[14px_14px_4px_14px] bg-on-surface px-4 py-2.5 text-[13px] leading-relaxed text-surface">
                Người dân nộp hồ sơ xin phép xây dựng online, cán bộ thẩm định rồi trả kết quả…
              </p>
              <div className="rounded-[4px_14px_14px_14px] bg-surface-container-lowest px-4 py-3.5 text-[13px] leading-relaxed text-on-surface-dark">
                <b className="text-primary">2 câu hỏi trước khi viết use case</b>
                <ol className="mt-1.5 list-decimal space-y-0.5 pl-5">
                  <li>Ai thẩm định: cán bộ quận hay Sở?</li>
                  <li>Công trình trên 7 tầng có cần thêm giấy tờ không?</li>
                </ol>
                <p className="mt-3 rounded-inner bg-primary-soft px-3 py-2 text-[12px] text-primary-hover">
                  Câu 2 quyết định luồng thẩm định có phải tách nhánh.
                </p>
              </div>
            </div>

            {/* Tài liệu */}
            <div className="flex flex-col gap-3 p-5 sm:p-6">
              <div className="rounded-card bg-surface-card p-4">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[14px] font-bold text-on-card">UC-03 · Nộp hồ sơ cấp phép</p>
                  <span className="shrink-0 rounded-full bg-surface-container-lowest px-2 py-0.5 text-[10.5px] font-bold text-on-card-strong">
                    Nháp · chờ duyệt
                  </span>
                </div>
                <p className="mt-2 text-[13px] leading-relaxed text-on-card-strong">
                  Điều kiện: người nộp đã đăng nhập và tải lên bản vẽ thiết kế hợp lệ; công trình trên 7 tầng phải có văn bản
                  thẩm duyệt PCCC.
                </p>
                <div className="mt-3 flex flex-wrap gap-2 text-[12px] font-bold" aria-hidden="true">
                  <span className="rounded-control bg-primary px-3.5 py-2 text-on-primary">Chấp nhận</span>
                  <span className="rounded-control bg-surface-container-lowest px-3.5 py-2 text-on-surface-medium">Yêu cầu sửa</span>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-card bg-success-soft px-4 py-3">
                  <p className="text-[10.5px] font-bold uppercase tracking-wide text-success">Sự thật · từ bạn</p>
                  <p className="mt-1 text-[13px] text-on-surface-dark">Chỉ nhận hồ sơ nộp trực tuyến</p>
                </div>
                <div className="rounded-card bg-accent-gold-soft px-4 py-3">
                  <p className="text-[10.5px] font-bold uppercase tracking-wide text-accent-gold-text">Giả định · do AI</p>
                  <p className="mt-1 text-[13px] text-on-surface-dark">Người nộp có tài khoản định danh điện tử</p>
                </div>
              </div>

              <p className="rounded-card bg-error-container px-4 py-3 text-[13px] font-semibold text-on-error-container">
                Mâu thuẫn: UC-07 hẹn thẩm định 5 ngày, NFR-02 chỉ cho phép 3 ngày.
              </p>
            </div>
          </div>
        </figure>
      </div>
    </section>
  );
}
