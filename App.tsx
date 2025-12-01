import React, { useState, useEffect, useMemo } from 'react';
import { HashRouter as Router, Routes, Route, Navigate, Link, useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { Product, StoreSettings, CartItem, PaymentMethod, User } from './types';
import { DataService } from './services/dataService';
import AdminSidebar from './components/AdminSidebar';

// --- Constants ---

const SUPABASE_SCHEMA = `-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- Create Products Table
create table if not exists products (
  id uuid default uuid_generate_v4() primary key,
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
  id uuid default uuid_generate_v4() primary key,
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
  id uuid default uuid_generate_v4() primary key,
  type text not null,
  name text not null,
  account_number text,
  account_name text,
  description text,
  logo text,
  is_active boolean default true,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Create Orders Table
create table if not exists orders (
  id uuid default uuid_generate_v4() primary key,
  customer_name text,
  customer_whatsapp text,
  total numeric not null,
  payment_method text,
  status text default 'PENDING',
  items jsonb,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS
alter table products enable row level security;
alter table store_settings enable row level security;
alter table payment_methods enable row level security;
alter table orders enable row level security;

-- Create Policies (Open access for simplicity in this demo, adjust for production)
create policy "Public Access Products" on products for all using (true);
create policy "Public Access Settings" on store_settings for all using (true);
create policy "Public Access Payments" on payment_methods for all using (true);
create policy "Public Access Orders" on orders for all using (true);

-- Initial Data
insert into store_settings (store_name, address, whatsapp, email, description)
values ('DigiStore Pro', 'Jl. Digital No. 1', '6281234567890', 'admin@digistore.com', 'Toko produk digital terpercaya.');
`;

// --- Context & State ---

const AppContext = React.createContext<{
  settings: StoreSettings;
  updateSettings: (s: StoreSettings) => void;
  products: Product[];
  updateProducts: (p: Product[]) => void;
  cart: CartItem[];
  addToCart: (p: Product) => void;
  removeFromCart: (id: string) => void;
  clearCart: () => void;
  user: User | null;
  login: (role: 'ADMIN' | 'CUSTOMER', name: string) => void;
  logout: () => void;
  paymentMethods: PaymentMethod[];
  updatePayments: (p: PaymentMethod[]) => void;
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
  const { products, settings } = useAppContext();
  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold text-white mb-6">Dashboard</h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
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
          Gunakan sidebar di sebelah kiri untuk mengelola produk, pengaturan toko, dan koneksi database.
          Aplikasi ini saat ini menggunakan LocalStorage untuk simulasi database. Untuk menggunakan Supabase, silakan konfigurasi di menu Database.
        </p>
      </div>
    </div>
  );
};

const AdminProducts: React.FC = () => {
  const { products, updateProducts } = useAppContext();
  const [isEditing, setIsEditing] = useState(false);
  const [currentProduct, setCurrentProduct] = useState<Partial<Product>>({});

  const handleSave = () => {
    if (!currentProduct.name || !currentProduct.price) return alert("Nama dan Harga wajib diisi");
    
    let newProducts = [...products];
    if (currentProduct.id) {
      // Edit
      newProducts = newProducts.map(p => p.id === currentProduct.id ? { ...p, ...currentProduct } as Product : p);
    } else {
      // Add
      const newId = Date.now().toString();
      const productToAdd: Product = {
        id: newId,
        name: currentProduct.name!,
        price: Number(currentProduct.price),
        description: currentProduct.description || '',
        category: currentProduct.category || 'General',
        image: currentProduct.image || `https://picsum.photos/400/400?random=${newId}`,
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

  // Convert file to Base64
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, field: 'image' | 'fileUrl') => {
    const file = e.target.files?.[0];
    if (file) {
      // Limit file size for localstorage demo purposes (limit 2MB)
      if (file.size > 2 * 1024 * 1024) {
        alert("File terlalu besar! Maksimal 2MB untuk demo ini.");
        return;
      }

      const reader = new FileReader();
      reader.onloadend = () => {
        setCurrentProduct(prev => ({ ...prev, [field]: reader.result as string }));
      };
      reader.readAsDataURL(file);
    }
  };

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
                <button 
                  onClick={() => { setCurrentProduct(p); setIsEditing(true); }}
                  className="text-blue-400 hover:text-blue-300"
                >
                  <i className="fas fa-edit"></i>
                </button>
                <button 
                  onClick={() => handleDelete(p.id)}
                  className="text-red-400 hover:text-red-300"
                >
                  <i className="fas fa-trash"></i>
                </button>
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
                <input 
                  type="text" 
                  value={currentProduct.name || ''} 
                  onChange={e => setCurrentProduct({...currentProduct, name: e.target.value})}
                  className="w-full bg-dark-900 border border-dark-700 rounded-lg px-4 py-2 text-white focus:border-primary focus:outline-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Kategori</label>
                  <input 
                    type="text" 
                    list="categories"
                    value={currentProduct.category || ''} 
                    onChange={e => setCurrentProduct({...currentProduct, category: e.target.value})}
                    className="w-full bg-dark-900 border border-dark-700 rounded-lg px-4 py-2 text-white focus:border-primary focus:outline-none"
                  />
                  <datalist id="categories">
                    <option value="Software" />
                    <option value="E-book" />
                    <option value="Course" />
                    <option value="Template" />
                  </datalist>
                </div>
                 <div>
                  <label className="block text-sm text-gray-400 mb-1">Gambar Produk</label>
                  <input 
                    type="file"
                    accept="image/*"
                    onChange={(e) => handleFileUpload(e, 'image')}
                    className="block w-full text-sm text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary file:text-white hover:file:bg-indigo-600 mb-2"
                  />
                  <input 
                    type="text" 
                    value={currentProduct.image || ''} 
                    onChange={e => setCurrentProduct({...currentProduct, image: e.target.value})}
                    placeholder="atau paste URL gambar..."
                    className="w-full bg-dark-900 border border-dark-700 rounded-lg px-4 py-2 text-white focus:border-primary focus:outline-none text-xs"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                 <div>
                  <label className="block text-sm text-gray-400 mb-1">Harga Normal</label>
                  <input 
                    type="number" 
                    value={currentProduct.price || ''} 
                    onChange={e => setCurrentProduct({...currentProduct, price: Number(e.target.value)})}
                    className="w-full bg-dark-900 border border-dark-700 rounded-lg px-4 py-2 text-white focus:border-primary focus:outline-none"
                  />
                </div>
                 <div>
                  <label className="block text-sm text-gray-400 mb-1">Harga Diskon (Opsional)</label>
                  <input 
                    type="number" 
                    value={currentProduct.discountPrice || ''} 
                    onChange={e => setCurrentProduct({...currentProduct, discountPrice: Number(e.target.value)})}
                    className="w-full bg-dark-900 border border-dark-700 rounded-lg px-4 py-2 text-white focus:border-primary focus:outline-none"
                  />
                </div>
              </div>
               <div>
                  <label className="block text-sm text-gray-400 mb-1">Deskripsi</label>
                  <textarea 
                    value={currentProduct.description || ''} 
                    onChange={e => setCurrentProduct({...currentProduct, description: e.target.value})}
                    rows={3}
                    className="w-full bg-dark-900 border border-dark-700 rounded-lg px-4 py-2 text-white focus:border-primary focus:outline-none"
                  />
              </div>
              <div>
                  <label className="block text-sm text-gray-400 mb-1">File Produk Digital</label>
                  <input 
                    type="file"
                    onChange={(e) => handleFileUpload(e, 'fileUrl')}
                    className="block w-full text-sm text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-secondary file:text-white hover:file:bg-purple-600 mb-2"
                  />
                  <input 
                    type="text" 
                    value={currentProduct.fileUrl || ''} 
                    onChange={e => setCurrentProduct({...currentProduct, fileUrl: e.target.value})}
                    placeholder="atau paste Link Google Drive / Dropbox..."
                    className="w-full bg-dark-900 border border-dark-700 rounded-lg px-4 py-2 text-white focus:border-primary focus:outline-none"
                  />
                  <p className="text-[10px] text-gray-500 mt-1">*Upload file akan dikonversi ke Base64 (untuk demo). Gunakan Link untuk file besar.</p>
              </div>
            </div>
            <div className="flex justify-end gap-4 mt-6">
              <button 
                onClick={() => setIsEditing(false)}
                className="px-4 py-2 rounded-lg text-gray-400 hover:text-white hover:bg-dark-700"
              >
                Batal
              </button>
              <button 
                onClick={handleSave}
                className="px-6 py-2 rounded-lg bg-primary hover:bg-indigo-600 text-white font-medium"
              >
                Simpan
              </button>
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

  // Sync state if context changes externally (rare here but good practice)
  useEffect(() => { setFormData(settings); }, [settings]);

  const handleSave = () => {
    updateSettings(formData);
    alert('Pengaturan berhasil disimpan!');
  };

  const handlePaymentToggle = (id: string) => {
    // In a real app we might toggle an 'isActive' boolean. 
    // Here we just mock editing functionality requirements.
    alert("Untuk demo ini, metode pembayaran dikelola via kode/state awal.");
  };

  return (
    <div className="p-6 pb-24 max-w-4xl mx-auto">
      <h2 className="text-2xl font-bold text-white mb-6">Pengaturan Toko</h2>
      
      <div className="space-y-8">
        {/* General Info */}
        <div className="bg-dark-800 p-6 rounded-xl border border-dark-700">
          <h3 className="text-lg font-bold text-white mb-4 border-b border-dark-700 pb-2">Informasi Umum</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1">Nama Toko</label>
              <input 
                value={formData.storeName}
                onChange={e => setFormData({...formData, storeName: e.target.value})}
                className="w-full bg-dark-900 border border-dark-700 rounded-lg px-4 py-2 text-white focus:border-primary focus:outline-none"
              />
            </div>
             <div>
              <label className="block text-sm text-gray-400 mb-1">No. WhatsApp (format: 628...)</label>
              <input 
                value={formData.whatsapp}
                onChange={e => setFormData({...formData, whatsapp: e.target.value})}
                className="w-full bg-dark-900 border border-dark-700 rounded-lg px-4 py-2 text-white focus:border-primary focus:outline-none"
              />
            </div>
             <div className="md:col-span-2">
              <label className="block text-sm text-gray-400 mb-1">Alamat</label>
              <input 
                value={formData.address}
                onChange={e => setFormData({...formData, address: e.target.value})}
                className="w-full bg-dark-900 border border-dark-700 rounded-lg px-4 py-2 text-white focus:border-primary focus:outline-none"
              />
            </div>
             <div className="md:col-span-2">
              <label className="block text-sm text-gray-400 mb-1">Deskripsi Toko</label>
              <textarea 
                value={formData.description}
                onChange={e => setFormData({...formData, description: e.target.value})}
                className="w-full bg-dark-900 border border-dark-700 rounded-lg px-4 py-2 text-white focus:border-primary focus:outline-none"
              />
            </div>
          </div>
        </div>

        {/* Payment Methods Display */}
        <div className="bg-dark-800 p-6 rounded-xl border border-dark-700">
           <h3 className="text-lg font-bold text-white mb-4 border-b border-dark-700 pb-2">Metode Pembayaran Aktif</h3>
           <div className="space-y-3">
             {paymentMethods.map(pm => (
               <div key={pm.id} className="flex items-center justify-between bg-dark-900 p-3 rounded-lg">
                 <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-white rounded flex items-center justify-center p-1">
                      {pm.logo ? <img src={pm.logo} alt={pm.name} className="max-w-full max-h-full" /> : <i className="fas fa-money-bill text-dark-900"></i>}
                    </div>
                    <div>
                      <p className="font-medium text-white">{pm.name}</p>
                      <p className="text-xs text-gray-400">{pm.type} - {pm.accountNumber || 'Auto'}</p>
                    </div>
                 </div>
                 <button onClick={() => handlePaymentToggle(pm.id)} className="text-gray-400 hover:text-white">
                   <i className="fas fa-cog"></i>
                 </button>
               </div>
             ))}
             <div className="mt-4 text-xs text-gray-500 italic">
               *Tripay configuration is located in the Database & API section.
             </div>
           </div>
        </div>

        <button onClick={handleSave} className="w-full bg-primary hover:bg-indigo-600 text-white font-bold py-3 rounded-xl transition-colors">
          Simpan Perubahan
        </button>
      </div>
    </div>
  );
};

const AdminDatabase: React.FC = () => {
  const { settings, updateSettings } = useAppContext();
  const [formData, setFormData] = useState(settings);
  const [showSql, setShowSql] = useState(false);

  const handleSave = () => {
    updateSettings(formData);
    alert('Konfigurasi API disimpan.');
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(SUPABASE_SCHEMA);
    alert("Kode SQL berhasil disalin! Silakan paste di Supabase SQL Editor.");
  };

  return (
    <div className="p-6 pb-24 max-w-4xl mx-auto">
       <h2 className="text-2xl font-bold text-white mb-6">Database & API Configuration</h2>
       
       <div className="space-y-6">
          <div className="bg-dark-800 p-6 rounded-xl border border-dark-700">
            <h3 className="text-lg font-bold text-green-400 mb-4 flex items-center gap-2">
              <i className="fas fa-database"></i> Supabase Integration
            </h3>
            <p className="text-sm text-gray-400 mb-4">
              Masukkan kredensial Supabase Anda di sini. Jika kosong, aplikasi akan menggunakan LocalStorage browser.
            </p>
            <div className="space-y-4">
               <div>
                <label className="block text-sm text-gray-400 mb-1">Supabase URL</label>
                <input 
                  type="password"
                  value={formData.supabaseUrl || ''}
                  onChange={e => setFormData({...formData, supabaseUrl: e.target.value})}
                  className="w-full bg-dark-900 border border-dark-700 rounded-lg px-4 py-2 text-white focus:border-primary focus:outline-none"
                />
              </div>
               <div>
                <label className="block text-sm text-gray-400 mb-1">Supabase Anon Key</label>
                <input 
                  type="password"
                  value={formData.supabaseKey || ''}
                  onChange={e => setFormData({...formData, supabaseKey: e.target.value})}
                  className="w-full bg-dark-900 border border-dark-700 rounded-lg px-4 py-2 text-white focus:border-primary focus:outline-none"
                />
              </div>

              {/* SQL Injection Area */}
              <div className="mt-6 pt-6 border-t border-dark-700">
                <button 
                  onClick={() => setShowSql(!showSql)}
                  className="text-sm text-primary hover:text-white flex items-center gap-2 font-medium"
                >
                  <i className={`fas fa-chevron-${showSql ? 'up' : 'down'}`}></i>
                  {showSql ? 'Sembunyikan Schema SQL' : 'Tampilkan Schema SQL untuk Setup Tabel'}
                </button>
                
                {showSql && (
                    <div className="mt-4 relative">
                        <div className="absolute top-2 right-2">
                             <button 
                                onClick={copyToClipboard}
                                className="bg-primary hover:bg-indigo-600 text-white px-3 py-1 rounded text-xs font-bold"
                            >
                                <i className="fas fa-copy mr-1"></i> Copy SQL
                            </button>
                        </div>
                        <textarea 
                            readOnly
                            value={SUPABASE_SCHEMA}
                            className="w-full h-80 bg-dark-900 border border-dark-700 rounded-lg p-4 text-xs font-mono text-gray-300 focus:outline-none focus:border-primary"
                        />
                        <p className="text-[10px] text-gray-500 mt-2">
                            <i className="fas fa-info-circle mr-1"></i>
                            Panduan: Copy kode di atas, buka <a href="https://supabase.com/dashboard" target="_blank" className="text-primary hover:underline">Supabase Dashboard</a> &gt; Pilih Project &gt; SQL Editor &gt; Paste & Run.
                        </p>
                    </div>
                )}
              </div>
            </div>
          </div>

          <div className="bg-dark-800 p-6 rounded-xl border border-dark-700">
            <h3 className="text-lg font-bold text-orange-400 mb-4 flex items-center gap-2">
              <i className="fas fa-credit-card"></i> Tripay Payment Gateway
            </h3>
            <p className="text-sm text-gray-400 mb-4">
              Konfigurasi Tripay untuk pembayaran otomatis. Pastikan menggunakan mode Production untuk live.
            </p>
            <div className="space-y-4">
               <div>
                <label className="block text-sm text-gray-400 mb-1">API Key</label>
                <input 
                  type="password"
                  value={formData.tripayApiKey || ''}
                  onChange={e => setFormData({...formData, tripayApiKey: e.target.value})}
                  className="w-full bg-dark-900 border border-dark-700 rounded-lg px-4 py-2 text-white focus:border-primary focus:outline-none"
                />
              </div>
               <div>
                <label className="block text-sm text-gray-400 mb-1">Private Key</label>
                <input 
                  type="password"
                  value={formData.tripayPrivateKey || ''}
                  onChange={e => setFormData({...formData, tripayPrivateKey: e.target.value})}
                  className="w-full bg-dark-900 border border-dark-700 rounded-lg px-4 py-2 text-white focus:border-primary focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Merchant Code</label>
                <input 
                  type="text"
                  value={formData.tripayMerchantCode || ''}
                  onChange={e => setFormData({...formData, tripayMerchantCode: e.target.value})}
                  className="w-full bg-dark-900 border border-dark-700 rounded-lg px-4 py-2 text-white focus:border-primary focus:outline-none"
                />
              </div>
            </div>
          </div>

          <button onClick={handleSave} className="w-full bg-primary hover:bg-indigo-600 text-white font-bold py-3 rounded-xl transition-colors">
            Simpan Konfigurasi
          </button>
       </div>
    </div>
  );
};

// --- Customer Views ---

const CustomerHome: React.FC = () => {
  const { products, settings, addToCart } = useAppContext();
  const [searchParams] = useSearchParams();
  const [categoryFilter, setCategoryFilter] = useState('All');

  // Sync with URL param if present
  useEffect(() => {
    const cat = searchParams.get('category');
    if (cat) {
      setCategoryFilter(cat);
      // Scroll to products if category is set via URL
      setTimeout(() => document.getElementById('products')?.scrollIntoView({ behavior: 'smooth'}), 100);
    }
  }, [searchParams]);

  const categories = ['All', ...Array.from(new Set(products.map(p => p.category)))];
  const filteredProducts = categoryFilter === 'All' 
    ? products 
    : products.filter(p => p.category === categoryFilter);

  return (
    <div className="pb-20">
      {/* Hero Section */}
      <div className="relative bg-dark-800 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-primary/20 to-secondary/20 z-0"></div>
        <div className="max-w-6xl mx-auto px-6 py-16 relative z-10 text-center md:text-left md:flex items-center justify-between">
          <div className="mb-8 md:mb-0">
            <h1 className="text-4xl md:text-5xl font-extrabold text-white mb-4 leading-tight">
              Produk Digital Terbaik <br/><span className="text-primary">Untuk Kebutuhanmu</span>
            </h1>
            <p className="text-gray-300 text-lg mb-6 max-w-xl">
              {settings.description}
            </p>
            <button 
              onClick={() => document.getElementById('products')?.scrollIntoView({ behavior: 'smooth'})}
              className="bg-primary hover:bg-indigo-600 text-white px-8 py-3 rounded-full font-bold transition-all transform hover:scale-105"
            >
              Belanja Sekarang
            </button>
          </div>
          <div className="hidden md:block">
            <i className="fas fa-rocket text-9xl text-white/10 transform rotate-12"></i>
          </div>
        </div>
      </div>

      {/* Categories */}
      <div className="max-w-6xl mx-auto px-6 py-8 overflow-x-auto no-scrollbar">
        <div className="flex space-x-4">
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => setCategoryFilter(cat)}
              className={`px-6 py-2 rounded-full border whitespace-nowrap transition-colors ${
                categoryFilter === cat 
                  ? 'bg-primary border-primary text-white' 
                  : 'bg-dark-800 border-dark-700 text-gray-400 hover:bg-dark-700'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Products Grid */}
      <div id="products" className="max-w-6xl mx-auto px-6 mb-12">
        <h2 className="text-2xl font-bold text-white mb-6">Produk Terbaru</h2>
        {filteredProducts.length === 0 ? (
          <div className="text-center py-20 text-gray-500">Tidak ada produk ditemukan.</div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {filteredProducts.map(p => (
              <ProductCard key={p.id} product={p} onAdd={() => {
                addToCart(p);
                alert("Produk ditambahkan ke keranjang!");
              }} />
            ))}
          </div>
        )}
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
          <Link 
            to={`/?category=${cat}`} 
            key={idx}
            className="aspect-square bg-dark-800 rounded-xl border border-dark-700 flex flex-col items-center justify-center hover:bg-dark-700 hover:border-primary transition-all group"
          >
            <div className="w-16 h-16 bg-primary/20 rounded-full flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
               <i className="fas fa-folder text-2xl text-primary"></i>
            </div>
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

  if (!user) {
    return <Navigate to="/login" />;
  }

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <div className="max-w-md mx-auto p-6 pb-24">
      <div className="bg-dark-800 rounded-xl border border-dark-700 p-6 text-center">
        <div className="w-24 h-24 bg-primary rounded-full mx-auto flex items-center justify-center mb-4">
          <i className="fas fa-user text-4xl text-white"></i>
        </div>
        <h2 className="text-2xl font-bold text-white mb-1">{user.name}</h2>
        <p className="text-primary text-sm font-semibold mb-6 uppercase">{user.role}</p>

        <div className="space-y-3">
          {user.role === 'ADMIN' && (
            <Link to="/admin" className="block w-full bg-dark-700 hover:bg-dark-600 text-white py-3 rounded-xl border border-dark-600">
              <i className="fas fa-cogs mr-2"></i> Ke Panel Admin
            </Link>
          )}
          
          <button 
            onClick={handleLogout}
            className="block w-full bg-red-500/10 hover:bg-red-500/20 text-red-500 py-3 rounded-xl border border-red-500/20"
          >
            <i className="fas fa-sign-out-alt mr-2"></i> Keluar
          </button>
        </div>
      </div>
      
      <div className="mt-6 text-center text-gray-500 text-sm">
        <p>Versi Aplikasi v1.0.0</p>
      </div>
    </div>
  );
};

const CustomerCart: React.FC = () => {
  const { cart, removeFromCart, clearCart, settings, paymentMethods } = useAppContext();
  const [selectedPayment, setSelectedPayment] = useState<string>('');
  const navigate = useNavigate();

  const total = cart.reduce((sum, item) => {
    const price = item.discountPrice || item.price;
    return sum + (price * item.quantity);
  }, 0);

  const handleCheckout = () => {
    if (!selectedPayment) return alert('Pilih metode pembayaran terlebih dahulu');
    if (cart.length === 0) return alert('Keranjang kosong');

    const paymentMethod = paymentMethods.find(p => p.id === selectedPayment);
    
    // Logic for Tripay (Simulated)
    if (paymentMethod?.type === 'TRIPAY') {
      alert(`[TRIPAY SIMULATION]\nRedirecting to Tripay Payment Gateway...\nAPI Key: ${settings.tripayApiKey ? 'CONFIGURED' : 'MISSING'}`);
      clearCart();
      navigate('/');
      return;
    }

    // Logic for WhatsApp
    let message = `Halo *${settings.storeName}*, saya ingin memesan:\n\n`;
    cart.forEach((item, idx) => {
      message += `${idx + 1}. ${item.name} x${item.quantity} - Rp ${(item.discountPrice || item.price).toLocaleString()}\n`;
    });
    message += `\n*Total: Rp ${total.toLocaleString()}*`;
    message += `\nMetode Pembayaran: ${paymentMethod?.name}`;
    message += `\n\nMohon diproses, terima kasih.`;

    const encodedMessage = encodeURIComponent(message);
    window.open(`https://wa.me/${settings.whatsapp}?text=${encodedMessage}`, '_blank');
    
    clearCart();
    navigate('/');
  };

  const getQRCodeUrl = (data: string) => {
     return `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(data)}`;
  };

  if (cart.length === 0) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center">
        <i className="fas fa-shopping-cart text-6xl text-dark-700 mb-4"></i>
        <h2 className="text-xl font-bold text-white mb-2">Keranjang Kosong</h2>
        <Link to="/" className="text-primary hover:underline">Kembali Belanja</Link>
      </div>
    );
  }

  const selectedPaymentDetails = paymentMethods.find(p => p.id === selectedPayment);

  return (
    <div className="max-w-2xl mx-auto p-6 pb-24">
      <h1 className="text-2xl font-bold text-white mb-6">Checkout</h1>
      
      {/* Items */}
      <div className="bg-dark-800 rounded-xl overflow-hidden mb-6 border border-dark-700">
        {cart.map(item => (
          <div key={item.id} className="flex items-center gap-4 p-4 border-b border-dark-700 last:border-0">
            <img src={item.image} alt={item.name} className="w-16 h-16 object-cover rounded" />
            <div className="flex-1">
              <h4 className="font-bold text-white text-sm">{item.name}</h4>
              <p className="text-primary text-sm font-semibold">
                Rp {(item.discountPrice || item.price).toLocaleString()} x {item.quantity}
              </p>
            </div>
            <button onClick={() => removeFromCart(item.id)} className="text-red-400 p-2">
              <i className="fas fa-trash"></i>
            </button>
          </div>
        ))}
        <div className="p-4 bg-dark-900 flex justify-between items-center">
          <span className="text-gray-400">Total Pembayaran</span>
          <span className="text-xl font-bold text-white">Rp {total.toLocaleString()}</span>
        </div>
      </div>

      {/* Payment Selection */}
      <h2 className="text-lg font-bold text-white mb-3">Pilih Pembayaran</h2>
      <div className="grid gap-3 mb-6">
        {paymentMethods.map(pm => (
          <div 
            key={pm.id}
            onClick={() => setSelectedPayment(pm.id)}
            className={`cursor-pointer p-4 rounded-xl border flex items-center justify-between transition-all ${
              selectedPayment === pm.id 
                ? 'bg-primary/20 border-primary' 
                : 'bg-dark-800 border-dark-700 hover:bg-dark-700'
            }`}
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 flex items-center justify-center bg-white rounded-full overflow-hidden">
                 {pm.logo ? <img src={pm.logo} className="w-full h-full object-contain" /> : <i className="fas fa-wallet text-black"></i>}
              </div>
              <span className="font-medium text-white">{pm.name}</span>
            </div>
            {selectedPayment === pm.id && <i className="fas fa-check-circle text-primary"></i>}
          </div>
        ))}
      </div>

      {/* QRIS / Account Detail View */}
      {selectedPaymentDetails && selectedPaymentDetails.type === 'QRIS' && (
        <div className="bg-white p-6 rounded-xl mb-6 flex flex-col items-center text-center">
          <h3 className="text-black font-bold mb-2">Scan QRIS</h3>
          <img src={getQRCodeUrl(`DIGISTORE-${total}`)} alt="QRIS" className="w-48 h-48 mb-2" />
          <p className="text-black text-sm">NMID: ID123456789</p>
        </div>
      )}

      {selectedPaymentDetails && selectedPaymentDetails.type === 'BANK' && (
        <div className="bg-dark-800 p-4 rounded-xl mb-6 border border-dark-700">
          <p className="text-gray-400 text-sm">Transfer ke:</p>
          <p className="text-white font-bold text-lg">{selectedPaymentDetails.name}</p>
          <p className="text-primary font-mono text-xl">{selectedPaymentDetails.accountNumber}</p>
          <p className="text-white text-sm">A.N {selectedPaymentDetails.accountName}</p>
        </div>
      )}

      <button 
        onClick={handleCheckout}
        className="w-full bg-green-500 hover:bg-green-600 text-white font-bold py-4 rounded-xl shadow-lg shadow-green-500/20 transition-all flex items-center justify-center gap-2"
      >
        <i className="fab fa-whatsapp text-xl"></i>
        {selectedPaymentDetails?.type === 'TRIPAY' ? 'Bayar via Tripay' : 'Konfirmasi via WhatsApp'}
      </button>
    </div>
  );
};

// --- Layouts ---

const CustomerLayout: React.FC = () => {
  const { cart, user } = useAppContext();
  const location = useLocation();

  return (
    <div className="min-h-screen bg-dark-900 text-gray-100 font-sans">
      {/* Navbar Desktop/Mobile Top */}
      <nav className="sticky top-0 z-40 bg-dark-900/80 backdrop-blur-md border-b border-dark-700">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <Link to="/" className="flex items-center gap-2">
              <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
                <i className="fas fa-bolt text-white"></i>
              </div>
              <span className="font-bold text-xl tracking-tight text-white">DigiStore</span>
            </Link>
            <div className="flex items-center gap-4">
               {/* Desktop Menu */}
               <div className="hidden md:flex items-center gap-6 mr-4">
                  <Link to="/" className="text-gray-300 hover:text-white transition-colors">Produk</Link>
                  <Link to="/categories" className="text-gray-300 hover:text-white transition-colors">Kategori</Link>
                  <Link to="/history" className="text-gray-300 hover:text-white transition-colors">Riwayat</Link>
               </div>

              <Link to="/cart" className="relative p-2 text-gray-300 hover:text-white transition-colors">
                <i className="fas fa-shopping-cart text-xl"></i>
                {cart.length > 0 && (
                  <span className="absolute top-0 right-0 inline-flex items-center justify-center px-2 py-1 text-xs font-bold leading-none text-white transform translate-x-1/4 -translate-y-1/4 bg-red-500 rounded-full">
                    {cart.length}
                  </span>
                )}
              </Link>
              
              {user ? (
                <Link to="/account" className="hidden md:flex items-center gap-2 text-gray-300 hover:text-white">
                  <i className="fas fa-user-circle text-xl"></i>
                </Link>
              ) : (
                <Link to="/login" className="hidden md:block bg-primary px-4 py-2 rounded-lg text-sm font-medium text-white hover:bg-indigo-600 transition-colors">
                  Login
                </Link>
              )}
            </div>
          </div>
        </div>
      </nav>

      {/* Content */}
      <div className="min-h-screen">
        <Routes>
          <Route path="/" element={<CustomerHome />} />
          <Route path="/cart" element={<CustomerCart />} />
          <Route path="/categories" element={<CategoryView />} />
          <Route path="/account" element={<AccountView />} />
          <Route path="/history" element={<div className="p-10 text-center">Riwayat Pesanan (Fitur Mendatang)</div>} />
        </Routes>
      </div>

      {/* Mobile Fixed Footer */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-dark-800 border-t border-dark-700 pb-safe z-50">
        <div className="grid grid-cols-4 h-16">
          <Link to="/" className={`flex flex-col items-center justify-center w-full h-full ${location.pathname === '/' ? 'text-primary' : 'text-gray-400'}`}>
            <i className="fas fa-store mb-1"></i>
            <span className="text-[10px] font-medium">Toko</span>
          </Link>
           <Link to="/categories" className={`flex flex-col items-center justify-center w-full h-full ${location.pathname === '/categories' ? 'text-primary' : 'text-gray-400'}`}>
            <i className="fas fa-th-large mb-1"></i>
            <span className="text-[10px] font-medium">Kategori</span>
          </Link>
           <Link to="/history" className={`flex flex-col items-center justify-center w-full h-full ${location.pathname === '/history' ? 'text-primary' : 'text-gray-400'}`}>
            <i className="fas fa-history mb-1"></i>
            <span className="text-[10px] font-medium">Riwayat</span>
          </Link>
          <Link to="/account" className={`flex flex-col items-center justify-center w-full h-full ${location.pathname.startsWith('/account') || location.pathname.startsWith('/admin') ? 'text-primary' : 'text-gray-400'}`}>
            <i className="fas fa-user mb-1"></i>
            <span className="text-[10px] font-medium">Akun</span>
          </Link>
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

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="flex h-screen bg-dark-900 text-gray-100 overflow-hidden">
      <AdminSidebar 
        isOpen={sidebarOpen} 
        setIsOpen={setSidebarOpen} 
        activeTab={activeTab} 
        setActiveTab={setActiveTab}
        onLogout={handleLogout}
      />
      
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Mobile Header */}
        <header className="md:hidden flex items-center justify-between bg-dark-800 p-4 border-b border-dark-700">
           <button onClick={() => setSidebarOpen(true)} className="text-gray-300">
             <i className="fas fa-bars text-xl"></i>
           </button>
           <span className="font-bold text-white">Admin Panel</span>
           <div className="w-6"></div> 
        </header>

        <main className="flex-1 overflow-y-auto bg-dark-900 relative">
          {activeTab === 'dashboard' && <AdminDashboard />}
          {activeTab === 'products' && <AdminProducts />}
          {activeTab === 'settings' && <AdminSettings />}
          {activeTab === 'database' && <AdminDatabase />}
        </main>
      </div>
    </div>
  );
};

const Login: React.FC = () => {
  const { login } = useAppContext();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const navigate = useNavigate();

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (username === 'admin' && password === 'admin') {
      login('ADMIN', 'Admin User');
      navigate('/admin');
    } else if (username && password) {
      login('CUSTOMER', username);
      navigate('/');
    } else {
      alert('Login Gagal. Coba username: admin, password: admin');
    }
  };

  return (
    <div className="min-h-screen bg-dark-900 flex items-center justify-center p-4">
      <div className="bg-dark-800 p-8 rounded-2xl shadow-2xl border border-dark-700 w-full max-w-md">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-primary rounded-xl mx-auto flex items-center justify-center mb-4 shadow-lg shadow-primary/30">
            <i className="fas fa-bolt text-3xl text-white"></i>
          </div>
          <h1 className="text-2xl font-bold text-white">DigiStore Login</h1>
          <div className="mt-4 bg-primary/10 border border-primary/20 rounded-lg p-3 text-sm text-left">
            <p className="text-primary font-bold mb-1">Demo Credentials:</p>
            <p className="text-gray-300">User: <span className="font-mono text-white">admin</span></p>
            <p className="text-gray-300">Pass: <span className="font-mono text-white">admin</span></p>
          </div>
        </div>
        <form onSubmit={handleLogin} className="space-y-6">
          <div>
            <label className="block text-sm text-gray-400 mb-1">Username</label>
            <input 
              type="text" 
              value={username}
              onChange={e => setUsername(e.target.value)}
              className="w-full bg-dark-900 border border-dark-700 rounded-lg px-4 py-3 text-white focus:border-primary focus:outline-none transition-colors"
              placeholder="Username"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">Password</label>
            <input 
              type="password" 
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="w-full bg-dark-900 border border-dark-700 rounded-lg px-4 py-3 text-white focus:border-primary focus:outline-none transition-colors"
              placeholder="Password"
            />
          </div>
          <button type="submit" className="w-full bg-primary hover:bg-indigo-600 text-white font-bold py-3 rounded-xl transition-all shadow-lg shadow-primary/25">
            Masuk
          </button>
        </form>
        <div className="mt-6 text-center">
             <Link to="/" className="text-gray-500 hover:text-white text-sm">Kembali ke Toko</Link>
        </div>
      </div>
    </div>
  );
};

// --- App Root ---

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
  const [cart, setCart] = useState<CartItem[]>([]);
  const [user, setUser] = useState<User | null>(null);

  // Persistence Effects
  useEffect(() => { DataService.saveSettings(settings); }, [settings]);
  useEffect(() => { DataService.saveProducts(products); }, [products]);
  useEffect(() => { DataService.savePayments(paymentMethods); }, [paymentMethods]);

  const addToCart = (product: Product) => {
    setCart(prev => {
      const existing = prev.find(p => p.id === product.id);
      if (existing) {
        return prev.map(p => p.id === product.id ? { ...p, quantity: p.quantity + 1 } : p);
      }
      return [...prev, { ...product, quantity: 1 }];
    });
  };

  const removeFromCart = (id: string) => {
    setCart(prev => prev.filter(p => p.id !== id));
  };

  const login = (role: 'ADMIN' | 'CUSTOMER', name: string) => {
    setUser({ role, name });
  };

  return (
    <AppContext.Provider value={{
      settings,
      updateSettings: setSettings,
      products,
      updateProducts: setProducts,
      cart,
      addToCart,
      removeFromCart,
      clearCart: () => setCart([]),
      user,
      login,
      logout: () => setUser(null),
      paymentMethods,
      updatePayments: setPaymentMethods,
    }}>
      <Router>
        <AppContent />
      </Router>
    </AppContext.Provider>
  );
}