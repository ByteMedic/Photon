FROM mcr.microsoft.com/devcontainers/base:ubuntu-24.04

ENV DEBIAN_FRONTEND=noninteractive

# Tauri Linux deps (WebKit2GTK 4.1+, GTK, appindicator, svg) + build essentials.
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
    libwebkit2gtk-4.1-dev \
    libgtk-3-dev \
    libayatana-appindicator3-dev \
    librsvg2-dev \
    libssl-dev \
    build-essential \
    curl \
    wget \
    file \
    pkg-config \
    ca-certificates \
    patchelf \
    && rm -rf /var/lib/apt/lists/*

# Permissions for the default non-root user (created by base image).
USER vscode
