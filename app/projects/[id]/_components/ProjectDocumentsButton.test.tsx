import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { API_BASE_URL } from "@/lib/api/client";
import { mockServer } from "@/mocks/server";
import { renderWithIntl } from "@/test/intl";
import ProjectDocumentsButton from "./ProjectDocumentsButton";

const P = "650000000000000000000001";

const doc = (id: string, name: string) => ({
  _id: id,
  projectId: P,
  uploadedBy: "u1",
  fileName: name,
  originalName: name,
  mimeType: "text/plain",
  size: 10,
  url: `https://example.test/${name}`,
  parseStatus: "success",
  summaryStatus: "success",
  docCode: 1,
  createdAt: "2026-11-01T00:00:00.000Z",
  updatedAt: "2026-11-01T00:00:00.000Z",
});

const ORIGINAL = {
  version: "0.1",
  kind: "imported",
  based_on: null,
  cr_ids: [],
  baseline_id: "B01",
  has_clean_file: false,
  has_tracked_file: false,
  has_original_file: true,
  other_language_available: false,
  created_by: "u1",
  created_at: "2026-11-01T00:00:00.000Z",
};

/** Tài liệu tham khảo của dự án (thay đổi được giữa các lần gọi) + version import có file gốc. */
const serve = (initial: ReturnType<typeof doc>[]) => {
  const state = { docs: [...initial], versionCalls: 0 };
  mockServer.use(
    http.get(`${API_BASE_URL}/projects/:projectId/documents`, () => HttpResponse.json({ data: state.docs, error: null })),
    http.delete(`${API_BASE_URL}/projects/:projectId/documents/:documentId`, ({ params }) => {
      state.docs = state.docs.filter((d) => d._id !== params.documentId);
      return HttpResponse.json({ data: null, error: null });
    }),
    http.get(`${API_BASE_URL}/projects/:projectId/documents/:documentId/extract`, () => HttpResponse.json({ data: null, error: null })),
    http.get(`${API_BASE_URL}/projects/:projectId/versions`, () => {
      state.versionCalls += 1;
      return HttpResponse.json({ data: [ORIGINAL], error: null });
    })
  );
  return state;
};

beforeAll(() => mockServer.listen({ onUnhandledRequest: "error" }));
afterEach(() => mockServer.resetHandlers());
afterAll(() => mockServer.close());

const open = async () => {
  fireEvent.click(await screen.findByRole("button", { name: /^Tài liệu/ }));
  return screen.findByRole("dialog", { name: "Tài liệu của dự án" });
};

describe("ProjectDocumentsButton - nút Tài liệu ở đầu khung chat", () => {
  it("dự án AI soạn: số = tài liệu tham khảo; popup có Xoá + Thêm, không có Rút yêu cầu, không có File SRS", async () => {
    const state = serve([doc("d1", "minutes.txt"), doc("d2", "email.pdf")]);
    renderWithIntl(<ProjectDocumentsButton projectId={P} mode1={false} onAdd={vi.fn()} />);
    expect(await screen.findByRole("button", { name: "Tài liệu (2)" })).toBeInTheDocument();

    const dialog = await open();
    expect(within(dialog).getByText("minutes.txt")).toBeInTheDocument();
    expect(within(dialog).queryByRole("button", { name: "Rút yêu cầu" })).toBeNull();
    expect(within(dialog).queryByText("File SRS")).toBeNull();
    expect(within(dialog).getByRole("button", { name: "Thêm tài liệu" })).toBeInTheDocument();
    // Dự án AI soạn không gọi API version (chỉ dự án nhập SRS có)
    expect(state.versionCalls).toBe(0);

    fireEvent.click(within(dialog).getAllByRole("button", { name: "Xoá" })[0]);
    await waitFor(() => expect(screen.getByRole("button", { name: "Tài liệu (1)" })).toBeInTheDocument());
  });

  it("dự án nhập SRS: có File SRS gốc (tính vào số) và nút Rút yêu cầu", async () => {
    serve([doc("d1", "minutes.txt")]);
    renderWithIntl(<ProjectDocumentsButton projectId={P} mode1 onAdd={vi.fn()} />);
    expect(await screen.findByRole("button", { name: "Tài liệu (2)" })).toBeInTheDocument();
    const dialog = await open();
    expect(within(dialog).getByText("File SRS")).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Tải file gốc" })).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Rút yêu cầu" })).toBeInTheDocument();
  });

  it("Thêm tài liệu: gọi onAdd với cả lượt chọn rồi tải lại; huỷ ở cổng credit ⇒ không tải lại; tệp trùng ⇒ báo", async () => {
    const state = serve([]);
    const onAdd = vi
      .fn()
      .mockResolvedValueOnce({ cancelled: true })
      .mockImplementationOnce(async () => {
        state.docs = [doc("d9", "notes.md")];
        return { cancelled: false, duplicates: ["Tệp email.pdf đã có trong dự án."] };
      });
    renderWithIntl(<ProjectDocumentsButton projectId={P} mode1={false} onAdd={onAdd} />);
    // Chưa có tài liệu ⇒ nút không mang số 0 (số 0 trông như một lời báo)
    await waitFor(() => expect(screen.getByRole("button", { name: "Tài liệu" })).toHaveTextContent(/^Tài liệu$/));
    const dialog = await open();
    expect(within(dialog).getByText(/Chưa có tài liệu tham khảo nào/)).toBeInTheDocument();
    const input = dialog.querySelector('input[type="file"]') as HTMLInputElement;
    const files = [new File(["a"], "notes.md"), new File(["b"], "email.pdf")];

    fireEvent.change(input, { target: { files } });
    await waitFor(() => expect(onAdd).toHaveBeenCalledTimes(1));
    expect(onAdd.mock.calls[0][0]).toHaveLength(2);
    expect(within(dialog).queryByText("notes.md")).toBeNull();

    fireEvent.change(input, { target: { files } });
    expect(await within(dialog).findByText("notes.md")).toBeInTheDocument();
    expect(within(dialog).getByText("Tệp email.pdf đã có trong dự án.")).toBeInTheDocument();
  });

  it("Viewer (readOnly): không có Thêm tài liệu, không có Xoá", async () => {
    serve([doc("d1", "minutes.txt")]);
    renderWithIntl(<ProjectDocumentsButton projectId={P} mode1={false} readOnly onAdd={vi.fn()} />);
    const dialog = await open();
    await within(dialog).findByText("minutes.txt");
    expect(within(dialog).queryByRole("button", { name: "Thêm tài liệu" })).toBeNull();
    expect(within(dialog).queryByRole("button", { name: "Xoá" })).toBeNull();
  });
  it("đang có lượt tải khác ở ô chat ⇒ báo chờ, không tải lại danh sách", async () => {
    serve([]);
    const onAdd = vi.fn().mockResolvedValue({ busy: true });
    renderWithIntl(<ProjectDocumentsButton projectId={P} mode1={false} onAdd={onAdd} />);
    const dialog = await open();
    const input = dialog.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [new File(["a"], "a.md")] } });
    expect(await within(dialog).findByText(/Đang tải tệp đính kèm ở ô chat/)).toBeInTheDocument();
  });
});
