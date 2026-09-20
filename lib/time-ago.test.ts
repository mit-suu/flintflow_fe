import { createTranslator } from "next-intl";
import { describe, expect, it } from "vitest";
import type { Locale } from "./i18n";
import { formatNotificationTime, timeAgo } from "./time-ago";
import { MESSAGES } from "@/test/intl";

const NOW = new Date("2026-09-19T12:00:00Z").getTime();
const ago = (ms: number) => new Date(NOW - ms).toISOString();
const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;
const tFor = (locale: Locale) => createTranslator({ locale, messages: MESSAGES[locale], namespace: "app.time" });

describe("formatNotificationTime", () => {
  it("vi giữ đúng chữ cũ", () => {
    const t = tFor("vi");
    expect(formatNotificationTime(ago(10_000), t, "vi", NOW)).toBe("Vừa xong");
    expect(formatNotificationTime(ago(5 * MIN), t, "vi", NOW)).toBe("5 phút trước");
    expect(formatNotificationTime(ago(3 * HOUR), t, "vi", NOW)).toBe("3 giờ trước");
    expect(formatNotificationTime(ago(3 * DAY), t, "vi", NOW)).toBe(new Date(ago(3 * DAY)).toLocaleDateString("vi-VN"));
  });

  it("en dịch và chia số ít / số nhiều", () => {
    const t = tFor("en");
    expect(formatNotificationTime(ago(10_000), t, "en", NOW)).toBe("Just now");
    expect(formatNotificationTime(ago(1 * MIN), t, "en", NOW)).toBe("1 minute ago");
    expect(formatNotificationTime(ago(5 * MIN), t, "en", NOW)).toBe("5 minutes ago");
    expect(formatNotificationTime(ago(1 * HOUR), t, "en", NOW)).toBe("1 hour ago");
    expect(formatNotificationTime(ago(3 * DAY), t, "en", NOW)).toBe(new Date(ago(3 * DAY)).toLocaleDateString("en-US"));
  });
});

describe("timeAgo (thẻ dự án)", () => {
  it("vi giữ đúng chữ cũ", () => {
    const t = tFor("vi");
    expect(timeAgo(ago(10_000), t, NOW)).toBe("1 phút trước");
    expect(timeAgo(ago(2 * HOUR), t, NOW)).toBe("2 giờ trước");
    expect(timeAgo(ago(30 * HOUR), t, NOW)).toBe("Hôm qua");
    expect(timeAgo(ago(3 * DAY), t, NOW)).toBe("3 ngày trước");
    expect(timeAgo(ago(15 * DAY), t, NOW)).toBe("2 tuần trước");
  });

  it("en", () => {
    const t = tFor("en");
    expect(timeAgo(ago(30 * HOUR), t, NOW)).toBe("Yesterday");
    expect(timeAgo(ago(8 * DAY), t, NOW)).toBe("1 week ago");
    expect(timeAgo(ago(3 * DAY), t, NOW)).toBe("3 days ago");
  });
});
