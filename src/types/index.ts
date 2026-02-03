export interface Product {
  id: string;
  title: string;
  description: string | null;
  price: number;
  image_url: string | null;
  category: string | null;
  download_url: string | null;
  demo_url: string | null;
  features: string[] | null;
  tech_stack: string[] | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CartItem {
  id: string;
  user_id: string;
  product_id: string;
  quantity: number;
  created_at: string;
  product?: Product;
}

export interface Order {
  id: string;
  user_id: string;
  product_id: string;
  status: string;
  total_amount: number;
  payment_method: string | null;
  payment_id: string | null;
  created_at: string;
  updated_at: string;
  product?: Product;
}

export interface Profile {
  id: string;
  user_id: string;
  full_name: string | null;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
}
