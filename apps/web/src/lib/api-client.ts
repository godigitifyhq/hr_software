import axios, { AxiosError, AxiosInstance } from 'axios';
import { useAuthStore } from '@/store/auth';

export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1';
export const API_ORIGIN = API_BASE_URL.replace(/\/api\/v1\/?$/, "");

export const apiClient: AxiosInstance = axios.create({
    baseURL: API_BASE_URL,
    withCredentials: true,
    headers: {
        'Content-Type': 'application/json'
    }
});

// Attach Authorization and CSRF token to requests
apiClient.interceptors.request.use((config) => {
    const { session } = useAuthStore.getState();

    if (typeof window !== 'undefined') {
        // Debug: log the authorization setup
        console.log('[API Client] Setting up request for:', config.url, {
            hasSession: !!session,
            hasToken: !!session?.accessToken,
            token: session?.accessToken ? `${session.accessToken.substring(0, 20)}...` : 'NONE'
        });
    }

    // Add Authorization header with access token
    if (session?.accessToken) {
        config.headers['Authorization'] = `Bearer ${session.accessToken}`;
    }

    // Add CSRF token from cookie
    if (typeof document !== 'undefined') {
        const csrfToken = document.cookie
            .split('; ')
            .find(row => row.startsWith('csrf='))
            ?.split('=')[1];

        if (csrfToken) {
            config.headers['X-CSRF-Token'] = csrfToken;
        }
    }
    return config;
});

// Handle 401 responses by clearing session
apiClient.interceptors.response.use(
    response => response,
    (error: AxiosError) => {
        if (error.response?.status === 401) {
            if (typeof window !== 'undefined') {
                useAuthStore.getState().logout();
                window.location.href = '/login';
            }
        }
        return Promise.reject(error);
    }
);

export default apiClient;
