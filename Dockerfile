FROM node:22-bookworm-slim

RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    libreoffice \
    libreoffice-writer \
    libreoffice-calc \
    libreoffice-impress \
    libreoffice-draw \
    openjdk-17-jre-headless \
    libreoffice-java-common \
    xvfb \
    xauth \
    dbus-x11 \
    fonts-liberation \
    fonts-crosextra-carlito \
    fonts-crosextra-caladea \
    fonts-dejavu-core \
    fonts-freefont-ttf \
    fonts-noto-core \
    ca-certificates \
    procps \
  && rm -rf /var/lib/apt/lists/*

ENV JAVA_HOME=/usr/lib/jvm/java-17-openjdk-amd64
ENV PATH=$JAVA_HOME/bin:$PATH
ENV SAL_USE_VCLPLUGIN=svp
ENV HOME=/tmp
ENV DISPLAY=:99

RUN mkdir -p /tmp/.config/libreoffice/4/user

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

ENV NODE_ENV=production
EXPOSE 3000

CMD ["sh", "-c", "Xvfb :99 -screen 0 1280x1024x24 -nolisten tcp & sleep 2 && npm start"]