import { useState } from 'react';
import { useStore } from '../store';
import { formatCurrency, formatDate, toTitleCase } from '../utils/formatters';
import { TrendingUp, TrendingDown, Link2, Unlink2, RotateCcw, Upload } from 'lucide-react';
import { TransactionDetail } from '../components/TransactionDetail';
import { StatementImport } from '../components/StatementImport';
import { Transaction } from '../types';
import { updateTransaction, reparseTransactions } from '../services/api';

export const Transactions = () => {
  const { transactions, accounts, loadTransactions } = useStore();
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
  const [showDetail, setShowDetail] = useState(false);
  const [showReparseModal, setShowReparseModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [selectedTransactionIds, setSelectedTransactionIds] = useState<Set<string>>(new Set());
  const [isReparsing, setIsReparsing] = useState(false);
  const [reparseResult, setReparseResult] = useState<any>(null);
  const [selectedImportAccountId, setSelectedImportAccountId] = useState<string>('');

  const importAccounts = accounts.filter((a) => a.accountType !== 'credit_card');

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

  const openImportPanel = () => {
    if (!selectedImportAccountId && importAccounts.length > 0) {
      setSelectedImportAccountId(importAccounts[0].id);
    }
    setShowImportModal(!showImportModal);
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full">
      <div className="mb-8">
        <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">Transactions</h2>
        <p className="text-gray-600 dark:text-gray-300">View all your recent transactions. Click on any transaction to view details.</p>
      </div>

      {/* Re-parse Controls */}
      <div className="mb-6 rounded-2xl border border-cyan-500/20 bg-gradient-to-br from-cyan-500/10 via-slate-900 to-slate-900 p-4">
        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
          <div>
            <h3 className="font-semibold text-cyan-100 mb-1">Transaction Parser</h3>
            <p className="text-sm text-cyan-100/80">Re-parse transactions to correct merchant names, bank names, and categories</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleReparseAll}
              disabled={isReparsing}
              className="flex items-center gap-2 px-4 py-2 bg-cyan-400 text-slate-950 font-medium rounded-lg hover:bg-cyan-300 disabled:bg-gray-400 transition-colors whitespace-nowrap"
            >
              <RotateCcw size={16} className={isReparsing ? 'animate-spin' : ''} />
              {isReparsing ? 'Re-parsing...' : 'Re-parse All'}
            </button>
            <button
              onClick={() => setShowReparseModal(!showReparseModal)}
              disabled={isReparsing}
              className="px-4 py-2 bg-transparent border border-cyan-300/50 text-cyan-100 rounded-lg hover:bg-cyan-500/10 disabled:opacity-50 transition-colors whitespace-nowrap"
            >
              {selectedTransactionIds.size > 0 ? `Selected (${selectedTransactionIds.size})` : 'Select & Reparse'}
            </button>
          </div>
        </div>
        
        {showReparseModal && (
          <div className="mt-4 p-3 bg-black/20 rounded border border-cyan-500/20">
            <p className="text-sm text-cyan-100/80 mb-2">
              {selectedTransactionIds.size} of {transactions.length} selected
            </p>
            <button
              onClick={handleReparseSelected}
              disabled={isReparsing || selectedTransactionIds.size === 0}
              className="px-3 py-1 bg-emerald-400 text-slate-950 font-medium rounded hover:bg-emerald-300 disabled:bg-gray-400 text-sm"
            >
              Re-parse {selectedTransactionIds.size} Selected
            </button>
          </div>
        )}

        {reparseResult && (
          <div className="mt-3 p-3 bg-emerald-500/10 rounded border border-emerald-500/30">
            <p className="text-sm font-semibold text-emerald-100">
              ✅ Re-parsed: {reparseResult.successCount} success, {reparseResult.errorCount} errors
            </p>
          </div>
        )}
      </div>

      {/* Statement Import Section */}
      <div className="mb-6 rounded-2xl border border-emerald-500/20 bg-gradient-to-br from-emerald-500/10 via-slate-900 to-slate-900 p-4 shadow-xl shadow-emerald-900/10">
        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
          <div>
            <h3 className="font-semibold text-emerald-200 mb-1">Import from Bank Statement</h3>
            <p className="text-sm text-emerald-100/80">Upload XLS, XLSX, or PDF and merge transactions cleanly by statement range.</p>
          </div>
          <button
            onClick={openImportPanel}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-500 text-slate-950 font-medium rounded-lg hover:bg-emerald-400 transition-colors whitespace-nowrap"
          >
            <Upload size={16} />
            Import Statement
          </button>
        </div>

        {showImportModal && (
          <div className="mt-4 p-4 bg-slate-900/60 rounded-xl border border-emerald-500/20">
            <div className="mb-4">
              <label className="block text-xs uppercase tracking-wide text-emerald-100/80 mb-1">Import account</label>
              <select
                value={selectedImportAccountId}
                onChange={(e) => setSelectedImportAccountId(e.target.value)}
                className="w-full rounded-lg border border-emerald-500/30 bg-slate-950 text-emerald-100 px-3 py-2 text-sm"
              >
                {importAccounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.bankName} - {account.accountNumber}
                  </option>
                ))}
              </select>
            </div>
            <StatementImport
              accountId={selectedImportAccountId || importAccounts[0]?.id || ''}
              onSuccess={() => {
                setShowImportModal(false);
                loadTransactions();
              }}
            />
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
                  ? 'bg-violet-500 text-white'
                  : 'bg-slate-200 dark:bg-slate-800 text-gray-700 dark:text-gray-200 hover:bg-slate-300 dark:hover:bg-slate-700'
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
                    ? 'bg-violet-500 text-white'
                    : 'bg-slate-200 dark:bg-slate-800 text-gray-700 dark:text-gray-200 hover:bg-slate-300 dark:hover:bg-slate-700'
                }`}
              >
                    <span className="truncate max-w-[120px] inline-block align-middle">{cat}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {filteredTransactions.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700 p-12 text-center">
          <p className="text-gray-500 dark:text-gray-300">No transactions found</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filteredTransactions.map((txn) => {
            const account = accounts.find((a) => a.id === txn.accountId);
            const isDebit = txn.type === 'debit';

            return (
              <div
                key={txn.id}
                className="bg-white dark:bg-slate-900 rounded-lg border border-gray-200 dark:border-slate-700 p-4 hover:shadow-md transition-shadow"
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
                        isDebit ? 'bg-red-100 dark:bg-red-500/20' : 'bg-green-100 dark:bg-green-500/20'
                      }`}
                    >
                      {isDebit ? (
                        <TrendingDown size={20} className="text-red-600" />
                      ) : (
                        <TrendingUp size={20} className="text-green-600" />
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-900 dark:text-white truncate">
                        {toTitleCase(txn.merchantName)}
                      </p>
                      <p className="text-sm text-gray-600 dark:text-gray-300 truncate">
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
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {formatDate(new Date(txn.transactionDate))}
                    </p>
                  </div>
                </div>

                {(txn.category || txn.tags || txn.refundLinkedId) && (
                  <div className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-300 px-4 pt-2 border-t border-gray-100 dark:border-slate-800">
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
