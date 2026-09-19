# FlintFlow — Frontend

Next.js app cho nền tảng AI soạn thảo SRS. Người dùng trò chuyện theo một quy trình có hướng dẫn
(12 phase, `51 + 5 × N` step), xem tài liệu sinh ra ở pane bên phải, và **sửa tài liệu qua chat** chứ
không gõ trực tiếp vào tài liệu.

Repo này đang trong đợt refactor lớn cùng `flintflow_be`. Kế hoạch, quy tắc và báo cáo nằm ở repo riêng
`claude_plan` (thư mục anh em `../claude_output`): `plan-overview.md`, `coding-rules.md`,
`task-01…24-*.md`, `task-report-template.md`. **Đọc `coding-rules.md` trước khi sửa code** — nó có bảng
vùng sở hữu file theo task và quy trình yêu cầu chéo (XREQ).

## Lệnh

```bash
npm run dev          # next dev (cổng 3000) — BE mặc định ở http://localhost:5000/api/v1
npm run typecheck    # tsc --noEmit
npm run lint         # eslint — phải 0 lỗi
npm test             # vitest run
npm run build        # next build
npm run sync:registry # copy assets/step-registry.json từ BE sang lib/constants/
```

Next 16 (App Router) · React 19 · TypeScript · Tailwind 4 · vitest + msw.

## Nguyên tắc quan trọng nhất

**Document pane là read-only.** Mọi thay đổi nội dung SRS đi qua chat/Change panel → `POST /changes`
(hoặc `/changes/preview` rồi xác nhận). Đừng thêm form sửa trực tiếp vào `DocumentPane`, `VerificationPane`
hay bất kỳ chỗ nào hiển thị tài liệu.

**Trạng thái sự thật nằm ở BE.** `status` của section, `% tiến độ`, danh sách cờ, `spine_version` đều do BE
tính; FE chỉ hiển thị. Đừng tự tính lại, đừng cache rồi suy diễn.

**Khoá lạc quan.** Mọi request ghi phải mang `base_version` = `spine_version` vừa đọc. Gặp
`409 SPINE_VERSION_CONFLICT` thì tải lại Spine rồi mời user thử lại — không tự retry đè.

## Tầng API

Mọi lời gọi BE đi qua `lib/api/` — **không `fetch` trực tiếp trong component**.

- `lib/api/client.ts`: `apiCall()`, envelope `{data, meta, error}`, `ApiClientError {status, code, message}`,
  tự refresh access token. `API_BASE_URL` từ `NEXT_PUBLIC_API_URL`.
- `lib/api/token-store.ts`: nơi duy nhất giữ/đọc token.
- Một file một nhóm endpoint: `projects.ts`, `chat.ts`, `spine.ts`, `pipeline.ts`, `flags.ts`,
  `documents.ts`, `export.ts`, `notifications.ts`, `billing.ts`, `admin.ts`.
- `types/` phản chiếu kiểu của BE (`spine.ts`, `pipeline.ts`, `flags.ts`, `document.ts`…). Giữ
  **snake_case** đúng như field Spine của BE, đừng đổi sang camelCase.

Hợp đồng endpoint là `flintflow_be/docs/api/pipeline-contract.md`. Endpoint không có trong đó thì
không gọi; cần thêm thì phải sửa contract trước (PR `contract-change`, 4/4 duyệt).

## Workspace (`app/projects/[id]/`)

- `page.tsx` ghép mọi thứ; state lấy qua hook trong `hooks/`:
  `useWorkspace`, `useSpine`, `useProgress`, `useStepRunner`, `useDocument`, `useFlags`, `useChanges`.
- `_components/` chia theo vai trò:
  - Chat & pipeline: `ChatPane`, `ChatInput`, `ChatBubble`, `ChatSessionSidebar`, `ElicitPanel`,
    `GateCard`, `StepProgressBar`, `PhaseHeader`, `PhaseNavBar`, `ScreenQueuePanel`, `StepEventLog`
  - Tài liệu & kiểm chứng: `DocumentPane`, `VerificationPane`, `FlagsPanel`, `ReadinessSummary`,
    `ExportPanel`
  - Sửa qua chat: `ChangePanel`, `DiffPreviewModal`, `TraceabilityMap`
  - Brief (B-0…S-1): `BriefSummaryCard`, `AssumptionSweepPanel`, `AddendumTriagePanel`, `NamesGlossaryPanel`
  - Dùng chung: `QuestionStepperInput` (câu hỏi có gợi ý — kiểu `DiscoveryQuestion` ở `types/chat.ts`)
- Chạy step là **SSE** (`lib/ai-stream.ts`): sự kiện `intake · elicit · answer_needed · draft ·
  ops_applied · render · flags · gate_ready · error`. Luôn huỷ luồng khi rời trang hoặc chạy lại; luồng
  đóng sớm phải thành lỗi rõ ràng, không im lặng.

## Step registry

`lib/constants/step-registry.json` là **bản sao** của `flintflow_be/assets/step-registry.json` — hợp đồng
đóng băng. Đừng sửa tay: chạy `npm run sync:registry`. Step của vòng S-5 mang id `S-5.<n>@<screen_id>`
hoặc `S-5.<n>@nonscreen`.

Mô hình section cũ (`lib/constants/section-types.ts`, rollback chat, `lib/api.ts` re-export) **đã xoá ở
T21**. Import API từ `@/lib/api/<resource>` (hoặc `@/lib/api` — trỏ tới `lib/api/index.ts`).

## Mock (msw)

`mocks/handlers.ts` mô phỏng BE theo đúng contract, và **chỉ còn dùng trong vitest**
(`mocks/server.ts`, nạp ở `test/setup.ts`). T23 đã gỡ hẳn msw khỏi trình duyệt: `mocks/browser.ts`,
`public/mockServiceWorker.js` và biến `NEXT_PUBLIC_API_MOCK` không còn tồn tại.

Lý do: một biến môi trường quyết định app đang nói chuyện với BE thật hay với dữ liệu giả là thứ sớm
muộn cũng làm ai đó debug nhầm nửa ngày. Chạy app nghĩa là chạy trên BE thật.

## Test

- Colocate cạnh component (`*.test.tsx`) hoặc trong `__tests__/`.
- vitest + Testing Library + msw. Component mới phải có ít nhất một test.
- Không xoá test đang xanh của người khác để PR mình pass.
- `npm run lint` phải 0 lỗi (eslint có `react-hooks` bật; chú ý quy tắc set-state-in-effect).

## Điều cấm

1. `fetch` thẳng trong component — đi qua `lib/api/`.
2. Thêm ô nhập/sửa trực tiếp nội dung tài liệu.
3. Tự tính `status` section hay `%` tiến độ ở FE.
4. Hard-code URL, client id, secret, dữ liệu demo trong JSX.
5. Sửa `lib/constants/step-registry.json` bằng tay.
6. Bỏ `base_version` khi gọi endpoint ghi.
7. Commit `.env.local` hoặc bất kỳ secret nào.

## Git

- `develop` là gốc; mỗi task một nhánh `feat/FLF-<số>-<slug>`. PR tiêu đề `[TXX][Wave N] <tên task>`,
  mô tả là báo cáo theo `task-report-template.md`, cần 1 reviewer khác người và CI xanh.
- Commit nhỏ, message dạng `tXX: <việc làm>`.
- **Khi tạo commit message, không thêm `Co-Authored-By: Claude <noreply@anthropic.com>`** — cũng không
  nhắc Claude/AI ở bất kỳ đâu trong message.
- **Gộp commit hợp lý, tránh commit vụn vặt** (`coding-rules.md` §7). Chỉ commit khi xong một đơn vị việc
  có nghĩa: một bước trong DoD, hoặc một module hoàn chỉnh kèm test. Mục tiêu **3–5 commit cho một task**,
  không phải 8–10. Không tạo commit riêng cho: sửa typo, format lại, chạy lại test, hay sửa lỗi do chính
  commit ngay trước gây ra — gộp vào commit đó (`git commit --amend`) khi nhánh chưa push.
- Không format lại toàn file; diff chỉ chứa dòng thực sự đổi.

## Quy ước ngôn ngữ

Nhãn UI và thông báo lỗi cho user: **tiếng Việt**. Nội dung tài liệu SRS (do BE sinh): tiếng Anh — FE chỉ
hiển thị, không dịch.
