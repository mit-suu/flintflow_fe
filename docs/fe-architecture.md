# Kiến trúc Frontend

Bản đồ cho người mới vào repo, và ghi lại những quyết định không đọc được từ code.
Quy tắc làm việc ở `CLAUDE.md`; hợp đồng API ở `flintflow_be/docs/api/pipeline-contract.md`.

## Ba nguyên tắc

1. **Document pane read-only.** Mọi thay đổi nội dung SRS đi qua chat hoặc Change panel →
   `POST /changes`. Không có form sửa trực tiếp ở bất kỳ chỗ nào hiển thị tài liệu. Đây là quyết định
   sản phẩm (Phases §2.3), không phải chuyện chưa kịp làm.
2. **Trạng thái sự thật nằm ở BE.** `status` của section, phần trăm sẵn sàng, danh sách cờ, `spine_version`
   đều do BE tính. FE chỉ hiển thị — không tự tính lại, không cache rồi suy diễn.
3. **Khoá lạc quan.** Mọi request ghi mang `base_version` = `spine_version` vừa đọc. Gặp
   `409 SPINE_VERSION_CONFLICT` thì tải lại rồi mời user thử lại, **không tự retry đè**.

## Tầng API (`lib/api/`)

Cửa duy nhất gọi BE. Không `fetch` trực tiếp trong component.

| File | Việc |
| --- | --- |
| `client.ts` | `apiCall()`, envelope `{data, meta, error}`, `ApiClientError {status, code, message}`, tự refresh access token |
| `token-store.ts` | Nơi duy nhất giữ/đọc token |
| `projects.ts` `chat.ts` `documents.ts` | Dự án, phiên chat, tài liệu upload |
| `spine.ts` `pipeline.ts` `flags.ts` `export.ts` | Spine, step runner, cờ, assemble/export/baseline |
| `notifications.ts` `billing.ts` `admin.ts` | Nền tảng |

`types/` phản chiếu kiểu của BE và giữ **snake_case** y như field Spine — đổi sang camelCase là tự tạo
một tầng dịch phải bảo trì mãi.

## Workspace (`app/projects/[projectId]/`)

`page.tsx` ghép mọi thứ; state nằm trong hook:

| Hook | Giữ gì |
| --- | --- |
| `useWorkspace` | project, user, phiên chat, gửi tin nhắn/đính kèm |
| `useSpine` | Spine + `spine_version` (nguồn của `base_version` khi ghi) |
| `useProgress` | `GET /progress` — readiness, tiến độ step, trạng thái section |
| `useStepRunner` | chạy step qua SSE, gate, câu hỏi Elicit |
| `useDocument` | `GET /document` + độ mới của bản nháp |
| `useFlags` | cờ đỏ/vàng, waive, recompute |
| `useChanges` | preview → xác nhận → áp, undo, hoà giải |

`_components/` chia theo vai trò: chat & pipeline · tài liệu & kiểm chứng · sửa qua chat · Brief
(`BriefSummaryCard`, `AssumptionSweepPanel`, `AddendumTriagePanel`, chỉ hiện ở pha B-*/S-1).

Chạy step là **SSE** (`lib/ai-stream.ts`): `intake · elicit · answer_needed · draft · ops_applied ·
render · flags · gate_ready · error`. Luôn huỷ luồng khi rời trang hoặc chạy lại; luồng đóng sớm phải
thành lỗi rõ ràng, không im lặng.

## Nhãn quy trình và i18n (`lib/i18n.ts`)

Nguồn duy nhất là `lib/constants/step-registry.json` — **bản sao** của
`flintflow_be/assets/step-registry.json` (hợp đồng đóng băng). Đừng sửa tay, chạy `npm run sync:registry`.

`tStep(stepId, locale)` và `tPhase(phase, locale)` đọc `label_vi` / `label_en` có sẵn trong registry, nên
không có bảng dịch thứ hai để lệch. Phạm vi cố ý hẹp: **chỉ nhãn step và phase**; chuỗi UI còn lại viết
thẳng tiếng Việt trong component. Dựng cả framework i18n cho một sản phẩm đang dùng một ngôn ngữ là chi
phí không đổi lấy được gì — khi cần ngôn ngữ thứ hai cho toàn UI thì thay ruột, giữ nguyên chữ ký `t*()`.

`localeOf(user)` hiện luôn trả `vi` vì BE chưa có field `locale` trên user.

Nội dung tài liệu SRS luôn là tiếng Anh (BE sinh) và **không** đi qua i18n — FE chỉ hiển thị.

## Mock (`mocks/`) — chỉ còn trong test

Trước T23 có thể bật msw ở trình duyệt bằng `NEXT_PUBLIC_API_MOCK=1`. **Đã gỡ hẳn**: `mocks/browser.ts`
và `public/mockServiceWorker.js` bị xoá, `useWorkspace` không còn nhánh khởi worker.

Lý do: một biến môi trường quyết định app đang nói chuyện với BE thật hay với dữ liệu giả là thứ sớm muộn
cũng làm ai đó debug nhầm nửa ngày. Từ T23 trở đi, chạy app nghĩa là chạy trên BE thật.

Còn lại:
- `mocks/handlers.ts` + `mocks/server.ts` — msw cho **vitest** (`test/setup.ts`), để test component không
  cần BE.
- `mocks/state.ts`, `mocks/fixtures/` — dữ liệu mẫu cho các handler đó.

## Test

| Loại | Chạy bằng | Ở đâu |
| --- | --- | --- |
| Đơn vị / component | `npm test` (vitest + Testing Library + msw) | cạnh file, hoặc `__tests__/` |
| End-to-end | `npm run e2e` (Playwright) | `e2e/` |

`vitest.config.ts` loại `e2e/**` để hai runner không chồng nhau.

### e2e chạy thật tới đâu

Kịch bản `e2e/workspace.spec.ts` chạy FE thật trên BE thật + Mongo thật, **không msw**: đăng nhập qua UI →
thẻ dự án đọc `GET /progress` → mở workspace → gieo nội dung bằng op qua `POST /changes` → Export panel →
kiểm `GET /document` trả đúng `200` hoặc `409 NO_WORKING_DRAFT`.

**Cố ý không chạy step AI trong e2e.** Task-23 dự tính khởi BE với `AI_PROVIDER=mock`, nhưng thực tế:

1. provider chọn theo frontmatter của từng skill (`provider: glm`) — không có biến môi trường ghi đè;
2. `mock.provider.ts` trả JSON cố định (`{status, message, promptSnippet}`) không khớp
   `opTransactionSchema` / `elicitSchema`, nên có ép dùng mock thì step cũng chết ở bước parse chứ không
   sinh ra op nào.

Gieo nội dung bằng op là đường **không cần model** mà vẫn đi qua đúng op engine và invariants thật — tức
là vẫn kiểm được cái e2e cần kiểm: FE ↔ BE. Muốn e2e phủ luôn bước AI thì phải sửa mock provider ở BE
(trả output hợp schema theo `ActionType`) — việc đó thuộc T22/T24, đã ghi `docs/spec-gaps.md`.

Chạy tại máy: cần FE `:3000` và BE `:5000` đang chạy, rồi `npm run e2e`. Đổi địa chỉ bằng `E2E_BASE_URL`
/ `E2E_API_URL`; đổi tài khoản bằng `E2E_EMAIL` / `E2E_PASSWORD`.

## Routing

```
/(auth)/{login,register,verify-email,forgot-password,reset-password,check-email}
/home                     lưới dự án (thẻ đọc tiến độ thật), tìm kiếm, tạo/đổi tên/lưu trữ
/home/{notifications,billing,onboarding}
/projects/[projectId]     workspace
/projects/[projectId]/view  bản đọc read-only
/admin/{users,metrics,ai-cost,feedback}
```

## Nợ còn lại

- `lib/constants/section-types.ts` — hằng số section cũ, T21 xoá.
- `_components/{DiscoveryStepBar, SummaryReviewCard, StepTransitionBanner, DraftReviewCard,
  ConfirmRollbackModal, QuestionStepperInput}.tsx` — không còn được import, T21 xoá.
- Chưa có nút "Ký baseline" trên UI: `lib/api/export.ts#createBaseline` đã đúng hợp đồng nhưng chưa
  component nào gọi.
