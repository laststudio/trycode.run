# Executor Container - Debian 12 + 30 Languages + gVisor runsc
# Optimized for 4C4G server (1.5GB executor container)
FROM debian:12-slim AS base

# Install base dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    curl \
    gnupg \
    lsb-release \
    software-properties-common \
    && rm -rf /var/lib/apt/lists/*

# Install gVisor runsc
RUN curl -fsSL https://gvisor.dev/archive.key | gpg --dearmor -o /usr/share/keyrings/gvisor-archive-keyring.gpg && \
    echo "deb [arch=amd64 signed-by=/usr/share/keyrings/gvisor-archive-keyring.gpg] https://storage.googleapis.com/gvisor/releases release main" > /etc/apt/sources.list.d/gvisor.list && \
    apt-get update && apt-get install -y --no-install-recommends runsc && \
    rm -rf /var/lib/apt/lists/*

# ============================================================================
# LANGUAGE TOOLCHAINS (Optimized for 4C4G - selective installation)
# ============================================================================

# Python 3.11 + pip + venv + pyodide deps
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 python3-pip python3-venv python3-dev \
    pypy3 \
    && rm -rf /var/lib/apt/lists/*

# Node.js 20 + npm
RUN curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && \
    apt-get install -y --no-install-recommends nodejs && \
    rm -rf /var/lib/apt/lists/*

# Go 1.22
RUN curl -fsSL https://go.dev/dl/go1.22.5.linux-amd64.tar.gz | tar -xz -C /usr/local && \
    ln -s /usr/local/go/bin/go /usr/local/bin/go && \
    ln -s /usr/local/go/bin/gofmt /usr/local/bin/gofmt

ENV GOPATH=/workspace/go
ENV PATH=$PATH:/usr/local/go/bin:$GOPATH/bin

# Rust (via rustup) - minimal profile
RUN curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y --default-toolchain stable --profile minimal && \
    ~/.cargo/bin/rustup component add rustfmt clippy
ENV PATH=/root/.cargo/bin:$PATH

# Java 21 (OpenJDK) + Maven + Gradle
RUN apt-get update && apt-get install -y --no-install-recommends \
    openjdk-21-jdk-headless maven gradle && \
    rm -rf /var/lib/apt/lists/*

# .NET 8 SDK
RUN curl -fsSL https://packages.microsoft.com/config/debian/12/packages-microsoft-prod.deb -o packages-microsoft-prod.deb && \
    dpkg -i packages-microsoft-prod.deb && rm packages-microsoft-prod.deb && \
    apt-get update && apt-get install -y --no-install-recommends dotnet-sdk-8.0 && \
    rm -rf /var/lib/apt/lists/*

# PHP 8.3
RUN apt-get update && apt-get install -y --no-install-recommends \
    php php-cli php-mbstring php-xml php-curl php-zip php-sqlite3 php-bcmath && \
    rm -rf /var/lib/apt/lists/*

# Ruby 3.3
RUN apt-get update && apt-get install -y --no-install-recommends \
    ruby ruby-dev bundler && \
    rm -rf /var/lib/apt/lists/*

# C/C++ (GCC, Clang, CMake, Make)
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential gcc g++ clang llvm cmake make ninja-build pkg-config && \
    rm -rf /var/lib/apt/lists/*

# Lua 5.4 + Luarocks
RUN apt-get update && apt-get install -y --no-install-recommends \
    lua5.4 luarocks && \
    rm -rf /var/lib/apt/lists/*

# Perl
RUN apt-get update && apt-get install -y --no-install-recommends \
    perl && \
    rm -rf /var/lib/apt/lists/*

# R
RUN apt-get update && apt-get install -y --no-install-recommends \
    r-base r-cran-littler && \
    rm -rf /var/lib/apt/lists/*

# Julia
RUN curl -fsSL https://julialang-s3.julialang.org/bin/linux/x64/1.10/julia-1.10.4-linux-x86_64.tar.gz | tar -xz -C /opt && \
    ln -s /opt/julia-1.10.4/bin/julia /usr/local/bin/julia

# Haskell (GHC + Cabal)
RUN apt-get update && apt-get install -y --no-install-recommends \
    ghc cabal-install && \
    rm -rf /var/lib/apt/lists/*

# Dart
RUN apt-get update && apt-get install -y --no-install-recommends \
    apt-transport-https && \
    curl -fsSL https://dl-ssl.google.com/linux/linux_signing_key.pub | gpg --dearmor -o /usr/share/keyrings/dart.gpg && \
    echo "deb [signed-by=/usr/share/keyrings/dart.gpg] https://storage.googleapis.com/download.dartlang.org/linux/debian stable main" > /etc/apt/sources.list.d/dart_stable.list && \
    apt-get update && apt-get install -y --no-install-recommends dart && \
    rm -rf /var/lib/apt/lists/*

# Zig
RUN curl -fsSL https://ziglang.org/download/0.13.0/zig-linux-x86_64-0.13.0.tar.xz | tar -xJ -C /opt && \
    ln -s /opt/zig-linux-x86_64-0.13.0/zig /usr/local/bin/zig

# Swift
RUN apt-get update && apt-get install -y --no-install-recommends \
    binutils git gnupg2 libc6-dev libcurl4 libedit2 libgcc-9-dev libpython3.11 libstdc++-9-dev libxml2 libz3-dev pkg-config tzdata zlib1g-dev && \
    curl -fsSL https://download.swift.org/swift-5.10-release/ubuntu2204/swift-5.10-RELEASE/swift-5.10-RELEASE-ubuntu22.04.tar.gz | tar -xz -C /opt && \
    ln -s /opt/swift-5.10-RELEASE-ubuntu22.04/usr/bin/swift /usr/local/bin/swift && \
    rm -rf /var/lib/apt/lists/*

# Kotlin (via SDKMAN)
RUN curl -s "https://get.sdkman.io" | bash && \
    source "/root/.sdkman/bin/sdkman-init.sh" && \
    sdk install kotlin

# Scala (via SDKMAN)
RUN source "/root/.sdkman/bin/sdkman-init.sh" && \
    sdk install scala

# TypeScript (via npm)
RUN npm install -g typescript ts-node

# WebAssembly runtimes
RUN cargo install wasmer-cli --locked

# ============================================================================
# LSP SERVERS (for LSP support in executor)
# ============================================================================

# LSP Servers
RUN npm install -g \
    pyright \
    typescript-language-server \
    typescript \
    vscode-langservers-extracted \
    bash-language-server \
    vscode-css-languageserver-bin \
    vscode-html-languageserver-bin \
    vscode-json-languageserver \
    yaml-language-server \
    dockerfile-language-server-nodejs \
    @vue/language-server \
    svelte-language-server \
    @tailwindcss/language-server

# Python LSP
RUN pip install --no-cache-dir \
    pyright \
    python-lsp-server \
    python-lsp-black \
    python-lsp-ruff \
    jedi-language-server

# Rust
RUN curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y \
    && source ~/.cargo/env \
    && rustup component add rust-analyzer

# Go
RUN curl -fsSL https://go.dev/dl/go1.22.5.linux-amd64.tar.gz | tar -xz -C /usr/local && \
    ln -s /usr/local/go/bin/go /usr/local/bin/go
ENV PATH="/usr/local/go/bin:${PATH}"
RUN go install golang.org/x/tools/gopls@latest \
    && ln -s ~/go/bin/gopls /usr/local/bin/gopls

# Java (JDT Language Server)
RUN apt-get update && apt-get install -y openjdk-21-jdk-headless \
    && mkdir -p /opt/lsp-servers/jdt-language-server \
    && wget -q https://download.eclipse.org/jdtls/snapshots/jdt-language-server-latest.tar.gz \
    && tar -xzf jdt-language-server-latest.tar.gz -C /opt/lsp-servers/jdt-language-server \
    && rm jdt-language-server-latest.tar.gz

# C/C++
RUN apt-get install -y clangd

# Kotlin
RUN wget -q https://github.com/fwcd/kotlin-language-server/releases/download/1.3.60/server.zip \
    && unzip server.zip -d /opt/lsp-servers/kotlin-language-server \
    && rm server.zip

# PHP
RUN wget -q https://github.com/bmewburn/vscode-intelephense/releases/download/v1.9.0/intelephense-linux-x64.tar.gz \
    && tar -xzf intelephense-linux-x64.tar.gz -C /opt/lsp-servers/intelephense \
    && rm intelephense-linux-x64.tar.gz

# ============================================================================
# EXECUTOR DAEMON (Rust binary for metrics + execution)
# ============================================================================

# Build executor daemon in a separate stage
FROM rust:1.80-slim-bookworm AS executor-builder

WORKDIR /app
COPY executor/src ./src
COPY executor/Cargo.toml ./

RUN cargo build --release --bin executor-daemon

# ============================================================================
# FINAL IMAGE
# ============================================================================
FROM base AS final

# Copy executor daemon
COPY --from=executor-builder /app/target/release/executor-daemon /usr/local/bin/executor-daemon
RUN chmod +x /usr/local/bin/executor-daemon

# Copy entrypoint
COPY executor/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

# Create non-root user
RUN groupadd -g 1000 executor && useradd -u 1000 -g executor -m -s /bin/bash executor

# Create workspace directory
RUN mkdir -p /workspace && chown executor:executor /workspace

# Expose metrics port
EXPOSE 9090

USER executor:executor

WORKDIR /workspace

ENTRYPOINT ["/entrypoint.sh"]