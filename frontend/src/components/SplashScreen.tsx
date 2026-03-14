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

  const baseUrl = ((import.meta as any)?.env?.BASE_URL as string) || '/';
  const splashImage = isDark ? `${baseUrl}spendlens/splash-dark.png` : `${baseUrl}spendlens/splash-light.png`;

  return (
    <div
      className={`fixed inset-0 z-50 flex flex-col items-center justify-center transition-opacity duration-300 ${
        isLoading ? 'opacity-100' : 'opacity-0 pointer-events-none'
      } ${isDark ? 'bg-black' : 'bg-white'}`}
    >
      {/* Background splash image */}
      <div className="absolute inset-0">
        <img
          src={splashImage}
          alt="App splash"
          className="w-full h-full object-cover"
        />
      </div>

      {/* Overlay for loader */}
      <div className="relative flex flex-col items-center justify-end pb-16 w-full h-full bg-black/20">
        {/* Loading Text */}
        <p className={`text-center mb-3 ${isDark ? 'text-gray-200' : 'text-white'}`}>
          Loading your finances...
        </p>

        {/* Three-dot loader */}
        <div className="flex gap-2">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="w-2.5 h-2.5 rounded-full bg-white animate-bounce"
              style={{
                animationDelay: `${i * 150}ms`,
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
};
