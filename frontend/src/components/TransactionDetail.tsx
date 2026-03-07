import { useState, useEffect } from 'react';
import { Transaction } from '../types';
import { formatCurrency } from '../utils/formatters';
import { X, ChevronDown } from 'lucide-react';
import { getCategories, linkRefundToDebit } from '../services/api';

interface Category {
  _id: string;
  name: string;
  type?: 'debit' | 'credit';
}

interface TransactionDetailProps {
  open: boolean;
  onClose: () => void;
  transaction: Transaction | null;
  onUpdate?: (updated: Transaction) => void;
  allTransactions?: Transaction[];
}

export const TransactionDetail = ({ 
  open, 
  onClose, 
  transaction, 
  onUpdate,
  allTransactions = []
}: TransactionDetailProps) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState<Partial<Transaction>>({});
  const [categories, setCategories] = useState<Category[]>([]);
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);
  const [showAddCategory, setShowAddCategory] = useState(false);
  const [newCategory, setNewCategory] = useState('');
  const [selectedRefundIds, setSelectedRefundIds] = useState<string[]>([]);
  const [showRefundDropdown, setShowRefundDropdown] = useState(false);
  const [linking, setLinking] = useState(false);
  const [linkedRefunds, setLinkedRefunds] = useState<Transaction[]>([]);
  const [calculationNotes, setCalculationNotes] = useState('');
  const [currentAmount, setCurrentAmount] = useState(0);

  useEffect(() => {
    if (transaction) {
      setEditData({
        merchantName: transaction.merchantName,
        amount: transaction.amount,
        type: transaction.type,
        category: transaction.category || 'Unknown',
      });
      setCurrentAmount(transaction.amount);
      setIsEditing(false);
      setShowRefundDropdown(false);
      setSelectedRefundIds([]);
      setNewCategory('');
      setShowAddCategory(false);
      loadCategories();
      
      // Load linked refunds
      if (transaction.linked_refunds && transaction.linked_refunds.length > 0) {
        const linked = allTransactions.filter(t => 
          transaction.linked_refunds?.includes(t.id)
        );
        setLinkedRefunds(linked);
      }
      
      // Set calculation notes if available
      if (transaction.refund_calculation_notes) {
        setCalculationNotes(transaction.refund_calculation_notes);
      }
    }
  }, [transaction, allTransactions]);

  const loadCategories = async () => {
    try {
      const data = await getCategories();
      setCategories(data as Category[]);
    } catch (error) {
      console.error('Failed to load categories:', error);
    }
  };

  const handleSave = async () => {
    if (!transaction || !editData) return;
    const updated = { ...transaction, ...editData };
    if (onUpdate) {
      onUpdate(updated);
    }
    setIsEditing(false);
  };

  const getAvailableCreditsForRefund = () => {
    if (!transaction || transaction.type !== 'debit') return [];
    
    const debitDate = new Date(transaction.transactionDate);
    const thirtyDaysBefore = new Date(debitDate);
    thirtyDaysBefore.setDate(thirtyDaysBefore.getDate() - 30);

    return allTransactions.filter(t => {
      const creditDate = new Date(t.transactionDate);
      return (
        t.type === 'credit' &&
        t.accountId === transaction.accountId &&
        creditDate >= thirtyDaysBefore &&
        creditDate <= debitDate &&
        !t.is_refund_of
      );
    }).sort((a, b) => new Date(b.transactionDate).getTime() - new Date(a.transactionDate).getTime());
  };

  const handleAddCategory = () => {
    if (!newCategory.trim()) return;
    setEditData({ ...editData, category: newCategory });
    setNewCategory('');
    setShowAddCategory(false);
    setShowCategoryDropdown(false);
  };

  const toggleRefundSelection = (creditId: string) => {
    setSelectedRefundIds(prev => 
      prev.includes(creditId) 
        ? prev.filter(id => id !== creditId)
        : [...prev, creditId]
    );
  };

  const handleLinkRefunds = async () => {
    if (!transaction || selectedRefundIds.length === 0) return;
    
    setLinking(true);
    try {
      const result = await linkRefundToDebit(transaction.id, selectedRefundIds);
      
      // Update the transaction with new amount and notes
      const updated = {
        ...transaction,
        amount: result.new_debit,
        type: result.type_changed ? 'credit' : transaction.type,
        refund_calculation_notes: result.calculation_note,
        linked_refunds: selectedRefundIds
      };
      
      if (onUpdate) {
        onUpdate(updated);
      }
      
      setCurrentAmount(result.new_debit);
      setCalculationNotes(result.calculation_note);
      setLinkedRefunds(allTransactions.filter(t => selectedRefundIds.includes(t.id)));
      setSelectedRefundIds([]);
      setShowRefundDropdown(false);
    } catch (error) {
      console.error('Failed to link refunds:', error);
      alert('Failed to link refunds. Please try again.');
    } finally {
      setLinking(false);
    }
  };

  const availableCredits = getAvailableCreditsForRefund();
  const categoryOptions = categories.length > 0 ? categories : [];
  const currentCategory = editData.category || transaction?.category || 'Unknown';

  if (!transaction) return null;

  return (
    <div className={`fixed inset-0 z-50 transition-opacity ${open ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}>
      {/* Backdrop */}
      <div
        onClick={onClose}
        className={`absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity ${open ? 'opacity-100' : 'opacity-0'}`}
      />

      {/* Centered Modal */}
      <div
        role="dialog"
        aria-modal="true"
        className={`fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-2xl mx-auto bg-white rounded-2xl shadow-2xl transform transition-transform ${
          open ? 'scale-100 opacity-100' : 'scale-95 opacity-0 pointer-events-none'
        }`}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between sticky top-0 bg-white rounded-t-2xl">
          <h3 className="text-xl font-bold text-gray-900">
            {isEditing ? 'Edit Transaction' : 'Transaction Details'}
          </h3>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors text-gray-600 hover:text-gray-900"
            aria-label="Close dialog"
          >
            <X size={24} />
          </button>
        </div>

        {/* Content */}
        <div className="overflow-y-auto p-6 max-h-[calc(100vh-200px)]">
          {isEditing ? (
            <div className="space-y-4">
              {/* Merchant */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Merchant Name</label>
                <input
                  type="text"
                  value={editData.merchantName || ''}
                  onChange={(e) => setEditData({ ...editData, merchantName: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
                  placeholder="Enter merchant name"
                />
              </div>

              {/* Amount */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Amount (₹)</label>
                <input
                  type="number"
                  step="0.01"
                  value={editData.amount || 0}
                  onChange={(e) => setEditData({ ...editData, amount: parseFloat(e.target.value) || 0 })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
                  placeholder="0.00"
                />
              </div>

              {/* Type */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Transaction Type</label>
                <select
                  value={editData.type || 'debit'}
                  onChange={(e) => setEditData({ ...editData, type: e.target.value as 'debit' | 'credit' })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
                >
                  <option value="debit">Debit (Expense)</option>
                  <option value="credit">Credit (Income)</option>
                </select>
              </div>

              {/* Category Dropdown */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setShowCategoryDropdown(!showCategoryDropdown)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-left flex items-center justify-between bg-white hover:bg-gray-50 transition-colors"
                  >
                    <span>{currentCategory}</span>
                    <ChevronDown size={18} className={`transition-transform ${showCategoryDropdown ? 'rotate-180' : ''}`} />
                  </button>
                  
                  {showCategoryDropdown && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-300 rounded-lg shadow-lg z-10">
                      <div className="max-h-48 overflow-y-auto">
                        {categoryOptions.map(cat => (
                          <button
                            key={cat._id}
                            type="button"
                            onClick={() => {
                              setEditData({ ...editData, category: cat.name });
                              setShowCategoryDropdown(false);
                            }}
                            className="w-full text-left px-3 py-2 hover:bg-gray-100 transition-colors text-sm"
                          >
                            {cat.name}
                          </button>
                        ))}
                        <button
                          type="button"
                          onClick={() => { setShowAddCategory(true); setShowCategoryDropdown(false); }}
                          className="w-full text-left px-3 py-2 hover:bg-blue-50 transition-colors text-sm text-blue-600 font-medium border-t border-gray-200"
                        >
                          + Add New Category
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {showAddCategory && (
                  <div className="mt-2 flex gap-2">
                    <input
                      type="text"
                      value={newCategory}
                      onChange={(e) => setNewCategory(e.target.value)}
                      placeholder="Enter category name"
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none text-sm"
                    />
                    <button
                      type="button"
                      onClick={handleAddCategory}
                      className="px-3 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors text-sm font-medium"
                    >
                      Add
                    </button>
                  </div>
                )}
                <p className="text-xs text-gray-500 mt-1">💡 Changing category will sync to this merchant for future transactions</p>
              </div>

              {/* Date (Read-only) */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Date & Time</label>
                <input
                  type="text"
                  value={transaction.transactionDate?.toLocaleDateString('en-IN', {
                    weekday: 'short',
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                  }) + ' ' + transaction.transactionDate?.toLocaleTimeString('en-IN', {
                    hour: '2-digit',
                    minute: '2-digit',
                  }) || ''}
                  disabled
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-600 cursor-not-allowed"
                />
              </div>

              {/* Refund Linking for Debit Only */}
              {editData.type === 'debit' && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <div className="mb-3">
                    <label className="block text-sm font-medium text-blue-900 mb-2">Link Refunds</label>
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => setShowRefundDropdown(!showRefundDropdown)}
                        className="w-full px-3 py-2 border border-blue-300 rounded-lg text-left flex items-center justify-between bg-white hover:bg-blue-50 transition-colors"
                      >
                        <span className="text-sm text-gray-700">
                          {selectedRefundIds.length > 0 
                            ? `Selected ${selectedRefundIds.length} refund(s)`
                            : 'Select credits (last 30 days)'}
                        </span>
                        <ChevronDown size={18} className={`transition-transform ${showRefundDropdown ? 'rotate-180' : ''}`} />
                      </button>

                      {showRefundDropdown && (
                        <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-blue-300 rounded-lg shadow-lg z-10">
                          <div className="max-h-48 overflow-y-auto">
                            {availableCredits.length > 0 ? (
                              availableCredits.map(credit => (
                                <label
                                  key={credit.id}
                                  className="flex items-start gap-2 px-3 py-2 hover:bg-gray-50 transition-colors cursor-pointer"
                                >
                                  <input
                                    type="checkbox"
                                    checked={selectedRefundIds.includes(credit.id)}
                                    onChange={() => toggleRefundSelection(credit.id)}
                                    className="mt-1 w-4 h-4 rounded border-gray-300"
                                  />
                                  <div className="flex-1 min-w-0">
                                    <div className="flex justify-between items-start gap-2">
                                      <span className="text-sm font-medium text-gray-900 truncate">{credit.merchantName}</span>
                                      <span className="text-sm text-green-600 font-semibold flex-shrink-0">+{formatCurrency(credit.amount)}</span>
                                    </div>
                                    <div className="text-xs text-gray-500">
                                      {new Date(credit.transactionDate).toLocaleDateString('en-IN')}
                                    </div>
                                  </div>
                                </label>
                              ))
                            ) : (
                              <div className="px-3 py-2 text-xs text-gray-500">
                                No available credits in the 30-day window
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {selectedRefundIds.length > 0 && (
                    <button
                      type="button"
                      onClick={handleLinkRefunds}
                      disabled={linking}
                      className="w-full px-3 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium text-sm disabled:opacity-50"
                    >
                      {linking ? 'Linking...' : `Link ${selectedRefundIds.length} Refund(s)`}
                    </button>
                  )}

                  {linkedRefunds.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-blue-200 space-y-2">
                      <p className="text-xs font-medium text-blue-900">✓ Linked Refunds:</p>
                      {linkedRefunds.map(linked => (
                        <div key={linked.id} className="text-xs bg-white px-2 py-1.5 rounded border border-blue-100">
                          <div className="flex justify-between items-start">
                            <span className="font-medium text-gray-800">{linked.merchantName}</span>
                            <span className="text-green-600 font-semibold">+{formatCurrency(linked.amount)}</span>
                          </div>
                          <div className="text-gray-500 mt-0.5">
                            {new Date(linked.transactionDate).toLocaleDateString('en-IN')}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {calculationNotes && (
                    <div className="mt-3 pt-3 border-t border-blue-200">
                      <p className="text-xs font-medium text-blue-900 mb-1">Calculation Note:</p>
                      <p className="text-xs text-blue-700 bg-white px-2 py-1.5 rounded border border-blue-100 font-mono">
                        {calculationNotes}
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex gap-3 pt-6">
                <button
                  onClick={handleSave}
                  className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium disabled:opacity-50"
                >
                  Save Changes
                </button>
                <button
                  onClick={() => setIsEditing(false)}
                  className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors font-medium"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Transaction Type & Amount */}
              <div className={`p-6 rounded-lg border-2 ${
                transaction.type === 'credit' 
                  ? 'bg-green-50 border-green-200' 
                  : 'bg-red-50 border-red-200'
              }`}>
                <p className="text-sm text-gray-600 mb-2">Amount</p>
                <p className={`text-3xl font-bold ${
                  transaction.type === 'credit' ? 'text-green-600' : 'text-red-600'
                }`}>
                  {transaction.type === 'credit' ? '+' : '-'}{formatCurrency(currentAmount)}
                </p>
                <p className={`text-xs mt-2 ${
                  transaction.type === 'credit' ? 'text-green-600' : 'text-red-600'
                } font-medium capitalize`}>
                  {transaction.type === 'credit' ? 'Credit (Income)' : 'Debit (Expense)'}
                </p>
              </div>

              {/* Merchant */}
              <div>
                <p className="text-sm text-gray-600 mb-1">Merchant</p>
                <p className="text-lg font-medium text-gray-900">{transaction.merchantName}</p>
              </div>

              {/* Category */}
              <div>
                <p className="text-sm text-gray-600 mb-1">Category</p>
                <p className="text-lg font-medium text-gray-900">
                  {currentCategory || '🔔 Unknown'}
                </p>
              </div>

              {/* Date & Time */}
              <div>
                <p className="text-sm text-gray-600 mb-1">Date & Time</p>
                <p className="text-lg font-medium text-gray-900">
                  {transaction.transactionDate?.toLocaleDateString('en-IN', {
                    weekday: 'short',
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                  })} at {transaction.transactionDate?.toLocaleTimeString('en-IN', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </p>
              </div>

              {/* Account ID */}
              <div>
                <p className="text-sm text-gray-600 mb-1">Account</p>
                <p className="text-lg font-medium text-gray-900 font-mono">****{transaction.accountId?.slice(-4) || 'N/A'}</p>
              </div>

              {/* Linked Refunds Display */}
              {linkedRefunds.length > 0 && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <p className="text-sm font-medium text-blue-900 mb-3">✓ Linked Refunds</p>
                  <div className="space-y-2">
                    {linkedRefunds.map(linked => (
                      <div key={linked.id} className="bg-white p-3 rounded border border-blue-100">
                        <div className="flex justify-between items-start mb-1">
                          <span className="font-medium text-gray-900">{linked.merchantName}</span>
                          <span className="text-green-600 font-semibold">+{formatCurrency(linked.amount)}</span>
                        </div>
                        <div className="text-xs text-gray-500">
                          {new Date(linked.transactionDate).toLocaleDateString('en-IN')}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Calculation Notes */}
              {calculationNotes && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <p className="text-sm font-medium text-yellow-900 mb-2">📋 Calculation Note</p>
                  <p className="text-sm text-yellow-700 font-mono">{calculationNotes}</p>
                </div>
              )}

              {/* Edit Button */}
              <div className="flex gap-3 pt-6">
                <button
                  onClick={() => setIsEditing(true)}
                  className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium"
                >
                  Edit Transaction
                </button>
                <button
                  onClick={onClose}
                  className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors font-medium"
                >
                  Close
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
