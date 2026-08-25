"use client";

interface SummaryData {
  problem?: string;
  users?: string;
  solution?: string;
  scope?: string;
  metrics?: string;
  risks?: string;
}

interface SummaryReviewCardProps {
  summary?: SummaryData;
  status: "pending" | "approved";
  onEdit: () => void;
  onApprove: () => void;
  isApproving?: boolean;
}

export default function SummaryReviewCard({
  summary,
  status,
  onEdit,
  onApprove,
  isApproving = false,
}: SummaryReviewCardProps) {
  const isApproved = status === "approved";

  return (
    <div className="w-full bg-white border border-[#DDD9F6] rounded-[16px] p-5 shadow-[0_12px_30px_rgba(79,70,229,0.1)] flex flex-col gap-3 my-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-[#4F46E5] text-base font-extrabold">✦</span>
          <h4 className="font-extrabold text-[13.5px] text-[#191817]">
            Tóm tắt yêu cầu khảo sát (Product Brief Summary)
          </h4>
        </div>

        <div
          className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider ${
            isApproved
              ? "bg-[#E9F7EE] text-[#1F7A45]"
              : "bg-[#FBF4E4] text-[#8A6D1F]"
          }`}
        >
          {isApproved ? "ĐÃ DUYỆT (APPROVED)" : "CHỜ DUYỆT (PENDING REVIEW)"}
        </div>
      </div>

      <div className="flex flex-col gap-2 text-[12.5px] text-[#4B4842] leading-relaxed bg-[#FAF9F7] p-3.5 rounded-[12px] border border-[#ECEAE5]">
        {summary?.problem && (
          <div>
            🎯 <strong className="text-[#191817]">Vấn đề & Tầm nhìn:</strong>{" "}
            {summary.problem}
          </div>
        )}
        {summary?.users && (
          <div>
            👥 <strong className="text-[#191817]">Người dùng mục tiêu:</strong>{" "}
            {summary.users}
          </div>
        )}
        {summary?.solution && (
          <div>
            💡 <strong className="text-[#191817]">Giá trị cốt lõi:</strong>{" "}
            {summary.solution}
          </div>
        )}
        {summary?.scope && (
          <div>
            📦 <strong className="text-[#191817]">Phạm vi MVP:</strong>{" "}
            {summary.scope}
          </div>
        )}
        {summary?.metrics && (
          <div>
            📊 <strong className="text-[#191817]">Tiêu chí thành công:</strong>{" "}
            {summary.metrics}
          </div>
        )}
        {summary?.risks && (
          <div className="pt-1 text-[#8A6D1F]">
            ⚠️ <strong className="text-[#8A6D1F]">Rủi ro & Giả định:</strong>{" "}
            {summary.risks}
          </div>
        )}
        {!summary && (
          <div className="italic text-[#8A867E]">
            Thông tin khảo sát Discovery đã được tổng hợp đầy đủ từ các bước phỏng
            vấn và tài liệu đính kèm.
          </div>
        )}
      </div>

      {!isApproved ? (
        <div className="flex items-center gap-2 pt-1">
          <button
            type="button"
            onClick={onEdit}
            className="px-3.5 py-1.5 rounded-full border border-[#ECEAE5] hover:bg-[#FAF9F7] text-[12px] font-bold text-[#4B4842] flex items-center gap-1.5 cursor-pointer transition-colors"
          >
            <span>✏</span>
            <span>Chỉnh sửa context</span>
          </button>

          <button
            type="button"
            onClick={onApprove}
            disabled={isApproving}
            className="px-4 py-1.5 rounded-full btn-gradient-primary text-white text-[12px] font-bold flex items-center gap-1.5 cursor-pointer shadow-md hover:opacity-95 transition-opacity"
          >
            {isApproving ? (
              <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <span>✓</span>
            )}
            <span>Duyệt & Chuyển sang sinh SRS</span>
          </button>
        </div>
      ) : (
        <div className="text-[12px] text-[#1F7A45] font-semibold flex items-center gap-1.5">
          <span>✓</span>
          <span>
            Discovery đã hoàn thành. Hệ thống đã mở khóa Phase Product Overview.
          </span>
        </div>
      )}
    </div>
  );
}
