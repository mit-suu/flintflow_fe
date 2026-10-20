import "@tanstack/react-table";

declare module "@tanstack/react-table" {
  /** Thêm vào `columnDef.meta`: class cho ô và nhãn tiếng Việt cho menu ẩn/hiện cột. */
  interface ColumnMeta<TData, TValue> {
    /** Áp cho cả `<th>` và `<td>` của cột. */
    className?: string;
    tdClassName?: string;
    thClassName?: string;
    /** Tên cột hiện trong menu "Ẩn/hiện cột" (mặc định là `column.id`). */
    label?: string;
  }
}
