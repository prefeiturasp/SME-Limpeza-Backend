FROM node:18-slim

ENV TZ=America/Sao_Paulo
WORKDIR /app

# Dependências para PhantomJS, build nativo e extração .tar.bz2
RUN apt-get update && apt-get install -y \
    tzdata python3 make g++ curl \
    libfontconfig libfreetype6 \
    bzip2 ca-certificates wget \
  && cp /usr/share/zoneinfo/${TZ} /etc/localtime \
  && echo ${TZ} > /etc/timezone \
  && rm -rf /var/lib/apt/lists/*

COPY package*.json ./

ARG BCRYPT_BUILD_FROM_SOURCE=true
ENV BCRYPT_BUILD_FROM_SOURCE=$BCRYPT_BUILD_FROM_SOURCE

# Instala dependências (phantomjs-prebuilt fará o download do binário)
RUN npm ci

COPY . .

# Rebuild opcional do bcrypt
RUN npm rebuild bcrypt --build-from-source || true

EXPOSE 3001
CMD ["node", "server.js"]