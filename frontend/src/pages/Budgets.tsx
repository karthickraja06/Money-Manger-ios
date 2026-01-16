import { useEffect, useState } from 'react';
import { Budget, BudgetAlert } from '../types';
import { getBudgets, getBudgetAlerts, createBudget, updateBudget, deleteBudget } from '../services/api';
import { formatCurrency } from '../utils/formatters';

export const Budgets = () => {
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [alerts, setAlerts] = useState<BudgetAlert | null>(null);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    category: '',
    monthlyLimit: '',
  });

  useEffect(() => {
    loadBudgets();
  }, []);

  const loadBudgets = async () => {
    setLoading(true);
    try {
      const [budgetsData, alertsData] = await Promise.all([
        getBudgets(),
        getBudgetAlerts(),
      ]);
      setBudgets(budgetsData);
      setAlerts(alertsData);
    } catch (error) {
      console.error('Error loading budgets:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateBudget = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.category || !formData.monthlyLimit) return;

    try {
      const newBudget = await createBudget({
        category: formData.category,
        monthlyLimit: parseInt(formData.monthlyLimit),
      });
      setBudgets([...budgets, newBudget]);
      setFormData({ category: '', monthlyLimit: '' });
      setShowForm(false);
    } catch (error) {
      console.error('Error creating budget:', error);
    }
  };

  const handleUpdateBudget = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingId || !formData.monthlyLimit) return;

    try {
      const updated = await updateBudget(editingId, {
        monthlyLimit: parseInt(formData.monthlyLimit),
      });
      setBudgets(budgets.map(b => b.id === editingId ? updated : b));
      setEditingId(null);
      setFormData({ category: '', monthlyLimit: '' });
    } catch (error) {
      console.error('Error updating budget:', error);
    }
  };

  const handleDeleteBudget = async (id: string) => {
    if (!window.confirm('Delete this budget?')) return;
    try {
      await deleteBudget(id);
      setBudgets(budgets.filter(b => b.id !== id));
    } catch (error) {
      console.error('Error deleting budget:', error);
    }
  };

  const startEdit = (budget: Budget) => {
    setEditingId(budget.id);
    setFormData({ category: budget.category, monthlyLimit: String(budget.monthlyLimit) });
    setShowForm(true);
  };

  const getProgressColor = (percentage: number) => {
    if (percentage > 100) return 'bg-red-500';
    if (percentage > 80) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  if (loading) {
    return <div className="p-4 text-center">Loading budgets...</div>;
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full">
      <div className="mb-8 flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold text-gray-900 mb-2">Budgets</h2>
          <p className="text-gray-600">Track spending limits for each category.</p>
        </div>
        <button
          onClick={() => {
            setEditingId(null);
            setFormData({ category: '', monthlyLimit: '' });
            setShowForm(!showForm);
          }}
          className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition"
        >
          {showForm ? 'Cancel' : 'Add Budget'}
        </button>
      </div>

      {alerts && (alerts.exceeding.length > 0 || alerts.nearLimit.length > 0) && (
        <div className="mb-8">
          {alerts.exceeding.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
              <h3 className="text-red-800 font-semibold mb-2">⚠️ Budget Exceeded</h3>
              <p className="text-red-700 text-sm">
                {alerts.exceeding.map(b => b.category).join(', ')} budgets exceeded
              </p>
            </div>
          )}
          {alerts.nearLimit.length > 0 && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <h3 className="text-yellow-800 font-semibold mb-2">📢 Near Limit</h3>
              <p className="text-yellow-700 text-sm">
                {alerts.nearLimit.map(b => `${b.category} (${b.percentage}%)`).join(', ')}
              </p>
            </div>
          )}
        </div>
      )}

      {showForm && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-8">
          <form onSubmit={editingId ? handleUpdateBudget : handleCreateBudget}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Category
                </label>
                <select
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  disabled={!!editingId}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                >
                  <option value="">Select category</option>
                  {[
                    'Groceries',
                    'Entertainment',
                    'Transport',
                    'Utilities',
                    'Dining',
                    'Shopping',
                    'Health',
                    'Education',
                    'Travel',
                    'Other',
                  ].map(cat => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Monthly Limit
                </label>
                <input
                  type="number"
                  value={formData.monthlyLimit}
                  onChange={(e) => setFormData({ ...formData, monthlyLimit: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  placeholder="5000"
                />
              </div>
            </div>
            <button
              type="submit"
              className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition"
            >
              {editingId ? 'Update' : 'Create'} Budget
            </button>
          </form>
        </div>
      )}

      {budgets.length === 0 ? (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
          <p className="text-gray-500">No budgets created yet</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {budgets.map(budget => (
            <div
              key={budget.id}
              className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 hover:shadow-md transition"
            >
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="text-lg font-bold text-gray-900">{budget.category}</h3>
                  <p className="text-sm text-gray-600">
                    {budget.transactionCount} transactions
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => startEdit(budget)}
                    className="text-blue-600 hover:text-blue-700 text-sm"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDeleteBudget(budget.id)}
                    className="text-red-600 hover:text-red-700 text-sm"
                  >
                    Delete
                  </button>
                </div>
              </div>

              <div className="mb-4">
                <div className="flex justify-between mb-2">
                  <span className="text-sm text-gray-600">Spent</span>
                  <span className="text-sm font-semibold text-gray-900">
                    {formatCurrency(budget.spent)} / {formatCurrency(budget.monthlyLimit)}
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full transition-all ${getProgressColor(budget.percentage)}`}
                    style={{ width: `${Math.min(budget.percentage, 100)}%` }}
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <p className="text-xs text-gray-600">Used</p>
                  <p className="text-lg font-bold text-gray-900">{budget.percentage}%</p>
                </div>
                <div>
                  <p className="text-xs text-gray-600">Spent</p>
                  <p className="text-lg font-bold text-gray-900">
                    {formatCurrency(budget.spent)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-600">Remaining</p>
                  <p className={`text-lg font-bold ${budget.remaining < 0 ? 'text-red-600' : 'text-green-600'}`}>
                    {formatCurrency(budget.remaining)}
                  </p>
                </div>
              </div>

              {budget.isExceeding && (
                <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
                  ⚠️ Budget exceeded by {formatCurrency(Math.abs(budget.remaining))}
                </div>
              )}
              {budget.isNearLimit && !budget.isExceeding && (
                <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded text-yellow-700 text-sm">
                  📢 Approaching budget limit
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
