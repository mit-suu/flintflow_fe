<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Refactor plan (Spine / pipeline) — đọc trước khi code

Mọi task refactor theo plan phải tuân thủ bộ tài liệu trong `docs/refactor-plan/`:

- `docs/refactor-plan/coding-rules.md` — **bắt buộc đọc đầu tiên**: vùng sở hữu file theo task, hợp đồng đóng băng, điều cấm, quy trình yêu cầu chéo (XREQ), checklist PR.
- `docs/refactor-plan/plan-overview.md` — bảng 24 task / 5 wave, giả định đã chốt (mục 1), merge point (mục 5), trạng thái tiến độ (mục 8).
- `docs/refactor-plan/task-XX-*.md` — chi tiết từng task (bước, dependency, DoD).
- `docs/refactor-plan/task-report-template.md` — mẫu báo cáo bắt buộc sau mỗi task/phiên.

Quy ước đường dẫn: trong các file trên, `claude_output/<file>` nghĩa là `docs/refactor-plan/<file>`. `audit.md` và tài liệu nguồn (`srs-spine.md`, `Product-Brief-to-SRS-Phases.md`) nằm ở repo `claude_plan`.

Bộ tài liệu này có bản giống hệt trong repo `flintflow_be`; khi cập nhật `plan-overview.md` mục 8 hoặc tick task, cập nhật cả hai repo.
