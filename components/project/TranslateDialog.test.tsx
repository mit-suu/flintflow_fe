import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import type { ComponentProps } from "react";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mockTranslation, resetMockTranslationState } from "@/mocks/handlers";
import { mockServer } from "@/mocks/server";
import { MOCK_PROJECT_ID, mockState, resetMockState } from "@/mocks/state";
import { MESSAGES, renderWithIntl, vietnameseLeftovers } from "@/test/intl";
import type { Locale } from "@/lib/i18n";
import type { TranslationRunResult } from "@/types/document";
import TranslateDialog from "./TranslateDialog";

const P = MOCK_PROJECT_ID;

beforeAll(() => mockServer.listen({ onUnhandledRequest: "error" }));
beforeEach(() => {
  resetMockState();
  resetMockTranslationState();
  // Mock: 100 đơn vị chưa dịch, lô 40 đơn vị / 2 credit; hộp xin 2 lô mỗi lượt ⇒ lượt 1 dịch 80, lượt 2 dịch 20
  mockState.project.documentLanguage = "vi";
});
afterEach(() => {
  mockServer.resetHandlers();
  mockServer.events.removeAllListeners();
});
afterAll(() => mockServer.close());

type Props = ComponentProps<typeof TranslateDialog>;

const openDialog = (props: Partial<Props> = {}, locale: Locale = "vi") => {
  const onClose = vi.fn();
  const onDone = vi.fn();
  const all: Props = { projectId: P, open: true, onClose, onDone, ...props };
  const view = renderWithIntl(<TranslateDialog {...all} />, locale);
  return { ...view, onClose, onDone, props: all };
};

const confirm = async () => fireEvent.click(await screen.findByRole("button", { name: "Dịch ngay" }));

/** Lượt `run` giữ lại tới khi gọi `release(kết quả)` — để nhìn thanh tiến độ, bấm Dừng hay đóng hộp giữa chừng. */
const holdRuns = () => {
  const pending: ((result: TranslationRunResult) => void)[] = [];
  mockServer.use(
    http.post("*/projects/:projectId/translations/run", async () => {
      const result = await new Promise<TranslationRunResult>((resolve) => pending.push(resolve));
      return HttpResponse.json({ data: result, error: null });
    })
  );
  return {
    calls: () => pending.length,
    release: (index: number, result: TranslationRunResult) => pending[index](result),
  };
};

const countStatusReads = () => {
  const read = vi.fn();
  mockServer.events.on("request:start", ({ request }) => {
    if (request.method === "GET" && request.url.endsWith("/translations/status")) read();
  });
  return read;
};

describe("TranslateDialog (FLF-265)", () => {
  it("mở ⇒ ước tính “N mục · ~C credit”; xác nhận ⇒ lặp run tới remaining 0; xong ⇒ báo + onDone một lần", async () => {
    const { onDone } = openDialog();

    expect(await screen.findByText("100 mục · ~6 credit")).toBeInTheDocument();
    expect(screen.getByText("Từ chữ gốc tiếng Anh sang tiếng Việt")).toBeInTheDocument();
    await confirm();

    expect(await screen.findByText("Đã dịch xong 100 mục.")).toBeInTheDocument();
    expect(screen.getByText("Đã dùng 6 credit.")).toBeInTheDocument();
    expect(mockTranslation.runCalls).toBe(2);
    expect(mockTranslation.missing).toBe(0);
    expect(onDone).toHaveBeenCalledTimes(1);
    expect(onDone).toHaveBeenCalledWith({ translated: 100, remaining: 0, creditsUsed: 6 });
  });

  it("thanh tiến độ = số đã dịch / (đã dịch + còn lại) sau mỗi lượt", async () => {
    const runs = holdRuns();
    openDialog();
    await confirm();

    const bar = await screen.findByRole("progressbar", { name: "Tiến độ dịch tài liệu" });
    expect(bar).toHaveAttribute("aria-valuenow", "0");
    expect(bar).toHaveAttribute("aria-valuemax", "100");
    await waitFor(() => expect(runs.calls()).toBe(1));
    runs.release(0, { translated: 80, remaining: 20, credits_used: 4 });

    await waitFor(() => expect(bar).toHaveAttribute("aria-valuenow", "80"));
    expect(screen.getByText("80/100 mục")).toBeInTheDocument();
    await waitFor(() => expect(runs.calls()).toBe(2));
    runs.release(1, { translated: 20, remaining: 0, credits_used: 2 });

    expect(await screen.findByText("Đã dịch xong 100 mục.")).toBeInTheDocument();
  });

  it("lượt không dịch được mục nào (translated 0) ⇒ dừng ngay, không gọi tiếp; phần đã dịch vẫn báo qua onDone", async () => {
    mockTranslation.failure = "stalled";
    mockTranslation.failFromCall = 2;
    const { onDone } = openDialog();
    await confirm();

    const notice = await screen.findByText(/Không dịch thêm được mục nào — còn 20 mục giữ chữ gốc/);
    expect(notice.parentElement).toHaveTextContent("Đã dịch 80 mục trước khi dừng — phần này được giữ.");
    expect(mockTranslation.runCalls).toBe(2);
    expect(onDone).toHaveBeenCalledWith({ translated: 80, remaining: 20, creditsUsed: 6 });
  });

  it("402 ngay lượt đầu ⇒ báo thiếu credit, chỉ còn nút Đóng, không gọi onDone (chưa dịch, chưa trừ gì)", async () => {
    mockTranslation.failure = "INSUFFICIENT_CREDIT";
    const { onDone } = openDialog();
    await confirm();

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Không đủ credit để dịch tiếp. Nạp thêm credit rồi chạy lại.");
    expect(alert).not.toHaveTextContent("trước khi dừng");
    expect(mockTranslation.runCalls).toBe(1);
    expect(onDone).not.toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: "Thử lại" })).toBeNull();
  });

  it("402 giữa chừng ⇒ giữ phần đã dịch, nói rõ, onDone báo đúng phần đã dịch và credit đã trừ", async () => {
    mockTranslation.failure = "INSUFFICIENT_CREDIT";
    mockTranslation.failFromCall = 2;
    const { onDone } = openDialog();
    await confirm();

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Không đủ credit để dịch tiếp");
    expect(alert).toHaveTextContent("Đã dịch 80 mục trước khi dừng — phần này được giữ.");
    expect(alert).toHaveTextContent("Đã dùng 4 credit.");
    expect(onDone).toHaveBeenCalledWith({ translated: 80, remaining: 20, creditsUsed: 4 });
  });

  it("409 TRANSLATION_RUNNING ⇒ báo đang dịch ở lượt khác; Thử lại đọc lại ước tính, chưa chạy gì thêm", async () => {
    mockTranslation.failure = "TRANSLATION_RUNNING";
    const statusReads = countStatusReads();
    openDialog();
    await confirm();

    expect(await screen.findByRole("status")).toHaveTextContent("Tài liệu đang được dịch ở một lượt khác — đợi lượt đó xong rồi thử lại.");
    expect(statusReads).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button", { name: "Thử lại" }));

    expect(await screen.findByText("100 mục · ~6 credit")).toBeInTheDocument();
    expect(statusReads).toHaveBeenCalledTimes(2);
    expect(mockTranslation.runCalls).toBe(1);
  });

  it.each(["PARSE_FAILED", "SCHEMA_MISMATCH"] as const)("422 %s ⇒ “chưa dịch được lúc này”, không lộ thông báo kỹ thuật", async (failure) => {
    mockTranslation.failure = failure;
    openDialog();
    await confirm();

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Chưa dịch được lúc này — AI trả kết quả không đọc được. Thử lại sau ít phút.");
    expect(alert).not.toHaveTextContent("translate_document");
    expect(screen.getByRole("button", { name: "Thử lại" })).toBeInTheDocument();
  });

  it("lỗi khác (403 ORG_ROLE_FORBIDDEN) ⇒ câu dịch theo mã lỗi", async () => {
    mockTranslation.failure = "ORG_ROLE_FORBIDDEN";
    openDialog();
    await confirm();

    expect(await screen.findByRole("alert")).toHaveTextContent(MESSAGES.vi.errors.ORG_ROLE_FORBIDDEN);
  });

  it("không còn mục nào: dịch đủ ⇒ báo đã dịch đủ; ngôn ngữ gốc ⇒ báo không cần dịch — không có nút Dịch", async () => {
    mockTranslation.missing = 0;
    const { unmount } = openDialog();
    expect(await screen.findByText("Tài liệu đã dịch đủ sang tiếng Việt — không còn mục nào cần dịch.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Dịch ngay" })).toBeNull();
    unmount();

    mockState.project.documentLanguage = "en";
    openDialog();
    expect(await screen.findByText("Tài liệu đang ở ngôn ngữ gốc — không có gì cần dịch.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Dịch ngay" })).toBeNull();
    expect(mockTranslation.runCalls).toBe(0);
  });

  it("bấm Dừng ⇒ dừng sau lượt đang chạy (không gọi lượt sau); Dịch tiếp ⇒ đọc lại ước tính", async () => {
    const runs = holdRuns();
    const statusReads = countStatusReads();
    const { onDone } = openDialog();
    await confirm();
    await waitFor(() => expect(runs.calls()).toBe(1));

    fireEvent.click(screen.getByRole("button", { name: "Dừng" }));
    expect(screen.getByRole("button", { name: "Dừng" })).toBeDisabled();
    expect(screen.getByText("Đang dừng sau lượt đang chạy…")).toBeInTheDocument();
    runs.release(0, { translated: 40, remaining: 60, credits_used: 2 });

    expect(await screen.findByText("Đã dừng — đã dịch 40 mục, còn 60 mục giữ chữ gốc.")).toBeInTheDocument();
    expect(runs.calls()).toBe(1);
    expect(onDone).toHaveBeenCalledWith({ translated: 40, remaining: 60, creditsUsed: 2 });

    fireEvent.click(screen.getByRole("button", { name: "Dịch tiếp" }));
    expect(await screen.findByText(/mục · ~\d+ credit/)).toBeInTheDocument();
    expect(statusReads).toHaveBeenCalledTimes(2);
  });

  it("đóng hộp giữa chừng ⇒ dừng sau lượt đang chạy; phần đã dịch vẫn báo qua onDone để nơi gọi tải lại", async () => {
    const runs = holdRuns();
    const { onClose, onDone, rerender, props } = openDialog();
    await confirm();
    await waitFor(() => expect(runs.calls()).toBe(1));

    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Đóng" }));
    expect(onClose).toHaveBeenCalledTimes(1);
    rerender(<TranslateDialog {...props} open={false} />);
    expect(screen.queryByRole("dialog")).toBeNull();

    runs.release(0, { translated: 40, remaining: 60, credits_used: 2 });
    await waitFor(() => expect(onDone).toHaveBeenCalledWith({ translated: 40, remaining: 60, creditsUsed: 2 }));
    // Chờ thêm một nhịp: không có lượt run thứ hai sau khi đã đóng
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(runs.calls()).toBe(1);
  });

  it("initialStatus ⇒ hiện ước tính ngay, không đọc lại lúc mở", async () => {
    const statusReads = countStatusReads();
    openDialog({ initialStatus: { locale: "vi", source_locale: "en", total: 120, missing: 42, batches: 2, estimated_credits: 4 } });

    expect(screen.getByText("42 mục · ~4 credit")).toBeInTheDocument();
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(statusReads).not.toHaveBeenCalled();
  });

  it("đọc ước tính lỗi ⇒ báo lỗi kèm Thử lại; thử lại được thì hiện ước tính", async () => {
    let failing = true;
    mockServer.use(
      http.get("*/projects/:projectId/translations/status", () =>
        failing ? HttpResponse.json({ data: null, error: { code: "PROJECT_NOT_FOUND", message: "Project not found" } }, { status: 404 }) : undefined
      )
    );
    openDialog();

    expect(await screen.findByRole("alert")).toHaveTextContent(MESSAGES.vi.errors.PROJECT_NOT_FOUND);
    failing = false;
    fireEvent.click(screen.getByRole("button", { name: "Thử lại" }));
    expect(await screen.findByText("100 mục · ~6 credit")).toBeInTheDocument();
  });

  it("en: hộp dịch theo ngôn ngữ giao diện, không sót chữ tiếng Việt", async () => {
    openDialog({}, "en");

    expect(await screen.findByText("100 items · ~6 credits")).toBeInTheDocument();
    expect(screen.getByText("From the original English to Vietnamese")).toBeInTheDocument();
    expect(vietnameseLeftovers(screen.getByRole("dialog"))).toEqual([]);
  });
});
