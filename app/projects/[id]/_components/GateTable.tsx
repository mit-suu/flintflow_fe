import type { GateTable as GateTableData } from "@/types/pipeline";

/** Bảng thu gọn dưới tin gate (MoSCoW, ma trận quyền…): mở khi bấm, ô phân tách bằng khoảng trắng và nền fill, không kẻ viền. */
export default function GateTable({ table }: { table: GateTableData }) {
  if (table.rows.length === 0) return null;
  return (
    <details className="bg-surface-container-low rounded-card px-3.5 py-2.5">
      <summary className="text-[12.5px] font-semibold text-on-surface cursor-pointer focus-visible:outline-2 focus-visible:outline-primary">
        Xem bảng: {table.title_vi} ({table.rows.length + table.truncated} dòng)
      </summary>
      <div className="overflow-x-auto mt-2">
        <table className="w-full border-separate border-spacing-0.5 text-[12px]">
          <thead>
            <tr>
              {table.columns.map((column) => (
                <th key={column} className="bg-surface-container px-2 py-1 text-left font-semibold rounded-inner">
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {table.rows.map((row, i) => (
              <tr key={i}>
                {row.map((cell, j) => (
                  <td key={j} className="bg-surface-container-lowest px-2 py-1 align-top rounded-inner">
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {table.truncated > 0 && <p className="text-[11.5px] text-on-surface-muted mt-1.5">và {table.truncated} dòng nữa — xem đủ trong tài liệu.</p>}
    </details>
  );
}
