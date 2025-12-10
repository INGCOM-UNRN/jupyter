// Configuración de Callisto Monitor
// Copia este archivo a callisto-config.js y personaliza los valores

window.CALLISTO_CONFIG = {
    // REQUERIDO: Configura estos valores con tu proyecto de Supabase
    supabaseUrl: 'https://tuktuczlmovbrxwsoago.supabase.co',
    supabaseKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR1a3R1Y3psbW92YnJ4d3NvYWdvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUzNzM3MjMsImV4cCI6MjA4MDk0OTcyM30.eGZ00M0A3jUfc5fvniWfR7XzYLMi4oVGYv8uZmqRgJs',
    
    // OPCIONAL: functionsUrl se construye automáticamente como:
    // supabaseUrl + '/functions/v1'
    // Solo especifica si usas una URL personalizada
    // functionsUrl: 'https://custom-url.com/functions/v1',
    
    // Opcional: Configuración avanzada
    autoInit: true,  // Iniciar automáticamente al cargar
    showWidget: true,  // Mostrar widget de estadísticas
    debugMode: false,  // Modo debug (logs en consola)
    
    // Intervalos de actualización (en milisegundos)
    updateInterval: 1000,  // Actualización de UI
    activityThrottle: 10000,  // Throttle para eventos de actividad
    
    // Eventos a monitorear
    events: {
        paste: true,
        focus: true,
        blur: true,
        activity: true
    }
};
