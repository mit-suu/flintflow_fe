FROM node:22-alpine AS base
WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build

FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000

COPY --from=base /app/package*.json ./
COPY --from=base /app/.next ./.next
COPY --from=base /app/public ./public
COPY --from=base /app/node_modules ./node_modules
COPY --from=base /app/next.config.ts ./next.config.ts
COPY --from=base /app/tsconfig.json ./tsconfig.json
COPY --from=base /app/next-env.d.ts ./next-env.d.ts

EXPOSE 3000
CMD ["npm", "run", "start", "--", "-p", "3000"]
