/**
 * Callisto Monitor - Sistema de monitoreo para JupyterLite
 * Versión para Supabase Edge Functions
 */

const CallistoMonitor = (function() {
    'use strict';

    let config = {
        supabaseUrl: '',
        supabaseKey: '',
        functionsUrl: ''
    };

    let state = {
        token: null,
        user: null,
        sessionId: null,
        focusStartTime: null,
        totalFocusTime: 0,
        pasteCount: 0,
        focusInterval: null,
        isActive: false,
        lastActivityTime: null
    };

    function generateSessionId() {
        return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    function init(options) {
        config.supabaseUrl = options.supabaseUrl;
        config.supabaseKey = options.supabaseKey;
        // functionsUrl se construye automáticamente, pero puede ser sobreescrito
        config.functionsUrl = options.functionsUrl || `${options.supabaseUrl}/functions/v1`;

        state.sessionId = generateSessionId();
        state.token = localStorage.getItem('callisto_token');

        if (state.token) {
            verifyToken();
        } else {
            console.log('Callisto Monitor: No token found, user needs to authenticate');
        }

        setupEventListeners();
    }

    async function verifyToken() {
        try {
            const response = await fetch(`${config.functionsUrl}/auth`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${state.token}`,
                    'apikey': config.supabaseKey
                },
                body: JSON.stringify({ action: 'me' })
            });

            if (response.ok) {
                const data = await response.json();
                state.user = data.user;
                startMonitoring();
                console.log('Callisto Monitor: User authenticated', state.user.email);
            } else {
                logout();
            }
        } catch (error) {
            console.error('Callisto Monitor: Error verifying token', error);
            logout();
        }
    }

    async function signup(email, password, fullName) {
        try {
            const response = await fetch(`${config.functionsUrl}/callisto-auth`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'apikey': config.supabaseKey
                },
                body: JSON.stringify({
                    action: 'signup',
                    email,
                    password,
                    full_name: fullName
                })
            });

            const data = await response.json();

            if (response.ok) {
                state.token = data.session.access_token;
                state.user = data.user;
                localStorage.setItem('callisto_token', state.token);
                startMonitoring();
                return { success: true, data };
            } else {
                return { success: false, error: data.error };
            }
        } catch (error) {
            console.error('Callisto Monitor: Signup error', error);
            return { success: false, error: error.message };
        }
    }

    async function signin(email, password) {
        try {
            const response = await fetch(`${config.functionsUrl}/callisto-auth`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'apikey': config.supabaseKey
                },
                body: JSON.stringify({
                    action: 'signin',
                    email,
                    password
                })
            });

            const data = await response.json();

            if (response.ok) {
                state.token = data.session.access_token;
                state.user = data.user;
                localStorage.setItem('callisto_token', state.token);
                startMonitoring();
                return { success: true, data };
            } else {
                return { success: false, error: data.error };
            }
        } catch (error) {
            console.error('Callisto Monitor: Signin error', error);
            return { success: false, error: error.message };
        }
    }

    function logout() {
        stopMonitoring();
        state.token = null;
        state.user = null;
        localStorage.removeItem('callisto_token');
        console.log('Callisto Monitor: User logged out');
    }

    function setupEventListeners() {
        // Detectar paste en el documento
        document.addEventListener('paste', handlePaste);

        // Detectar focus/blur de ventana
        window.addEventListener('focus', handleFocus);
        window.addEventListener('blur', handleBlur);

        // Detectar actividad
        document.addEventListener('mousemove', throttledActivity);
        document.addEventListener('keydown', throttledActivity);

        // Guardar estado antes de cerrar
        window.addEventListener('beforeunload', () => {
            if (state.isActive) {
                stopMonitoring();
            }
        });
    }

    async function startMonitoring() {
        if (state.isActive) return;

        state.isActive = true;

        // Iniciar sesión de foco
        await sendRequest('/callisto-monitor/session/start', {
            session_id: state.sessionId,
            metadata: {
                user_agent: navigator.userAgent,
                screen_resolution: `${window.screen.width}x${window.screen.height}`,
                start_url: window.location.href
            }
        });

        // Iniciar tracking de foco
        state.focusStartTime = Date.now();
        state.focusInterval = setInterval(updateFocusTime, 1000);

        console.log('Callisto Monitor: Monitoring started', state.sessionId);
    }

    async function stopMonitoring() {
        if (!state.isActive) return;

        state.isActive = false;
        clearInterval(state.focusInterval);

        // Finalizar sesión
        await sendRequest('/callisto-monitor/session/end', {
            session_id: state.sessionId,
            total_focus_time: Math.floor(state.totalFocusTime / 1000),
            paste_count: state.pasteCount
        }, 'PUT');

        console.log('Callisto Monitor: Monitoring stopped');
    }

    async function handlePaste(event) {
        if (!state.isActive) return;

        state.pasteCount++;

        const pastedText = event.clipboardData?.getData('text') || '';

        await sendEvent('paste', {
            text_length: pastedText.length,
            text_preview: pastedText.substring(0, 100),
            target: event.target?.tagName || 'unknown'
        });

        console.log('Callisto Monitor: Paste detected', pastedText.length, 'chars');
    }

    async function handleFocus() {
        if (!state.isActive) return;

        state.focusStartTime = Date.now();
        await sendEvent('focus');
        console.log('Callisto Monitor: Window focused');
    }

    async function handleBlur() {
        if (!state.isActive) return;

        if (state.focusStartTime) {
            state.totalFocusTime += Date.now() - state.focusStartTime;
            state.focusStartTime = null;
        }

        await sendEvent('blur');
        console.log('Callisto Monitor: Window blurred');
    }

    function throttledActivity() {
        if (!state.isActive) return;

        const now = Date.now();
        if (!state.lastActivityTime || now - state.lastActivityTime > 10000) {
            state.lastActivityTime = now;
            sendEvent('activity');
        }
    }

    function updateFocusTime() {
        let totalTime = state.totalFocusTime;

        if (state.focusStartTime) {
            totalTime += Date.now() - state.focusStartTime;
        }

        // Emitir evento personalizado con las estadísticas
        window.dispatchEvent(new CustomEvent('callisto:stats', {
            detail: {
                focusTime: totalTime,
                pasteCount: state.pasteCount,
                sessionId: state.sessionId
            }
        }));
    }

    async function sendEvent(eventType, data = null) {
        return sendRequest('/callisto-monitor', {
            session_id: state.sessionId,
            event_type: eventType,
            data,
            metadata: {
                user_agent: navigator.userAgent,
                timestamp: new Date().toISOString()
            }
        });
    }

    async function sendRequest(endpoint, body, method = 'POST') {
        if (!state.token) {
            console.warn('Callisto Monitor: No token, skipping request');
            return false;
        }

        try {
            const response = await fetch(`${config.functionsUrl}${endpoint}`, {
                method,
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${state.token}`,
                    'apikey': config.supabaseKey
                },
                body: JSON.stringify(body)
            });

            if (!response.ok) {
                console.error('Callisto Monitor: Request failed', await response.text());
                return false;
            }

            return true;
        } catch (error) {
            console.error('Callisto Monitor: Connection error', error);
            return false;
        }
    }

    async function getEvents(filters = {}) {
        if (!state.token) return null;

        const params = new URLSearchParams();
        if (filters.session_id) params.append('session_id', filters.session_id);
        if (filters.event_type) params.append('event_type', filters.event_type);
        if (filters.limit) params.append('limit', filters.limit);

        try {
            const response = await fetch(`${config.functionsUrl}/callisto-monitor?${params}`, {
                headers: {
                    'Authorization': `Bearer ${state.token}`,
                    'apikey': config.supabaseKey
                }
            });

            if (response.ok) {
                const data = await response.json();
                return data.events;
            }
        } catch (error) {
            console.error('Callisto Monitor: Error getting events', error);
        }

        return null;
    }

    async function getSessionStats(sessionId) {
        if (!state.token) return null;

        try {
            const response = await fetch(`${config.functionsUrl}/callisto-monitor/session/${sessionId}/stats`, {
                headers: {
                    'Authorization': `Bearer ${state.token}`,
                    'apikey': config.supabaseKey
                }
            });

            if (response.ok) {
                return await response.json();
            }
        } catch (error) {
            console.error('Callisto Monitor: Error getting stats', error);
        }

        return null;
    }

    // API pública
    return {
        init,
        signup,
        signin,
        logout,
        getEvents,
        getSessionStats,
        getState: () => ({ ...state }),
        isAuthenticated: () => !!state.token,
        getUser: () => state.user
    };
})();

// Export para uso en módulos
if (typeof module !== 'undefined' && module.exports) {
    module.exports = CallistoMonitor;
}
