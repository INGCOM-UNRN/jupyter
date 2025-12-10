# Guía de Despliegue - JupyterLite

Este documento describe cómo desplegar JupyterLite utilizando Docker en diferentes entornos.

## 📋 Tabla de Contenidos

- [Requisitos](#requisitos)
- [Despliegue Local con Docker Compose](#despliegue-local-con-docker-compose)
- [Despliegue Manual con Docker](#despliegue-manual-con-docker)
- [Despliegue en CI/CD](#despliegue-en-cicd)
- [Solución de Problemas](#solución-de-problemas)
- [Configuración Avanzada](#configuración-avanzada)

## Requisitos

### Software Necesario

- **Docker**: versión 20.10 o superior
  - Descarga: https://docs.docker.com/get-docker/
- **Docker Compose** (opcional pero recomendado): versión 2.0 o superior
  - Incluido en Docker Desktop
  - Linux: https://docs.docker.com/compose/install/

### Verificar Instalación

```bash
# Verificar Docker
docker --version

# Verificar Docker Compose
docker-compose --version
# o
docker compose version
```

## Despliegue Local con Docker Compose

### Opción 1: Inicio Rápido

```bash
# Clonar el repositorio
git clone https://github.com/INGCOM-UNRN/jupyter.git
cd jupyter

# Construir y ejecutar
docker-compose up --build

# La aplicación estará disponible en:
# http://localhost:8080
```

### Opción 2: Con Script de Verificación

```bash
# Ejecutar el script de verificación automática
./verify-deployment.sh
```

Este script realizará:
1. Verificación de requisitos
2. Construcción de la imagen
3. Inicio del contenedor
4. Pruebas de conectividad
5. Reporte de estado

### Comandos Útiles

```bash
# Ejecutar en segundo plano
docker-compose up -d --build

# Ver logs
docker-compose logs -f

# Detener el servicio
docker-compose down

# Reconstruir sin caché
docker-compose build --no-cache
docker-compose up -d
```

## Despliegue Manual con Docker

### Construcción de la Imagen

```bash
# Construir la imagen
docker build -t jupyterlite-app:latest .

# Verificar que la imagen se creó
docker images | grep jupyterlite-app
```

### Ejecutar el Contenedor

```bash
# Ejecutar en segundo plano
docker run -d \
  --name jupyterlite \
  -p 8080:8080 \
  --restart unless-stopped \
  jupyterlite-app:latest

# Verificar que está corriendo
docker ps | grep jupyterlite

# Ver logs
docker logs jupyterlite

# Ver logs en tiempo real
docker logs -f jupyterlite
```

### Detener y Eliminar el Contenedor

```bash
# Detener
docker stop jupyterlite

# Eliminar
docker rm jupyterlite

# Detener y eliminar en un solo comando
docker rm -f jupyterlite
```

## Despliegue en CI/CD

### GitHub Actions

El repositorio incluye un workflow de CI/CD en `.github/workflows/docker-ci.yml` que:

1. **En Pull Requests**: Construye y prueba la imagen Docker
2. **En Push a main**: Además de construir y probar, puede publicar la imagen

#### Habilitar GitHub Container Registry (opcional)

Para publicar imágenes automáticamente:

1. Ir a Settings → Secrets and variables → Actions
2. No se requieren secretos adicionales (usa GITHUB_TOKEN automático)
3. El workflow está configurado para usar `ghcr.io`

### Otros Sistemas CI/CD

#### GitLab CI

```yaml
build-docker:
  stage: build
  image: docker:latest
  services:
    - docker:dind
  script:
    - docker build -t $CI_REGISTRY_IMAGE:$CI_COMMIT_REF_SLUG .
    - docker push $CI_REGISTRY_IMAGE:$CI_COMMIT_REF_SLUG
```

#### Jenkins

```groovy
pipeline {
    agent any
    stages {
        stage('Build') {
            steps {
                sh 'docker build -t jupyterlite-app:latest .'
            }
        }
        stage('Test') {
            steps {
                sh 'docker run --rm jupyterlite-app:latest nginx -t'
            }
        }
    }
}
```

## Solución de Problemas

### El puerto 8080 ya está en uso

```bash
# Opción 1: Usar otro puerto
docker run -d -p 8081:8080 --name jupyterlite jupyterlite-app:latest

# Opción 2: Modificar docker-compose.yml
# Cambiar "8080:8080" a "8081:8080"
```

### Error de construcción: "Cannot resolve host"

Esto puede ocurrir si hay problemas de red durante la construcción. Soluciones:

```bash
# Opción 1: Reintentar la construcción
docker build --no-cache -t jupyterlite-app:latest .

# Opción 2: Configurar DNS en Docker
# Editar /etc/docker/daemon.json:
{
  "dns": ["8.8.8.8", "8.8.4.4"]
}
# Reiniciar Docker
sudo systemctl restart docker
```

### Error: "SSL certificate problem"

En algunos entornos corporativos o con proxies:

```bash
# Modificar el Dockerfile para añadir antes de las instalaciones:
RUN micromamba config set ssl_verify false
```

**Nota**: Solo usar esto en entornos de desarrollo controlados.

### El contenedor se detiene inmediatamente

```bash
# Ver logs para identificar el problema
docker logs jupyterlite

# Verificar el health check
docker inspect jupyterlite | grep -A 10 Health
```

### Imagen muy grande

La imagen actual debería ser ~150-300 MB gracias al multi-stage build. Si es más grande:

```bash
# Limpiar capas antiguas
docker system prune -a

# Reconstruir sin caché
docker build --no-cache -t jupyterlite-app:latest .

# Ver tamaño de capas
docker history jupyterlite-app:latest
```

## Configuración Avanzada

### Variables de Entorno

Actualmente la aplicación no requiere variables de entorno, pero se pueden agregar:

```yaml
# docker-compose.yml
services:
  jupyterlite:
    environment:
      - JUPYTER_CONFIG_DIR=/config
      - TZ=America/Argentina/Buenos_Aires
```

### Volúmenes Persistentes

Para persistir configuraciones:

```yaml
# docker-compose.yml
services:
  jupyterlite:
    volumes:
      - ./notebooks:/usr/share/nginx/html/notebooks
```

### Configuración de Nginx

Para personalizar nginx, crear un archivo `nginx.conf` y montarlo:

```yaml
# docker-compose.yml
services:
  jupyterlite:
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf:ro
```

### Recursos Limitados

```yaml
# docker-compose.yml
services:
  jupyterlite:
    deploy:
      resources:
        limits:
          cpus: '0.5'
          memory: 512M
        reservations:
          memory: 256M
```

### HTTPS con Traefik

```yaml
# docker-compose.yml con Traefik
services:
  jupyterlite:
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.jupyter.rule=Host(`jupyter.example.com`)"
      - "traefik.http.routers.jupyter.entrypoints=websecure"
      - "traefik.http.routers.jupyter.tls.certresolver=letsencrypt"
```

## Próximos Pasos

- [ ] Configurar CI/CD para publicar imágenes automáticamente
- [ ] Agregar soporte para múltiples arquitecturas (ARM64)
- [ ] Crear Helm charts para Kubernetes
- [ ] Implementar caché de dependencias para builds más rápidos

## Contacto y Soporte

Para reportar problemas o sugerir mejoras, abrir un issue en:
https://github.com/INGCOM-UNRN/jupyter/issues
