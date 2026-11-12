# Servidor de salas do modo online (só o server/, não o jogo). Serve para Koyeb, Fly.io, Railway,
# Google Cloud Run ou qualquer hospedagem que rode contêiner. Passo a passo em docs/ONLINE.md.
#
#   docker build -t toon-clash-server .
#   docker run -p 8787:8787 toon-clash-server
FROM node:22-alpine

WORKDIR /app
ENV NODE_ENV=production
# Só as dependências de produção (ws); three e as ferramentas de build ficam de fora.
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY server/server.mjs server/

USER node
# A hospedagem pode trocar a porta pela variável PORT.
ENV PORT=8787
EXPOSE 8787
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s \
  CMD node -e "fetch('http://127.0.0.1:'+process.env.PORT+'/healthz').then(r=>process.exit(r.ok?0:1),()=>process.exit(1))"
CMD ["node", "server/server.mjs"]
