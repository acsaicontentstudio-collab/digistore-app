export interface Product {
  id: string;
  name: string;
  image: string; // URL
  category: string;
  description: string;
  price: number;
  discountPrice?: number;
  fileUrl?: string; // Link to the digital product
  isPopular?: boolean;
}

export interface PaymentMethod {
  id: string;
  type: 'BANK' | 'E-WALLET' | 'QRIS' | 'TRIPAY';
  name: string;
  accountNumber?: string;
  accountName?: string;
  description?: string;
  logo?: string;
}

export interface StoreSettings {
  storeName: string;
  address: string;
  whatsapp: string;
  email: string;
  description: string;
  logoUrl: string;
  supabaseUrl?: string;
  supabaseKey?: string;
  tripayApiKey?: string;
  tripayPrivateKey?: string;
  tripayMerchantCode?: string;
}

export interface CartItem extends Product {
  quantity: number;
}

export interface User {
  role: 'ADMIN' | 'CUSTOMER';
  name: string;
}

export interface Order {
  id: string;
  items: CartItem[];
  total: number;
  customerName: string;
  customerWhatsapp: string;
  paymentMethod: string;
  status: 'PENDING' | 'PAID' | 'COMPLETED';
  date: string;
}
