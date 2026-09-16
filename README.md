# FlintFlow Frontend

Giao diện của FlintFlow — nền tảng AI hỗ trợ soạn SRS theo template FPT. Người dùng đi theo quy trình có
hướng dẫn (12 phase, `51 + 5 × N` step) ở pane chat, xem tài liệu do BE render ở pane bên phải, và sửa tài
liệu **qua chat / Change panel**, không gõ trực tiếp vào tài liệu.

## Tech stack

Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS 4 · Vitest + Testing Library + msw.

## Chạy local

```bash
cp .env.example .env.local   # NEXT_PUBLIC_API_URL, NEXT_PUBLIC_APP_URL, NEXT_PUBLIC_GOOGLE_CLIENT_ID
npm ci
npm run dev                  # http://localhost:3000 — BE mặc định http://localhost:5000/api/v1
npm run typecheck
npm run lint                 # phải 0 lỗi
npm test
npm run sync:registry        # chép assets/step-registry.json từ BE sang lib/constants/
```

Bật mock BE (msw) khi phát triển UI chưa có endpoint: `NEXT_PUBLIC_API_MOCK=1`.

## Cấu trúc

```
app/
├── (auth)/                     # đăng nhập, đăng ký, quên mật khẩu, Google OAuth
├── home/                       # danh sách dự án, billing, notifications, onboarding
├── admin/                      # chỉ đọc: users, metrics, chi phí AI, feedback
└── projects/[projectId]/
    ├── page.tsx                # workspace: chat + tài liệu + panel công cụ
    ├── view/                   # xem tài liệu read-only
    ├── hooks/                  # useWorkspace, useSpine, useProgress, useStepRunner,
    │                           # useDocument, useFlags, useChanges
    └── _components/            # ChatPane, StepProgressBar, GateCard, ElicitPanel, DocumentPane,
                                # FlagsPanel, ChangePanel, DiffPreviewModal, ExportPanel,
                                # BriefSummaryCard, AssumptionSweepPanel, AddendumTriagePanel…
components/                     # Sidebar, ProjectCard, NotificationBell, AuthGuard, Logo, Modal
lib/
├── api/                        # một file một nhóm endpoint; client.ts giữ envelope + refresh token
├── ai-stream.ts                # đọc SSE của step runner
└── constants/                  # step-registry.json (bản sao từ BE) + helper
types/                          # phản chiếu kiểu BE (snake_case như Spine)
mocks/                          # msw handlers theo pipeline-contract
```

## Nguyên tắc

- **Trạng thái sự thật nằm ở BE**: Spine, `status` section, `% tiến độ`, cờ, baseline. FE chỉ hiển thị.
- Mọi lời gọi BE đi qua `lib/api/`; hợp đồng là `flintflow_be/docs/api/pipeline-contract.md`.
- Mọi request ghi mang `base_version`; gặp `409 SPINE_VERSION_CONFLICT` thì tải lại Spine rồi mời user thử lại.
- Nhãn UI tiếng Việt; nội dung SRS do BE sinh bằng tiếng Anh, FE không dịch.
- Mô hình section cũ (danh sách section cố định, rollback chat, thẻ duyệt draft từng section) đã gỡ ở T21.

## Docker

```bash
docker build -t flintflow-frontend .
docker run -p 3000:3000 --env-file .env.local flintflow-frontend
```
