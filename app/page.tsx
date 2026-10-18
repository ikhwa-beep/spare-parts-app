'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { 
  Package, Search, Plus, AlertTriangle, ArrowUpRight, 
  ArrowDownRight, LogOut, RefreshCw, Layers, ShieldAlert 
} from 'lucide-react';

// Initialize Supabase Client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

export default function InventoryDashboard() {
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  
  // Auth Form State
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [authError, setAuthError] = useState('');

  // Inventory Data State
  const [parts, setParts] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  
  // Modals & Action State
  const [showAddModal, setShowAddModal] = useState(false);
  const [activePart, setActivePart] = useState<any>(null);
  const [modalType, setModalType] = useState<'IN' | 'OUT' | null>(null);
  const [txQty, setTxQty] = useState(1);
  const [txReason, setTxReason] = useState('');

  // New Part Form
  const [newPart, setNewPart] = useState({
    part_number: '',
    name: '',
    category: 'Mechanical',
    quantity: 0,
    min_stock: 5,
    unit: 'pcs',
    location: 'Rack A1'
  });

  // Check Session on Load
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) fetchParts();
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) fetchParts();
    });

    return () => subscription.unsubscribe();
  }, []);

  // Fetch Parts from Supabase
  const fetchParts = async () => {
    const { data, error } = await supabase
      .from('parts')
      .select('*')
      .order('name', { ascending: true });
    
    if (!error && data) setParts(data);
  };

  // Handle Authentication
  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    if (isSignUp) {
      const { error } = await supabase.auth.signUp({ email, password });
      if (error) setAuthError(error.message);
      else alert('Check your email for confirmation link if required, or try logging in!');
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) setAuthError(error.message);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  // Add Part
  const handleCreatePart = async (e: React.FormEvent) => {
    e.preventDefault();
    const { error } = await supabase.from('parts').insert([newPart]);
    if (error) {
      alert('Error: ' + error.message);
    } else {
      setShowAddModal(false);
      setNewPart({ part_number: '', name: '', category: 'Mechanical', quantity: 0, min_stock: 5, unit: 'pcs', location: 'Rack A1' });
      fetchParts();
    }
  };

  // Adjust Stock (IN / OUT)
  const handleStockAdjustment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activePart || !modalType) return;

    const qtyChange = Number(txQty);
    const newQuantity = modalType === 'IN' 
      ? activePart.quantity + qtyChange 
      : activePart.quantity - qtyChange;

    if (newQuantity < 0) {
      alert('Stock cannot be negative!');
      return;
    }

    // Update part quantity
    const { error: updateError } = await supabase
      .from('parts')
      .update({ quantity: newQuantity })
      .eq('id', activePart.id);

    if (updateError) {
      alert('Failed to update stock: ' + updateError.message);
      return;
    }

    // Log transaction
    await supabase.from('stock_logs').insert([{
      part_id: activePart.id,
      type: modalType,
      quantity: qtyChange,
      reason: txReason || (modalType === 'IN' ? 'Stock Restock' : 'Maintenance Usage')
    }]);

    setModalType(null);
    setActivePart(null);
    setTxQty(1);
    setTxReason('');
    fetchParts();
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center bg-gray-50 text-gray-500">Loading system...</div>;
  }

  // Login Screen
  if (!session) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-slate-900 px-4">
        <div className="max-w-md w-full bg-white rounded-xl shadow-2xl p-8">
          <div className="flex items-center space-x-3 mb-6">
            <div className="bg-indigo-600 p-2.5 rounded-lg text-white">
              <Package className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900">Spare Parts Hub</h1>
              <p className="text-xs text-slate-500">Inventory & Maintenance Control</p>
            </div>
          </div>

          {authError && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 shrink-0" />
              <span>{authError}</span>
            </div>
          )}

          <form onSubmit={handleAuth} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">Email Address</label>
              <input 
                type="email" 
                required
                value={email} 
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3.5 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="name@company.com"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">Password</label>
              <input 
                type="password" 
                required
                value={password} 
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3.5 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="••••••••"
              />
            </div>
            <button 
              type="submit" 
              className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg text-sm transition shadow-sm"
            >
              {isSignUp ? 'Create Account' : 'Sign In'}
            </button>
          </form>

          <div className="mt-6 text-center">
            <button 
              onClick={() => setIsSignUp(!isSignUp)}
              className="text-xs text-indigo-600 hover:underline font-medium"
            >
              {isSignUp ? 'Already have an account? Sign In' : "Don't have an account? Register"}
            </button>
          </div>
        </div>
      </main>
    );
  }

  // Filtered Parts
  const filteredParts = parts.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          p.part_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          p.location?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCat = selectedCategory === 'All' || p.category === selectedCategory;
    return matchesSearch && matchesCat;
  });

  const lowStockCount = parts.filter(p => p.quantity <= p.min_stock).length;

  return (
    <div className="min-h-screen bg-slate-100 text-slate-800">
      {/* Top Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="bg-indigo-600 p-2 rounded-lg text-white">
              <Package className="w-5 h-5" />
            </div>
            <div>
              <h1 className="font-bold text-slate-900 leading-tight">Spare Parts Inventory</h1>
              <p className="text-xs text-slate-500">Plant Maintenance System</p>
            </div>
          </div>
          <div className="flex items-center space-x-4">
            <span className="text-xs text-slate-600 bg-slate-100 px-3 py-1.5 rounded-full font-medium hidden sm:inline-block">
              {session.user.email}
            </span>
            <button 
              onClick={handleLogout}
              className="flex items-center space-x-1.5 text-xs font-medium text-slate-600 hover:text-red-600 transition bg-slate-50 hover:bg-red-50 px-3 py-1.5 rounded-lg border border-slate-200"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Logout</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        
        {/* KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase">Total Part SKUs</p>
              <p className="text-2xl font-bold text-slate-900 mt-1">{parts.length}</p>
            </div>
            <div className="p-3 bg-indigo-50 text-indigo-600 rounded-lg">
              <Layers className="w-6 h-6" />
            </div>
          </div>
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase">Low Stock Alerts</p>
              <p className={`text-2xl font-bold mt-1 ${lowStockCount > 0 ? 'text-amber-600' : 'text-slate-900'}`}>
                {lowStockCount}
              </p>
            </div>
            <div className={`p-3 rounded-lg ${lowStockCount > 0 ? 'bg-amber-50 text-amber-600' : 'bg-slate-50 text-slate-600'}`}>
              <AlertTriangle className="w-6 h-6" />
            </div>
          </div>
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase">Categories</p>
              <p className="text-2xl font-bold text-slate-900 mt-1">
                {new Set(parts.map(p => p.category)).size}
              </p>
            </div>
            <div className="p-3 bg-emerald-50 text-emerald-600 rounded-lg">
              <Package className="w-6 h-6" />
            </div>
          </div>
        </div>

        {/* Filters & Actions Bar */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col sm:flex-row gap-4 items-center justify-between">
          <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto items-center">
            <div className="relative w-full sm:w-72">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
              <input 
                type="text" 
                placeholder="Search part name, number, location..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-4 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <select 
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full sm:w-auto px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="All">All Categories</option>
              <option value="Mechanical">Mechanical</option>
              <option value="Electrical">Electrical</option>
              <option value="Pneumatic">Pneumatic</option>
              <option value="Consumables">Consumables</option>
            </select>
          </div>
          
          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <button 
              onClick={fetchParts}
              className="p-2 border border-slate-300 rounded-lg text-slate-600 hover:bg-slate-50 transition"
              title="Refresh Data"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
            <button 
              onClick={() => setShowAddModal(true)}
              className="flex items-center space-x-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium transition shadow-sm w-full sm:w-auto justify-center"
            >
              <Plus className="w-4 h-4" />
              <span>Add New Part</span>
            </button>
          </div>
        </div>

        {/* Parts Table */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  <th className="py-3.5 px-4">Part Number</th>
                  <th className="py-3.5 px-4">Name</th>
                  <th className="py-3.5 px-4">Category</th>
                  <th className="py-3.5 px-4">Location</th>
                  <th className="py-3.5 px-4 text-center">Quantity</th>
                  <th className="py-3.5 px-4 text-right">Quick Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-sm">
                {filteredParts.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-400">
                      No spare parts found. Click "Add New Part" to get started.
                    </td>
                  </tr>
                ) : (
                  filteredParts.map(part => {
                    const isLow = part.quantity <= part.min_stock;
                    return (
                      <tr key={part.id} className="hover:bg-slate-50 transition">
                        <td className="py-3 px-4 font-mono text-xs text-indigo-600 font-semibold">{part.part_number}</td>
                        <td className="py-3 px-4 font-medium text-slate-900">{part.name}</td>
                        <td className="py-3 px-4 text-slate-600">
                          <span className="bg-slate-100 text-slate-700 text-xs px-2.5 py-1 rounded-full font-medium">
                            {part.category}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-slate-600 font-mono text-xs">{part.location || '—'}</td>
                        <td className="py-3 px-4 text-center">
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${
                            isLow ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'
                          }`}>
                            {part.quantity} {part.unit}
                            {isLow && <AlertTriangle className="w-3 h-3" />}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right space-x-2">
                          <button 
                            onClick={() => { setActivePart(part); setModalType('IN'); }}
                            className="inline-flex items-center px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded text-xs font-medium transition"
                          >
                            <ArrowDownRight className="w-3 h-3 mr-1" /> Stock In
                          </button>
                          <button 
                            onClick={() => { setActivePart(part); setModalType('OUT'); }}
                            className="inline-flex items-center px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded text-xs font-medium transition"
                          >
                            <ArrowUpRight className="w-3 h-3 mr-1" /> Stock Out
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      {/* Add Part Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 space-y-4">
            <h3 className="text-lg font-bold text-slate-900">Add New Spare Part</h3>
            <form onSubmit={handleCreatePart} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold uppercase text-slate-600 mb-1">Part Number / SKU</label>
                <input 
                  type="text" required
                  value={newPart.part_number}
                  onChange={e => setNewPart({...newPart, part_number: e.target.value})}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                  placeholder="e.g. MEC-VALV-001"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase text-slate-600 mb-1">Part Name</label>
                <input 
                  type="text" required
                  value={newPart.name}
                  onChange={e => setNewPart({...newPart, name: e.target.value})}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                  placeholder="e.g. Pneumatic Solenoid Valve 24V"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold uppercase text-slate-600 mb-1">Category</label>
                  <select 
                    value={newPart.category}
                    onChange={e => setNewPart({...newPart, category: e.target.value})}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white"
                  >
                    <option value="Mechanical">Mechanical</option>
                    <option value="Electrical">Electrical</option>
                    <option value="Pneumatic">Pneumatic</option>
                    <option value="Consumables">Consumables</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase text-slate-600 mb-1">Location</label>
                  <input 
                    type="text"
                    value={newPart.location}
                    onChange={e => setNewPart({...newPart, location: e.target.value})}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                    placeholder="Rack B2"
                  />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold uppercase text-slate-600 mb-1">Initial Qty</label>
                  <input 
                    type="number" min="0" required
                    value={newPart.quantity}
                    onChange={e => setNewPart({...newPart, quantity: parseInt(e.target.value) || 0})}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase text-slate-600 mb-1">Min Stock</label>
                  <input 
                    type="number" min="0" required
                    value={newPart.min_stock}
                    onChange={e => setNewPart({...newPart, min_stock: parseInt(e.target.value) || 0})}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase text-slate-600 mb-1">Unit</label>
                  <input 
                    type="text" required
                    value={newPart.unit}
                    onChange={e => setNewPart({...newPart, unit: e.target.value})}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                  />
                </div>
              </div>
              <div className="flex justify-end space-x-2 pt-3">
                <button 
                  type="button" 
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 border border-slate-300 rounded-lg text-sm text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium"
                >
                  Save Part
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Stock In / Out Modal */}
      {modalType && activePart && (
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-sm w-full p-6 space-y-4">
            <h3 className="text-lg font-bold text-slate-900">
              {modalType === 'IN' ? 'Stock In (Restock)' : 'Stock Out (Issue)'}
            </h3>
            <p className="text-xs text-slate-500">
              Part: <span className="font-semibold text-slate-800">{activePart.name}</span> (Current: {activePart.quantity} {activePart.unit})
            </p>
            <form onSubmit={handleStockAdjustment} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold uppercase text-slate-600 mb-1">Quantity to {modalType === 'IN' ? 'Add' : 'Deduct'}</label>
                <input 
                  type="number" min="1" required
                  value={txQty}
                  onChange={e => setTxQty(parseInt(e.target.value) || 1)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase text-slate-600 mb-1">Reason / Reference</label>
                <input 
                  type="text"
                  value={txReason}
                  onChange={e => setTxReason(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                  placeholder={modalType === 'IN' ? 'Purchase Order # / Supplier' : 'Machine Breakdown / Work Order #'}
                />
              </div>
              <div className="flex justify-end space-x-2 pt-3">
                <button 
                  type="button" 
                  onClick={() => { setModalType(null); setActivePart(null); }}
                  className="px-4 py-2 border border-slate-300 rounded-lg text-sm text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className={`px-4 py-2 text-white rounded-lg text-sm font-medium ${
                    modalType === 'IN' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-rose-600 hover:bg-rose-700'
                  }`}
                >
                  Confirm {modalType}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
