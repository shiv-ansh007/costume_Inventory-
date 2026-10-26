// API base URL - relative /api route proxied to backend via next.config.ts rewrites
const rawApiUrl = (process.env.NEXT_PUBLIC_API_URL || '/api').trim();
const API_URL = rawApiUrl.endsWith('/api') ? rawApiUrl : `${rawApiUrl}/api`;

// ─── Token Helpers ─────────────────────────────────────────────────────────────
export const getToken = (): string | null => {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('token');
};

export const setToken = (token: string): void => {
  localStorage.setItem('token', token);
};

export const removeToken = (): void => {
  localStorage.removeItem('token');
};

// ─── Request Helper ────────────────────────────────────────────────────────────
interface FetchOptions extends RequestInit {
  auth?: boolean;
}

async function apiFetch(endpoint: string, options: FetchOptions = {}) {
  const { auth = false, headers = {}, ...rest } = options;

  const reqHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(headers as Record<string, string>),
  };

  if (auth) {
    const token = getToken();
    if (token) reqHeaders['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_URL}${endpoint}`, {
    headers: reqHeaders,
    ...rest,
  });

  const data = await response.json();

  if (!response.ok) {
    const errorMsg = data.message || data.errors?.[0]?.msg || 'Invalid credentials or request error';
    throw new Error(errorMsg);
  }

  return data;
}

// ─── Auth API ──────────────────────────────────────────────────────────────────
export const authApi = {
  register: (body: { name: string; email: string; password: string }) =>
    apiFetch('/auth/register', { method: 'POST', body: JSON.stringify(body) }),

  login: (body: { email: string; password: string }) =>
    apiFetch('/auth/login', { method: 'POST', body: JSON.stringify(body) }),

  getMe: () => apiFetch('/auth/me', { auth: true }),
};

// ─── Products API ──────────────────────────────────────────────────────────────
export const productsApi = {
  getAll: (params?: Record<string, string>) => {
    const query = params ? '?' + new URLSearchParams(params).toString() : '';
    return apiFetch(`/products${query}`);
  },

  getCategories: () => apiFetch('/products/categories'),

  getById: (id: number) => apiFetch(`/products/${id}`),

  checkAvailability: (id: number, startDate: string, endDate: string) =>
    apiFetch(`/products/${id}/availability?startDate=${startDate}&endDate=${endDate}`),

  // Admin
  getAllAdmin: (params?: Record<string, string>) => {
    const query = params ? '?' + new URLSearchParams(params).toString() : '';
    return apiFetch(`/products/admin/all${query}`, { auth: true });
  },

  create: (formData: FormData) =>
    fetch(`${API_URL}/products/admin`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${getToken()}` },
      body: formData,
    }).then((r) => r.json()),

  update: (id: number, formData: FormData) =>
    fetch(`${API_URL}/products/admin/${id}`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${getToken()}` },
      body: formData,
    }).then((r) => r.json()),

  delete: (id: number) =>
    apiFetch(`/products/admin/${id}`, { method: 'DELETE', auth: true }),
};

// ─── Rentals API ───────────────────────────────────────────────────────────────
export const rentalsApi = {
  request: (body: {
    productId: number;
    startDate: string;
    endDate: string;
    quantity?: number;
    notes?: string;
    deliveryOption?: 'PICKUP' | 'HOME_DELIVERY';
    deliveryAddress?: string;
    contactPhone?: string;
  }) => apiFetch('/rentals/request', { method: 'POST', auth: true, body: JSON.stringify(body) }),

  getMyOrders: () => apiFetch('/rentals/my-orders', { auth: true }),

  cancel: (id: number) => apiFetch(`/rentals/${id}`, { method: 'DELETE', auth: true }),

  // Admin
  getAllOrders: (params?: Record<string, string>) => {
    const query = params ? '?' + new URLSearchParams(params).toString() : '';
    return apiFetch(`/rentals/admin/orders${query}`, { auth: true });
  },

  updateStatus: (id: number, status: string) =>
    apiFetch(`/rentals/admin/orders/${id}/status`, {
      method: 'PATCH',
      auth: true,
      body: JSON.stringify({ status }),
    }),

  updateDeliveryStatus: (id: number, deliveryStatus: string) =>
    apiFetch(`/rentals/admin/orders/${id}/delivery-status`, {
      method: 'PATCH',
      auth: true,
      body: JSON.stringify({ deliveryStatus }),
    }),

  getDashboard: () => apiFetch('/rentals/admin/dashboard', { auth: true }),
};

// ─── Notifications API ─────────────────────────────────────────────────────────
export const notificationsApi = {
  getAll: () => apiFetch('/notifications', { auth: true }),
  getUnreadCount: () => apiFetch('/notifications/unread-count', { auth: true }),
  markAsRead: (id: number) => apiFetch(`/notifications/${id}/read`, { method: 'PATCH', auth: true }),
  markAllAsRead: () => apiFetch('/notifications/read-all', { method: 'PATCH', auth: true }),
};

