"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Logo from "../../../components/Logo";
import { clearAuthToken } from "../../../lib/auth";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api/v1";

const ACTION_TYPES = [
  { id: "summarize", name: "Summarize", desc: "Tóm tắt yêu cầu / tài liệu" },
  { id: "extract", name: "Extract", desc: "Trích xuất entities & thuộc tính" },
  { id: "analysis", name: "Analysis", desc: "Phân tích mục tiêu & rủi ro" },
  { id: "clarification", name: "Clarification", desc: "Đặt câu hỏi làm rõ" },
  { id: "generate_section", name: "Generate Section", desc: "Sinh đặc tả section" },
  { id: "verification", name: "Verification", desc: "Rà soát mâu thuẫn & khoảng trống" },
  { id: "rewrite", name: "Rewrite", desc: "Viết lại chuẩn hóa văn phong" },
];

interface PromptTemplateDoc {
  _id: string;
  actionType: string;
  template: string;
  provider: "openai" | "anthropic" | "gemini" | "mock";
  aiModel: string;
  maxTokens: number;
  temperature: number;
  version: number;
  isActive: boolean;
  updatedBy?: { name?: string; email?: string } | string;
  createdAt: string;
  updatedAt: string;
}

export default function AdminPromptTemplatesPage() {
  const [selectedAction, setSelectedAction] = useState<string>("summarize");
  const [activeTemplate, setActiveTemplate] = useState<PromptTemplateDoc | null>(null);
  const [history, setHistory] = useState<PromptTemplateDoc[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [saving, setSaving] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Form states
  const [templateText, setTemplateText] = useState<string>("");
  const [provider, setProvider] = useState<"openai" | "anthropic" | "gemini" | "mock">("openai");
  const [aiModel, setAiModel] = useState<string>("gpt-4o-mini");
  const [maxTokens, setMaxTokens] = useState<number>(2048);
  const [temperature, setTemperature] = useState<number>(0.7);

  // Live Test states
  const [testVarValues, setTestVarValues] = useState<Record<string, string>>({});
  const [testing, setTesting] = useState<boolean>(false);
  const [testResult, setTestResult] = useState<any | null>(null);
  const [testError, setTestError] = useState<string | null>(null);

  const router = useRouter();

  const handleLogout = () => {
    clearAuthToken();
    router.push("/login");
  };

  // Extract {{variables}} from template text
  const detectedVariables = Array.from(
    new Set((templateText.match(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g) || []).map((v) =>
      v.replace(/[{}]/g, "").trim()
    ))
  );

  const getAuthHeaders = (): Record<string, string> => {
    const token = typeof window !== "undefined" ? localStorage.getItem("accessToken") : null;
    return {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    };
  };

  const fetchTemplateData = useCallback(async (actionType: string) => {
    setLoading(true);
    setError(null);
    setSuccessMsg(null);
    setTestResult(null);
    setTestError(null);
    try {
      // 1. Fetch active template
      const activeRes = await fetch(`${API_BASE_URL}/admin/prompt-templates/${actionType}`, {
        headers: getAuthHeaders(),
        credentials: "include",
      });
      const activeJson = await activeRes.json();

      if (activeRes.ok && activeJson.data) {
        const doc = activeJson.data;
        setActiveTemplate(doc);
        setTemplateText(doc.template);
        setProvider(doc.provider || "openai");
        setAiModel(doc.aiModel || doc.model || "gpt-4o-mini");
        setMaxTokens(doc.maxTokens || 2048);
        setTemperature(doc.temperature ?? 0.7);
      } else {
        setActiveTemplate(null);
        setTemplateText("");
      }

      // 2. Fetch history
      const historyRes = await fetch(`${API_BASE_URL}/admin/prompt-templates/${actionType}/history`, {
        headers: getAuthHeaders(),
        credentials: "include",
      });
      const historyJson = await historyRes.json();
      if (historyRes.ok && historyJson.data) {
        setHistory(historyJson.data);
      } else {
        setHistory([]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Đã có lỗi xảy ra");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTemplateData(selectedAction);
  }, [selectedAction, fetchTemplateData]);

  // Handle Save (Create or Update Version)
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccessMsg(null);

    try {
      const isNew = !activeTemplate;
      const endpoint = isNew
        ? `${API_BASE_URL}/admin/prompt-templates`
        : `${API_BASE_URL}/admin/prompt-templates/${selectedAction}`;
      const method = isNew ? "POST" : "PUT";

      const bodyData = {
        actionType: selectedAction,
        template: templateText,
        provider,
        model: aiModel,
        aiModel,
        maxTokens,
        temperature,
      };

      const res = await fetch(endpoint, {
        method,
        headers: getAuthHeaders(),
        body: JSON.stringify(bodyData),
        credentials: "include",
      });

      const json = await res.json();
      if (!res.ok || json.error) {
        throw new Error(json.error?.message || "Lưu template thất bại");
      }

      setSuccessMsg(
        isNew
          ? "Tạo mới Prompt Template thành công!"
          : `Đã lưu thành phiên bản v${json.data.version} thành công!`
      );

      await fetchTemplateData(selectedAction);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Lỗi khi lưu template");
    } finally {
      setSaving(false);
    }
  };

  // Handle Rollback / Activate Version
  const handleActivateVersion = async (version: number) => {
    if (!confirm(`Bạn có chắc chắn muốn kích hoạt phiên bản v${version} làm phiên bản chính?`)) {
      return;
    }

    setSaving(true);
    setError(null);
    setSuccessMsg(null);

    try {
      const res = await fetch(
        `${API_BASE_URL}/admin/prompt-templates/${selectedAction}/activate/${version}`,
        {
          method: "PATCH",
          headers: getAuthHeaders(),
          credentials: "include",
        }
      );

      const json = await res.json();
      if (!res.ok || json.error) {
        throw new Error(json.error?.message || "Kích hoạt phiên bản thất bại");
      }

      setSuccessMsg(`Đã kích hoạt lại phiên bản v${version} thành công!`);
      await fetchTemplateData(selectedAction);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Lỗi khi chuyển phiên bản");
    } finally {
      setSaving(false);
    }
  };

  // Handle Live Test Execution
  const handleRunTest = async () => {
    setTesting(true);
    setTestError(null);
    setTestResult(null);

    try {
      const res = await fetch(`${API_BASE_URL}/ai-actions/execute`, {
        method: "POST",
        headers: getAuthHeaders(),
        credentials: "include",
        body: JSON.stringify({
          actionType: selectedAction,
          input: {
            promptVariables: testVarValues,
          },
          provider,
          model: aiModel,
        }),
      });

      const json = await res.json();

      if (!res.ok || json.error) {
        throw new Error(json.error?.message || "Thực thi AI Action thất bại");
      }

      setTestResult(json.data);
    } catch (err) {
      setTestError(err instanceof Error ? err.message : "Lỗi khi chạy thử AI");
    } finally {
      setTesting(false);
    }
  };

  // Compute live prompt preview with interpolated test variables
  let livePromptPreview = templateText;
  for (const [key, val] of Object.entries(testVarValues)) {
    const placeholder = new RegExp(`{{\\s*${key}\\s*}}`, "g");
    livePromptPreview = livePromptPreview.replace(placeholder, val || `{{${key}}}`);
  }

  return (
    <main className="min-h-screen bg-background text-on-surface flex flex-col px-6 py-8">
      {/* Header Banner */}
      <header className="max-w-6xl mx-auto w-full mb-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Logo sizeClassName="w-12 h-12" />
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-on-surface">
              Quản lý Prompt Templates (UC83)
            </h1>
            <p className="text-xs text-secondary">
              Quản lý, cấu hình model, thử nghiệm biến {`{{variable_name}}`} và lịch sử phiên bản cho AI Action Framework
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/home"
            className="text-xs font-semibold text-secondary hover:text-primary transition-colors flex items-center gap-1"
          >
            <span className="material-symbols-outlined text-lg">arrow_back</span>
            Về Dashboard
          </Link>
          <button
            type="button"
            onClick={handleLogout}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold text-red-600 hover:bg-red-50 border border-red-200 transition-colors"
          >
            <span className="text-sm leading-none">⏻</span>
            Đăng xuất
          </button>
        </div>
      </header>

      {/* Main Grid */}
      <div className="max-w-6xl mx-auto w-full grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Sidebar Tabs — 7 Action Types */}
        <aside className="lg:col-span-3 space-y-2">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-secondary px-2 mb-3">
            Danh sách Action Types
          </h2>
          {ACTION_TYPES.map((act) => {
            const isSelected = selectedAction === act.id;
            return (
              <button
                key={act.id}
                onClick={() => setSelectedAction(act.id)}
                className={`w-full text-left p-3 rounded-lg border transition-all ${
                  isSelected
                    ? "bg-primary-container text-white border-primary-container shadow-sm font-semibold"
                    : "bg-surface-container-lowest border-surface-container hover:bg-surface-container-low text-on-surface"
                }`}
              >
                <div className="text-sm font-medium">{act.name}</div>
                <div
                  className={`text-[11px] mt-0.5 truncate ${
                    isSelected ? "text-white/80" : "text-secondary"
                  }`}
                >
                  {act.desc}
                </div>
              </button>
            );
          })}
        </aside>

        {/* Content Area */}
        <div className="lg:col-span-9 space-y-6">
          {/* Status Bar */}
          {error && (
            <div className="bg-error-container border border-error/20 text-on-error-container px-4 py-3 rounded-lg text-xs font-medium flex items-center justify-between">
              <span>{error}</span>
              <button onClick={() => setError(null)} className="text-error font-bold">
                ✕
              </button>
            </div>
          )}

          {successMsg && (
            <div className="bg-[#d4edda] border border-[#c3e6cb] text-[#155724] px-4 py-3 rounded-lg text-xs font-medium flex items-center justify-between">
              <span>{successMsg}</span>
              <button onClick={() => setSuccessMsg(null)} className="font-bold">
                ✕
              </button>
            </div>
          )}

          {/* Form & Editor Card */}
          <div className="bg-surface-container-lowest rounded-xl p-6 card-elevated border border-surface-container">
            <div className="flex items-center justify-between mb-6 pb-4 border-b border-surface-container">
              <div>
                <h2 className="text-lg font-bold text-on-surface flex items-center gap-2">
                  Action: <span className="text-primary-container">{selectedAction}</span>
                </h2>
                <p className="text-xs text-secondary">
                  Cấu hình Prompt Template & Tham số LLM
                </p>
              </div>
              <div className="flex items-center gap-2">
                {activeTemplate ? (
                  <span className="px-3 py-1 bg-emerald-100 text-emerald-800 rounded-full text-xs font-semibold">
                    v{activeTemplate.version} (Active)
                  </span>
                ) : (
                  <span className="px-3 py-1 bg-amber-100 text-amber-800 rounded-full text-xs font-semibold">
                    Chưa cấu hình (Chạy mặc định)
                  </span>
                )}
              </div>
            </div>

            {loading ? (
              <div className="py-12 text-center text-xs text-secondary flex items-center justify-center gap-2">
                <span className="material-symbols-outlined text-xl ff-spinner">
                  progress_activity
                </span>
                Đang tải dữ liệu template...
              </div>
            ) : (
              <form onSubmit={handleSave} className="space-y-6">
                {/* Config Controls Row */}
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 bg-surface-container-low p-4 rounded-lg border border-surface-container">
                  {/* Provider */}
                  <div>
                    <label className="block text-xs font-medium text-tertiary mb-1">
                      Provider
                    </label>
                    <select
                      value={provider}
                      onChange={(e) =>
                        setProvider(e.target.value as "openai" | "anthropic" | "gemini" | "mock")
                      }
                      className="w-full h-9 px-3 rounded-md border border-surface-container bg-white text-xs text-on-surface focus:outline-none input-focus-ring"
                    >
                      <option value="openai">OpenAI</option>
                      <option value="anthropic">Anthropic</option>
                      <option value="gemini">Google Gemini</option>
                      <option value="mock">Mock AI (Thử nghiệm Offline)</option>
                    </select>
                  </div>

                  {/* Model */}
                  <div>
                    <label className="block text-xs font-medium text-tertiary mb-1">
                      Model Name
                    </label>
                    <input
                      type="text"
                      value={aiModel}
                      onChange={(e) => setAiModel(e.target.value)}
                      placeholder="gpt-4o-mini"
                      className="w-full h-9 px-3 rounded-md border border-surface-container bg-white text-xs text-on-surface focus:outline-none input-focus-ring"
                    />
                  </div>

                  {/* Max Tokens */}
                  <div>
                    <label className="block text-xs font-medium text-tertiary mb-1">
                      Max Tokens
                    </label>
                    <input
                      type="number"
                      value={maxTokens}
                      onChange={(e) => setMaxTokens(Number(e.target.value))}
                      min={128}
                      max={16000}
                      className="w-full h-9 px-3 rounded-md border border-surface-container bg-white text-xs text-on-surface focus:outline-none input-focus-ring"
                    />
                  </div>

                  {/* Temperature */}
                  <div>
                    <label className="block text-xs font-medium text-tertiary mb-1">
                      Temperature ({temperature})
                    </label>
                    <input
                      type="range"
                      min={0}
                      max={1}
                      step={0.1}
                      value={temperature}
                      onChange={(e) => setTemperature(Number(e.target.value))}
                      className="w-full h-9 accent-primary-container"
                    />
                  </div>
                </div>

                {/* Template Textarea */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-medium text-tertiary">
                      Nội dung Prompt Template
                    </label>
                    <span className="text-[11px] text-secondary">
                      Dùng cú pháp <code className="bg-surface-container px-1 py-0.5 rounded text-primary font-mono">{`{{variable_name}}`}</code> để chèn biến
                    </span>
                  </div>
                  <textarea
                    rows={8}
                    required
                    value={templateText}
                    onChange={(e) => setTemplateText(e.target.value)}
                    placeholder="Nhập nội dung prompt template..."
                    className="w-full p-4 rounded-lg border border-surface-container bg-white text-xs font-mono text-on-surface focus:outline-none input-focus-ring leading-relaxed"
                  />
                </div>

                {/* Detected Variables Preview */}
                {detectedVariables.length > 0 && (
                  <div className="flex items-center gap-2 flex-wrap text-xs">
                    <span className="text-secondary font-medium">Biến phát hiện được:</span>
                    {detectedVariables.map((varName) => (
                      <span
                        key={varName}
                        className="px-2 py-0.5 bg-primary-fixed text-on-primary-container font-mono text-[11px] rounded"
                      >
                        {`{{${varName}}}`}
                      </span>
                    ))}
                  </div>
                )}

                {/* Submit Action */}
                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={saving}
                    className="h-10 px-6 bg-primary-container text-white font-medium text-xs rounded-lg shadow-sm hover:brightness-90 btn-press disabled:opacity-50 flex items-center gap-2"
                  >
                    {saving ? (
                      <>
                        <span className="material-symbols-outlined text-lg ff-spinner">
                          progress_activity
                        </span>
                        Đang lưu...
                      </>
                    ) : (
                      <>
                        <span className="material-symbols-outlined text-lg">save</span>
                        {activeTemplate ? "Lưu thành Version mới" : "Khởi tạo Prompt Template"}
                      </>
                    )}
                  </button>
                </div>
              </form>
            )}
          </div>

          {/* Interactive Test Panel */}
          <div className="bg-surface-container-lowest rounded-xl p-6 card-elevated border border-primary-container/30">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-surface-container">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-primary-container text-xl">
                  science
                </span>
                <h3 className="text-sm font-bold text-on-surface">
                  Thử nghiệm Prompt trực tiếp với AI (Live Test)
                </h3>
              </div>
              <span className="text-[11px] text-secondary">
                Nhập giá trị biến bên dưới để kiểm tra prompt sau khi interpolate
              </span>
            </div>

            {detectedVariables.length === 0 ? (
              <p className="text-xs text-secondary italic py-2">
                Template hiện tại không chứa biến dạng {`{{...}}`}. Bạn vẫn có thể chạy thử trực tiếp.
              </p>
            ) : (
              <div className="space-y-3 mb-4">
                <label className="block text-xs font-semibold text-tertiary">
                  Nhập giá trị cho các biến test:
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {detectedVariables.map((varName) => (
                    <div key={varName} className="space-y-1">
                      <span className="text-[11px] font-mono text-primary font-semibold">
                        {`{{${varName}}}`}
                      </span>
                      <textarea
                        rows={2}
                        value={testVarValues[varName] || ""}
                        onChange={(e) =>
                          setTestVarValues({ ...testVarValues, [varName]: e.target.value })
                        }
                        placeholder={`Nhập dữ liệu test cho ${varName}...`}
                        className="w-full p-2.5 rounded border border-surface-container bg-white text-xs font-sans text-on-surface focus:outline-none input-focus-ring"
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Live Interpolated Prompt Preview */}
            <div className="mb-4">
              <label className="block text-[11px] font-semibold text-secondary mb-1">
                Xem trước Prompt thực tế sẽ gửi tới AI (Interpolated Prompt):
              </label>
              <div className="bg-surface-container-low p-3 rounded border border-surface-container text-xs font-mono whitespace-pre-wrap text-on-surface max-h-40 overflow-y-auto">
                {livePromptPreview}
              </div>
            </div>

            {/* Test Action Button */}
            <div className="flex justify-end mb-4">
              <button
                type="button"
                onClick={handleRunTest}
                disabled={testing}
                className="h-10 px-5 bg-tertiary text-white font-medium text-xs rounded-lg shadow-sm hover:brightness-90 btn-press disabled:opacity-50 flex items-center gap-2"
              >
                {testing ? (
                  <>
                    <span className="material-symbols-outlined text-lg ff-spinner">
                      progress_activity
                    </span>
                    Đang gửi tới AI...
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-lg">play_arrow</span>
                    Chạy thử với {provider.toUpperCase()} ({aiModel})
                  </>
                )}
              </button>
            </div>

            {/* Test Error */}
            {testError && (
              <div className="bg-error-container border border-error/20 text-on-error-container p-3 rounded-lg text-xs font-medium mb-3">
                <strong>Lỗi thực thi:</strong> {testError}
              </div>
            )}

            {/* Test Output Display */}
            {testResult && (
              <div className="mt-4 pt-4 border-t border-surface-container space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-emerald-700 flex items-center gap-1">
                    <span className="material-symbols-outlined text-base">check_circle</span>
                    Kết quả trả về thành công
                  </span>
                  <div className="flex items-center gap-3 text-[11px] text-secondary">
                    <span>
                      Tokens: <strong>{testResult.tokensUsed?.totalTokens || 0}</strong>
                    </span>
                    <span>
                      Latency: <strong>{testResult.latencyMs}ms</strong>
                    </span>
                    <span>
                      Cost: <strong className="text-primary">{testResult.cost} credit</strong>
                    </span>
                  </div>
                </div>

                {/* Parsed JSON Data */}
                <div>
                  <label className="block text-[11px] font-semibold text-secondary mb-1">
                    Output đã Parse (Zod Validated):
                  </label>
                  <pre className="bg-slate-900 text-emerald-400 p-4 rounded-lg text-xs font-mono overflow-x-auto max-h-60">
                    {JSON.stringify(testResult.data, null, 2)}
                  </pre>
                </div>

                {/* Raw Text */}
                <div>
                  <label className="block text-[11px] font-semibold text-secondary mb-1">
                    Văn bản thô từ AI (Raw Response):
                  </label>
                  <div className="bg-surface-container-low p-3 rounded border border-surface-container text-xs whitespace-pre-wrap text-on-surface max-h-40 overflow-y-auto">
                    {testResult.rawText}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* History Section */}
          <div className="bg-surface-container-lowest rounded-xl p-6 card-elevated border border-surface-container">
            <h3 className="text-sm font-bold text-on-surface mb-4 pb-2 border-b border-surface-container flex items-center justify-between">
              <span>Lịch sử phiên bản (Version History)</span>
              <span className="text-xs font-normal text-secondary">
                {history.length} phiên bản
              </span>
            </h3>

            {history.length === 0 ? (
              <p className="text-xs text-secondary py-4 text-center">
                Chưa có lịch sử phiên bản nào.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-surface-container text-tertiary">
                      <th className="py-2.5 px-3">Version</th>
                      <th className="py-2.5 px-3">Trạng thái</th>
                      <th className="py-2.5 px-3">Provider / Model</th>
                      <th className="py-2.5 px-3">Max Tokens</th>
                      <th className="py-2.5 px-3">Ngày cập nhật</th>
                      <th className="py-2.5 px-3 text-right">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-surface-container">
                    {history.map((hDoc) => (
                      <tr key={hDoc._id} className="hover:bg-surface-container-low transition-colors">
                        <td className="py-3 px-3 font-semibold text-on-surface">
                          v{hDoc.version}
                        </td>
                        <td className="py-3 px-3">
                          {hDoc.isActive ? (
                            <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded font-semibold text-[11px]">
                              Active
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 bg-surface-container text-secondary rounded text-[11px]">
                              Inactive
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-3 text-secondary font-mono">
                          {hDoc.provider} / {hDoc.aiModel}
                        </td>
                        <td className="py-3 px-3 text-secondary">
                          {hDoc.maxTokens}
                        </td>
                        <td className="py-3 px-3 text-secondary">
                          {new Date(hDoc.updatedAt).toLocaleString("vi-VN")}
                        </td>
                        <td className="py-3 px-3 text-right">
                          {!hDoc.isActive && (
                            <button
                              onClick={() => handleActivateVersion(hDoc.version)}
                              disabled={saving}
                              className="px-3 py-1 bg-surface-container hover:bg-surface-container-high text-on-surface rounded text-[11px] font-medium transition btn-press disabled:opacity-50"
                            >
                              Kích hoạt lại
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
