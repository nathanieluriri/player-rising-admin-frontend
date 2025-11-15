import axios from "axios";

const API_BASE_URL = "https://api.example.com"; // Replace with your actual API URL

export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

// Add token to requests if available
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("access_token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

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
};
