import { fireEvent, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { renderWithIntl } from "@/test/intl";
import TemplateUpdateBanner from "./TemplateUpdateBanner";

const update = { template_id: "t1", name: "Mẫu ngân hàng", current_version: 1, latest_version: 3 };

afterEach(() => window.sessionStorage.clear());

describe("TemplateUpdateBanner", () => {
  it("báo bản mới và mở màn đổi mẫu với đúng bản", () => {
    const onUpdate = vi.fn();
    renderWithIntl(<TemplateUpdateBanner projectId="p1" update={update} canEdit onUpdate={onUpdate} />);
    expect(screen.getByText(/Mẫu Mẫu ngân hàng có bản 3/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Cập nhật" }));
    expect(onUpdate).toHaveBeenCalledWith({ templateId: "t1", version: 3 });
  });

  it("Để sau chỉ ẩn trong phiên, không gọi mạng", () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const { unmount } = renderWithIntl(<TemplateUpdateBanner projectId="p1" update={update} canEdit onUpdate={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: "Để sau" }));
    expect(screen.queryByText(/có bản 3/)).not.toBeInTheDocument();
    expect(fetchSpy).not.toHaveBeenCalled();
    unmount();
    // Mount lại trong cùng phiên vẫn ẩn; bản mới hơn thì hiện lại
    renderWithIntl(<TemplateUpdateBanner projectId="p1" update={update} canEdit onUpdate={() => {}} />);
    expect(screen.queryByText(/có bản 3/)).not.toBeInTheDocument();
    fetchSpy.mockRestore();
  });

  it("không hiện cho người không sửa được hoặc khi không có bản mới", () => {
    const { container, rerender } = renderWithIntl(<TemplateUpdateBanner projectId="p1" update={update} canEdit={false} onUpdate={() => {}} />);
    expect(container).toBeEmptyDOMElement();
    rerender(<TemplateUpdateBanner projectId="p1" update={null} canEdit onUpdate={() => {}} />);
    expect(container).toBeEmptyDOMElement();
  });
});
