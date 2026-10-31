FROM node:22-alpine AS build
WORKDIR /src
RUN apk add --no-cache git
COPY . .
# The allowlisted build context contains source only; create an index for the
# source archive without transferring the developer's Git history or credentials.
RUN git init && git add . && npm ci --ignore-scripts && npm run build && npm test && npm run package:source

FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force
COPY server.mjs relay-policy.mjs presence.mjs device-access.mjs assistant.mjs account-access.mjs ./
COPY platform/internal.mjs platform/security.mjs ./platform/
COPY --from=build /src/public ./public
RUN node --input-type=module -e "import {createFrostServer} from './server.mjs'; const s=createFrostServer().listen(0,'127.0.0.1'); await new Promise(r=>s.once('listening',r)); try{for(const p of ['/health','/app.mjs','/source.zip']){const r=await fetch('http://localhost:'+s.address().port+p); if(!r.ok)throw Error(p+': '+r.status); await r.arrayBuffer();}}finally{s.close();}"
USER node
EXPOSE 8080
CMD ["node", "server.mjs"]
