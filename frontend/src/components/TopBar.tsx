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
    <div className="bg-white border-b border-gray-200 sticky top-0 z-10 overflow-x-hidden">
      <div className="max-w-full px-2 sm:px-4 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-2">
          <h1 className="text-lg sm:text-2xl font-bold text-gray-900 whitespace-nowrap">SpendLens</h1>

          <div className="flex items-center gap-1 sm:gap-3 flex-wrap justify-center">
            <button
              onClick={handlePrevMonth}
              className="p-1 sm:p-2 hover:bg-gray-100 rounded-lg transition-colors flex-shrink-0"
            >
              <ChevronLeft size={18} className="text-gray-600" />
            </button>

            <div className="min-w-[100px] sm:min-w-[140px] text-center flex-shrink-0">
              <p className="font-medium text-gray-900 text-sm sm:text-base">
                {format(selectedMonth, 'MMM yyyy')}
              </p>
            </div>

            <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
              <button
                onClick={() => setViewMode('personal')}
                className={`px-2 sm:px-3 py-1 text-xs sm:text-sm rounded transition-colors whitespace-nowrap ${viewMode === 'personal' ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-700'}`}
              >
                Personal
              </button>
              <button
                onClick={() => setViewMode('business')}
                className={`px-2 sm:px-3 py-1 text-xs sm:text-sm rounded transition-colors whitespace-nowrap ${viewMode === 'business' ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-700'}`}
              >
                Business
              </button>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <button onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} className="px-3 py-1 rounded bg-gray-100 text-sm">
                {theme === 'dark' ? 'Light' : 'Dark'}
              </button>
            </div>

            <button
              onClick={handleNextMonth}
              className="p-1 sm:p-2 hover:bg-gray-100 rounded-lg transition-colors flex-shrink-0"
            >
              <ChevronRight size={18} className="text-gray-600" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
