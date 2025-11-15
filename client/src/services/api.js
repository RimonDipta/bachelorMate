// src/services/api.js

const BASE_URL = "http://localhost:5000/api"; // adjust if backend is different

class APIClient {
  constructor() {
    this.token = null;
  }

  setToken(token) {
    this.token = token;
  }

  async request(path, options = {}) {
    const headers = options.headers || {};
    headers["Content-Type"] = "application/json";

    if (this.token) {
      headers["Authorization"] = `Bearer ${this.token}`;
    }

    const res = await fetch(`${BASE_URL}${path}`, {
      ...options,
      headers,
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      const message = data?.message || "Request failed";
      throw new Error(message);
    }

    return data;
  }

  post(path, body) {
    return this.request(path, {
      method: "POST",
      body: JSON.stringify(body),
    });
  }

  get(path) {
    return this.request(path, { method: "GET" });
  }

  patch(path, body) {
    return this.request(path, {
      method: "PATCH",
      body: JSON.stringify(body),
    });
  }
}

export const api = new APIClient();
