FROM mcr.microsoft.com/devcontainers/javascript-node:24-bookworm

# Preserve the existing browser tests and their Chromium executable path.
USER root
RUN apt-get update \
    && apt-get install -y --no-install-recommends chromium \
    && rm -rf /var/lib/apt/lists/*
USER node
