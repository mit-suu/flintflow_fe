/**
 * Google Picker: cho user chọn một Google Doc hoặc file `.docx` trên Drive của họ.
 *
 * Với quyền `drive.file`, app chỉ đọc được file user tự chọn ở đây — Picker bắt buộc có App ID (project number) để Google
 * cấp quyền file đã chọn cho đúng app. API key nên giới hạn API = Google Picker API và referrer = domain FE.
 *
 * `NEXT_PUBLIC_*` được Next thay bằng hằng số lúc build. Thiếu một trong hai ⇒ không hiện nút chọn từ Drive.
 */

export const GOOGLE_PICKER_API_KEY = (process.env.NEXT_PUBLIC_GOOGLE_API_KEY ?? "").trim();
export const GOOGLE_PICKER_APP_ID = (process.env.NEXT_PUBLIC_GOOGLE_APP_ID ?? "").trim();
export const isGooglePickerConfigured = GOOGLE_PICKER_API_KEY.length > 0 && GOOGLE_PICKER_APP_ID.length > 0;

export const GOOGLE_DOC_MIME = "application/vnd.google-apps.document";
export const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

const GAPI_SRC = "https://apis.google.com/js/api.js";

export interface PickedGoogleFile {
  id: string;
  name: string;
  mimeType: string;
}

// ─── Kiểu tối thiểu của gapi + google.picker (không thêm @types cho vài hàm) ─────────────

interface PickerDoc {
  id: string;
  name: string;
  mimeType: string;
}
interface PickerResponse {
  action: string;
  docs?: PickerDoc[];
}
interface PickerView {
  setMimeTypes(mimeTypes: string): PickerView;
  setIncludeFolders(include: boolean): PickerView;
  setSelectFolderEnabled(enabled: boolean): PickerView;
}
interface PickerBuilder {
  setAppId(appId: string): PickerBuilder;
  setDeveloperKey(key: string): PickerBuilder;
  setOAuthToken(token: string): PickerBuilder;
  setLocale(locale: string): PickerBuilder;
  addView(view: PickerView): PickerBuilder;
  setCallback(callback: (data: PickerResponse) => void): PickerBuilder;
  build(): { setVisible(visible: boolean): void };
}
interface PickerNamespace {
  PickerBuilder: new () => PickerBuilder;
  DocsView: new (viewId?: string) => PickerView;
  ViewId: { DOCS: string };
  Action: { PICKED: string; CANCEL: string };
}
interface GoogleWindow {
  gapi?: { load(name: string, options: { callback: () => void; onerror?: () => void }): void };
  google?: { picker?: PickerNamespace };
}

const win = (): GoogleWindow => window as unknown as GoogleWindow;

let loading: Promise<PickerNamespace> | null = null;

/** Nạp `api.js` rồi module `picker` một lần; lỗi ⇒ lần sau thử lại. */
export const loadGooglePicker = (): Promise<PickerNamespace> => {
  if (loading) return loading;
  loading = new Promise<PickerNamespace>((resolve, reject) => {
    const loadPicker = () =>
      win().gapi!.load("picker", {
        callback: () => {
          const picker = win().google?.picker;
          if (picker) resolve(picker);
          else reject(new Error("google.picker không có sau khi nạp"));
        },
        onerror: () => reject(new Error("Không nạp được Google Picker")),
      });
    if (win().gapi?.load) {
      loadPicker();
      return;
    }
    const script = document.createElement("script");
    script.src = GAPI_SRC;
    script.async = true;
    script.onload = loadPicker;
    script.onerror = () => reject(new Error("Không tải được apis.google.com/js/api.js"));
    document.head.appendChild(script);
  }).catch((err: unknown) => {
    loading = null;
    throw err;
  });
  return loading;
};

/**
 * Mở Picker (mặc định Google Docs và `.docx`, một file). Trả file đã chọn, hoặc `null` khi user huỷ.
 * `accessToken` lấy từ `GET /integrations/google/access-token`. Trợ lý Google Docs chỉ cần Google Docs ⇒ truyền `mimeTypes`.
 */
export const pickGoogleFile = async ({
  accessToken,
  locale,
  mimeTypes = [GOOGLE_DOC_MIME, DOCX_MIME],
}: {
  accessToken: string;
  locale?: string;
  mimeTypes?: string[];
}): Promise<PickedGoogleFile | null> => {
  const picker = await loadGooglePicker();
  return new Promise((resolve) => {
    const view = new picker.DocsView(picker.ViewId.DOCS)
      .setMimeTypes(mimeTypes.join(","))
      .setIncludeFolders(true)
      .setSelectFolderEnabled(false);
    let builder = new picker.PickerBuilder()
      .setAppId(GOOGLE_PICKER_APP_ID)
      .setDeveloperKey(GOOGLE_PICKER_API_KEY)
      .setOAuthToken(accessToken)
      .addView(view)
      .setCallback((data) => {
        if (data.action === picker.Action.PICKED) {
          const doc = data.docs?.[0];
          resolve(doc ? { id: doc.id, name: doc.name, mimeType: doc.mimeType } : null);
        } else if (data.action === picker.Action.CANCEL) {
          resolve(null);
        }
      });
    if (locale) builder = builder.setLocale(locale);
    builder.build().setVisible(true);
  });
};
