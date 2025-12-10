# Dockerfile para construir y servir JupyterLite
# Etapa 1: Construcción de JupyterLite
FROM mambaorg/micromamba:1.5.8 AS builder

USER root
# Instalar ca-certificates para evitar problemas SSL
RUN apt-get update && apt-get install -y ca-certificates wget && rm -rf /var/lib/apt/lists/*
USER $MAMBA_USER

# Copiar archivos de configuración de entorno
COPY --chown=$MAMBA_USER:$MAMBA_USER .github/build-environment.yml /tmp/build-environment.yml
COPY --chown=$MAMBA_USER:$MAMBA_USER environment.yml /tmp/environment.yml

# Instalar dependencias de construcción
# Nota: en entornos con problemas SSL, usar: micromamba config set ssl_verify false antes de install
RUN micromamba install -y -n base -f /tmp/build-environment.yml && \
    micromamba clean --all --yes

# Copiar contenido del proyecto
COPY --chown=$MAMBA_USER:$MAMBA_USER content /app/content
COPY --chown=$MAMBA_USER:$MAMBA_USER README.md /app/

# Construir el sitio JupyterLite
WORKDIR /app
RUN eval "$(micromamba shell hook --shell bash)" && \
    micromamba activate base && \
    cp README.md content/ && \
    jupyter lite build --contents content --output-dir dist --XeusAddon.environment_file=/tmp/environment.yml

# Integrar Callisto Monitor si existe
RUN if [ -f content/callisto-monitor.js ]; then \
        cp content/callisto-monitor.js dist/ && \
        echo "✅ callisto-monitor.js copiado"; \
        if [ -f content/callisto-config.js ]; then \
            cp content/callisto-config.js dist/ && \
            echo "✅ callisto-config.js copiado"; \
        fi; \
        for html_file in dist/index.html dist/lab/index.html dist/repl/index.html; do \
            if [ -f "$html_file" ]; then \
                sed -i 's|</body>|  <script src="../callisto-monitor.js"></script>\n  <script>\n    if (window.CALLISTO_CONFIG) {\n      CallistoMonitor.init(window.CALLISTO_CONFIG);\n    }\n  </script>\n</body>|' "$html_file" 2>/dev/null || \
                sed -i 's|</body>|  <script src="callisto-monitor.js"></script>\n  <script>\n    if (window.CALLISTO_CONFIG) {\n      CallistoMonitor.init(window.CALLISTO_CONFIG);\n    }\n  </script>\n</body>|' "$html_file" 2>/dev/null || true; \
                echo "✅ Script inyectado en $html_file"; \
            fi; \
        done; \
    else \
        echo "⚠️  callisto-monitor.js no encontrado, saltando integración"; \
    fi

# Etapa 2: Servidor web con nginx
FROM nginx:alpine

# Copiar la configuración de nginx
COPY --from=builder /app/dist /usr/share/nginx/html

# Copiar configuración personalizada de nginx si es necesaria
RUN echo 'server { \
    listen 8080; \
    server_name localhost; \
    root /usr/share/nginx/html; \
    index index.html; \
    location / { \
        try_files $uri $uri/ /index.html; \
    } \
    # Habilitar compresión gzip \
    gzip on; \
    gzip_vary on; \
    gzip_min_length 1024; \
    gzip_types text/plain text/css text/xml text/javascript application/x-javascript application/xml+rss application/json application/javascript; \
}' > /etc/nginx/conf.d/default.conf

# Exponer puerto 8080
EXPOSE 8080

# Healthcheck
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:8080/ || exit 1

# Comando de inicio
CMD ["nginx", "-g", "daemon off;"]
