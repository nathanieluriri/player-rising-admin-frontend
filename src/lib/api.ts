import axios from "axios";

// IMPORTANT: Replace this with your actual API URL
const API_BASE_URL = import.meta.env.VITE_API_URL || "https://player-rising-api.aleeaqee.com/";

export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

let isRefreshing = false;
let failedQueue: any[] = [];

const processQueue = (error: any, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

// Add token to requests if available
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("access_token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle token refresh on 401 errors
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {
      const refreshToken = localStorage.getItem("refresh_token");

      if (!refreshToken) {
        window.location.href = "/login";
        return Promise.reject(error);
      }

      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            originalRequest.headers.Authorization = `Bearer ${token}`;
            return api(originalRequest);
          })
          .catch((err) => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        // use your axios instance so baseURL is correct
        const response = await api.post("/v1/admins/refresh", {
          refresh_token: refreshToken,
        });

        const { access_token, refresh_token: newRefreshToken } =
          response.data.data;

        localStorage.setItem("access_token", access_token);
        localStorage.setItem("refresh_token", newRefreshToken);

        api.defaults.headers.common.Authorization = `Bearer ${access_token}`;

        // clone request before retry
        const retryRequest = {
          ...originalRequest,
          headers: {
            ...originalRequest.headers,
            Authorization: `Bearer ${access_token}`,
          },
        };

        processQueue(null, access_token);
        isRefreshing = false;

        return api(retryRequest);
      } catch (refreshError) {
        processQueue(refreshError, null);
        isRefreshing = false;

        localStorage.removeItem("access_token");
        localStorage.removeItem("refresh_token");

        window.location.href = "/login";
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

// Admin APIs
export const adminApi = {
  login: async (email: string, password: string) => {
    const response = await api.post("/v1/admins/login", { email, password });
    if (response.data.data?.access_token) {
      localStorage.setItem("access_token", response.data.data.access_token);
      localStorage.setItem("refresh_token", response.data.data.refresh_token);
    }
    return response.data;
  },
  
  refresh: async (refreshToken: string) => {
    const response = await api.post("/v1/admins/refresh", { refresh_token: refreshToken });
    return response.data;
  },
  
  getMe: async () => {
    const response = await api.get("/v1/admins/me");
    return response.data;
  },
};

// Blog APIs
export const blogApi = {
  list: async (start = 0, stop = 100) => {
    const response = await api.get(`/v1/blogs/?start=${start}&stop=${stop}`);
    return response.data;
  },
  
  getById: async (id: string) => {
    const response = await api.get(`/v1/blogs/${id}`);
    return response.data;
  },
  
  create: async (payload: any) => {
    const response = await api.post("/v1/blogs/", payload);
    return response.data;
  },
  
  update: async (id: string, payload: any) => {
    const response = await api.patch(`/v1/blogs/${id}`, payload);
    return response.data;
  },
  
  delete: async (id: string) => {
    const response = await api.delete(`/v1/blogs/${id}`);
    return response.data;
  },
};

// Media APIs
export const mediaApi = {
  uploadImage: async (file: File) => {
    const formData = new FormData();
    formData.append("file", file);
    
    const response = await api.post("/v1/media/upload-image", formData, {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    });
    return response.data;
  },
  
  uploadMediaWithCaption: async (
    mediaId: string,
    file: File,
    caption: string
  ) => {
    const formData = new FormData();
    formData.append("caption", caption);
    formData.append("file", file);

    const response = await api.post(`/v1/media/${mediaId}`, formData, {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    });

    return response.data;
  },
};

export interface Category {
  name: string;
  slug: string;
}
export async function fetchCategories(): Promise<Category[]> {
  const res = await fetch(`${API_BASE_URL}api/v1/articles/content/categories`);

  if (!res.ok) throw new Error("Failed to load categories");

  const json = await res.json();
  return json.data as Category[];
}

