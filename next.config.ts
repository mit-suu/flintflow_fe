import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

// Trỏ tới `i18n/request.ts` (đường mặc định của next-intl).
const withNextIntl = createNextIntlPlugin();

const nextConfig: NextConfig = {
  turbopack: {},
};

export default withNextIntl(nextConfig);
