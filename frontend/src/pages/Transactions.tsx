import { useState } from 'react';
import { useStore } from '../store';
import { formatCurrency, formatDate } from '../utils/formatters';
import { TrendingUp, TrendingDown, Link2, Unlink2, RotateCcw } from 'lucide-react';
import { TransactionDetail } from '../components/TransactionDetail';
import { Transaction } from '../types';
import { updateTransaction, reparseTransactions } from '../services/api';

export const Transactions = () => {
  const { transactions, accounts, loadTransactions } = useStore();
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
  const [showDetail, setShowDetail] = useState(false);
  const [showReparseModal, setShowReparseModal] = useState(false);
  const [selectedTransactionIds, setSelectedTransactionIds] = useState<Set<string>>(new Set());
  const [isReparsing, setIsReparsing] = useState(false);
  const [reparseResult, setReparseResult] = useState<any>(null);

  const sortedTransactions = [...transactions].sort(
    (a, b) =>
      new Date(b.transactionDate).getTime() -
      new Date(a.transactionDate).getTime()
  );

  const filteredTransactions = selectedCategory
    ? sortedTransactions.filter(t => t.category === selectedCategory)
    : sortedTransactions;

  const categories = Array.from(new Set(sortedTransactions.map(t => t.category).filter(Boolean))) as string[];

  const handleTransactionClick = (txn: Transaction) => {
    setSelectedTransaction(txn);
    setShowDetail(true);
  };

  const handleUpdateTransaction = async (updated: Transaction) => {
    if (!selectedTransaction) return;
    
    try {
      await updateTransaction(selectedTransaction.id, {
        merchantName: updated.merchantName,
        amount: updated.amount,
        type: updated.type,
        category: updated.category,
      });
      
      // Reload transactions to get updated data
      await loadTransactions();
      
      // Close modal and show success
      setShowDetail(false);
      alert('✅ Transaction updated successfully!');
    } catch (error) {
      console.error('[Transactions] Error updating transaction:', error);
      alert('❌ Failed to update transaction');
    }
  };

  const handleReparseAll = async () => {
    setIsReparsing(true);
    setReparseResult(null);
    try {
      const result = await reparseTransactions([]); // Empty array = all transactions
      setReparseResult(result);
      await loadTransactions();
      alert(`✅ Re-parsed ${result.successCount} transactions successfully!`);
    } catch (error) {
      console.error('[Transactions] Error re-parsing all:', error);
      alert(`❌ Failed to re-parse: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setIsReparsing(false);
    }
  };

  const handleReparseSelected = async () => {
    if (selectedTransactionIds.size === 0) {
      alert('Please select at least one transaction');
      return;
    }

    setIsReparsing(true);
    setReparseResult(null);
    try {
      const ids = Array.from(selectedTransactionIds);
      const result = await reparseTransactions(ids);
      setReparseResult(result);
      setSelectedTransactionIds(new Set());
      await loadTransactions();
      alert(`✅ Re-parsed ${result.successCount} transactions successfully!`);
    } catch (error) {
      console.error('[Transactions] Error re-parsing selected:', error);
      alert(`❌ Failed to re-parse: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setIsReparsing(false);
    }
  };

  const toggleTransactionSelection = (id: string) => {
    const newSet = new Set(selectedTransactionIds);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedTransactionIds(newSet);
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full">
      <div className="mb-8">
        <h2 className="text-3xl font-bold text-gray-900 mb-2">Transactions</h2>
        <p className="text-gray-600">View all your recent transactions. Click on any transaction to view details.</p>
      </div>

      {/* Re-parse Controls */}
      <div className="mb-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
          <div>
            <h3 className="font-semibold text-blue-900 mb-1">Transaction Parser</h3>
            <p className="text-sm text-blue-700">Re-parse transactions to correct merchant names, bank names, and categories</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleReparseAll}
              disabled={isReparsing}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 transition-colors whitespace-nowrap"
            >
              <RotateCcw size={16} className={isReparsing ? 'animate-spin' : ''} />
              {isReparsing ? 'Re-parsing...' : 'Re-parse All'}
            </button>
            <button
              onClick={() => setShowReparseModal(!showReparseModal)}
              disabled={isReparsing}
              className="px-4 py-2 bg-white border border-blue-600 text-blue-600 rounded-lg hover:bg-blue-50 disabled:opacity-50 transition-colors whitespace-nowrap"
            >
              {selectedTransactionIds.size > 0 ? `Selected (${selectedTransactionIds.size})` : 'Select & Reparse'}
            </button>
          </div>
        </div>
        
        {showReparseModal && (
          <div className="mt-4 p-3 bg-white rounded border border-blue-200">
            <p className="text-sm text-gray-700 mb-2">
              {selectedTransactionIds.size} of {transactions.length} selected
            </p>
            <button
              onClick={handleReparseSelected}
              disabled={isReparsing || selectedTransactionIds.size === 0}
              className="px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700 disabled:bg-gray-400 text-sm"
            >
              Re-parse {selectedTransactionIds.size} Selected
            </button>
          </div>
        )}

        {reparseResult && (
          <div className="mt-3 p-3 bg-white rounded border border-green-200">
            <p className="text-sm font-semibold text-green-700">
              ✅ Re-parsed: {reparseResult.successCount} success, {reparseResult.errorCount} errors
            </p>
          </div>
        )}
      </div>

      {categories.length > 0 && (
        <div className="mb-6">
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setSelectedCategory('')}
              className={`px-4 py-2 rounded-full text-sm font-medium transition ${
                selectedCategory === ''
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              All
            </button>
            {categories.map(cat => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-4 py-2 rounded-full text-sm font-medium transition ${
                  selectedCategory === cat
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                    <span className="truncate max-w-[120px] inline-block align-middle">{cat}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {filteredTransactions.length === 0 ? (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
          <p className="text-gray-500">No transactions found</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filteredTransactions.map((txn) => {
            const account = accounts.find((a) => a.id === txn.accountId);
            const isDebit = txn.type === 'debit';

            return (
              <div
                key={txn.id}
                className="bg-white rounded-lg border border-gray-200 p-4 hover:shadow-md transition-shadow"
              >
                <div className="flex items-center justify-between gap-4 mb-2">
                  {showReparseModal && (
                    <input
                      type="checkbox"
                      checked={selectedTransactionIds.has(txn.id)}
                      onChange={(e) => {
                        e.stopPropagation();
                        toggleTransactionSelection(txn.id);
                      }}
                      className="w-5 h-5 rounded border-gray-300 cursor-pointer flex-shrink-0"
                    />
                  )}
                  <div
                    onClick={() => handleTransactionClick(txn)}
                    className="flex items-center gap-4 flex-1 cursor-pointer"
                  >
                    <div
                      className={`p-2 rounded-lg flex-shrink-0 ${
                        isDebit ? 'bg-red-100' : 'bg-green-100'
                      }`}
                    >
                      {isDebit ? (
                        <TrendingDown size={20} className="text-red-600" />
                      ) : (
                        <TrendingUp size={20} className="text-green-600" />
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-900 truncate">
                        {txn.merchantName}
                      </p>
                      <p className="text-sm text-gray-600 truncate">
                        {account?.bankName} • {account?.accountNumber}
                      </p>
                    </div>
                  </div>

                  <div className="text-right flex-shrink-0">
                    <p
                      className={`font-semibold text-lg ${
                        isDebit ? 'text-red-600' : 'text-green-600'
                      }`}
                    >
                      {isDebit ? '-' : '+'}
                      {formatCurrency(txn.amount)}
                    </p>
                    <p className="text-sm text-gray-500">
                      {formatDate(new Date(txn.transactionDate))}
                    </p>
                  </div>
                </div>

                {(txn.category || txn.tags || txn.refundLinkedId) && (
                  <div className="flex items-center gap-2 text-xs text-gray-600 px-4 pt-2 border-t border-gray-100">
                    {txn.category && (
                      <span className="bg-blue-50 text-blue-700 px-2 py-1 rounded">
                        {txn.category}
                      </span>
                    )}
                    {txn.refundLinkedId && (
                      <span className="flex items-center gap-1 bg-green-50 text-green-700 px-2 py-1 rounded">
                        <Link2 size={12} /> Refund linked
                      </span>
                    )}
                    {txn.isRefund && (
                      <span className="flex items-center gap-1 bg-purple-50 text-purple-700 px-2 py-1 rounded">
                        <Unlink2 size={12} /> Refund
                      </span>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Transaction Detail Modal */}
      <TransactionDetail
        open={showDetail}
        onClose={() => setShowDetail(false)}
        transaction={selectedTransaction}
        onUpdate={handleUpdateTransaction}
        allTransactions={sortedTransactions}
      />
    </div>
  );
};
