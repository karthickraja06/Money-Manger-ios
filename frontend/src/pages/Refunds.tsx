import { useEffect, useState } from 'react';
import { RefundPair, Transaction, NetSpend } from '../types';
import { getRefundPairs, getTransactions, linkRefund, unlinkRefund, getNetSpend } from '../services/api';
import { formatCurrency } from '../utils/formatters';

export const Refunds = () => {
  const [refundPairs, setRefundPairs] = useState<RefundPair[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [netSpend, setNetSpend] = useState<NetSpend | null>(null);
  const [loading, setLoading] = useState(true);
  const [showLinkForm, setShowLinkForm] = useState(false);
  const [selectedOriginal, setSelectedOriginal] = useState<string>('');
  const [selectedRefund, setSelectedRefund] = useState<string>('');

  useEffect(() => {
    loadRefundData();
  }, []);

  const loadRefundData = async () => {
    setLoading(true);
    try {
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);

      const [pairs, txns, spend] = await Promise.all([
        getRefundPairs(),
        getTransactions(),
        getNetSpend(monthStart, monthEnd),
      ]);

      setRefundPairs(pairs);
      setTransactions(txns);
      setNetSpend(spend);
    } catch (error) {
      console.error('Error loading refund data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleLinkRefund = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOriginal || !selectedRefund) return;

    try {
      await linkRefund(selectedOriginal, selectedRefund);
      await loadRefundData();
      setSelectedOriginal('');
      setSelectedRefund('');
      setShowLinkForm(false);
    } catch (error) {
      console.error('Error linking refund:', error);
    }
  };

  const handleUnlinkRefund = async (originalTxId: string) => {
    if (!window.confirm('Unlink this refund?')) return;

    try {
      await unlinkRefund(originalTxId);
      await loadRefundData();
    } catch (error) {
      console.error('Error unlinking refund:', error);
    }
  };

  const debitTransactions = transactions.filter(t => t.type === 'debit' && !t.refundLinkedId);
  const creditTransactions = transactions.filter(t => t.type === 'credit');

  if (loading) {
    return <div className="p-4 text-center">Loading refund data...</div>;
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full">
      <div className="mb-8">
        <h2 className="text-3xl font-bold text-gray-900 mb-2">Refunds</h2>
        <p className="text-gray-600">Link refunds to original transactions and track net spending.</p>
      </div>

      {netSpend && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <p className="text-sm text-gray-600 mb-2">Total Debits</p>
            <p className="text-2xl font-bold text-gray-900">
              {formatCurrency(netSpend.totalDebits)}
            </p>
          </div>
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <p className="text-sm text-gray-600 mb-2">Total Refunded</p>
            <p className="text-2xl font-bold text-green-600">
              {formatCurrency(netSpend.totalRefunded)}
            </p>
          </div>
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <p className="text-sm text-gray-600 mb-2">Net Spend</p>
            <p className="text-2xl font-bold text-gray-900">
              {formatCurrency(netSpend.netSpend)}
            </p>
          </div>
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <p className="text-sm text-gray-600 mb-2">Refund Pairs</p>
            <p className="text-2xl font-bold text-gray-900">
              {netSpend.refundCount}
            </p>
          </div>
        </div>
      )}

      <div className="mb-8">
        <button
          onClick={() => setShowLinkForm(!showLinkForm)}
          className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition"
        >
          {showLinkForm ? 'Cancel' : 'Link Refund'}
        </button>
      </div>

      {showLinkForm && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-8">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Link Refund to Transaction</h3>
          <form onSubmit={handleLinkRefund}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Original Transaction (Debit)
                </label>
                <select
                  value={selectedOriginal}
                  onChange={(e) => setSelectedOriginal(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                >
                  <option value="">Select transaction</option>
                  {debitTransactions.map(t => (
                    <option key={t.id} value={t.id}>
                      {t.merchantName} - {formatCurrency(t.amount)}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Refund Transaction (Credit)
                </label>
                <select
                  value={selectedRefund}
                  onChange={(e) => setSelectedRefund(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                >
                  <option value="">Select refund</option>
                  {creditTransactions.map(t => (
                    <option key={t.id} value={t.id}>
                      {t.merchantName} - {formatCurrency(t.amount)}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <button
              type="submit"
              className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition"
            >
              Link Refund
            </button>
          </form>
        </div>
      )}

      <div>
        <h3 className="text-lg font-bold text-gray-900 mb-4">Linked Refunds</h3>
        {refundPairs.length === 0 ? (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
            <p className="text-gray-500">No linked refunds yet</p>
          </div>
        ) : (
          <div className="space-y-4">
            {refundPairs.map(pair => (
              <div
                key={`${pair.original.id}-${pair.refund.id}`}
                className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 hover:shadow-md transition"
              >
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center mb-4">
                  <div>
                    <p className="text-sm text-gray-600">Original (Debit)</p>
                    <p className="font-semibold text-gray-900">{pair.original.merchant}</p>
                    <p className="text-sm text-gray-600">{pair.original.type}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-gray-900">
                      {formatCurrency(pair.original.amount)}
                    </p>
                    <p className="text-xs text-gray-500">↕️ Linked</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Refund (Credit)</p>
                    <p className="font-semibold text-gray-900">{pair.refund.merchant}</p>
                    <p className="text-sm text-gray-600">
                      {new Date(pair.refund.transactionTime).toLocaleDateString()}
                    </p>
                  </div>
                </div>

                <div className="flex justify-between items-center pt-4 border-t border-gray-100">
                  <p className="text-xs text-gray-500">
                    Linked on {new Date(pair.linkedDate).toLocaleDateString()}
                  </p>
                  <button
                    onClick={() => handleUnlinkRefund(pair.original.id)}
                    className="text-red-600 hover:text-red-700 text-sm"
                  >
                    Unlink
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
