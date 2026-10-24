FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force
COPY server.mjs relay-policy.mjs presence.mjs device-access.mjs assistant.mjs ./
COPY public ./public
USER node
EXPOSE 8080
CMD ["node", "server.mjs"]
