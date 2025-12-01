import { Product, StoreSettings, PaymentMethod, Order, Voucher, Affiliate } from '../types';

const STORAGE_KEYS = {
  PRODUCTS: 'ds_products',
  SETTINGS: 'ds_settings',
  PAYMENTS: 'ds_payments',
  ORDERS: 'ds_orders',
  VOUCHERS: 'ds_vouchers',
  AFFILIATES: 'ds_affiliates',
};

// Initial Data
const initialSettings: StoreSettings = {
  storeName: 'DigiStore Pro',
  address: 'Jl. Digital No. 1, Jakarta',
  whatsapp: '6281234567890',
  email: 'admin@digistore.com',
  description: 'Toko produk digital terpercaya dan terlengkap.',
  logoUrl: 'https://picsum.photos/id/42/200/200',
};

const initialPayments: PaymentMethod[] = [
  { id: '1', type: 'BANK', name: 'Bank BCA', accountNumber: '1234567890', accountName: 'Admin Store', logo: 'https://upload.wikimedia.org/wikipedia/commons/5/5c/Bank_Central_Asia.svg' },
  { id: '2', type: 'BANK', name: 'Bank Mandiri', accountNumber: '0987654321', accountName: 'Admin Store', logo: 'https://upload.wikimedia.org/wikipedia/commons/a/ad/Bank_Mandiri_logo_2016.svg' },
  { id: '3', type: 'E-WALLET', name: 'DANA', accountNumber: '081234567890', accountName: 'Admin Store', logo: 'https://upload.wikimedia.org/wikipedia/commons/7/72/Logo_dana_blue.svg' },
  { id: '4', type: 'QRIS', name: 'QRIS Payment', accountNumber: 'N/A', accountName: 'DigiStore', description: 'Scan QR untuk membayar' },
  { id: '5', type: 'TRIPAY', name: 'Tripay Automatis', description: 'Metode pembayaran otomatis' },
];

const initialProducts: Product[] = [
  {
    id: '1',
    name: 'Premium UI Kit',
    category: 'Design',
    price: 150000,
    discountPrice: 99000,
    image: 'https://picsum.photos/id/1/400/400',
    description: 'High quality UI Kit for mobile apps.',
    isPopular: true,
  },
  {
    id: '2',
    name: 'React Dashboard Template',
    category: 'Code',
    price: 350000,
    discountPrice: 299000,
    image: 'https://picsum.photos/id/3/400/400',
    description: 'Complete admin dashboard built with React and Tailwind.',
    isPopular: false,
  },
  {
    id: '3',
    name: 'E-book: Mastering React',
    category: 'Education',
    price: 75000,
    image: 'https://picsum.photos/id/24/400/400',
    description: 'A comprehensive guide to modern React development.',
    isPopular: true,
  }
];

const initialVouchers: Voucher[] = [
  { id: '1', code: 'DISKON10', type: 'PERCENT', value: 10, isActive: true },
  { id: '2', code: 'HEMAT20K', type: 'FIXED', value: 20000, isActive: true },
];

const initialAffiliates: Affiliate[] = [
  { 
    id: '1', 
    name: 'Partner Satu', 
    code: 'PARTNER1', 
    password: '123', 
    commissionRate: 10, 
    totalEarnings: 150000, 
    bankDetails: 'BCA 123456', 
    isActive: true 
  }
];

// Helper to get from local storage or default
const get = <T>(key: string, defaultVal: T): T => {
  const stored = localStorage.getItem(key);
  if (!stored) return defaultVal;
  try {
    return JSON.parse(stored);
  } catch {
    return defaultVal;
  }
};

const set = <T>(key: string, val: T): void => {
  localStorage.setItem(key, JSON.stringify(val));
};

export const DataService = {
  getSettings: (): StoreSettings => get(STORAGE_KEYS.SETTINGS, initialSettings),
  saveSettings: (settings: StoreSettings) => set(STORAGE_KEYS.SETTINGS, settings),

  getProducts: (): Product[] => get(STORAGE_KEYS.PRODUCTS, initialProducts),
  saveProducts: (products: Product[]) => set(STORAGE_KEYS.PRODUCTS, products),

  getPayments: (): PaymentMethod[] => get(STORAGE_KEYS.PAYMENTS, initialPayments),
  savePayments: (methods: PaymentMethod[]) => set(STORAGE_KEYS.PAYMENTS, methods),

  getVouchers: (): Voucher[] => get(STORAGE_KEYS.VOUCHERS, initialVouchers),
  saveVouchers: (vouchers: Voucher[]) => set(STORAGE_KEYS.VOUCHERS, vouchers),

  getOrders: (): Order[] => get(STORAGE_KEYS.ORDERS, []),
  saveOrder: (order: Order) => {
    const orders = get<Order[]>(STORAGE_KEYS.ORDERS, []);
    set(STORAGE_KEYS.ORDERS, [order, ...orders]);
  },

  getAffiliates: (): Affiliate[] => get(STORAGE_KEYS.AFFILIATES, initialAffiliates),
  saveAffiliates: (affiliates: Affiliate[]) => set(STORAGE_KEYS.AFFILIATES, affiliates),
};