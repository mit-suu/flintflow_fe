import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderWithIntl } from "@/test/intl";
import PasswordStrengthMeter from "./PasswordStrengthMeter";

describe("PasswordStrengthMeter", () => {
  it("ô còn trống ⇒ không vẽ gì (tránh đỏ ngay lúc mới vào trang)", () => {
    const { container } = renderWithIntl(<PasswordStrengthMeter password="" />);
    expect(container).toBeEmptyDOMElement();
  });

  it("mật khẩu yếu ⇒ nói thẳng thiếu cái gì, không chỉ tô vạch đỏ", () => {
    renderWithIntl(<PasswordStrengthMeter password="matkhau2026" />);

    expect(screen.getByText(/^Yếu/)).toBeInTheDocument();
    expect(screen.getByText(/3 trong 4 nhóm/)).toBeInTheDocument();
  });

  it("qua hết luật cứng nhưng chưa tới ngưỡng ⇒ báo rõ còn thiếu gì", () => {
    renderWithIntl(<PasswordStrengthMeter password="muaroi2!" />);

    expect(screen.getByText(/Trung bình — chưa dùng được/)).toBeInTheDocument();
    expect(screen.getByText(/từ 12 ký tự, hoặc có đủ cả 4 nhóm/)).toBeInTheDocument();
  });

  it("tiếng Việt có dấu ⇒ báo chỉ dùng chữ không dấu", () => {
    renderWithIntl(<PasswordStrengthMeter password="Đườngxưa1!" />);

    expect(screen.getByText(/không dấu/)).toBeInTheDocument();
  });

  it("đạt chuẩn ⇒ hiện mức, không còn dòng nhắc", () => {
    renderWithIntl(<PasswordStrengthMeter password="Mua2Roi!TrenPho" />);

    expect(screen.getByText("Mạnh")).toBeInTheDocument();
    expect(screen.queryByText(/chưa dùng được/)).not.toBeInTheDocument();
  });

  // Ngưỡng nằm trong câu chữ đến từ `PASSWORD_ISSUE_VALUES`, nên bản dịch không phải chép lại con số —
  // test này giữ cho bản `en` không rơi lại thành chuỗi tiếng Việt.
  it("locale en ⇒ chữ và ngưỡng đều sang tiếng Anh", () => {
    renderWithIntl(<PasswordStrengthMeter password="muaroi2!" />, "en");

    expect(screen.getByText(/Medium — not usable yet/)).toBeInTheDocument();
    expect(screen.getByText(/use 12 characters or more/)).toBeInTheDocument();
  });
});
