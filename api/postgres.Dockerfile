FROM postgres:15-bullseye

# Install PostGIS + pgvector on both amd64 and arm64
RUN set -eux; \
    apt-get update; \
    apt-get install -y --no-install-recommends ca-certificates curl gnupg; \
    update-ca-certificates; \
    install -d /etc/apt/keyrings; \
    curl -fsSL https://www.postgresql.org/media/keys/ACCC4CF8.asc \
      | gpg --dearmor -o /etc/apt/keyrings/postgresql.gpg; \
    echo "deb [signed-by=/etc/apt/keyrings/postgresql.gpg] https://apt.postgresql.org/pub/repos/apt bullseye-pgdg main" \
      > /etc/apt/sources.list.d/pgdg.list; \
    # switch apt sources to HTTPS to bypass proxy content filters that reset HTTP downloads
    find /etc/apt -name '*.list' -print0 \
      | xargs -0 sed -Ei 's@http://(deb\\.debian\\.org|security\\.debian\\.org|apt\\.postgresql\\.org)@https://\\1@g'; \
    # add a few resilience knobs
    printf 'Acquire::Retries \"5\";\nAcquire::http::Pipeline-Depth \"0\";\nAcquire::http::No-Cache \"true\";\n' \
      > /etc/apt/apt.conf.d/80retries; \
    apt-get update; \
    apt-get install -y --no-install-recommends \
      postgresql-15-postgis-3 \
      postgresql-15-postgis-3-scripts \
      postgresql-15-pgvector; \
    rm -rf /var/lib/apt/lists/*
