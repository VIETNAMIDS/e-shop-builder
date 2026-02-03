import { supabase } from '@/integrations/supabase/client';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

async function callEdgeFunction(functionName: string, body: object) {
  const { data: { session } } = await supabase.auth.getSession();
  
  if (!session?.access_token) {
    throw new Error('Not authenticated');
  }

  const response = await fetch(`${SUPABASE_URL}/functions/v1/${functionName}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session.access_token}`,
      'apikey': SUPABASE_ANON_KEY,
    },
    body: JSON.stringify(body),
  });

  const data = await response.json();

  if (!response.ok || data.error) {
    throw new Error(data.error || 'Request failed');
  }

  return data;
}

async function callAdminFunction(functionName: string, body: object) {
  return callEdgeFunction(functionName, body);
}

// Products API - All logic runs on backend
export const adminProductsApi = {
  async create(productData: {
    title: string;
    description?: string;
    price?: string;
    is_free: boolean;
    category: string;
    image_url?: string;
    tech_stack?: string[];
    download_url?: string;
    seller_id?: string;
  }) {
    return callAdminFunction('admin-products', { action: 'create', data: productData });
  },

  async update(
    id: string,
    productData: {
      title: string;
      description?: string;
      price?: string;
      is_free: boolean;
      category: string;
      image_url?: string;
      tech_stack?: string[];
      download_url?: string;
      seller_id?: string;
    }
  ) {
    return callAdminFunction('admin-products', { action: 'update', data: { id, ...productData } });
  },

  async delete(id: string) {
    return callAdminFunction('admin-products', { action: 'delete', data: { id } });
  },
};

export const sellerProductsApi = {
  async create(productData: {
    title: string;
    description?: string;
    price?: string;
    is_free: boolean;
    category: string;
    image_url?: string;
    tech_stack?: string[];
    download_url?: string;
    seller_id?: string;
  }) {
    return callEdgeFunction('seller-products', { action: 'create', data: productData });
  },

  async update(
    id: string,
    productData: {
      title?: string;
      description?: string;
      price?: string;
      is_free?: boolean;
      category?: string;
      image_url?: string;
      tech_stack?: string[];
      download_url?: string;
      seller_id?: string;
    }
  ) {
    return callEdgeFunction('seller-products', { action: 'update', data: { id, ...productData } });
  },
};

// Users API - All logic runs on backend
export const adminUsersApi = {
  async list() {
    return callAdminFunction('admin-users', { action: 'list', data: {} });
  },

  async addAdmin(userId: string) {
    return callAdminFunction('admin-users', { action: 'addAdmin', data: { userId } });
  },

  async removeAdmin(userId: string) {
    return callAdminFunction('admin-users', { action: 'removeAdmin', data: { userId } });
  },

  async deleteUser(userId: string) {
    return callAdminFunction('admin-users', { action: 'deleteUser', data: { userId } });
  },
};

// Accounts API - All logic runs on backend
export const adminAccountsApi = {
  async create(accountData: {
    title: string;
    description?: string;
    account_username: string;
    account_password: string;
    account_email?: string;
    account_phone?: string;
    price?: number;
    category: string;
    image_url?: string;
    seller_id?: string;
  }) {
    return callAdminFunction('admin-accounts', { action: 'create', data: accountData });
  },

  async update(
    id: string,
    accountData: {
      title: string;
      description?: string;
      account_username: string;
      account_password: string;
      account_email?: string;
      account_phone?: string;
      price?: number;
      category: string;
      image_url?: string;
      seller_id?: string;
    }
  ) {
    return callAdminFunction('admin-accounts', { action: 'update', data: { id, ...accountData } });
  },

  async delete(id: string) {
    return callAdminFunction('admin-accounts', { action: 'delete', data: { id } });
  },

  async getDetails(id: string) {
    return callAdminFunction('admin-accounts', { action: 'getDetails', data: { id } });
  },

  async markAsSold(id: string, isSold: boolean) {
    return callAdminFunction('admin-accounts', { action: 'markSold', data: { id, is_sold: isSold } });
  },
};

// Orders API - All logic runs on backend
export const adminOrdersApi = {
  async list() {
    return callAdminFunction('admin-orders', { action: 'list', data: {} });
  },

  async approve(orderId: string) {
    return callAdminFunction('admin-orders', { action: 'approve', data: { orderId } });
  },

  async reject(orderId: string) {
    return callAdminFunction('admin-orders', { action: 'reject', data: { orderId } });
  },
};

// Get purchased credentials (for buyers)
export const getPurchasedCredentials = async (orderId: string) => {
  const { data: { session } } = await supabase.auth.getSession();
  
  if (!session?.access_token) {
    throw new Error('Not authenticated');
  }

  const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
  const response = await fetch(`${SUPABASE_URL}/functions/v1/get-purchased-credentials`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({ orderId }),
  });

  const data = await response.json();

  if (!response.ok || data.error) {
    throw new Error(data.error || 'Request failed');
  }

  return data;
};

// Verify admin status via backend
export const verifyAdminApi = async () => {
  try {
    const result = await callAdminFunction('verify-admin', {});
    return result.isAdmin === true;
  } catch {
    return false;
  }
};
