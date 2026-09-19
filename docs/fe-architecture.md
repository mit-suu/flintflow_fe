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

## Đa ngôn ngữ (vi / en)

Kế hoạch đầy đủ: `claude_plan/task-25-i18n-ui.md`. Đã chuyển **toàn bộ UI người dùng**: landing
(`app/_landing/`), auth (`app/(auth)/`), khu vực đã đăng nhập (`app/home/**`, `components/`) và workspace
(`app/projects/**`, namespace `workspace`), lỗi BE (theo mã) và email (BE, theo `user.locale`). Không chuyển:
admin (xem dưới).

**Admin chỉ tiếng Việt** — trang admin không đưa vào messages. `app/admin/layout.tsx` bọc
`NextIntlClientProvider` ghim `locale="vi"` (`getMessages({ locale: "vi" })`), nên component dùng chung đã
dịch (`AuthGuard`…) vẫn hiện tiếng Việt trong admin dù cookie là `en`. `i18n/request.ts` phải tôn trọng
`locale` do nơi gọi xin — bỏ qua nó thì admin nhận nhầm bản `en` (có test ở `i18n/request.test.ts`).

**Chọn locale.** Không prefix URL. `i18n/request.ts` gọi `resolveLocale()` (`lib/i18n.ts`): cookie
`NEXT_LOCALE` → header `Accept-Language` → `vi`. `components/LocaleSwitcher.tsx` ghi cookie rồi
`router.refresh()` (`tone="dark"` cho landing, `"light"` cho nền sáng). Vì layout đọc cookie nên mọi route
render động.

**Chuỗi UI** nằm ở `messages/vi.json` (bản chuẩn) và `messages/en.json`, chia namespace theo khu vực
(`landing`, `auth`, `app`, `workspace`, `common`, `metadata`). Component dùng `useTranslations("<namespace>")` — được cả ở
server component không async. Khi sửa:

- Sửa câu chữ ⇒ sửa **cả hai** file messages, không đụng `.tsx`.
- Thêm chuỗi ⇒ thêm key vào cả hai file, gọi `t("…")`; không viết chữ thẳng vào JSX.
- Số liệu, giá, href ⇒ để trong code/data (vd `app/_landing/content.ts`), không nằm trong messages. Số
  format qua `useFormatter()`.
- Chữ có định dạng ⇒ `t.rich("key", { strong: (c) => <strong>{c}</strong> })`. Tên thẻ không được trùng
  tên tham số.
- Ngày / số ⇒ `useFormatter()` (`format.number`, `format.dateTime`), không `toLocaleString("vi-VN")` cứng.
  "x phút trước" ⇒ `lib/time-ago.ts` (nhận `useTranslations("app.time")` làm tham số, giữ hàm thuần để test).
- Câu dự phòng khi lỗi nằm **trong `useEffect`** ⇒ ghi `""` vào state rồi dịch lúc render
  (`error || t("…")`, hiện khối lỗi khi `error !== null`). Đưa `t` vào dependency sẽ chạy lại effect (vd
  polling checkout) mỗi lần đổi ngôn ngữ.
- Hàm thuần cần chữ đã dịch (vd `nextStepLabel` của `ProjectCard`, `describeEvent` của `StepEventLog`) ⇒ nhận
  `t` làm tham số; test dùng `createTranslator({ locale, messages: MESSAGES[locale], namespace })`.
- Hook báo lỗi trong callback mà effect gọi (`useDocument`, `useFlags`, `useChanges`…) ⇒ **không** gọi
  `useTranslations` trong hook: lưu mã `HOOK_ERROR.<key>` (`@<key>`, `lib/hook-errors.ts`), component dịch lúc
  render bằng `hookErrorText(error, useTranslations("workspace.hookErrors"))`. Message từ BE đi qua nguyên văn.
- Hook chỉ cần `t` cho một lần báo lỗi trong effect chạy-một-lần (`useWorkspace`) ⇒ `useEffectEvent`.
- Lỗi runner do FE sinh (`NOT_PIPELINE_SESSION`, `STREAM_CLOSED`) dịch theo mã ở `page.tsx`; lỗi BE hiện `message`.
- **Không dịch:** dữ liệu (nội dung tài liệu, tin nhắn chat, `flag.message`, `reason` của op ghi vào Spine), và
  danh sách từ khoá tiếng Việt trong `isQuestionMultiple` (heuristic đọc câu hỏi của AI, không phải chữ UI).
- Test: `renderWithIntl` bọc qua `wrapper` (`rerender` giữ provider); `renderHookWithIntl` cho hook dùng `t`.

**Lưới an toàn:** `global.d.ts` khai kiểu messages từ `vi.json` ⇒ key sai là lỗi `tsc`;
`messages/messages.test.ts` bắt lệch key / thiếu tham số / chuỗi rỗng giữa vi và en; test render từng khu
vực ở `en` bằng `vietnameseLeftovers()` (`test/intl.tsx`) để bắt chữ tiếng Việt còn sót. Component test dùng
`renderWithIntl(ui, locale)`. e2e chạy `locale: "vi-VN"` (`playwright.config.ts`).

**Lỗi từ BE** dịch theo `error.code` ngay trong constructor của `ApiClientError` (`lib/api/error-messages.ts`,
namespace `errors`) — mọi chỗ hiện `err.message` tự đúng ngôn ngữ, câu gốc BE ở `err.rawMessage`. Ngôn ngữ lấy từ
`<html lang>`; trong `/admin` luôn `vi`. Mã không có trong `errors` (mơ hồ / chi tiết động) giữ nguyên message BE.
Trang auth dùng `fetch` thô thì gọi `localizeApiError(json.error?.code, …)`. Dựng tiếp `ApiClientError` từ response
thì đọc `readRawErrorMessage` (constructor tự dịch), không phải `readErrorMessage` (đã dịch).

**Thông báo** (chuông + trang Thông báo): BE ghi `title`/`body` tiếng Việt kèm `type` + tham số trong `meta`; FE dựng lại câu
theo ngôn ngữ bằng `useNotificationText()` (`lib/notification-text.ts`, `app.notificationTypes`). Thiếu tham số / `type` lạ
(vd `admin_new_user`) ⇒ hiện nguyên câu đã lưu. Thêm loại thông báo mới ⇒ thêm case + key ở cả hai file messages.

**Ngôn ngữ tài khoản:** `User.locale` ở BE. Đăng ký / Google gửi `locale` đang dùng; đăng nhập xong
`applyAccountLocale(user.locale)` ghi cookie (tài khoản thắng lựa chọn tạm trên trang đăng nhập); `LocaleSwitcher` khi
đã đăng nhập gọi `patchMe({ locale })` (`lib/api/users.ts`). Email xác thực / đặt lại mật khẩu gửi theo ngôn ngữ này.

**Nhãn step/phase** chỉ đi qua `tStep(stepId, locale)` / `tPhase(phase, locale)` (`stepLabel()` đã xoá; `PHASE_LABELS_VI`
chỉ đọc qua `tPhase`), đọc `label_vi` /
`label_en` từ `lib/constants/step-registry.json` — **bản sao** của `flintflow_be/assets/step-registry.json`
(hợp đồng đóng băng; đừng sửa tay, chạy `npm run sync:registry`). `localeOf(user)` hiện luôn trả `vi` vì
BE chưa có field `locale` trên user.

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

**Cố ý không chạy step AI trong e2e.** Gieo nội dung bằng op là đường **không cần model** mà vẫn đi qua
đúng op engine và invariants thật — tức là vẫn kiểm được cái e2e cần kiểm: FE ↔ BE.

T24 đã mở đường chạy step mà **không gọi model**: `AI_PROVIDER_OVERRIDE=mock` (BE) ghi đè provider của
mọi skill, và `mock.provider.ts` giờ trả output hợp schema theo `ActionType`. Nhưng lô op của mock luôn
**rỗng** — nó không đọc được Spine nên không thể sinh op hợp bất biến. Nghĩa là đường này chứng minh
*step chạy tới gate*, không chứng minh nội dung. Thêm kịch bản e2e cho bước AI thì phải khẳng định đúng
thứ đó (SSE phát đủ `intake · elicit · draft · gate_ready`), không phải khẳng định tài liệu có gì.

**Chạy e2e trong docker compose** (`flintflow_be/docker-compose.yml`, xem `flintflow_be/docs/ops.md`):

```bash
cd flintflow_be && docker compose up -d --wait
docker compose exec backend node dist/scripts/seed-e2e-user.js
cd ../flintflow_fe && npm run e2e          # mặc định :3000 / :5000
```

Chạy tại máy: cần FE `:3000` và BE `:5000` đang chạy, rồi `npm run e2e`. Đổi địa chỉ bằng `E2E_BASE_URL`
/ `E2E_API_URL`; đổi tài khoản bằng `E2E_EMAIL` / `E2E_PASSWORD`.

## Docker (T24)

`Dockerfile` build ba stage: `deps` (npm ci đủ devDependencies) -> `build` (next build) -> `runtime`
(`npm ci --omit=dev`, chạy `npm run start`). Compose của cả hệ thống nằm ở `flintflow_be/docker-compose.yml`
(`docker compose up -d` dựng mongo + plantuml + backend + frontend); chi tiết vận hành ở
`flintflow_be/docs/ops.md`.

**`NEXT_PUBLIC_API_URL` là địa chỉ của TRÌNH DUYỆT.** Next nhúng mọi biến `NEXT_PUBLIC_*` vào bundle lúc
build, và bundle đó chạy trong trình duyệt người dùng — `http://backend:5000` chỉ phân giải được bên
trong mạng docker. Đổi giá trị này phải **build lại** image, không phải restart container.

**Cố ý không dùng `output: "standalone"`.** Image sẽ nhỏ hơn nhiều (~200 MB thay vì ~950 MB), nhưng Next
cảnh báo `next start` không chạy với cấu hình đó — mà `npm run start` chính là lệnh Playwright dùng để
dựng server ở CI (`playwright.config.ts#webServer`). Không đổi một đường chạy được chính Next tuyên bố
là không hỗ trợ lấy image nhỏ hơn.

## Routing

```
/(auth)/{login,register,verify-email,forgot-password,reset-password,check-email}
/home                     lưới dự án (thẻ đọc tiến độ thật), tìm kiếm, tạo/đổi tên/lưu trữ
/home/{notifications,billing,onboarding}
/projects/[projectId]     workspace
/projects/[projectId]/view  bản đọc read-only
/admin/{users,metrics,ai-cost,feedback}
```

## Đăng nhập Google là tuỳ chọn

`lib/google-auth.ts` là nơi duy nhất đọc `NEXT_PUBLIC_GOOGLE_CLIENT_ID`. Không có client id thì
`app/layout.tsx` **không bọc** `GoogleOAuthProvider` và `GoogleButton` trả `null`.

Trước T24 layout luôn bọc provider với `clientId={... || ""}`; thiếu biến — đúng cảnh build image mà
quên `--build-arg` — làm script `gsi/client` của Google ném lỗi và **cả app thành trang trắng**, kể cả
đăng nhập bằng mật khẩu. Một tính năng phụ không được là điều kiện sống còn của trang đăng nhập.

## Nợ còn lại

- Chưa có nút "Ký baseline" trên UI: `lib/api/export.ts#createBaseline` đã đúng hợp đồng nhưng chưa
  component nào gọi.
- Danh sách trên đã sạch các mục T21 (`lib/constants/section-types.ts` và 6 component không còn import
  đã bị xoá).
