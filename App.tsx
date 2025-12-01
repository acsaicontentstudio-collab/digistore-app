
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { HashRouter as Router, Routes, Route, Navigate, Link, useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Product, StoreSettings, CartItem, PaymentMethod, User, Voucher, Affiliate, Order } from './types';
import { DataService } from './services/dataService';
import AdminSidebar from './components/AdminSidebar';

// --- Constants ---

const SUPABASE_SCHEMA = `-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- Create Products Table
create table if not exists products (
  id text primary key,
  name text not null,
  category text,
  description text,
  price numeric not null,
  discount_price numeric,
  image text,
  file_url text,
  is_popular boolean default false,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Create Store Settings Table
create table if not exists store_settings (
  id text primary key,
  store_name text,
  address text,
  whatsapp text,
  email text,
  description text,
  logo_url text,
  tripay_api_key text,
  tripay_private_key text,
  tripay_merchant_code text,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Create Payment Methods Table
create table if not exists payment_methods (
  id text primary key,
  type text not null,
  name text not null,
  account_number text,
  account_name text,
  description text,
  logo text,
  is_active boolean default true,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Create Vouchers Table
create table if not exists vouchers (
  id text primary key,
  code text not null unique,
  type text not null check (type in ('FIXED', 'PERCENT')),
  value numeric not null,
  is_active boolean default true,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Create Affiliates Table
create table if not exists affiliates (
  id text primary key,
  name text not null,
  code text not null unique,
  password text not null,
  commission_rate numeric not null,
  total_earnings numeric default 0,
  bank_details text,
  is_active boolean default true,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Create Orders Table
create table if not exists orders (
  id text primary key,
  customer_name text,
  customer_whatsapp text,
  total numeric not null,
  payment_method text,
  status text default 'PENDING',
  items jsonb,
  voucher_code text,
  discount_amount numeric,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS
alter table products enable row level security;
alter table store_settings enable row level security;
alter table payment_methods enable row level security;
alter table vouchers enable row level security;
alter table affiliates enable row level security;
alter table orders enable row level security;

-- DROP POLICIES IF EXIST (Fix for Re-running script)
drop policy if exists "Public Access Products" on products;
drop policy if exists "Public Access Settings" on store_settings;
drop policy if exists "Public Access Payments" on payment_methods;
drop policy if exists "Public Access Vouchers" on vouchers;
drop policy if exists "Public Access Affiliates" on affiliates;
drop policy if exists "Public Access Orders" on orders;

-- Create Policies (Open access for simplicity in this demo, adjust for production)
create policy "Public Access Products" on products for all using (true) with check (true);
create policy "Public Access Settings" on store_settings for all using (true) with check (true);
create policy "Public Access Payments" on payment_methods for all using (true) with check (true);
create policy "Public Access Vouchers" on vouchers for all using (true) with check (true);
create policy "Public Access Affiliates" on affiliates for all using (true) with check (true);
create policy "Public Access Orders" on orders for all using (true) with check (true);
`;

// --- Helpers ---
function generateUUID() {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

function isValidUUID(uuid: string) {
    // Basic check for UUID format or generated mock UUIDs
    const regex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    return regex.test(uuid);
}

// --- Context & State ---

const AppContext = React.createContext<{
  settings: StoreSettings;
  updateSettings: (s: StoreSettings) => void;
  products: Product[];
  updateProducts: (p: Product[]) => void;
  vouchers: Voucher[];
  updateVouchers: (v: Voucher[]) => void;
  affiliates: Affiliate[];
  updateAffiliates: (a: Affiliate[]) => void;
  cart: CartItem[];
  addToCart: (p: Product) => void;
  removeFromCart: (id: string) => void;
  clearCart: () => void;
  user: User | null;
  login: (role: 'ADMIN' | 'CUSTOMER' | 'AFFILIATE', name: string, id?: string) => void;
  logout: () => void;
  paymentMethods: PaymentMethod[];
  updatePayments: (p: PaymentMethod[]) => void;
  referralCode: string | null;
  setReferralCode: (code: string | null) => void;
  supabase: SupabaseClient | null;
  isCloudConnected: boolean;
  debugDataCount: number;
  resetLocalData: () => void;
  fetchError: string | null;
} | null>(null);

const useAppContext = () => {
  const context = React.useContext(AppContext);
  if (!context) throw new Error("useAppContext must be used within AppContext.Provider");
  return context;
};

// --- Components ---

const ProductCard: React.FC<{ product: Product, onAdd: () => void }> = ({ product, onAdd }) => {
  const discount = product.discountPrice ? Math.round(((product.price - product.discountPrice) / product.price) * 100) : 0;
  
  return (
    <div className="bg-dark-800 rounded-xl overflow-hidden shadow-lg border border-dark-700 hover:border-primary/50 transition-all group">
      <div className="relative h-48 overflow-hidden">
        <img src={product.image} alt={product.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
        {discount > 0 && (
          <span className="absolute top-2 right-2 bg-red-500 text-white text-xs font-bold px-2 py-1 rounded-full">
            -{discount}%
          </span>
        )}
      </div>
      <div className="p-4">
        <div className="text-xs text-primary mb-1 font-semibold uppercase tracking-wider">{product.category}</div>
        <h3 className="font-bold text-white mb-2 truncate">{product.name}</h3>
        <div className="flex items-end justify-between mb-4">
          <div>
            {product.discountPrice ? (
              <div className="flex flex-col">
                <span className="text-gray-400 line-through text-xs">Rp {product.price.toLocaleString()}</span>
                <span className="text-lg font-bold text-white">Rp {product.discountPrice.toLocaleString()}</span>
              </div>
            ) : (
              <span className="text-lg font-bold text-white">Rp {product.price.toLocaleString()}</span>
            )}
          </div>
        </div>
        <button 
          onClick={onAdd}
          className="w-full bg-primary hover:bg-indigo-600 text-white py-2 rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
        >
          <i className="fas fa-shopping-cart"></i> Add to Cart
        </button>
      </div>
    </div>
  );
};

// --- Admin Views ---

const AdminDashboard: React.FC = () => {
  const { products, vouchers, affiliates, isCloudConnected, fetchError } = useAppContext();
  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-white">Dashboard</h2>
          <div className={`px-3 py-1 rounded-full text-xs font-bold border ${isCloudConnected ? 'bg-green-500/10 text-green-400 border-green-500/30' : 'bg-gray-500/10 text-gray-400 border-gray-500/30'}`}>
              {isCloudConnected ? '● Cloud Connected' : '○ Local Mode'}
          </div>
      </div>

      {fetchError && (
          <div className="bg-red-500/10 border border-red-500/30 p-4 rounded-lg mb-6 text-red-400 text-sm">
              <strong>Connection Error:</strong> {fetchError}
              <br/>
              Saran: Masuk ke menu "Database & API" dan jalankan ulang SQL Schema.
          </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-dark-800 p-6 rounded-xl border border-dark-700">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-sm">Total Produk</p>
              <h3 className="text-3xl font-bold text-white mt-1">{products.length}</h3>
            </div>
            <div className="w-12 h-12 bg-primary/20 rounded-full flex items-center justify-center text-primary">
              <i className="fas fa-box text-xl"></i>
            </div>
          </div>
        </div>
         <div className="bg-dark-800 p-6 rounded-xl border border-dark-700">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-sm">Voucher Aktif</p>
              <h3 className="text-3xl font-bold text-white mt-1">{vouchers.filter(v => v.isActive).length}</h3>
            </div>
            <div className="w-12 h-12 bg-secondary/20 rounded-full flex items-center justify-center text-secondary">
              <i className="fas fa-ticket-alt text-xl"></i>
            </div>
          </div>
        </div>
         <div className="bg-dark-800 p-6 rounded-xl border border-dark-700">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-sm">Afiliasi</p>
              <h3 className="text-3xl font-bold text-white mt-1">{affiliates.length}</h3>
            </div>
            <div className="w-12 h-12 bg-blue-500/20 rounded-full flex items-center justify-center text-blue-500">
              <i className="fas fa-users text-xl"></i>
            </div>
          </div>
        </div>
        <div className="bg-dark-800 p-6 rounded-xl border border-dark-700">
           <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-sm">Status Toko</p>
              <h3 className="text-xl font-bold text-green-400 mt-1">Online</h3>
            </div>
             <div className="w-12 h-12 bg-green-500/20 rounded-full flex items-center justify-center text-green-500">
              <i className="fas fa-wifi text-xl"></i>
            </div>
          </div>
        </div>
      </div>
      
      <div className="mt-8 bg-dark-800 rounded-xl border border-dark-700 p-6">
        <h3 className="text-xl font-bold text-white mb-4">Selamat Datang, Admin!</h3>
        <p className="text-gray-400">
          Gunakan sidebar di sebelah kiri untuk mengelola produk, voucher, afiliasi, dan pengaturan toko.
        </p>
      </div>
    </div>
  );
};

const AdminProducts: React.FC = () => {
  const { products, updateProducts } = useAppContext();
  const [isEditing, setIsEditing] = useState(false);
  const [currentProduct, setCurrentProduct] = useState<Partial<Product>>({});

  const availableCategories = useMemo(() => {
    const defaults = ['Software', 'E-book', 'Course', 'Template'];
    const fromProducts = products.map(p => p.category);
    return Array.from(new Set([...defaults, ...fromProducts]));
  }, [products]);

  const handleSave = () => {
    if (!currentProduct.name || !currentProduct.price) return alert("Nama dan Harga wajib diisi");
    
    let newProducts = [...products];
    if (currentProduct.id) {
      newProducts = newProducts.map(p => p.id === currentProduct.id ? { ...p, ...currentProduct } as Product : p);
    } else {
      const newId = generateUUID();
      const productToAdd: Product = {
        id: newId,
        name: currentProduct.name!,
        price: Number(currentProduct.price),
        description: currentProduct.description || '',
        category: currentProduct.category || 'General',
        image: currentProduct.image || `https://picsum.photos/400/400?random=${Date.now()}`,
        discountPrice: currentProduct.discountPrice ? Number(currentProduct.discountPrice) : undefined,
        fileUrl: currentProduct.fileUrl || '',
      };
      newProducts.push(productToAdd);
    }
    updateProducts(newProducts);
    setIsEditing(false);
    setCurrentProduct({});
  };

  const handleDelete = (id: string) => {
    if (confirm('Yakin hapus produk ini?')) {
      updateProducts(products.filter(p => p.id !== id));
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, field: 'image' | 'fileUrl') => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 3 * 1024 * 1024) {
        alert("File terlalu besar! Maksimal 3MB untuk demo ini.");
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setCurrentProduct(prev => ({ ...prev, [field]: reader.result as string }));
      };
      reader.readAsDataURL(file);
    }
  };

  const isBase64 = (str: string) => str?.startsWith('data:');

  return (
    <div className="p-6 pb-24">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-white">Manajemen Produk</h2>
        <button 
          onClick={() => { setCurrentProduct({}); setIsEditing(true); }}
          className="bg-primary hover:bg-indigo-600 text-white px-4 py-2 rounded-lg"
        >
          <i className="fas fa-plus mr-2"></i> Tambah Produk
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {products.map(p => (
          <div key={p.id} className="bg-dark-800 rounded-lg p-4 border border-dark-700 flex flex-col">
            <img src={p.image} alt={p.name} className="w-full h-32 object-cover rounded-md mb-3" />
            <h3 className="font-bold text-white truncate">{p.name}</h3>
            <p className="text-sm text-gray-400 mb-2">{p.category}</p>
            <div className="flex justify-between items-center mt-auto">
              <span className="font-bold text-primary">Rp {p.price.toLocaleString()}</span>
              <div className="space-x-2">
                <button onClick={() => { setCurrentProduct(p); setIsEditing(true); }} className="text-blue-400 hover:text-blue-300"><i className="fas fa-edit"></i></button>
                <button onClick={() => handleDelete(p.id)} className="text-red-400 hover:text-red-300"><i className="fas fa-trash"></i></button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {isEditing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 overflow-y-auto">
          <div className="bg-dark-800 rounded-xl p-6 w-full max-w-lg border border-dark-700 shadow-2xl">
            <h3 className="text-xl font-bold text-white mb-4">{currentProduct.id ? 'Edit Produk' : 'Tambah Produk'}</h3>
            <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-2 no-scrollbar">
              <div>
                <label className="block text-sm text-gray-400 mb-1">Nama Produk</label>
                <input type="text" value={currentProduct.name || ''} onChange={e => setCurrentProduct({...currentProduct, name: e.target.value})} className="w-full bg-dark-900 border border-dark-700 rounded-lg px-4 py-2 text-white focus:border-primary focus:outline-none" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Kategori</label>
                  <input type="text" list="categories" value={currentProduct.category || ''} onChange={e => setCurrentProduct({...currentProduct, category: e.target.value})} placeholder="Pilih atau ketik..." className="w-full bg-dark-900 border border-dark-700 rounded-lg px-4 py-2 text-white focus:border-primary focus:outline-none" />
                  <datalist id="categories">{availableCategories.map(cat => <option key={cat} value={cat} />)}</datalist>
                </div>
                 <div>
                  <label className="block text-sm text-gray-400 mb-1">Gambar</label>
                  <div className="flex flex-col gap-2">
                    <input type="file" accept="image/*" onChange={(e) => handleFileUpload(e, 'image')} className="block w-full text-xs text-gray-400 file:mr-2 file:py-1 file:px-3 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-primary file:text-white" />
                    <input type="text" value={isBase64(currentProduct.image || '') ? '(Gambar terupload)' : currentProduct.image || ''} onChange={e => setCurrentProduct({...currentProduct, image: e.target.value})} disabled={isBase64(currentProduct.image || '')} className="w-full bg-dark-900 border border-dark-700 rounded-lg px-4 py-2 text-white focus:border-primary focus:outline-none text-xs disabled:opacity-50" placeholder="URL Gambar" />
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                 <div><label className="block text-sm text-gray-400 mb-1">Harga Normal</label><input type="number" value={currentProduct.price || ''} onChange={e => setCurrentProduct({...currentProduct, price: Number(e.target.value)})} className="w-full bg-dark-900 border border-dark-700 rounded-lg px-4 py-2 text-white focus:border-primary focus:outline-none" /></div>
                 <div><label className="block text-sm text-gray-400 mb-1">Harga Diskon (Opsional)</label><input type="number" value={currentProduct.discountPrice || ''} onChange={e => setCurrentProduct({...currentProduct, discountPrice: Number(e.target.value)})} className="w-full bg-dark-900 border border-dark-700 rounded-lg px-4 py-2 text-white focus:border-primary focus:outline-none" /></div>
              </div>
               <div><label className="block text-sm text-gray-400 mb-1">Deskripsi</label><textarea value={currentProduct.description || ''} onChange={e => setCurrentProduct({...currentProduct, description: e.target.value})} rows={3} className="w-full bg-dark-900 border border-dark-700 rounded-lg px-4 py-2 text-white focus:border-primary focus:outline-none" /></div>
              <div>
                  <label className="block text-sm text-gray-400 mb-1">File Produk</label>
                   <div className="flex flex-col gap-2">
                    <input type="file" onChange={(e) => handleFileUpload(e, 'fileUrl')} className="block w-full text-xs text-gray-400 file:mr-2 file:py-1 file:px-3 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-secondary file:text-white" />
                    <input type="text" value={isBase64(currentProduct.fileUrl || '') ? '(File terupload)' : currentProduct.fileUrl || ''} onChange={e => setCurrentProduct({...currentProduct, fileUrl: e.target.value})} placeholder="Link GDrive / Dropbox..." disabled={isBase64(currentProduct.fileUrl || '')} className="w-full bg-dark-900 border border-dark-700 rounded-lg px-4 py-2 text-white focus:border-primary focus:outline-none text-sm disabled:opacity-50" />
                  </div>
              </div>
            </div>
            <div className="flex justify-end gap-4 mt-6">
              <button onClick={() => setIsEditing(false)} className="px-4 py-2 rounded-lg text-gray-400 hover:text-white hover:bg-dark-700">Batal</button>
              <button onClick={handleSave} className="px-6 py-2 rounded-lg bg-primary hover:bg-indigo-600 text-white font-medium">Simpan</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const AdminVouchers: React.FC = () => {
  const { vouchers, updateVouchers } = useAppContext();
  const [isEditing, setIsEditing] = useState(false);
  const [currentVoucher, setCurrentVoucher] = useState<Partial<Voucher>>({});

  const handleSave = () => {
    if (!currentVoucher.code || !currentVoucher.value) return alert("Kode dan Nilai Diskon wajib diisi");
    let newVouchers = [...vouchers];
    if (currentVoucher.id) {
      newVouchers = newVouchers.map(v => v.id === currentVoucher.id ? { ...v, ...currentVoucher } as Voucher : v);
    } else {
      const newId = generateUUID();
      newVouchers.push({ id: newId, code: currentVoucher.code.toUpperCase(), type: currentVoucher.type || 'FIXED', value: Number(currentVoucher.value), isActive: currentVoucher.isActive !== undefined ? currentVoucher.isActive : true });
    }
    updateVouchers(newVouchers);
    setIsEditing(false);
    setCurrentVoucher({});
  };

  const handleDelete = (id: string) => {
    if (confirm('Yakin hapus voucher ini?')) updateVouchers(vouchers.filter(v => v.id !== id));
  };

  return (
    <div className="p-6 pb-24">
       <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-white">Manajemen Voucher</h2>
        <button onClick={() => { setCurrentVoucher({ type: 'FIXED', isActive: true }); setIsEditing(true); }} className="bg-primary hover:bg-indigo-600 text-white px-4 py-2 rounded-lg"><i className="fas fa-plus mr-2"></i> Buat Voucher</button>
      </div>
      <div className="bg-dark-800 rounded-xl border border-dark-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-gray-400">
            <thead className="bg-dark-900 text-gray-200 uppercase font-medium"><tr><th className="px-6 py-4">Kode</th><th className="px-6 py-4">Tipe</th><th className="px-6 py-4">Nilai</th><th className="px-6 py-4">Status</th><th className="px-6 py-4 text-right">Aksi</th></tr></thead>
            <tbody className="divide-y divide-dark-700">
              {vouchers.map(v => (
                <tr key={v.id} className="hover:bg-dark-700/50">
                  <td className="px-6 py-4 font-bold text-white">{v.code}</td>
                  <td className="px-6 py-4"><span className={`px-2 py-1 rounded text-xs font-bold ${v.type === 'PERCENT' ? 'bg-blue-500/20 text-blue-400' : 'bg-green-500/20 text-green-400'}`}>{v.type}</span></td>
                  <td className="px-6 py-4">{v.type === 'PERCENT' ? `${v.value}%` : `Rp ${v.value.toLocaleString()}`}</td>
                  <td className="px-6 py-4"><span className={`w-2 h-2 rounded-full inline-block mr-2 ${v.isActive ? 'bg-green-500' : 'bg-red-500'}`}></span>{v.isActive ? 'Aktif' : 'Off'}</td>
                  <td className="px-6 py-4 text-right space-x-3"><button onClick={() => { setCurrentVoucher(v); setIsEditing(true); }} className="text-blue-400"><i className="fas fa-edit"></i></button><button onClick={() => handleDelete(v.id)} className="text-red-400"><i className="fas fa-trash"></i></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      {isEditing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="bg-dark-800 rounded-xl p-6 w-full max-w-md border border-dark-700 shadow-2xl">
             <h3 className="text-xl font-bold text-white mb-4">{currentVoucher.id ? 'Edit Voucher' : 'Buat Voucher'}</h3>
             <div className="space-y-4">
               <input type="text" placeholder="Kode (misal: DISC10)" value={currentVoucher.code || ''} onChange={e => setCurrentVoucher({...currentVoucher, code: e.target.value.toUpperCase()})} className="w-full bg-dark-900 border border-dark-700 rounded-lg px-4 py-2 text-white" />
               <select value={currentVoucher.type || 'FIXED'} onChange={e => setCurrentVoucher({...currentVoucher, type: e.target.value as any})} className="w-full bg-dark-900 border border-dark-700 rounded-lg px-4 py-2 text-white"><option value="FIXED">Rupiah (Rp)</option><option value="PERCENT">Persen (%)</option></select>
               <input type="number" placeholder="Nilai" value={currentVoucher.value || ''} onChange={e => setCurrentVoucher({...currentVoucher, value: Number(e.target.value)})} className="w-full bg-dark-900 border border-dark-700 rounded-lg px-4 py-2 text-white" />
             </div>
             <div className="flex justify-end gap-4 mt-6">
               <button onClick={() => setIsEditing(false)} className="text-gray-400">Batal</button>
               <button onClick={handleSave} className="bg-primary text-white px-4 py-2 rounded-lg">Simpan</button>
             </div>
          </div>
        </div>
      )}
    </div>
  );
};

const AdminAffiliates: React.FC = () => {
  const { affiliates, updateAffiliates } = useAppContext();
  const [isEditing, setIsEditing] = useState(false);
  const [currentAff, setCurrentAff] = useState<Partial<Affiliate>>({});

  const handleSave = () => {
    if (!currentAff.name || !currentAff.code || !currentAff.password) return alert("Data wajib diisi");
    
    let newAffs = [...affiliates];
    if (currentAff.id) {
      newAffs = newAffs.map(a => a.id === currentAff.id ? { ...a, ...currentAff } as Affiliate : a);
    } else {
      newAffs.push({
        id: generateUUID(),
        name: currentAff.name!,
        code: currentAff.code!.toUpperCase(),
        password: currentAff.password!,
        commissionRate: Number(currentAff.commissionRate || 10),
        totalEarnings: 0,
        bankDetails: currentAff.bankDetails || '',
        isActive: true,
      });
    }
    updateAffiliates(newAffs);
    setIsEditing(false);
    setCurrentAff({});
  };

  const handleDelete = (id: string) => {
    if(confirm('Hapus partner ini?')) updateAffiliates(affiliates.filter(a => a.id !== id));
  };

  return (
    <div className="p-6 pb-24">
       <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-white">Manajemen Afiliasi</h2>
        <button 
          onClick={() => { setCurrentAff({ commissionRate: 10, isActive: true }); setIsEditing(true); }}
          className="bg-primary hover:bg-indigo-600 text-white px-4 py-2 rounded-lg"
        >
          <i className="fas fa-user-plus mr-2"></i> Tambah Partner
        </button>
      </div>

      <div className="bg-dark-800 rounded-xl border border-dark-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-gray-400">
            <thead className="bg-dark-900 text-gray-200 uppercase font-medium">
              <tr><th className="px-6 py-4">Partner</th><th className="px-6 py-4">Kode Referral</th><th className="px-6 py-4">Komisi</th><th className="px-6 py-4">Pendapatan</th><th className="px-6 py-4">Password</th><th className="px-6 py-4 text-right">Aksi</th></tr>
            </thead>
            <tbody className="divide-y divide-dark-700">
              {affiliates.map(a => (
                <tr key={a.id} className="hover:bg-dark-700/50">
                  <td className="px-6 py-4 font-bold text-white">{a.name}</td>
                  <td className="px-6 py-4"><span className="bg-gray-700 px-2 py-1 rounded text-white font-mono">{a.code}</span></td>
                  <td className="px-6 py-4">{a.commissionRate}%</td>
                  <td className="px-6 py-4 text-green-400 font-bold">Rp {a.totalEarnings.toLocaleString()}</td>
                  <td className="px-6 py-4 font-mono text-xs">{a.password}</td>
                  <td className="px-6 py-4 text-right space-x-3">
                    <button onClick={() => { setCurrentAff(a); setIsEditing(true); }} className="text-blue-400"><i className="fas fa-edit"></i></button>
                    <button onClick={() => handleDelete(a.id)} className="text-red-400"><i className="fas fa-trash"></i></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {isEditing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="bg-dark-800 rounded-xl p-6 w-full max-w-md border border-dark-700 shadow-2xl">
            <h3 className="text-xl font-bold text-white mb-4">{currentAff.id ? 'Edit Partner' : 'Tambah Partner Afiliasi'}</h3>
            <div className="space-y-4">
              <div><label className="text-xs text-gray-400">Nama Lengkap</label><input type="text" value={currentAff.name || ''} onChange={e => setCurrentAff({...currentAff, name: e.target.value})} className="w-full bg-dark-900 border border-dark-700 rounded-lg px-4 py-2 text-white" /></div>
              <div><label className="text-xs text-gray-400">Kode Referral (Unik)</label><input type="text" value={currentAff.code || ''} onChange={e => setCurrentAff({...currentAff, code: e.target.value.toUpperCase()})} className="w-full bg-dark-900 border border-dark-700 rounded-lg px-4 py-2 text-white uppercase" placeholder="CONTOH: BUDI123" /></div>
              <div className="grid grid-cols-2 gap-4">
                 <div><label className="text-xs text-gray-400">Komisi (%)</label><input type="number" value={currentAff.commissionRate || ''} onChange={e => setCurrentAff({...currentAff, commissionRate: Number(e.target.value)})} className="w-full bg-dark-900 border border-dark-700 rounded-lg px-4 py-2 text-white" /></div>
                 <div><label className="text-xs text-gray-400">Password Login</label><input type="text" value={currentAff.password || ''} onChange={e => setCurrentAff({...currentAff, password: e.target.value})} className="w-full bg-dark-900 border border-dark-700 rounded-lg px-4 py-2 text-white" /></div>
              </div>
              <div><label className="text-xs text-gray-400">Info Bank</label><input type="text" value={currentAff.bankDetails || ''} onChange={e => setCurrentAff({...currentAff, bankDetails: e.target.value})} className="w-full bg-dark-900 border border-dark-700 rounded-lg px-4 py-2 text-white" placeholder="BCA - 12345678 - Budi" /></div>
            </div>
            <div className="flex justify-end gap-4 mt-6">
              <button onClick={() => setIsEditing(false)} className="text-gray-400">Batal</button>
              <button onClick={handleSave} className="bg-primary text-white px-4 py-2 rounded-lg">Simpan</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const AdminSettings: React.FC = () => {
  const { settings, updateSettings, paymentMethods, updatePayments } = useAppContext();
  const [formData, setFormData] = useState(settings);
  const [payments, setPayments] = useState(paymentMethods);
  
  useEffect(() => { setFormData(settings); }, [settings]);
  useEffect(() => { setPayments(paymentMethods); }, [paymentMethods]);

  const handleSave = () => { 
      updateSettings(formData); 
      updatePayments(payments);
      alert('Pengaturan dan Pembayaran berhasil disimpan secara lokal. Jangan lupa klik "Upload to Cloud" di menu Database untuk sinkronisasi ke Customer.'); 
  };

  return (
    <div className="p-6 pb-24 max-w-4xl mx-auto">
      <h2 className="text-2xl font-bold text-white mb-6">Pengaturan Toko</h2>
      <div className="space-y-8">
        <div className="bg-dark-800 p-6 rounded-xl border border-dark-700">
          <h3 className="text-lg font-bold text-white mb-4 border-b border-dark-700 pb-2">Informasi Umum</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div><label className="block text-sm text-gray-400 mb-1">Nama Toko</label><input value={formData.storeName} onChange={e => setFormData({...formData, storeName: e.target.value})} className="w-full bg-dark-900 border border-dark-700 rounded-lg px-4 py-2 text-white" /></div>
            <div><label className="block text-sm text-gray-400 mb-1">WhatsApp</label><input value={formData.whatsapp} onChange={e => setFormData({...formData, whatsapp: e.target.value})} className="w-full bg-dark-900 border border-dark-700 rounded-lg px-4 py-2 text-white" /></div>
            <div className="md:col-span-2"><label className="block text-sm text-gray-400 mb-1">Alamat</label><input value={formData.address} onChange={e => setFormData({...formData, address: e.target.value})} className="w-full bg-dark-900 border border-dark-700 rounded-lg px-4 py-2 text-white" /></div>
            <div className="md:col-span-2"><label className="block text-sm text-gray-400 mb-1">Deskripsi</label><textarea value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} className="w-full bg-dark-900 border border-dark-700 rounded-lg px-4 py-2 text-white" /></div>
          </div>
        </div>

        <div className="bg-dark-800 p-6 rounded-xl border border-dark-700">
            <h3 className="text-lg font-bold text-white mb-4 border-b border-dark-700 pb-2">Rekening & Pembayaran</h3>
            {payments.map((pm, idx) => (
                <div key={pm.id} className="mb-4 pb-4 border-b border-dark-700 last:border-0 last:pb-0">
                    <div className="flex justify-between items-center mb-2">
                        <span className="font-bold text-primary">{pm.type} - {pm.name}</span>
                        <input type="checkbox" checked={pm.isActive !== false} onChange={e => {
                             const newP = [...payments]; newP[idx].isActive = e.target.checked; setPayments(newP);
                        }} className="accent-primary w-4 h-4" />
                    </div>
                    {pm.type === 'BANK' || pm.type === 'E-WALLET' ? (
                        <div className="grid grid-cols-2 gap-2">
                            <input value={pm.accountNumber || ''} onChange={e => { const newP = [...payments]; newP[idx].accountNumber = e.target.value; setPayments(newP); }} placeholder="No. Rekening" className="bg-dark-900 border border-dark-700 rounded px-2 py-1 text-xs text-white" />
                            <input value={pm.accountName || ''} onChange={e => { const newP = [...payments]; newP[idx].accountName = e.target.value; setPayments(newP); }} placeholder="Atas Nama" className="bg-dark-900 border border-dark-700 rounded px-2 py-1 text-xs text-white" />
                        </div>
                    ) : <p className="text-xs text-gray-500">{pm.description}</p>}
                </div>
            ))}
        </div>

        <button onClick={handleSave} className="w-full bg-primary hover:bg-indigo-600 text-white font-bold py-3 rounded-xl">Simpan Semua Perubahan</button>
      </div>
    </div>
  );
};

const AdminDatabase: React.FC = () => {
  const { settings, updateSettings, products, vouchers, affiliates, paymentMethods, supabase, resetLocalData, updateProducts, updateVouchers, updateAffiliates, updatePayments } = useAppContext();
  const [formData, setFormData] = useState(settings);
  const [showSql, setShowSql] = useState(!settings.supabaseUrl); // Auto show if no URL
  const [isSyncing, setIsSyncing] = useState(false);

  // Fungsi untuk push data local ke Supabase
  const handleSync = async () => {
    if (!supabase) return alert("Supabase belum terkoneksi! Masukkan URL & Key, Simpan, lalu Refresh.");
    if (!confirm("PERHATIAN: Ini akan MENGUPLOAD semua data produk, voucher, partner, dan pengaturan toko yang ada di panel admin ini ke database cloud. Data di cloud akan ditimpa. Lanjutkan?")) return;
    
    setIsSyncing(true);
    try {
        // --- Helper to fix legacy IDs (like "1") to proper UUIDs ---
        const ensureUuid = (item: any) => {
            if (!isValidUUID(item.id)) {
                return { ...item, id: generateUUID() };
            }
            return item;
        };

        // 1. Sync Products
        if (products.length > 0) {
            const fixedProducts = products.map(ensureUuid);
            updateProducts(fixedProducts); // Update local to prevent sync loop of old IDs
            
            const dbProducts = fixedProducts.map(p => ({
                id: p.id, name: p.name, category: p.category, description: p.description, price: p.price,
                discount_price: p.discountPrice, image: p.image, file_url: p.fileUrl, is_popular: p.isPopular
            }));
            const { error } = await supabase.from('products').upsert(dbProducts);
            if (error) throw error;
        }

        // 2. Sync Vouchers
        if (vouchers.length > 0) {
            const fixedVouchers = vouchers.map(ensureUuid);
            updateVouchers(fixedVouchers);

            const dbVouchers = fixedVouchers.map(v => ({
                id: v.id, code: v.code, type: v.type, value: v.value, is_active: v.isActive
            }));
            const { error } = await supabase.from('vouchers').upsert(dbVouchers);
            if (error) throw error;
        }

        // 3. Sync Affiliates
        if (affiliates.length > 0) {
            const fixedAffs = affiliates.map(ensureUuid);
            updateAffiliates(fixedAffs);

            const dbAffs = fixedAffs.map(a => ({
                id: a.id, name: a.name, code: a.code, password: a.password, commission_rate: a.commissionRate,
                total_earnings: a.totalEarnings, bank_details: a.bankDetails, is_active: a.isActive
            }));
            const { error } = await supabase.from('affiliates').upsert(dbAffs);
            if (error) throw error;
        }

        // 4. Sync Store Settings (Single Row ID: settings_01)
        const dbSettings = {
            id: 'settings_01',
            store_name: settings.storeName,
            address: settings.address,
            whatsapp: settings.whatsapp,
            email: settings.email,
            description: settings.description,
            logo_url: settings.logoUrl,
            tripay_api_key: settings.tripayApiKey,
            tripay_private_key: settings.tripayPrivateKey,
            tripay_merchant_code: settings.tripayMerchantCode
        };
        const { error: setErr } = await supabase.from('store_settings').upsert(dbSettings);
        if (setErr) throw setErr;

        // 5. Sync Payment Methods
        if (paymentMethods.length > 0) {
             const fixedPayments = paymentMethods.map(ensureUuid);
             updatePayments(fixedPayments);

             const dbPayments = fixedPayments.map(p => ({
                 id: p.id, type: p.type, name: p.name, account_number: p.accountNumber, 
                 account_name: p.accountName, description: p.description, logo: p.logo, is_active: p.isActive
             }));
             const { error: payErr } = await supabase.from('payment_methods').upsert(dbPayments);
             if (payErr) throw payErr;
        }

        alert("Upload Berhasil! Semua data (Produk, Voucher, Pengaturan, Pembayaran) sudah tersimpan di Supabase.");
    } catch (e: any) {
        alert("Gagal upload: " + (e.message || e));
        console.error(e);
    } finally {
        setIsSyncing(false);
    }
  };

  return (
    <div className="p-6 pb-24 max-w-4xl mx-auto">
       <h2 className="text-2xl font-bold text-white mb-6">Database & API</h2>
       <div className="space-y-6">
          <div className="bg-dark-800 p-6 rounded-xl border border-dark-700">
            <h3 className="text-lg font-bold text-green-400 mb-4 flex items-center gap-2">
                <i className="fas fa-database"></i> Supabase Integration
                {supabase && <span className="bg-green-500/20 text-green-400 text-xs px-2 py-1 rounded-full border border-green-500/30">Connected</span>}
            </h3>
            
            {/* Sync Dashboard Area */}
            <div className="bg-dark-900/50 p-4 rounded-lg border border-dark-700 mb-6">
                <h4 className="font-bold text-white mb-2">Sync Dashboard</h4>
                <p className="text-gray-400 text-sm mb-4">
                    Gunakan tombol di bawah ini untuk mengirim data yang ada di panel admin ini ke database cloud. 
                    Sistem akan otomatis memperbaiki format ID (UUID) dan menyinkronkan pengaturan toko.
                </p>
                <div className="flex gap-4">
                     <button 
                        onClick={handleSync} 
                        disabled={isSyncing || !supabase}
                        className="flex-1 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-bold py-3 rounded-lg transition-colors flex items-center justify-center gap-2"
                    >
                        {isSyncing ? <i className="fas fa-spinner fa-spin"></i> : <i className="fas fa-cloud-upload-alt"></i>}
                        {isSyncing ? "Uploading..." : "UPLOAD LOCAL DATA TO CLOUD"}
                    </button>
                     <button 
                        onClick={() => { if(confirm("Ini akan menghapus data di browser ini dan mengambil ulang dari Cloud/Default. Yakin?")) resetLocalData(); }}
                        className="px-6 py-3 bg-red-600/20 hover:bg-red-600/40 text-red-500 border border-red-600/50 rounded-lg font-medium"
                        title="Reset Local Data"
                    >
                        <i className="fas fa-redo"></i> Reset Local
                    </button>
                </div>
            </div>

            <div className="space-y-4 pt-4 border-t border-dark-700">
               <div><label className="text-sm text-gray-400">Supabase URL</label><input type="password" value={formData.supabaseUrl || ''} onChange={e => setFormData({...formData, supabaseUrl: e.target.value})} className="w-full bg-dark-900 border border-dark-700 rounded-lg px-4 py-2 text-white" placeholder="https://xyz.supabase.co" /></div>
               <div><label className="text-sm text-gray-400">Anon Key</label><input type="password" value={formData.supabaseKey || ''} onChange={e => setFormData({...formData, supabaseKey: e.target.value})} className="w-full bg-dark-900 border border-dark-700 rounded-lg px-4 py-2 text-white" placeholder="eyJh..." /></div>
               <div className="mt-4"><button onClick={() => setShowSql(!showSql)} className="text-primary text-sm font-bold"> {showSql ? 'Hide SQL' : 'Show SQL Schema'} </button>{showSql && <textarea readOnly value={SUPABASE_SCHEMA} className="w-full h-64 bg-dark-900 border border-dark-700 rounded-lg p-4 mt-2 text-xs font-mono text-gray-300" />}</div>
            </div>
          </div>
          <button onClick={() => { updateSettings(formData); alert('Saved. Please refresh page.'); }} className="w-full bg-primary hover:bg-indigo-600 text-white font-bold py-3 rounded-xl">Simpan Konfigurasi</button>
       </div>
    </div>
  );
};

// --- Affiliate Views ---

const AffiliateDashboard: React.FC = () => {
  const { user, affiliates } = useAppContext();
  
  // Find current affiliate data
  const myData = affiliates.find(a => a.id === user?.id);
  
  if (!myData) return <div className="p-8 text-center">Data afiliasi tidak ditemukan.</div>;

  // Generate Referral Link
  // Note: Using window.location.origin + hash structure
  const referralLink = `${window.location.origin}${window.location.pathname}#/?ref=${myData.code}`;

  const copyLink = () => {
    navigator.clipboard.writeText(referralLink);
    alert('Link referral berhasil disalin!');
  };

  return (
    <div className="p-6 max-w-4xl mx-auto pb-24">
      <div className="bg-gradient-to-r from-blue-600 to-indigo-700 rounded-2xl p-8 mb-8 text-white shadow-lg">
        <h2 className="text-3xl font-bold mb-2">Halo, {myData.name}!</h2>
        <p className="opacity-80">Selamat datang di dashboard partner. Sebarkan link dan dapatkan komisi.</p>
        
        <div className="mt-6 flex flex-col md:flex-row gap-4 items-center bg-white/10 p-4 rounded-xl backdrop-blur-sm border border-white/20">
          <div className="flex-1 w-full">
            <label className="text-xs uppercase tracking-wider opacity-70 mb-1 block">Link Referral Anda</label>
            <div className="font-mono text-sm truncate bg-black/20 p-2 rounded">{referralLink}</div>
          </div>
          <button onClick={copyLink} className="bg-white text-blue-700 px-6 py-2 rounded-lg font-bold hover:bg-gray-100 transition w-full md:w-auto">
            <i className="fas fa-copy mr-2"></i> Salin Link
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-dark-800 p-6 rounded-xl border border-dark-700">
          <p className="text-gray-400 text-sm">Total Pendapatan</p>
          <h3 className="text-3xl font-bold text-green-400 mt-2">Rp {myData.totalEarnings.toLocaleString()}</h3>
        </div>
        <div className="bg-dark-800 p-6 rounded-xl border border-dark-700">
          <p className="text-gray-400 text-sm">Komisi Per Penjualan</p>
          <h3 className="text-3xl font-bold text-white mt-2">{myData.commissionRate}%</h3>
        </div>
        <div className="bg-dark-800 p-6 rounded-xl border border-dark-700">
          <p className="text-gray-400 text-sm">Kode Unik</p>
          <h3 className="text-3xl font-bold text-blue-400 mt-2">{myData.code}</h3>
        </div>
      </div>

      <div className="bg-dark-800 rounded-xl border border-dark-700 p-6">
        <h3 className="text-lg font-bold text-white mb-4">Informasi Rekening</h3>
        <p className="text-gray-400 mb-2">Komisi akan ditransfer ke rekening berikut:</p>
        <div className="bg-dark-900 p-4 rounded-lg border border-dark-700 font-mono text-lg text-white">
          {myData.bankDetails}
        </div>
        <p className="text-xs text-gray-500 mt-4">* Hubungi admin jika ingin mengubah data rekening.</p>
      </div>
    </div>
  );
};

// --- Customer Views ---

const CustomerHome: React.FC = () => {
  const { products, settings, addToCart, setReferralCode } = useAppContext();
  const [searchParams] = useSearchParams();
  const [categoryFilter, setCategoryFilter] = useState('All');

  // Check for Referral Code in URL
  useEffect(() => {
    const ref = searchParams.get('ref');
    if (ref) {
      setReferralCode(ref); // Save to global state/storage
    }
  }, [searchParams, setReferralCode]);

  // Sync with URL param for category
  useEffect(() => {
    const cat = searchParams.get('category');
    if (cat) {
      setCategoryFilter(cat);
      setTimeout(() => document.getElementById('products')?.scrollIntoView({ behavior: 'smooth'}), 100);
    }
  }, [searchParams]);

  const categories = ['All', ...Array.from(new Set(products.map(p => p.category)))];
  const filteredProducts = categoryFilter === 'All' ? products : products.filter(p => p.category === categoryFilter);

  return (
    <div className="pb-20">
      <div className="relative bg-dark-800 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-primary/20 to-secondary/20 z-0"></div>
        <div className="max-w-6xl mx-auto px-6 py-16 relative z-10 text-center md:text-left md:flex items-center justify-between">
          <div className="mb-8 md:mb-0">
            <h1 className="text-4xl md:text-5xl font-extrabold text-white mb-4 leading-tight">Produk Digital Terbaik <br/><span className="text-primary">Untuk Kebutuhanmu</span></h1>
            <p className="text-gray-300 text-lg mb-6 max-w-xl">{settings.description}</p>
            <button onClick={() => document.getElementById('products')?.scrollIntoView({ behavior: 'smooth'})} className="bg-primary hover:bg-indigo-600 text-white px-8 py-3 rounded-full font-bold transition-all transform hover:scale-105">Belanja Sekarang</button>
          </div>
          <div className="hidden md:block"><i className="fas fa-rocket text-9xl text-white/10 transform rotate-12"></i></div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-8 overflow-x-auto no-scrollbar">
        <div className="flex space-x-4">
          {categories.map(cat => (
            <button key={cat} onClick={() => setCategoryFilter(cat)} className={`px-6 py-2 rounded-full border whitespace-nowrap transition-colors ${categoryFilter === cat ? 'bg-primary border-primary text-white' : 'bg-dark-800 border-dark-700 text-gray-400 hover:bg-dark-700'}`}>{cat}</button>
          ))}
        </div>
      </div>

      <div id="products" className="max-w-6xl mx-auto px-6 mb-12">
        <h2 className="text-2xl font-bold text-white mb-6">Produk Terbaru</h2>
        {filteredProducts.length === 0 ? <div className="text-center py-20 text-gray-500">Tidak ada produk ditemukan.</div> : 
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {filteredProducts.map(p => (
              <ProductCard key={p.id} product={p} onAdd={() => { addToCart(p); alert("Produk ditambahkan ke keranjang!"); }} />
            ))}
          </div>
        }
      </div>
    </div>
  );
};

const CategoryView: React.FC = () => {
  const { products } = useAppContext();
  const categories = Array.from(new Set(products.map(p => p.category)));
  return (
    <div className="max-w-4xl mx-auto p-6 pb-24">
      <h2 className="text-2xl font-bold text-white mb-6">Kategori Produk</h2>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {categories.map((cat, idx) => (
          <Link to={`/?category=${cat}`} key={idx} className="aspect-square bg-dark-800 rounded-xl border border-dark-700 flex flex-col items-center justify-center hover:bg-dark-700 hover:border-primary transition-all group">
            <div className="w-16 h-16 bg-primary/20 rounded-full flex items-center justify-center mb-4 group-hover:scale-110 transition-transform"><i className="fas fa-folder text-2xl text-primary"></i></div>
            <span className="font-bold text-white text-lg">{cat}</span>
          </Link>
        ))}
      </div>
    </div>
  );
};

const AccountView: React.FC = () => {
  const { user, logout } = useAppContext();
  const navigate = useNavigate();

  if (!user) return <Navigate to="/login" />;

  const handleLogout = () => { logout(); navigate('/'); };

  return (
    <div className="max-w-md mx-auto p-6 pb-24">
      <div className="bg-dark-800 rounded-xl border border-dark-700 p-6 text-center">
        <div className="w-24 h-24 bg-primary rounded-full mx-auto flex items-center justify-center mb-4"><i className="fas fa-user text-4xl text-white"></i></div>
        <h2 className="text-2xl font-bold text-white mb-1">{user.name}</h2>
        <p className="text-primary text-sm font-semibold mb-6 uppercase">{user.role}</p>

        <div className="space-y-3">
          {user.role === 'ADMIN' && (
            <Link to="/admin" className="block w-full bg-dark-700 hover:bg-dark-600 text-white py-3 rounded-xl border border-dark-600"><i className="fas fa-cogs mr-2"></i> Ke Panel Admin</Link>
          )}
          {user.role === 'AFFILIATE' && (
            <Link to="/affiliate" className="block w-full bg-blue-600 hover:bg-blue-500 text-white py-3 rounded-xl border border-blue-500"><i className="fas fa-chart-line mr-2"></i> Dashboard Afiliasi</Link>
          )}
          <button onClick={handleLogout} className="block w-full bg-red-500/10 hover:bg-red-500/20 text-red-500 py-3 rounded-xl border border-red-500/20"><i className="fas fa-sign-out-alt mr-2"></i> Keluar</button>
        </div>
      </div>
    </div>
  );
};

const CustomerCart: React.FC = () => {
  const { cart, removeFromCart, clearCart, settings, paymentMethods, vouchers, referralCode, affiliates, updateAffiliates } = useAppContext();
  const [selectedPayment, setSelectedPayment] = useState<string>('');
  const [voucherCode, setVoucherCode] = useState('');
  const [appliedVoucher, setAppliedVoucher] = useState<Voucher | null>(null);
  const navigate = useNavigate();

  const subTotal = cart.reduce((sum, item) => sum + ((item.discountPrice || item.price) * item.quantity), 0);
  let discountAmount = 0;
  if (appliedVoucher) {
    discountAmount = appliedVoucher.type === 'PERCENT' ? (subTotal * appliedVoucher.value) / 100 : appliedVoucher.value;
  }
  const total = Math.max(0, subTotal - discountAmount);

  const handleApplyVoucher = () => {
    if (!voucherCode) return;
    const found = vouchers.find(v => v.code === voucherCode.toUpperCase() && v.isActive);
    if (found) { setAppliedVoucher(found); alert(`Voucher ${found.code} digunakan!`); } 
    else { alert("Voucher tidak valid"); setAppliedVoucher(null); }
  };

  const handleCheckout = () => {
    if (!selectedPayment) return alert('Pilih metode pembayaran');
    if (cart.length === 0) return alert('Keranjang kosong');

    const paymentMethod = paymentMethods.find(p => p.id === selectedPayment);
    
    // Logic Affiliate: Calculate Commission & Update Earnings (Mocked in Local Storage for this demo)
    let affiliateName = '';
    if (referralCode) {
      const affiliate = affiliates.find(a => a.code === referralCode);
      if (affiliate && affiliate.isActive) {
        affiliateName = affiliate.name;
        // Mocking backend process: In a real app, this happens on server after payment confirmation
        const commission = Math.round((subTotal * affiliate.commissionRate) / 100);
        
        // Clone and update
        const updatedAffiliates = affiliates.map(a => {
            if (a.id === affiliate.id) {
                return { ...a, totalEarnings: a.totalEarnings + commission };
            }
            return a;
        });
        updateAffiliates(updatedAffiliates);
        console.log(`Commission of ${commission} added to ${affiliate.name}`);
      }
    }

    if (paymentMethod?.type === 'TRIPAY') {
      alert(`[TRIPAY] Redirecting...\nTotal: ${total}\nRef: ${referralCode || '-'}`);
      clearCart(); navigate('/'); return;
    }

    let message = `Halo *${settings.storeName}*, saya ingin memesan:\n\n`;
    cart.forEach((item, idx) => { message += `${idx + 1}. ${item.name} x${item.quantity} - Rp ${(item.discountPrice || item.price).toLocaleString()}\n`; });
    message += `\nSubtotal: Rp ${subTotal.toLocaleString()}`;
    if (appliedVoucher) message += `\nVoucher (${appliedVoucher.code}): -Rp ${discountAmount.toLocaleString()}`;
    message += `\n*Total Akhir: Rp ${total.toLocaleString()}*`;
    message += `\nMetode Pembayaran: ${paymentMethod?.name}`;
    if (referralCode) message += `\n\n[Internal Info] Ref Code: ${referralCode}`;
    message += `\n\nMohon diproses, terima kasih.`;

    window.open(`https://wa.me/${settings.whatsapp}?text=${encodeURIComponent(message)}`, '_blank');
    clearCart(); navigate('/');
  };

  const getQRCodeUrl = (data: string) => `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(data)}`;

  if (cart.length === 0) return <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center"><i className="fas fa-shopping-cart text-6xl text-dark-700 mb-4"></i><h2 className="text-xl font-bold text-white mb-2">Keranjang Kosong</h2><Link to="/" className="text-primary">Kembali Belanja</Link></div>;

  const selectedPaymentDetails = paymentMethods.find(p => p.id === selectedPayment);

  return (
    <div className="max-w-2xl mx-auto p-6 pb-24">
      <h1 className="text-2xl font-bold text-white mb-6">Checkout</h1>
      <div className="bg-dark-800 rounded-xl overflow-hidden mb-6 border border-dark-700">
        {cart.map(item => (
          <div key={item.id} className="flex items-center gap-4 p-4 border-b border-dark-700 last:border-0"><img src={item.image} className="w-16 h-16 object-cover rounded" /><div className="flex-1"><h4 className="font-bold text-white text-sm">{item.name}</h4><p className="text-primary text-sm">Rp {(item.discountPrice || item.price).toLocaleString()} x {item.quantity}</p></div><button onClick={() => removeFromCart(item.id)} className="text-red-400 p-2"><i className="fas fa-trash"></i></button></div>
        ))}
        <div className="p-4 bg-dark-900 border-b border-dark-700"><div className="flex gap-2"><input type="text" value={voucherCode} onChange={(e) => setVoucherCode(e.target.value.toUpperCase())} placeholder="Kode voucher?" className="flex-1 bg-dark-800 border border-dark-700 rounded-lg px-3 py-2 text-white uppercase" /><button onClick={handleApplyVoucher} className="bg-secondary text-white px-4 py-2 rounded-lg text-sm">Pakai</button></div>{appliedVoucher && <div className="mt-2 text-green-400 text-sm">Voucher aktif!</div>}</div>
        <div className="p-4 bg-dark-900 space-y-2"><div className="flex justify-between text-gray-400 text-sm"><span>Subtotal</span><span>Rp {subTotal.toLocaleString()}</span></div>{appliedVoucher && <div className="flex justify-between text-green-400 text-sm"><span>Diskon</span><span>-Rp {discountAmount.toLocaleString()}</span></div>}<div className="flex justify-between border-t border-dark-700 pt-2 mt-2"><span className="text-gray-300">Total</span><span className="text-xl font-bold text-white">Rp {total.toLocaleString()}</span></div></div>
      </div>
      
      {referralCode && (
        <div className="bg-blue-500/10 border border-blue-500/30 p-3 rounded-lg mb-6 flex items-center gap-2 text-blue-400 text-sm">
           <i className="fas fa-info-circle"></i>
           <span>Referral Code aktif: <b>{referralCode}</b></span>
        </div>
      )}

      <h2 className="text-lg font-bold text-white mb-3">Pilih Pembayaran</h2>
      <div className="grid gap-3 mb-6">
        {paymentMethods.map(pm => (
          <div key={pm.id} onClick={() => setSelectedPayment(pm.id)} className={`cursor-pointer p-4 rounded-xl border flex items-center justify-between ${selectedPayment === pm.id ? 'bg-primary/20 border-primary' : 'bg-dark-800 border-dark-700'}`}><div className="flex items-center gap-3"><div className="w-8 h-8 flex items-center justify-center bg-white rounded-full overflow-hidden">{pm.logo ? <img src={pm.logo} className="w-full h-full object-contain" /> : <i className="fas fa-wallet text-black"></i>}</div><span className="font-medium text-white">{pm.name}</span></div>{selectedPayment === pm.id && <i className="fas fa-check-circle text-primary"></i>}</div>
        ))}
      </div>
      {selectedPaymentDetails?.type === 'QRIS' && <div className="bg-white p-6 rounded-xl mb-6 flex flex-col items-center text-center"><h3 className="text-black font-bold mb-2">Scan QRIS</h3><img src={getQRCodeUrl(`DIGISTORE-${total}`)} className="w-48 h-48 mb-2" /><p className="text-black text-sm">NMID: ID123456789</p></div>}
      {selectedPaymentDetails?.type === 'BANK' && <div className="bg-dark-800 p-4 rounded-xl mb-6 border border-dark-700"><p className="text-gray-400 text-sm">Transfer ke:</p><p className="text-white font-bold text-lg">{selectedPaymentDetails.name}</p><p className="text-primary font-mono text-xl">{selectedPaymentDetails.accountNumber}</p><p className="text-white text-sm">A.N {selectedPaymentDetails.accountName}</p></div>}
      <button onClick={handleCheckout} className="w-full bg-green-500 hover:bg-green-600 text-white font-bold py-4 rounded-xl shadow-lg flex items-center justify-center gap-2"><i className="fab fa-whatsapp text-xl"></i> {selectedPaymentDetails?.type === 'TRIPAY' ? 'Bayar via Tripay' : 'Konfirmasi via WhatsApp'}</button>
    </div>
  );
};

// --- Layouts ---

const CustomerLayout: React.FC = () => {
  const { cart, user, isCloudConnected, debugDataCount } = useAppContext();
  const location = useLocation();

  return (
    <div className="min-h-screen bg-dark-900 text-gray-100 font-sans">
      <nav className="sticky top-0 z-40 bg-dark-900/80 backdrop-blur-md border-b border-dark-700">
        <div className="max-w-6xl mx-auto px-4 flex items-center justify-between h-16">
          <Link to="/" className="flex items-center gap-2"><div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center"><i className="fas fa-bolt text-white"></i></div><span className="font-bold text-xl tracking-tight text-white">DigiStore</span></Link>
          <div className="flex items-center gap-4">
             <div className="hidden md:flex items-center gap-6 mr-4"><Link to="/" className="text-gray-300 hover:text-white">Produk</Link><Link to="/categories" className="text-gray-300 hover:text-white">Kategori</Link></div>
            <Link to="/cart" className="relative p-2 text-gray-300 hover:text-white"><i className="fas fa-shopping-cart text-xl"></i>{cart.length > 0 && <span className="absolute top-0 right-0 inline-flex items-center justify-center px-2 py-1 text-xs font-bold leading-none text-white transform translate-x-1/4 -translate-y-1/4 bg-red-500 rounded-full">{cart.length}</span>}</Link>
            {user ? <Link to="/account" className="hidden md:flex items-center gap-2 text-gray-300 hover:text-white"><i className="fas fa-user-circle text-xl"></i></Link> : <Link to="/login" className="hidden md:block bg-primary px-4 py-2 rounded-lg text-sm font-medium text-white">Login</Link>}
          </div>
        </div>
      </nav>
      <div className="min-h-screen">
        <Routes>
          <Route path="/" element={<CustomerHome />} />
          <Route path="/cart" element={<CustomerCart />} />
          <Route path="/categories" element={<CategoryView />} />
          <Route path="/account" element={<AccountView />} />
          <Route path="/affiliate" element={user?.role === 'AFFILIATE' ? <AffiliateDashboard /> : <Navigate to="/account" />} />
          <Route path="/history" element={<div className="p-10 text-center">Riwayat Pesanan (Fitur Mendatang)</div>} />
        </Routes>
      </div>
      
      {/* Footer / Mobile Nav */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-dark-800 border-t border-dark-700 pb-safe z-50">
        <div className="grid grid-cols-4 h-16">
          <Link to="/" className={`flex flex-col items-center justify-center w-full h-full ${location.pathname === '/' ? 'text-primary' : 'text-gray-400'}`}><i className="fas fa-store mb-1"></i><span className="text-[10px] font-medium">Toko</span></Link>
           <Link to="/categories" className={`flex flex-col items-center justify-center w-full h-full ${location.pathname === '/categories' ? 'text-primary' : 'text-gray-400'}`}><i className="fas fa-th-large mb-1"></i><span className="text-[10px] font-medium">Kategori</span></Link>
           <Link to="/history" className={`flex flex-col items-center justify-center w-full h-full ${location.pathname === '/history' ? 'text-primary' : 'text-gray-400'}`}><i className="fas fa-history mb-1"></i><span className="text-[10px] font-medium">Riwayat</span></Link>
          <Link to="/account" className={`flex flex-col items-center justify-center w-full h-full ${location.pathname.startsWith('/account') ? 'text-primary' : 'text-gray-400'}`}><i className="fas fa-user mb-1"></i><span className="text-[10px] font-medium">Akun</span></Link>
        </div>
        <div className="text-[10px] text-center pb-2 bg-dark-800 opacity-50 flex justify-center gap-2">
            {isCloudConnected ? <span className="text-green-500">● Cloud Connected</span> : <span>○ Local Mode</span>}
            <span className="text-gray-500">| Loaded: {debugDataCount} items</span>
        </div>
      </div>
      
      {/* Desktop Footer Status */}
      <div className="hidden md:block fixed bottom-4 right-4 z-50">
         <div className={`px-3 py-1 rounded-full text-xs font-bold border shadow-lg ${isCloudConnected ? 'bg-green-500/10 text-green-400 border-green-500/30' : 'bg-gray-800 text-gray-400 border-gray-700'}`}>
              {isCloudConnected ? '● Cloud Connected' : '○ Local Mode'} | Items: {debugDataCount}
          </div>
      </div>
    </div>
  );
};

const AdminLayout: React.FC = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('dashboard');
  const { logout } = useAppContext();
  const navigate = useNavigate();

  return (
    <div className="flex h-screen bg-dark-900 text-gray-100 overflow-hidden">
      <AdminSidebar isOpen={sidebarOpen} setIsOpen={setSidebarOpen} activeTab={activeTab} setActiveTab={setActiveTab} onLogout={() => { logout(); navigate('/login'); }} />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="md:hidden flex items-center justify-between bg-dark-800 p-4 border-b border-dark-700"><button onClick={() => setSidebarOpen(true)} className="text-gray-300"><i className="fas fa-bars text-xl"></i></button><span className="font-bold text-white">Admin Panel</span><div className="w-6"></div></header>
        <main className="flex-1 overflow-y-auto bg-dark-900 relative">
          {activeTab === 'dashboard' && <AdminDashboard />}
          {activeTab === 'products' && <AdminProducts />}
          {activeTab === 'vouchers' && <AdminVouchers />}
          {activeTab === 'affiliates' && <AdminAffiliates />}
          {activeTab === 'settings' && <AdminSettings />}
          {activeTab === 'database' && <AdminDatabase />}
        </main>
      </div>
    </div>
  );
};

const Login: React.FC = () => {
  const { login, affiliates } = useAppContext();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const navigate = useNavigate();

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (username === 'admin' && password === 'admin') {
      login('ADMIN', 'Admin User');
      navigate('/admin');
    } else {
      // Check for affiliate login
      const affiliate = affiliates.find(a => a.code === username.toUpperCase() && a.password === password);
      if (affiliate) {
        if (!affiliate.isActive) return alert("Akun affiliate non-aktif.");
        login('AFFILIATE', affiliate.name, affiliate.id);
        navigate('/account');
        return;
      }

      // Default customer logic
      if (username && password) {
        login('CUSTOMER', username);
        navigate('/');
      } else {
        alert('Login Gagal. Cek username/password.');
      }
    }
  };

  return (
    <div className="min-h-screen bg-dark-900 flex items-center justify-center p-4">
      <div className="bg-dark-800 p-8 rounded-2xl shadow-2xl border border-dark-700 w-full max-w-md">
        <div className="text-center mb-8"><div className="w-16 h-16 bg-primary rounded-xl mx-auto flex items-center justify-center mb-4 shadow-lg"><i className="fas fa-bolt text-3xl text-white"></i></div><h1 className="text-2xl font-bold text-white">DigiStore Login</h1></div>
        <form onSubmit={handleLogin} className="space-y-6">
          <div><label className="block text-sm text-gray-400 mb-1">Username / Kode Affiliate</label><input type="text" value={username} onChange={e => setUsername(e.target.value)} className="w-full bg-dark-900 border border-dark-700 rounded-lg px-4 py-3 text-white" /></div>
          <div><label className="block text-sm text-gray-400 mb-1">Password</label><input type="password" value={password} onChange={e => setPassword(e.target.value)} className="w-full bg-dark-900 border border-dark-700 rounded-lg px-4 py-3 text-white" /></div>
          <button type="submit" className="w-full bg-primary hover:bg-indigo-600 text-white font-bold py-3 rounded-xl shadow-lg">Masuk</button>
        </form>
        <div className="mt-6 text-center"><Link to="/" className="text-gray-500 hover:text-white text-sm">Kembali ke Toko</Link></div>
      </div>
    </div>
  );
};

const AppContent: React.FC = () => {
  const { user } = useAppContext();
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/admin/*" element={user?.role === 'ADMIN' ? <AdminLayout /> : <Navigate to="/login" />} />
      <Route path="/*" element={<CustomerLayout />} />
    </Routes>
  );
};

export default function App() {
  const [settings, setSettings] = useState<StoreSettings>(DataService.getSettings());
  const [products, setProducts] = useState<Product[]>(DataService.getProducts());
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>(DataService.getPayments());
  const [vouchers, setVouchers] = useState<Voucher[]>(DataService.getVouchers());
  const [affiliates, setAffiliates] = useState<Affiliate[]>(DataService.getAffiliates());
  const [cart, setCart] = useState<CartItem[]>([]);
  const [user, setUser] = useState<User | null>(null);
  const [referralCode, setReferralCode] = useState<string | null>(null);
  const [isCloudConnected, setIsCloudConnected] = useState(false);
  const [debugDataCount, setDebugDataCount] = useState(0);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // Initialize Supabase Client if credentials exist
  const supabase = useMemo(() => {
    if (settings.supabaseUrl && settings.supabaseKey) {
      try {
        return createClient(settings.supabaseUrl, settings.supabaseKey);
      } catch (e) {
        console.error("Supabase Init Failed:", e);
        return null;
      }
    }
    return null;
  }, [settings.supabaseUrl, settings.supabaseKey]);

  // Initial Sync from Supabase
  useEffect(() => {
    if (!supabase) return;

    const fetchData = async () => {
      console.log("Fetching from Supabase...");
      setFetchError(null);
      try {
          const { data: prodData, error: prodErr } = await supabase.from('products').select('*');
          if (prodErr) throw prodErr;
          
          // Always use cloud data if connected, even if empty, to ensure sync
          if (prodData) {
            const mappedProducts: Product[] = prodData.map((p: any) => ({
              id: p.id, name: p.name, category: p.category, description: p.description, price: Number(p.price),
              discountPrice: p.discount_price ? Number(p.discount_price) : undefined,
              image: p.image, fileUrl: p.file_url, isPopular: p.is_popular
            }));
            setProducts(mappedProducts);
            DataService.saveProducts(mappedProducts); // Force save local
            setDebugDataCount(mappedProducts.length);
          }

          const { data: vouchData, error: vouchErr } = await supabase.from('vouchers').select('*');
          if (vouchErr) throw vouchErr;
          if (vouchData) {
            const mappedVouchers: Voucher[] = vouchData.map((v: any) => ({
              id: v.id, code: v.code, type: v.type, value: Number(v.value), isActive: v.is_active
            }));
            setVouchers(mappedVouchers);
            DataService.saveVouchers(mappedVouchers);
          }
          
          const { data: affData, error: affErr } = await supabase.from('affiliates').select('*');
          if (affErr) throw affErr;
          if (affData) {
            const mappedAff: Affiliate[] = affData.map((a: any) => ({
              id: a.id, name: a.name, code: a.code, password: a.password,
              commissionRate: Number(a.commission_rate), totalEarnings: Number(a.total_earnings),
              bankDetails: a.bank_details, isActive: a.is_active
            }));
            setAffiliates(mappedAff);
            DataService.saveAffiliates(mappedAff);
          }

          const { data: settingsData } = await supabase.from('store_settings').select('*').single();
          // No error throw here as settings might be empty initially
          if (settingsData) {
             const newSettings: StoreSettings = {
                ...settings, // Keep existing credentials if any
                storeName: settingsData.store_name,
                address: settingsData.address,
                whatsapp: settingsData.whatsapp,
                email: settingsData.email,
                description: settingsData.description,
                logoUrl: settingsData.logo_url,
                tripayApiKey: settingsData.tripay_api_key,
                tripayPrivateKey: settingsData.tripay_private_key,
                tripayMerchantCode: settingsData.tripay_merchant_code
             };
             setSettings(newSettings);
             DataService.saveSettings(newSettings);
          }

          const { data: payData, error: payErr } = await supabase.from('payment_methods').select('*');
          if (payErr) throw payErr;
          if (payData && payData.length > 0) {
              const mappedPayments: PaymentMethod[] = payData.map((p: any) => ({
                  id: p.id, type: p.type, name: p.name, accountNumber: p.account_number,
                  accountName: p.account_name, description: p.description, logo: p.logo, isActive: p.is_active
              }));
              setPaymentMethods(mappedPayments);
              DataService.savePayments(mappedPayments);
          }
          
          setIsCloudConnected(true);
      } catch (err: any) {
          console.error("Supabase Fetch Error:", err);
          setFetchError(err.message || "Unknown error");
          // If RLS error, user needs to run SQL schema
      }
    };

    fetchData();
  }, [supabase]);

  // Sync TO Supabase (Upsert logic) - Note: Only Products/Settings etc are auto-synced locally. Cloud sync is manual via AdminDatabase.
  // We keep local sync here:
  useEffect(() => { DataService.saveSettings(settings); }, [settings]);
  useEffect(() => { DataService.saveProducts(products); }, [products]);
  useEffect(() => { DataService.savePayments(paymentMethods); }, [paymentMethods]);
  useEffect(() => { DataService.saveVouchers(vouchers); }, [vouchers]);
  useEffect(() => { DataService.saveAffiliates(affiliates); }, [affiliates]);

  const addToCart = (product: Product) => {
    setCart(prev => {
      const existing = prev.find(p => p.id === product.id);
      return existing ? prev.map(p => p.id === product.id ? { ...p, quantity: p.quantity + 1 } : p) : [...prev, { ...product, quantity: 1 }];
    });
  };

  const resetLocalData = () => {
      localStorage.clear();
      window.location.reload();
  };

  const login = (role: 'ADMIN' | 'CUSTOMER' | 'AFFILIATE', name: string, id?: string) => setUser({ role, name, id });

  return (
    <AppContext.Provider value={{
      settings, updateSettings: setSettings,
      products, updateProducts: setProducts,
      vouchers, updateVouchers: setVouchers,
      affiliates, updateAffiliates: setAffiliates,
      cart, addToCart, removeFromCart: (id) => setCart(p => p.filter(x => x.id !== id)), clearCart: () => setCart([]),
      user, login, logout: () => setUser(null),
      paymentMethods, updatePayments: setPaymentMethods,
      referralCode, setReferralCode,
      supabase,
      isCloudConnected,
      debugDataCount,
      resetLocalData,
      fetchError
    }}>
      <Router>
        <AppContent />
      </Router>
    </AppContext.Provider>
  );
}
