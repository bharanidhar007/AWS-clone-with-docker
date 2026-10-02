# AWS Console Practice Sandbox — Node/Express API + SQLite database,
# serving the static frontend from the same container.
FROM node:20-alpine

# better-sqlite3 needs to compile a native addon at install time.
RUN apk add --no-cache python3 make g++

WORKDIR /app

COPY backend/package.json backend/package-lock.json* ./backend/
RUN cd backend && npm install --omit=dev

COPY backend ./backend
COPY public ./public

ENV PORT=4000
ENV DATA_DIR=/app/data
RUN mkdir -p /app/data
VOLUME ["/app/data"]

EXPOSE 4000

HEALTHCHECK --interval=30s --timeout=3s CMD wget -qO- http://localhost:4000/api/regions >/dev/null || exit 1

CMD ["node", "backend/server.js"]
