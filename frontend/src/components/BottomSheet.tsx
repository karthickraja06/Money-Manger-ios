import React from 'react';

interface BottomSheetProps {
  open: boolean;
  onClose: () => void;
  heightPercent?: number;
  children?: React.ReactNode;
}

export const BottomSheet = ({ open, onClose, heightPercent = 90, children }: BottomSheetProps) => {
  return (
    <div
      aria-hidden={!open}
      className={`fixed inset-0 z-50 transition-opacity ${open ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
    >
      <div
        onClick={onClose}
        className={`absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity ${open ? 'opacity-100' : 'opacity-0'}`}
      />

      <div
        role="dialog"
        aria-modal="true"
        style={{ height: `${heightPercent}vh`, maxHeight: `calc(100vh - 80px)` }}
        className={`fixed left-0 right-0 bottom-20 mx-auto w-full max-w-3xl bg-white rounded-t-xl shadow-lg transform transition-transform ${open ? 'translate-y-0' : 'translate-y-full'}`}
      >
        <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-center sticky top-0 bg-white rounded-t-xl z-10">
          <div className="w-10 h-1 rounded-full bg-gray-300" />
        </div>
        <div className="overflow-y-auto h-[calc(100%-60px)] p-4 pb-6">{children}</div>
      </div>
    </div>
  );
};
