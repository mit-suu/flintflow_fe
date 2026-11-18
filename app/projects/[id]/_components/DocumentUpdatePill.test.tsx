"use client";

import { fireEvent, screen } from "@testing-library/react";
import { renderWithIntl } from "@/test/intl";
import { describe, expect, it, vi } from "vitest";
import DocumentUpdatePill from "./DocumentUpdatePill";

const noop = () => undefined;

describe("DocumentUpdatePill", () => {
  it("không có gì để báo ⇒ không dựng gì", () => {
    const { container } = renderWithIntl(<DocumentUpdatePill pendingCount={0} updatedCount={0} generic={false} onJump={noop} onDismiss={noop} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("một mục đang cập nhật ⇒ chưa có nhãn (mục đó đã có nền + vạch ngay tại chỗ); nhiều mục ⇒ 'Đang cập nhật N mục', không phải nút", () => {
    const { container, rerender } = renderWithIntl(<DocumentUpdatePill pendingCount={1} updatedCount={0} generic={false} onJump={noop} onDismiss={noop} />);
    expect(container).toBeEmptyDOMElement();

    rerender(<DocumentUpdatePill pendingCount={3} updatedCount={0} generic={false} onJump={noop} onDismiss={noop} />);
    expect(screen.getByText("Đang cập nhật 3 mục")).toBeInTheDocument();
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("mục vừa cập nhật ngoài màn hình ⇒ 'N mục vừa cập nhật', bấm gọi onJump", () => {
    const onJump = vi.fn();
    renderWithIntl(<DocumentUpdatePill pendingCount={0} updatedCount={2} generic={false} onJump={onJump} onDismiss={noop} />);

    fireEvent.click(screen.getByRole("button", { name: /2 mục vừa cập nhật/ }));
    expect(onJump).toHaveBeenCalledTimes(1);
  });

  it("đang cập nhật nhiều mục thì nhãn đó đứng trước nhãn 'vừa cập nhật'", () => {
    renderWithIntl(<DocumentUpdatePill pendingCount={2} updatedCount={1} generic={false} onJump={noop} onDismiss={noop} />);
    expect(screen.getByText("Đang cập nhật 2 mục")).toBeInTheDocument();
    expect(screen.queryByText(/vừa cập nhật/)).toBeNull();
  });

  it("đổi diện rộng ⇒ chỉ nhãn chung 'Tài liệu đã cập nhật', bấm để ẩn", () => {
    const onDismiss = vi.fn();
    renderWithIntl(<DocumentUpdatePill pendingCount={0} updatedCount={0} generic onJump={noop} onDismiss={onDismiss} />);

    fireEvent.click(screen.getByRole("button", { name: "Tài liệu đã cập nhật" }));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });
});
