"use client";

import { createContext, useContext } from "react";

/**
 * FLF-495: khung chat nhờ pane tài liệu hiện đề xuất của CR. `locationId` = cuộn tới vị trí đó; `null` = chỉ bật chế độ xem.
 * Không có Provider (chat dùng ngoài workspace, test) ⇒ `null` và các nút "Xem trên tài liệu" tự ẩn.
 */
export type ViewOnDocument = (locationId: string | null) => void;

export const CrDocumentViewContext = createContext<ViewOnDocument | null>(null);

export const useViewOnDocument = (): ViewOnDocument | null => useContext(CrDocumentViewContext);
