import { useEffect, useState } from 'react';
import { Category } from '../types';
import { getCategories, createCategory, getCategoryIconEmoji } from '../services/api';

export const Categories = () => {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    parentCategory: '',
    keywords: '',
    color: '#808080',
    icon: '',
  });

  useEffect(() => {
    loadCategories();
  }, []);

  const loadCategories = async () => {
    setLoading(true);
    try {
      const data = await getCategories();
      setCategories(data);
    } catch (error) {
      console.warn('[Categories] Endpoint not available - showing empty list');
      // Categories endpoint may not be available on this deployment
      setCategories([]);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.parentCategory) return;

    try {
      const newCategory = await createCategory({
        name: formData.name,
        parentCategory: formData.parentCategory,
        keywords: formData.keywords.split(',').map(k => k.trim()),
        color: formData.color,
      });
      setCategories([...categories, newCategory]);
      setFormData({ name: '', parentCategory: '', keywords: '', color: '#808080' });
      setShowForm(false);
    } catch (error) {
      console.error('Error creating category:', error);
    }
  };

  const groupedCategories = categories.reduce((acc, cat) => {
    const parentKey = cat.parentCategory || 'Other';
    if (!acc[parentKey]) {
      acc[parentKey] = [];
    }
    acc[parentKey].push(cat);
    return acc;
  }, {} as Record<string, Category[]>);

  if (loading) {
    return <div className="p-4 text-center text-gray-600 dark:text-gray-300">Loading categories...</div>;
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full">
      <div className="mb-8 flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">Categories</h2>
          <p className="text-gray-600 dark:text-gray-300">Manage custom categories for auto-categorization.</p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="bg-violet-500 text-white px-6 py-2 rounded-lg hover:bg-violet-400 transition"
        >
          {showForm ? 'Cancel' : 'Add Category'}
        </button>
      </div>

      {showForm && (
        <div className="bg-white dark:bg-slate-900 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700 p-6 mb-8">
          <form onSubmit={handleCreateCategory}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Category Name
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-950 rounded-lg"
                  placeholder="e.g., Coffee Shops"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Parent Category
                </label>
                <select
                  value={formData.parentCategory}
                  onChange={(e) => setFormData({ ...formData, parentCategory: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-950 rounded-lg"
                >
                  <option value="">Select parent category</option>
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
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Keywords (comma-separated)
              </label>
              <input
                type="text"
                value={formData.keywords}
                onChange={(e) => setFormData({ ...formData, keywords: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-950 rounded-lg"
                placeholder="e.g., starbucks, coffee, cafe"
              />
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Color
              </label>
              <input
                type="color"
                value={formData.color}
                onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                className="w-16 h-10 border border-gray-300 dark:border-slate-700 rounded-lg cursor-pointer"
              />
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Icon (emoji)
              </label>
              <input
                type="text"
                value={formData.icon}
                onChange={(e) => setFormData({ ...formData, icon: e.target.value })}
                placeholder={getCategoryIconEmoji(formData.parentCategory)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-950 rounded-lg"
                maxLength={4}
              />
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Leave empty to use default: {getCategoryIconEmoji(formData.parentCategory)}
              </p>
            </div>

            <button
              type="submit"
              className="bg-violet-500 text-white px-6 py-2 rounded-lg hover:bg-violet-400 transition"
            >
              Create Category
            </button>
          </form>
        </div>
      )}

      {Object.keys(groupedCategories).length === 0 ? (
        <div className="bg-white dark:bg-slate-900 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700 p-12 text-center">
          <p className="text-gray-500 dark:text-gray-300">No custom categories yet</p>
        </div>
      ) : (
        <div className="space-y-8">
          {Object.entries(groupedCategories).map(([parentCat, cats]) => (
            <div key={parentCat}>
              <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">{parentCat}</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {cats.map(cat => (
                  <div
                    key={cat.id}
                    className="bg-white dark:bg-slate-900 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700 p-4"
                  >
                    <div className="flex items-start gap-3 mb-3">
                      <div className="text-2xl">{getCategoryIconEmoji(cat.parentCategory || '', cat.icon)}</div>
                      <div className="flex-1">
                        <h4 className="font-semibold text-gray-900 dark:text-white">{cat.name}</h4>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {cat.transactionCount} transactions
                        </p>
                      </div>
                      <div
                        className="w-6 h-6 rounded-full border-2 border-gray-300 dark:border-slate-600"
                        style={{ backgroundColor: cat.color }}
                        title="Category color"
                      />
                    </div>

                    {(cat.keywords || []).length > 0 && (
                      <div className="mb-3">
                        <p className="text-xs text-gray-600 dark:text-gray-300 mb-2">Keywords:</p>
                        <div className="flex flex-wrap gap-2">
                          {(cat.keywords || []).map(keyword => (
                            <span
                              key={keyword}
                              className="text-xs bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-gray-200 px-2 py-1 rounded"
                            >
                              {keyword}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="flex gap-2 pt-3 border-t border-gray-100 dark:border-slate-800">
                      <button className="text-sm text-violet-600 dark:text-violet-300 hover:text-violet-700">
                        Edit
                      </button>
                      <button className="text-sm text-red-600 hover:text-red-700">
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
