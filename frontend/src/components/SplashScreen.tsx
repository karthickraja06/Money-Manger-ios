import { useEffect, useState } from 'react';

interface SplashScreenProps {
  isLoading: boolean;
  isDark?: boolean;
}

export const SplashScreen = ({ isLoading, isDark = false }: SplashScreenProps) => {
  const [show, setShow] = useState(isLoading);

  useEffect(() => {
    if (isLoading) {
      setShow(true);
    } else {
      // Add a small delay before fadingout for smooth transition
      const timer = setTimeout(() => setShow(false), 300);
      return () => clearTimeout(timer);
    }
  }, [isLoading]);

  if (!show) return null;

  return (
    <div
      className={`fixed inset-0 z-50 flex flex-col items-center justify-center transition-opacity duration-300 ${
        isLoading ? 'opacity-100' : 'opacity-0 pointer-events-none'
      } ${isDark ? 'bg-gradient-to-br from-gray-900 to-gray-800' : 'bg-gradient-to-br from-blue-50 to-blue-100'}`}
    >
      {/* Logo/App Name */}
      <div className="mb-8">
        <h1 className={`text-4xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
          SpendLens
        </h1>
        <p className={`text-center mt-2 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
          Smart Money Management
        </p>
      </div>

      {/* Loading Spinner */}
      <div className="relative w-16 h-16 mb-8">
        <div
          className={`absolute inset-0 rounded-full ${
            isDark ? 'bg-gradient-to-r from-blue-400 to-blue-600' : 'bg-gradient-to-r from-blue-500 to-blue-600'
          } animate-spin`}
          style={{
            clipPath: 'polygon(50% 0%, 100% 0%, 100% 50%, 50% 50%)',
          }}
        />
        <div
          className={`absolute inset-2 rounded-full ${isDark ? 'bg-gray-800' : 'bg-white'}`}
        />
      </div>

      {/* Loading Text */}
      <p className={`text-center ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
        Loading your finances...
      </p>

      {/* Animated dots */}
      <div className="flex gap-2 mt-4">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className={`w-2 h-2 rounded-full ${isDark ? 'bg-blue-400' : 'bg-blue-600'} animate-bounce`}
            style={{
              animationDelay: `${i * 150}ms`,
            }}
          />
        ))}
      </div>
    </div>
  );
};
