/**
 * Kịch bản dựng sẵn trên mock mode 1 cho test component: đi qua đúng API thật của `lib/api` (không sửa state tay),
 * để test UI bắt đầu từ một trạng thái có nghĩa.
 */
import { answerClarifications, createCr, getCr, runCrAction, type CrAction } from "@/lib/api/change-requests";
import { confirmLatest, finalizeImport, getImport, patchFields, patchMapping, startExtraction, uploadImport } from "@/lib/api/import";
import type { CrDetail } from "@/types/change-request";
import { MODE1_PROJECT_ID } from "./state";
import * as stateModule from "./state";

const P = MODE1_PROJECT_ID;

const docx = () => new File(["PK mock"], "SRS_Lumen.docx", { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" });

/** Upload → … → finalize: import ở `gap_review`, có version 0.0 + baseline. */
export const importToGapReview = async (): Promise<string> => {
  const id = (await uploadImport(P, docx())).data!.import.id;
  await confirmLatest(P, id);
  await patchMapping(P, { import_id: id, confirm_all: true });
  await startExtraction(P, id);
  for (let i = 0; i < 50 && (await getImport(P)).data!.import!.status === "extracting"; i++);
  await patchFields(P, { import_id: id, confirm_all: true });
  await finalizeImport(P, id, stateModule.mode1State.spineVersion);
  return id;
};

export const newCr = async (title = "Đăng xuất mọi thiết bị", description = "Logging out must sign the user out of all devices."): Promise<CrDetail> =>
  (await createCr(P, { title, description, source: { kind: "stakeholder_email", ref: "Email PM" }, requester: "PM Lan" })).data!;

/** Chạy lần lượt các bước không body của CR; trả chi tiết sau bước cuối. */
export const crSteps = async (crId: string, steps: CrAction[]): Promise<CrDetail> => {
  for (const step of steps) await runCrAction(P, crId, step);
  return (await getCr(P, crId)).data!;
};

/** CR mới đi tới `in_review` (1 group chờ duyệt). */
export const crToReview = async (title?: string): Promise<CrDetail> => {
  const cr = await newCr(title);
  return crSteps(cr.change_request.cr_id, ["clarify", "impact", "propose", "verify", "submit"]);
};

export { answerClarifications };
