import axios, { AxiosError, AxiosInstance, InternalAxiosRequestConfig } from "axios";
import { useAuthStore } from "@/store/auth";

export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ||
  (process.env.NODE_ENV === "production"
    ? "https://hr-software-api.vercel.app/api/v1"
    : "http://localhost:4000/api/v1");
export const API_ORIGIN = API_BASE_URL.replace(/\/api\/v1\/?$/, "");

export const apiClient: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
  timeout: 30000,
  headers: {
    "Content-Type": "application/json",
  },
});

// Attach Authorization and CSRF token to requests
apiClient.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const { session } = useAuthStore.getState();

  if (session?.accessToken) {
    config.headers["Authorization"] = `Bearer ${session.accessToken}`;
  }

  if (typeof document !== "undefined") {
    const csrfToken = document.cookie
      .split("; ")
      .find((row) => row.startsWith("csrf="))
      ?.split("=")[1];

    if (csrfToken) {
      config.headers["X-CSRF-Token"] = csrfToken;
    }
  }
  return config;
});

function forceLogout() {
  if (typeof window !== "undefined") {
    useAuthStore.getState().logout();
    window.location.href = "/login";
  }
}

// The access token is short-lived (15 min); a refresh token (httpOnly cookie)
// is meant to silently renew it so a user mid-form isn't logged out from under
// themselves. Concurrent 401s must share a single in-flight refresh call —
// the backend rotates and revokes the refresh token on each use, so firing it
// twice in parallel would revoke the whole session as "token reuse".
let refreshPromise: Promise<string> | null = null;

async function refreshAccessToken(): Promise<string> {
  if (!refreshPromise) {
    refreshPromise = apiClient
      .post("/auth/refresh", undefined, { _isRefreshCall: true } as any)
      .then((res) => {
        const newToken = res.data?.data?.accessToken as string | undefined;
        if (!newToken) {
          throw new Error("Refresh response missing accessToken");
        }
        const { session, setSession } = useAuthStore.getState();
        if (session) {
          setSession({ ...session, accessToken: newToken });
        }
        return newToken;
      })
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
}

// Handle 401 responses by silently refreshing the access token and retrying
// once; only clear the session if there's no session to refresh, or the
// refresh itself fails (refresh token expired/invalid/reused).
// Retry transient 5xx/network errors once, separately.
apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const config = error.config as InternalAxiosRequestConfig & {
      _retried?: boolean;
      _refreshRetried?: boolean;
      _isRefreshCall?: boolean;
    };

    if (error.response?.status === 401) {
      // The refresh call itself failed — the refresh token is gone, there's
      // nothing left to retry with.
      if (config?._isRefreshCall) {
        forceLogout();
        return Promise.reject(error);
      }

      const hasSession = !!useAuthStore.getState().session;
      if (config && !config._refreshRetried && hasSession) {
        config._refreshRetried = true;
        try {
          const newToken = await refreshAccessToken();
          config.headers = config.headers ?? {};
          config.headers["Authorization"] = `Bearer ${newToken}`;
          return apiClient(config);
        } catch {
          forceLogout();
          return Promise.reject(error);
        }
      }

      forceLogout();
      return Promise.reject(error);
    }

    // Retry once on network error or 5xx (not on 4xx client errors)
    const isTransient =
      !error.response ||
      (error.response.status >= 500 && error.response.status < 600);

    if (isTransient && !config._retried && config) {
      config._retried = true;
      await new Promise((r) => setTimeout(r, 800));
      return apiClient(config);
    }

    return Promise.reject(error);
  },
);


export default apiClient;
