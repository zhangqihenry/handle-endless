FROM node:22-alpine AS build
WORKDIR /app
RUN npm install -g pnpm@7.33.7
COPY . .
RUN pnpm install --frozen-lockfile --ignore-scripts && pnpm build

FROM node:22-alpine
WORKDIR /app
COPY --from=build /app/dist /app/www
COPY --from=build /app/server/index.mjs /app/server/index.mjs
COPY --from=build /app/server/config.json /app/server/config.json
COPY --from=build /app/server/catalog.json /app/server/catalog.json
ENV PORT=13863 WEB_DIR=/app/www DATA_DIR=/app/data
VOLUME ["/app/data"]
EXPOSE 13863
HEALTHCHECK --interval=30s --timeout=5s CMD node -e "fetch('http://127.0.0.1:13863/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "/app/server/index.mjs"]
