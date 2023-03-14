# base
FROM rockylinux:9.1 AS base

SHELL ["/bin/bash", "-c"]

RUN dnf upgrade -y --refresh

RUN dnf install -y 'dnf-command(config-manager)' \
    && dnf config-manager --set-enabled crb \
    && dnf install -y epel-release

RUN dnf install -y \
    glibc-langpack-en \
    glibc-langpack-fr \
    jemalloc \
    jemalloc-devel \
    langpacks-en \
    langpacks-fr \
    nmap-ncat \
    procps-ng \
    unzip

ENV TZ=Europe/Paris

RUN echo "LANG=en_FR.UTF-8" > /etc/locale.conf \
    && cp -f /usr/share/zoneinfo/${TZ} /etc/localtime

COPY project/docker/production/files /

RUN groupadd -g 1000 node \
    && useradd -u 1000 -g 1000 -s /bin/bash -M node \
    && chown -Rf node: /home/node

USER node

WORKDIR /home/node

RUN curl -fsSL https://fnm.vercel.app/install | bash -s -- --install-dir "$HOME/.fnm" --skip-shell \
    && source ~/.bashrc \
    && fnm install 18 \
    && fnm default 18 \
    && fnm use 18 \
    && npm install -g npm@latest

# build
FROM base as build

USER root

COPY project /app-build
COPY shared /app-build/shared

RUN chown -Rf node: /app-build

USER node

WORKDIR /app-build

RUN source ~/.bashrc \
    && cd shared && npm install

RUN source ~/.bashrc \
    && npm install \
    && npm run cs \
    && rm -Rf .next \
    && npm run build

# prod
FROM base

USER root

RUN mkdir /app

COPY --from=build /app-build/.next /app/.next
COPY --from=build /app-build/next.config.js /app
COPY --from=build /app-build/package.json /app
COPY --from=build /app-build/package-lock.json /app
COPY --from=build /app-build/public /app/public

RUN ln -s /app/.next/server/pages /app/pages \
    && chown -Rf node: /app

USER node

WORKDIR /app

RUN source ~/.bashrc \
    && npm install --omit=dev

CMD source ~/.bashrc \
    && export LD_PRELOAD=`jemalloc-config --libdir`/libjemalloc.so.`jemalloc-config --revision` \
    && node_modules/.bin/next start -p 3000
