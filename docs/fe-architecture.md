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
| `notifications.ts` `billing.ts` `admin.ts` `feedback.ts` `folders.ts` | Nền tảng (`feedback.ts`: `POST /feedback`, UC-12; `folders.ts`: CRUD thư mục) |

`types/` phản chiếu kiểu của BE và giữ **snake_case** y như field Spine — đổi sang camelCase là tự tạo
một tầng dịch phải bảo trì mãi.

## Workspace (`app/projects/[id]/`)

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
/home                     Project Dashboard: chưa có dự án/thư mục ⇒ chọn cách làm SRS (`Project.mode`) + tên ngay trên trang;
                          còn lại ⇒ tab Tất cả (thư mục + dự án ngoài thư mục) · Thư mục · Dự án (mọi dự án, chia vùng
                          Hôm nay/7/30 ngày theo "Mới cập nhật" hoặc "Mới mở" = Project.lastOpenedAt); kéo card thả vào
                          thẻ thư mục để chuyển; bấm thư mục ⇒ dự án trong thư mục + "Thêm dự án" (chọn có sẵn / tạo mới).
                          Tạo dự án `import` (mode 1) ⇒ vào thẳng wizard `/projects/[id]/import`
/home/{notifications,billing,profile}
/projects/[id]            workspace — cửa vào duy nhất của một dự án (card luôn link tới đây)
/projects/[id]/view       bản đọc read-only
/admin/{users,metrics,ai-cost,feedback}
```

Tạo dự án xong đi tới `getProjectStartRoute(id, mode)` (`lib/project-source-mode.ts`) — chỗ duy nhất
map mode → route: `import → /projects/:id/import` (wizard mode 1), `customer_template → /projects/:id/template`
(chưa có, BE trả 501), `fpt → /projects/:id`. Route đổi thì chỉ sửa hàm này.

## Cách làm SRS của dự án (`Project.mode`)

`Project.mode` (`import | fpt | customer_template`, BE `project.model.ts`) chọn khi tạo, không đổi được; không gửi
⇒ `fpt`, dự án cũ BE đọc ra `fpt`. Khác `WorkingMode` (fast/coaching) của Spine — đừng gọi nó là "working mode".
Nhãn, mô tả, icon, tone và `status: "ready" | "soon"` của 3 mode chỉ khai báo ở `SOURCE_MODE_OPTIONS`; mode `soon`
hiện nhưng không chọn được. Card dự án `import` hiện trạng thái import (`import_state`) hoặc số change request đang mở
thay cho step tiếp theo.

## Component dùng chung (`components/`)

| Thư mục | Chứa gì |
| --- | --- |
| `ui/` | Primitive không biết domain: `Icon`, `Button`, `IconButton`, `Badge`, `CountBadge`, `SearchInput`, `FilterSelect`, `DropdownMenu`, `Card`, `Skeleton`, `EmptyState`, `Modal`, `Tabs` (import qua `@/components/ui`) |
| `layout/` | Khung `/home/*`: `AppShell` (drawer mobile, số dư credits, trạng thái thu gọn), `AppSidebar` dựng từ `sidebar-config.ts`, `SidebarNavItem`, `TopBar`, `RecentProjects` |
| `project/` | Feature dùng ở nhiều trang: `SourceModePicker`, `CreateProjectForm` (một component cho empty state và dialog), `ProjectCard` (kéo được) + `ProjectCover` (bìa màu trơn theo tone mode, sắc độ cố định theo id), `ProjectGrid`, `ProjectActionDialogs`, `FolderCard` (nhận thả card), `FolderDialogs` (tạo/sửa/xoá thư mục, chuyển dự án), `AddToFolderDialog`, `ProjectTimeline`, `FeedbackDialog` |

Quy tắc:

- **Icon chỉ qua `components/ui/Icon.tsx`** (Phosphor Icons, `@phosphor-icons/react`). Không emoji, ký tự hay Material Symbols làm icon.
  `Icon` map tên miền của app sang component Phosphor (import `dist/ssr`, chạy cả Server Component); thêm icon = thêm một dòng vào bảng `ICONS`. Độ nét dùng prop `weight` (`regular` mặc định, `bold`, `fill`).
- **Màu chỉ qua token** trong `app/globals.css` (`bg-surface`, `text-on-surface`, `bg-primary`, `bg-info-soft`…),
  không hex trong component mới. Thiếu màu thì thêm token.
- **Tính năng chưa có BE** hiện nhưng disabled kèm `<Badge tone="soon" />` ("Sắp có") — không ẩn, không dữ liệu
  giả. Sidebar: đổi `status` trong `sidebar-config.ts` sang `"ready"` + `href` khi có BE.
- Dự án và thư mục tải một lần ở `app/home/layout.tsx` qua `ProjectsProvider` (`lib/hooks/use-projects.tsx`);
  sidebar ("Gần đây") và dashboard dùng chung, gọi `reload()` sau khi tạo/đổi tên/lưu trữ/xoá.

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
