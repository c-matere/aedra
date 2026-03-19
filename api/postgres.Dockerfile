FROM postgis/postgis:15-3.4

# Use HTTPS mirrors and retries to avoid MITM/proxy resets when installing pgvector
RUN set -eux; \
    # switch apt sources to HTTPS to bypass proxy content filters that reset HTTP downloads
    find /etc/apt -name '*.list' -print0 \
      | xargs -0 sed -Ei 's@http://(deb\.debian\.org|security\.debian\.org|apt\.postgresql\.org)@https://\1@g'; \
    # add a few resilience knobs
    printf 'Acquire::Retries "5";\nAcquire::http::Pipeline-Depth "0";\nAcquire::http::No-Cache "true";\n' \
      > /etc/apt/apt.conf.d/80retries; \
    apt-get update; \
    apt-get install -y --no-install-recommends postgresql-15-pgvector; \
    rm -rf /var/lib/apt/lists/*
