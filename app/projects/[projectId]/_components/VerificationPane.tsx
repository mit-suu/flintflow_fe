"use client";

import { useCallback, useEffect, useState } from "react";
import { apiCall } from "../../../../lib/api";
import type { VerificationData } from "@/types/flags";

interface VerificationPaneProps {
  projectId: string;
  onClose: () => void;
}

const isEmptyVerification = (data: VerificationData | null): boolean =>
  !data ||
  (data.readinessScore === undefined &&
    data.completenessPercent === undefined &&
    data.goalAlignmentPercent === undefined &&
    !data.blockingIssues?.length &&
    !data.facts?.length &&
    !data.assumptions?.length);

export default function VerificationPane({
  projectId,
  onClose,
}: VerificationPaneProps) {
  const [data, setData] = useState<VerificationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [recomputing, setRecomputing] = useState(false);
  const [recomputeError, setRecomputeError] = useState<string | null>(null);

  // setState chỉ nằm trong callback của promise để effect gọi hàm này không set state đồng bộ
  const loadVerification = useCallback(
    () =>
      apiCall<VerificationData>(`/verification/projects/${projectId}`)
        .then((res) => {
          setData(res.data);
          setError(null);
        })
        .catch((err: unknown) => {
          setData(null);
          setError(
            err instanceof Error ? err.message : "Không tải được dữ liệu kiểm tra"
          );
        })
        .finally(() => setLoading(false)),
    [projectId]
  );

  const handleRecompute = async () => {
    try {
      setRecomputing(true);
      setRecomputeError(null);
      await apiCall(`/verification/projects/${projectId}/recompute`, {
        method: "POST",
      });
      setLoading(true);
      await loadVerification();
    } catch (err: unknown) {
      setRecomputeError(
        err instanceof Error ? err.message : "Tính toán lại thất bại"
      );
    } finally {
      setRecomputing(false);
    }
  };

  useEffect(() => {
    if (projectId) {
      loadVerification();
    }
  }, [projectId, loadVerification]);

  return (
    <aside className="w-[320px] flex-none bg-[#FAF9F7] border-l border-[#ECEAE5] flex flex-col overflow-hidden z-10">
      {/* Header */}
      <div className="p-3.5 border-b border-[#ECEAE5] bg-white flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-[#1F7A45] font-bold">✓</span>
          <h3 className="font-extrabold text-[13px] text-[#191817]">
            Verification & Readiness
          </h3>
        </div>

        <button
          onClick={onClose}
          className="p-1 hover:bg-[#F5F3F0] rounded-[6px] text-[#8A867E] hover:text-[#191817] transition-colors cursor-pointer"
          title="Đóng bảng đánh giá"
        >
          ✕
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-12 gap-2 text-[#8A867E]">
            <span className="w-6 h-6 border-2 border-[#4F46E5] border-t-transparent rounded-full animate-spin" />
            <span className="text-xs">Đang tải báo cáo đánh giá…</span>
          </div>
        ) : (
          <>
            {error ? (
              <div className="bg-[#FDEDED] border border-[#F2CACA] rounded-[14px] p-3.5 text-[11.5px] text-[#8A4141] leading-relaxed">
                Không tải được dữ liệu kiểm tra: {error}
              </div>
            ) : isEmptyVerification(data) ? (
              <div className="bg-white border border-dashed border-[#E4E1DC] rounded-[14px] p-5 flex flex-col items-center gap-1.5 text-center">
                <span className="text-[12.5px] font-bold text-[#4B4842]">
                  Chưa có dữ liệu kiểm tra
                </span>
                <span className="text-[11px] text-[#8A867E] leading-relaxed">
                  Bấm “Tính toán lại chỉ số Readiness” để tạo báo cáo.
                </span>
              </div>
            ) : (
              <>
                {/* Readiness score */}
                {data?.readinessScore !== undefined && (
                  <div className="bg-white border border-[#ECEAE5] rounded-[14px] p-3.5 flex items-center justify-between shadow-2xs">
                    <span className="text-[11px] font-extrabold text-[#8A867E] tracking-wider uppercase">
                      READINESS
                    </span>
                    <span className="text-[12.5px] font-bold text-[#191817]">
                      {data.readinessScore}
                      {data.readinessLevel && (
                        <span className="ml-1.5 text-[10.5px] font-mono text-[#8A867E]">
                          {data.readinessLevel}
                        </span>
                      )}
                    </span>
                  </div>
                )}

                {/* SRS Completeness */}
                {data?.completenessPercent !== undefined && (
                  <div className="bg-white border border-[#ECEAE5] rounded-[14px] p-3.5 flex flex-col gap-2 shadow-2xs">
                    <div className="flex items-center justify-between text-[11px] font-extrabold text-[#8A867E]">
                      <span className="tracking-wider uppercase">SRS COMPLETENESS</span>
                      <span className="text-[#8A6D1F] text-[12.5px]">
                        {data.completenessPercent}%
                      </span>
                    </div>

                    <div className="w-full h-1.5 rounded-full bg-[#F0EEEA] overflow-hidden">
                      <div
                        className="h-full bg-linear-to-r from-[#E8A23D] to-[#D98A1F] rounded-full transition-all"
                        style={{
                          width: `${Math.min(100, Math.max(0, data.completenessPercent))}%`,
                        }}
                      />
                    </div>
                  </div>
                )}

                {/* Blocking Issues */}
                {data?.blockingIssues && data.blockingIssues.length > 0 && (
                  <div className="bg-white border border-[#ECEAE5] rounded-[14px] p-3.5 flex flex-col gap-2 shadow-2xs">
                    <div className="text-[10.5px] font-extrabold text-[#8A867E] tracking-wider uppercase">
                      ĐANG CHẶN READINESS ({data.blockingIssues.length})
                    </div>

                    <div className="flex flex-col gap-1.5">
                      {data.blockingIssues.map((issue, i) => (
                        <div
                          key={i}
                          className="flex items-start gap-2 text-[11.5px] text-[#4B4842] leading-relaxed"
                        >
                          <span className="text-[#C73E3E] font-bold text-xs mt-0.5">
                            ●
                          </span>
                          <span>{issue}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Facts vs Assumptions (UC 2.9) */}
                {(Boolean(data?.facts?.length) || Boolean(data?.assumptions?.length)) && (
                  <div className="bg-white border border-[#ECEAE5] rounded-[14px] p-3.5 flex flex-col gap-2.5 shadow-2xs">
                    <div className="text-[10.5px] font-extrabold text-[#8A867E] tracking-wider uppercase">
                      FACTS vs ASSUMPTIONS (UC 2.9)
                    </div>

                    {data?.facts?.map((fact, i) => (
                      <div
                        key={i}
                        className="p-2 bg-[#FAF9F7] rounded-[8px] border-l-3 border-[#1F7A45] text-[11px] text-[#4B4842]"
                      >
                        <span className="font-bold text-[#1F7A45]">Fact: </span>
                        {fact.statement}
                      </div>
                    ))}

                    {data?.assumptions?.map((ass, i) => (
                      <div
                        key={i}
                        className="p-2 bg-[#FAF9F7] rounded-[8px] border-l-3 border-[#E8A23D] text-[11px] text-[#4B4842] flex flex-col gap-1"
                      >
                        <div>
                          <span className="font-bold text-[#8A6D1F]">
                            Assumption:{" "}
                          </span>
                          {ass.statement}
                        </div>
                        <div className="flex items-center gap-1.5 pt-0.5">
                          <button
                            type="button"
                            className="px-2 py-0.5 rounded-full bg-white border border-[#ECEAE5] text-[10px] font-bold text-[#1F7A45] hover:bg-[#E9F7EE] cursor-pointer"
                          >
                            ✓ Xác nhận
                          </button>
                          <button
                            type="button"
                            className="px-2 py-0.5 rounded-full bg-white border border-[#ECEAE5] text-[10px] font-bold text-[#6B6862] hover:bg-[#FAF9F7] cursor-pointer"
                          >
                            ✎ Sửa
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Goal Alignment (UC 6.5) */}
                {data?.goalAlignmentPercent !== undefined && (
                  <div className="bg-white border border-[#ECEAE5] rounded-[14px] p-3.5 flex flex-col gap-2 shadow-2xs">
                    <div className="flex items-center justify-between text-[10.5px] font-extrabold text-[#8A867E]">
                      <span className="tracking-wider uppercase">
                        ĐỐI CHIẾU MỤC TIÊU (UC 6.5)
                      </span>
                      <span className="text-[#1F7A45] font-bold">
                        {data.goalAlignmentPercent}% aligned
                      </span>
                    </div>
                  </div>
                )}
              </>
            )}

            {recomputeError && (
              <div className="text-[11px] text-[#8A4141] leading-relaxed">
                Tính toán lại thất bại: {recomputeError}
              </div>
            )}

            {/* Recompute button */}
            <button
              type="button"
              onClick={handleRecompute}
              disabled={recomputing}
              className="w-full py-2 rounded-full border border-[#ECEAE5] hover:bg-white text-[11.5px] font-bold text-[#4B4842] flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
            >
              {recomputing ? (
                <span className="w-3.5 h-3.5 border-2 border-[#4B4842] border-t-transparent rounded-full animate-spin" />
              ) : (
                <span>↻</span>
              )}
              <span>Tính toán lại chỉ số Readiness</span>
            </button>
          </>
        )}
      </div>
    </aside>
  );
}
