import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/** Picker giả: ghi lại cấu hình builder, `setVisible` gọi callback theo kịch bản của test. */
const makeFakePicker = (respond: (actions: { PICKED: string; CANCEL: string }) => unknown) => {
  const calls: Record<string, unknown> = {};
  const Action = { PICKED: "picked", CANCEL: "cancel" };
  class DocsView {
    constructor(public viewId?: string) {
      calls.viewId = viewId;
    }
    setMimeTypes(m: string) {
      calls.mimeTypes = m;
      return this;
    }
    setIncludeFolders(v: boolean) {
      calls.includeFolders = v;
      return this;
    }
    setSelectFolderEnabled(v: boolean) {
      calls.selectFolder = v;
      return this;
    }
  }
  class PickerBuilder {
    private callback: (data: unknown) => void = () => {};
    setAppId(v: string) {
      calls.appId = v;
      return this;
    }
    setDeveloperKey(v: string) {
      calls.key = v;
      return this;
    }
    setOAuthToken(v: string) {
      calls.token = v;
      return this;
    }
    setLocale(v: string) {
      calls.locale = v;
      return this;
    }
    addView() {
      return this;
    }
    setCallback(cb: (data: unknown) => void) {
      this.callback = cb;
      return this;
    }
    build() {
      return { setVisible: () => this.callback(respond(Action)) };
    }
  }
  return { calls, picker: { PickerBuilder, DocsView, ViewId: { DOCS: "all" }, Action } };
};

const load = async () => {
  vi.resetModules();
  return import("./google-picker");
};

type TestWindow = { gapi?: unknown; google?: unknown };
const w = () => window as unknown as TestWindow;

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_GOOGLE_API_KEY", "picker-key");
  vi.stubEnv("NEXT_PUBLIC_GOOGLE_APP_ID", "123456789");
});

afterEach(() => {
  vi.unstubAllEnvs();
  delete w().gapi;
  delete w().google;
  document.head.querySelectorAll("script[src*='apis.google.com']").forEach((s) => s.remove());
});

describe("google-picker", () => {
  it("đủ API key + App ID ⇒ configured; thiếu một ⇒ không", async () => {
    expect((await load()).isGooglePickerConfigured).toBe(true);
    vi.stubEnv("NEXT_PUBLIC_GOOGLE_APP_ID", "");
    expect((await load()).isGooglePickerConfigured).toBe(false);
  });

  it("chưa có gapi ⇒ chèn script api.js, nạp module picker; chọn file ⇒ trả id/name/mimeType", async () => {
    const { picker, calls } = makeFakePicker((a) => ({
      action: a.PICKED,
      docs: [{ id: "doc-1", name: "SRS", mimeType: "application/vnd.google-apps.document", url: "x" }],
    }));
    const mod = await load();
    const promise = mod.pickGoogleFile({ accessToken: "access-xyz", locale: "vi" });

    const script = document.head.querySelector<HTMLScriptElement>("script[src='https://apis.google.com/js/api.js']");
    expect(script).not.toBeNull();
    w().gapi = {
      load: (name: string, opts: { callback: () => void }) => {
        expect(name).toBe("picker");
        w().google = { picker };
        opts.callback();
      },
    };
    script!.onload!(new Event("load"));

    expect(await promise).toEqual({ id: "doc-1", name: "SRS", mimeType: "application/vnd.google-apps.document" });
    expect(calls).toMatchObject({
      appId: "123456789",
      key: "picker-key",
      token: "access-xyz",
      locale: "vi",
      mimeTypes: `${mod.GOOGLE_DOC_MIME},${mod.DOCX_MIME}`,
      selectFolder: false,
    });
  });

  it("đã có gapi ⇒ không chèn script; huỷ ⇒ null", async () => {
    const { picker } = makeFakePicker((a) => ({ action: a.CANCEL }));
    w().gapi = {
      load: (_name: string, opts: { callback: () => void }) => {
        w().google = { picker };
        opts.callback();
      },
    };
    const mod = await load();
    expect(await mod.pickGoogleFile({ accessToken: "t" })).toBeNull();
    expect(document.head.querySelector("script[src*='apis.google.com']")).toBeNull();
  });

  it("script không tải được ⇒ reject; lần sau thử nạp lại", async () => {
    const mod = await load();
    const first = mod.loadGooglePicker();
    const script = document.head.querySelector<HTMLScriptElement>("script[src*='apis.google.com']")!;
    script.onerror!(new Event("error"));
    await expect(first).rejects.toThrow();

    const second = mod.loadGooglePicker();
    expect(second).not.toBe(first);
    expect(document.head.querySelectorAll("script[src*='apis.google.com']")).toHaveLength(2);
    second.catch(() => {});
  });
});
