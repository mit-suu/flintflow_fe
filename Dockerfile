# Image production của FE (T24).
#
# `next start` cần `.next`, `public`, `next.config.ts` và các dependency production — không cần
# devDependencies (eslint/vitest/playwright/msw/tailwind CLI), nên runtime cài lại bằng `--omit=dev`.
#
# CỐ Ý KHÔNG dùng `output: "standalone"`: Next cảnh báo `next start` không chạy với cấu hình đó, mà
# `npm run start` chính là lệnh Playwright dùng để dựng server ở CI (playwright.config.ts#webServer).
# Image nhỏ hơn không đáng đổi lấy một đường chạy mà Next tuyên bố là không hỗ trợ.
#
# NEXT_PUBLIC_* được nhúng lúc BUILD, không đọc lại lúc chạy — `NEXT_PUBLIC_API_URL` phải là địa chỉ
# **trình duyệt** gọi được (http://localhost:5000/api/v1 khi chạy compose trên máy), không phải tên
# service nội bộ của docker. Đổi giá trị này phải build lại image, không phải restart container.

FROM node:22-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci

FROM deps AS build
WORKDIR /app
ARG NEXT_PUBLIC_API_URL=http://localhost:5000/api/v1
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}
# Tuỳ chọn: không truyền thì app chạy bình thường, chỉ không có nút đăng nhập Google
# (`lib/google-auth.ts`). Trước T24, thiếu biến này làm trắng toàn bộ app.
ARG NEXT_PUBLIC_GOOGLE_CLIENT_ID=
ENV NEXT_PUBLIC_GOOGLE_CLIENT_ID=${NEXT_PUBLIC_GOOGLE_CLIENT_ID}
ENV NEXT_TELEMETRY_DISABLED=1
COPY . .
RUN npm run build

FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
ENV NEXT_TELEMETRY_DISABLED=1
ARG NEXT_PUBLIC_API_URL=http://localhost:5000/api/v1
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}

COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --from=build /app/.next ./.next
COPY --from=build /app/public ./public
COPY --from=build /app/next.config.ts ./next.config.ts
COPY --from=build /app/tsconfig.json ./tsconfig.json
COPY --from=build /app/next-env.d.ts ./next-env.d.ts

USER node

EXPOSE 3000
CMD ["npm", "run", "start"]
