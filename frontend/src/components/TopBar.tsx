import { format, addMonths, subMonths } from 'date-fns';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useStore } from '../store';

export const TopBar = () => {
  const { selectedMonth, setSelectedMonth, viewMode, setViewMode, theme, setTheme } = useStore();

  const handlePrevMonth = () => {
    setSelectedMonth(subMonths(selectedMonth, 1));
  };

  const handleNextMonth = () => {
    setSelectedMonth(addMonths(selectedMonth, 1));
  };

  return (
    <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <h1 className="text-2xl font-bold text-gray-900">Axio</h1>

          <div className="flex items-center gap-3">
            <button
              onClick={handlePrevMonth}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <ChevronLeft size={20} className="text-gray-600" />
            </button>

            <div className="min-w-[140px] text-center">
              <p className="font-medium text-gray-900">
                {format(selectedMonth, 'MMMM yyyy')}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setViewMode('personal')}
                className={`px-3 py-1 rounded ${viewMode === 'personal' ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-700'}`}
              >
                Personal
              </button>
              <button
                onClick={() => setViewMode('business')}
                className={`px-3 py-1 rounded ${viewMode === 'business' ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-700'}`}
              >
                Business
              </button>
            </div>
            <div className="ml-4 flex items-center gap-2">
              <button onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} className="px-3 py-1 rounded bg-gray-100">
                {theme === 'dark' ? 'Light' : 'Dark'}
              </button>
            </div>

            <button
              onClick={handleNextMonth}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <ChevronRight size={20} className="text-gray-600" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
