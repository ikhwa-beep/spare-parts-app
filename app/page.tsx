'use client';

import { useState, useEffect, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';
import JsBarcode from 'jsbarcode';
import { BrowserMultiFormatReader } from '@zxing/library';
import { 
  Package, Search, Plus, AlertTriangle, ArrowUpRight, 
  ArrowDownRight, LogOut, RefreshCw, Layers, ShieldAlert,
  Barcode, Printer, Camera, X, RefreshCw as RefreshIcon
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
  
  // Categories State (Supports custom user additions)
  const [categories, setCategories] = useState<string[]>([
    'Mechanical', 'Electrical', 'Pneumatic', 'Consumables'
  ]);
  const [isAddingNewCategory, setIsAddingNewCategory] = useState(false);
  const [customCategoryInput, setCustomCategoryInput] = useState('');

  // Modals & Action State
  const [showAddModal, setShowAddModal] = useState(false);
  const [activePart, setActivePart] = useState<any>(null);
  const [modalType, setModalType] = useState<'IN' | 'OUT' | null>(null);
  const [txQty, setTxQty] = useState(1);
  const [txReason, setTxReason] = useState('');

  // Barcode Scanner State
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [scanMode, setScanMode] = useState<'SEARCH' | 'STOCK_IN' | 'STOCK_OUT'>('SEARCH');
  const [scanMessage, setScanMessage] = useState('');
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const codeReaderRef = useRef<BrowserMultiFormatReader | null>(null);

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

  // Print Label State
  const [printPart, setPrintPart] = useState<any>(null);

  // Helper to generate formatted SKU
  const generateSKU = (categoryName: string) => {
    const prefix = categoryName ? categoryName.substring(0, 3).toUpperCase() : 'SKU';
    const randomNum = Math.floor(100000 + Math.random() * 900000);
    return `${prefix}-${randomNum}`;
  };

  // Auto-generate Part SKU on opening modal or changing category
  useEffect(() => {
    if (showAddModal) {
      if (!newPart.part_number) {
        setNewPart(prev => ({ ...prev, part_number: generateSKU(prev.category) }));
      }
    }
  }, [showAddModal]);

  // Sync category lists from fetched database parts
  useEffect(() => {
    if (parts.length > 0) {
      const dbCategories = Array.from(new Set(parts.map(p => p.category).filter(Boolean)));
      setCategories(prev => Array.from(new Set([...prev, ...dbCategories])));
    }
  }, [parts]);

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

  // Render Barcode SVG helper component
  const BarcodeImage = ({ value, id }: { value: string; id?: string }) => {
    const svgRef = useRef<SVGSVGElement | null>(null);

    useEffect(() => {
      if (svgRef.current && value) {
        try {
          JsBarcode(svgRef.current, value, {
            format: 'CODE128',
            width: 1.8,
            height: 45,
            displayValue: true,
            fontSize: 11,
            margin: 4
          });
        } catch (e) {
          console.error('Barcode Generation Error', e);
        }
      }
    }, [value]);

    return <svg id={id} ref={svgRef} className="max-w-full"></svg>;
  };

// Barcode Scanner Logic
  useEffect(() => {
    if (isScannerOpen && videoRef.current) {
      const codeReader = new BrowserMultiFormatReader();
      codeReaderRef.current = codeReader;

      // Passing null uses the default video input device (camera)
      codeReader.decodeFromVideoDevice(null, videoRef.current, (result) => {
        if (result) {
          handleScannedBarcode(result.getText());
        }
      }).catch(() => {
        setScanMessage('Camera permission required or camera not found.');
      });
    } else {
      if (codeReaderRef.current) {
        codeReaderRef.current.reset();
      }
    }

    return () => {
      if (codeReaderRef.current) {
        codeReaderRef.current.reset();
      }
    };
  }, [isScannerOpen]);

  const handleScannedBarcode = (scannedCode: string) => {
    const foundPart = parts.find(
      p => p.part_number.toLowerCase() === scannedCode.toLowerCase()
    );

    if (scanMode === 'SEARCH') {
      setSearchTerm(scannedCode);
      setIsScannerOpen(false);
    } else if (foundPart) {
      setActivePart(foundPart);
      setModalType(scanMode === 'STOCK_IN' ? 'IN' : 'OUT');
      setIsScannerOpen(false);
    } else {
      setScanMessage(`Part "${scannedCode}" not found in database.`);
      setTimeout(() => setScanMessage(''), 3000);
    }
  };

  // Handle Adding New Custom Category
  const handleAddNewCategory = () => {
    const trimmed = customCategoryInput.trim();
    if (trimmed) {
      if (!categories.includes(trimmed)) {
        setCategories(prev => [...prev, trimmed]);
      }
      setNewPart(prev => ({
        ...prev,
        category: trimmed,
        part_number: generateSKU(trimmed)
      }));
      setCustomCategoryInput('');
      setIsAddingNewCategory(false);
    }
  };

  // Print Barcode Label Trigger
  const triggerPrint = (part: any) => {
    setPrintPart(part);
    setTimeout(() => {
      window.print();
    }, 300);
  };

  // Handle Authentication
  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    if (isSignUp) {
      const { error } = await supabase.auth.signUp({ email, password });
      if (error) setAuthError(error.message);
      else alert('Account registered! You may log in now.');
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) setAuthError(error.message);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  // Add Part
  const handleCreatePart = async (e: React.FormEvent, printOnSave = false) => {
    e.preventDefault();
    const { data, error } = await supabase.from('parts').insert([newPart]).select().single();
    if (error) {
      alert('Error: ' + error.message);
    } else {
      setShowAddModal(false);
      const savedPart = data || newPart;
      setNewPart({ part_number: '', name: '', category: 'Mechanical', quantity: 0, min_stock: 5, unit: 'pcs', location: 'Rack A1' });
      fetchParts();

      if (printOnSave) {
        triggerPrint(savedPart);
      }
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

    const { error: updateError } = await supabase
      .from('parts')
      .update({ quantity: newQuantity })
      .eq('id', activePart.id);

    if (updateError) {
      alert('Failed to update stock: ' + updateError.message);
      return;
    }

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
    return <div className="min-h-screen flex items-center justify-center bg-slate-50 text-slate-500">Loading system...</div>;
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
      
      {/* Printable Area for Barcode Label (Hidden on Screen) */}
      {printPart && (
        <div className="hidden print:flex print:flex-col print:items-center print:justify-center print:p-4 print:text-center">
          <p className="text-lg font-bold">{printPart.name}</p>
          <p className="text-sm text-gray-600 mb-2">Location: {printPart.location || 'N/A'}</p>
          <BarcodeImage value={printPart.part_number} />
          <p className="text-xs mt-1">Spare Part Management System</p>
        </div>
      )}

      {/* Screen Interface */}
      <div className="print:hidden">
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
                  {categories.length}
                </p>
              </div>
              <div className="p-3 bg-emerald-50 text-emerald-600 rounded-lg">
                <Package className="w-6 h-6" />
              </div>
            </div>
          </div>

          {/* Filters, Scanner & Actions Bar */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col sm:flex-row gap-4 items-center justify-between">
            <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto items-center">
              <div className="relative w-full sm:w-72">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input 
                  type="text" 
                  placeholder="Search part, SKU, location..."
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
                {categories.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>
            
            <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto justify-end">
              {/* Barcode Scanner Actions */}
              <button 
                onClick={() => { setScanMode('SEARCH'); setIsScannerOpen(true); }}
                className="flex items-center space-x-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-xs font-medium transition"
              >
                <Camera className="w-4 h-4" />
                <span>Scan Search</span>
              </button>
              <button 
                onClick={() => { setScanMode('STOCK_IN'); setIsScannerOpen(true); }}
                className="flex items-center space-x-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-medium transition"
              >
                <Barcode className="w-4 h-4" />
                <span>Scan In</span>
              </button>
              <button 
                onClick={() => { setScanMode('STOCK_OUT'); setIsScannerOpen(true); }}
                className="flex items-center space-x-1.5 px-3 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-medium transition"
              >
                <Barcode className="w-4 h-4" />
                <span>Scan Out</span>
              </button>

              <button 
                onClick={fetchParts}
                className="p-2 border border-slate-300 rounded-lg text-slate-600 hover:bg-slate-50 transition"
                title="Refresh Data"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
              <button 
                onClick={() => {
                  const defaultCat = categories[0] || 'Mechanical';
                  setNewPart({
                    part_number: generateSKU(defaultCat),
                    name: '',
                    category: defaultCat,
                    quantity: 0,
                    min_stock: 5,
                    unit: 'pcs',
                    location: 'Rack A1'
                  });
                  setShowAddModal(true);
                }}
                className="flex items-center space-x-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium transition shadow-sm"
              >
                <Plus className="w-4 h-4" />
                <span>Add Part</span>
              </button>
            </div>
          </div>

          {/* Parts Table */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    <th className="py-3.5 px-4">Part / SKU</th>
                    <th className="py-3.5 px-4">Name</th>
                    <th className="py-3.5 px-4">Category</th>
                    <th className="py-3.5 px-4">Barcode</th>
                    <th className="py-3.5 px-4 text-center">Quantity</th>
                    <th className="py-3.5 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 text-sm">
                  {filteredParts.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-slate-400">
                        No spare parts found. Click "Add Part" or use the Barcode Scanner.
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
                          <td className="py-2 px-4">
                            <div className="flex items-center space-x-2">
                              <BarcodeImage value={part.part_number} />
                              <button 
                                onClick={() => triggerPrint(part)}
                                className="p-1.5 border border-slate-200 rounded hover:bg-slate-100 text-slate-600"
                                title="Print Barcode Label"
                              >
                                <Printer className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
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

        {/* Live Camera Barcode Scanner Modal */}
        {isScannerOpen && (
          <div className="fixed inset-0 bg-slate-900/80 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 space-y-4 relative">
              <button 
                onClick={() => setIsScannerOpen(false)}
                className="absolute top-4 right-4 text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
              <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <Camera className="w-5 h-5 text-indigo-600" />
                <span>Barcode Scanner ({scanMode})</span>
              </h3>
              <p className="text-xs text-slate-500">Align barcode label within camera view to scan automatically.</p>
              
              <div className="relative overflow-hidden rounded-lg bg-black aspect-video flex items-center justify-center">
                <video ref={videoRef} className="w-full h-full object-cover" />
                <div className="absolute inset-x-8 top-1/2 h-0.5 bg-red-500 animate-pulse"></div>
              </div>

              {scanMessage && (
                <p className="text-xs text-center font-medium text-red-600">{scanMessage}</p>
              )}

              <div className="flex justify-end">
                <button 
                  onClick={() => setIsScannerOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-sm"
                >
                  Close Scanner
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Add Part Modal */}
        {showAddModal && (
          <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 space-y-4">
              <h3 className="text-lg font-bold text-slate-900">Add New Spare Part</h3>
              <form onSubmit={(e) => handleCreatePart(e, false)} className="space-y-3">
                
                {/* Part SKU with Auto-generate & Manual Edit */}
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="block text-xs font-semibold uppercase text-slate-600">Part SKU / Barcode</label>
                    <span className="text-[10px] text-slate-400">Editable field</span>
                  </div>
                  <div className="flex gap-2">
                    <input 
                      type="text" required
                      value={newPart.part_number}
                      onChange={e => setNewPart({...newPart, part_number: e.target.value})}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-mono focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                      placeholder="e.g. MEC-123456"
                    />
                    <button 
                      type="button"
                      onClick={() => setNewPart({...newPart, part_number: generateSKU(newPart.category)})}
                      className="inline-flex items-center space-x-1 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-xs font-semibold rounded-lg text-slate-700 transition"
                      title="Auto-generate SKU"
                    >
                      <RefreshIcon className="w-3.5 h-3.5" />
                      <span>Auto</span>
                    </button>
                  </div>
                  {newPart.part_number && (
                    <div className="mt-2 p-2 bg-slate-50 border border-slate-200 rounded-lg flex justify-center">
                      <BarcodeImage value={newPart.part_number} />
                    </div>
                  )}
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

                {/* Category & New Category Option */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold uppercase text-slate-600 mb-1">Category</label>
                    {!isAddingNewCategory ? (
                      <select 
                        value={newPart.category}
                        onChange={e => {
                          const val = e.target.value;
                          if (val === 'NEW_CATEGORY_TRIGGER') {
                            setIsAddingNewCategory(true);
                          } else {
                            setNewPart({
                              ...newPart, 
                              category: val,
                              part_number: generateSKU(val)
                            });
                          }
                        }}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white"
                      >
                        {categories.map(cat => (
                          <option key={cat} value={cat}>{cat}</option>
                        ))}
                        <option value="NEW_CATEGORY_TRIGGER" className="font-semibold text-indigo-600">+ Add New Category...</option>
                      </select>
                    ) : (
                      <div className="flex gap-1">
                        <input 
                          type="text" 
                          autoFocus
                          value={customCategoryInput}
                          onChange={e => setCustomCategoryInput(e.target.value)}
                          placeholder="New Category"
                          className="w-full px-2 py-1.5 border border-indigo-400 rounded text-xs focus:outline-none"
                        />
                        <button 
                          type="button" 
                          onClick={handleAddNewCategory}
                          className="px-2 py-1 bg-indigo-600 text-white rounded text-xs font-medium"
                        >
                          Add
                        </button>
                        <button 
                          type="button" 
                          onClick={() => setIsAddingNewCategory(false)}
                          className="px-2 py-1 bg-slate-200 text-slate-600 rounded text-xs"
                        >
                          X
                        </button>
                      </div>
                    )}
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

                <div className="flex justify-between items-center pt-3 border-t">
                  <button 
                    type="button" 
                    onClick={(e) => handleCreatePart(e, true)}
                    className="inline-flex items-center space-x-1 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-medium"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    <span>Save & Print Label</span>
                  </button>
                  <div className="flex space-x-2">
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
    </div>
  );
}