"use client";

import { useTranslations } from "next-intl";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { AiCostRow } from "@/lib/api/admin";

/**
 * Lượt gọi AI theo ngày, 7 ngày gần nhất.
 *
 * Giữ nguyên mọi dòng BE trả về, kể cả ngày 0 lượt: bỏ ngày rỗng đi thì trục tự bóp lại và một ngày
 * chết trông như ngày bình thường.
 */
export default function AiCallsChart({ rows }: { rows: AiCostRow[] }) {
  const t = useTranslations("admin.metrics.chart");
  const points = rows.map((row) => ({ label: row.label, calls: row.calls, failed: row.failedCalls }));

  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={points}>
        <CartesianGrid vertical={false} strokeOpacity={0.2} />
        <XAxis dataKey="label" tickLine={false} axisLine={false} fontSize={12} stroke="currentColor" opacity={0.6} />
        <YAxis
          allowDecimals={false}
          tickLine={false}
          axisLine={false}
          fontSize={12}
          width={36}
          stroke="currentColor"
          opacity={0.6}
        />
        <Tooltip
          cursor={{ fillOpacity: 0.1 }}
          formatter={(value, name) => [t("value", { value: Number(value) }), name === "failed" ? t("failed") : t("calls")]}
          labelFormatter={(label: unknown) => t("day", { label: String(label) })}
          contentStyle={{
            background: "var(--popover)",
            color: "var(--popover-foreground)",
            border: "1px solid var(--border)",
            borderRadius: "10px",
            fontSize: 12,
          }}
        />
        {/* Cột dùng tím nhạt (`primary-light`) chứ không phải tím đậm: mảng màu lớn trên nền trắng mà
            dùng đúng sắc của nút chính thì nặng và át hết các điểm nhấn khác trên trang. */}
        <Bar dataKey="calls" fill="var(--color-primary-light)" radius={[4, 4, 0, 0]} />
        <Bar dataKey="failed" fill="var(--destructive)" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
