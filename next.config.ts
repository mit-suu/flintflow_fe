import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

// Trỏ tới `i18n/request.ts` (đường mặc định của next-intl).
const withNextIntl = createNextIntlPlugin();

const nextConfig: NextConfig = {
  turbopack: {},
  // `components/ui/Icon.tsx` import từ barrel `lucide-react`; không có dòng này thì cả bộ ~1500 icon rơi vào
  // chunk đầu trang. Next viết lại thành import sâu từng icon lúc build.
  experimental: { optimizePackageImports: ["lucide-react"] },
};

export default withNextIntl(nextConfig);
