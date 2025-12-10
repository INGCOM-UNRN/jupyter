#!/bin/bash
# Script para verificar el despliegue local de JupyterLite

set -e

echo "============================================"
echo "  Verificación de Despliegue JupyterLite"
echo "============================================"
echo ""

# Verificar si Docker está instalado
if ! command -v docker &> /dev/null; then
    echo "❌ Error: Docker no está instalado"
    echo "Por favor, instala Docker desde: https://docs.docker.com/get-docker/"
    exit 1
fi
echo "✅ Docker está instalado"

# Verificar si docker-compose está disponible
if command -v docker-compose &> /dev/null; then
    COMPOSE_CMD="docker-compose"
    echo "✅ docker-compose está instalado"
elif docker compose version &> /dev/null; then
    COMPOSE_CMD="docker compose"
    echo "✅ Docker Compose (plugin) está instalado"
else
    echo "❌ Error: ni docker-compose ni 'docker compose' están disponibles"
    exit 1
fi

echo ""
echo "Construyendo la imagen Docker..."
echo "Esto puede tomar varios minutos la primera vez..."
echo ""

# Construir la imagen
if $COMPOSE_CMD build; then
    echo ""
    echo "✅ Imagen construida exitosamente"
else
    echo ""
    echo "❌ Error al construir la imagen"
    exit 1
fi

echo ""
echo "Iniciando el contenedor..."
echo ""

# Iniciar el contenedor
if $COMPOSE_CMD up -d; then
    echo ""
    echo "✅ Contenedor iniciado"
else
    echo ""
    echo "❌ Error al iniciar el contenedor"
    exit 1
fi

echo ""
echo "Esperando a que el servicio esté listo..."
sleep 5

# Verificar que el contenedor está corriendo
if docker ps | grep -q jupyterlite; then
    echo "✅ Contenedor está corriendo"
else
    echo "❌ El contenedor no está corriendo"
    echo ""
    echo "Logs del contenedor:"
    docker logs jupyterlite
    exit 1
fi

# Verificar que el servicio responde
echo ""
echo "Verificando que el servicio responde en http://localhost:8080..."
for i in {1..30}; do
    if curl -sf http://localhost:8080/ > /dev/null; then
        echo "✅ El servicio responde correctamente"
        echo ""
        echo "============================================"
        echo "  ✅ VERIFICACIÓN EXITOSA"
        echo "============================================"
        echo ""
        echo "JupyterLite está disponible en:"
        echo "  🌐 http://localhost:8080"
        echo "  📓 JupyterLab: http://localhost:8080/lab/"
        echo "  💻 REPL: http://localhost:8080/repl/"
        echo ""
        echo "Para detener el servicio:"
        echo "  $COMPOSE_CMD down"
        echo ""
        echo "Para ver los logs:"
        echo "  docker logs jupyterlite"
        echo ""
        exit 0
    fi
    echo "  Esperando... intento $i/30"
    sleep 2
done

echo "❌ El servicio no responde después de 60 segundos"
echo ""
echo "Logs del contenedor:"
docker logs jupyterlite
exit 1
