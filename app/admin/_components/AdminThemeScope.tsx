"use client";

import { useEffect } from "react";

/**
 * Gắn class `admin-theme` lên `<html>` khi đang ở khu quản trị, gỡ khi rời đi.
 *
 * Phải là `<html>` chứ không phải thẻ bọc nội dung: menu thả xuống, hộp thoại, tooltip và bảng lệnh ⌘K
 * đều render qua portal gắn thẳng vào `document.body`, nằm NGOÀI cây admin — để class ở thẻ bọc thì
 * những thứ đó rơi về bộ màu của app và lệch tông với trang bên dưới.
 */
export default function AdminThemeScope() {
  useEffect(() => {
    const root = document.documentElement;
    root.classList.add("admin-theme");
    return () => root.classList.remove("admin-theme");
  }, []);

  return null;
}
