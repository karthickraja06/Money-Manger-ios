import React, { useRef, useState } from 'react';
import { Upload, Check, AlertCircle, Loader } from 'lucide-react';

interface ImportResult {
  status: 'success' | 'error' | 'idle';
  message: string;
  summary?: {
    deleted: number;
    imported: number;
    openingBalance: number | null;
    closingBalance: number | null;
    balanceMismatch: boolean;
    parseEngine?: string;
    dateRange: { start: string; end: string };
  };
}

interface StatementImportProps {
  accountId: string;
  onSuccess?: () => void;
}

export const StatementImport: React.FC<StatementImportProps> = ({
  accountId,
  onSuccess,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<ImportResult>({ status: 'idle', message: '' });

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleFile(files[0]);
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFile(e.target.files[0]);
    }
  };

  const handleFile = async (file: File) => {
    // Validate file type
    const validTypes = [
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/pdf',
    ];

    const fileName = file.name.toLowerCase();
    const isValidType = validTypes.includes(file.type) ||
      fileName.endsWith('.xlsx') ||
      fileName.endsWith('.xls') ||
      fileName.endsWith('.pdf');

    if (!isValidType) {
      setResult({
        status: 'error',
        message: 'Invalid file type. Please upload XLS, XLSX, or PDF files only.',
      });
      return;
    }

    // Validate file size (10MB limit)
    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
      setResult({
        status: 'error',
        message: 'File size exceeds 10MB limit.',
      });
      return;
    }

    setIsLoading(true);
    setResult({ status: 'idle', message: '' });

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('account_id', accountId);

      // Use environment variable or default to production
      // For local development: set     ¸ˇ ̰ˀ=http://localhost:5000
      //const apiBase = (import.meta as any)?.env?.VITE_API_BASE || 'http://localhost:5000';
      const apiBase =  'http://localhost:3000';
      const apiKey = 'ios_secret_key_123';

      console.log('[StatementImport] Uploading to:', `${apiBase}/statement/import`);

      const response = await fetch(`${apiBase}/statement/import`, {
        method: 'POST',
        headers: {
          'x-api-key': apiKey,
        },
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || data.message || 'Failed to import statement');
      }

      setResult({
        status: 'success',
        message: data.message,
        summary: data.summary,
      });

      // Clear file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }

      // Trigger callback after 2 seconds
      setTimeout(() => {
        onSuccess?.();
      }, 2000);
    } catch (error: any) {
      const errorMessage = error.message || 'Failed to import statement';

      setResult({
        status: 'error',
        message: errorMessage,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="w-full max-w-xl">
      {/* Drag and Drop Area */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={triggerFileInput}
        className={`
          relative p-8 border-2 border-dashed rounded-2xl cursor-pointer
          transition-all duration-200 text-center backdrop-blur-sm
          ${isDragging
            ? 'border-emerald-400 bg-emerald-50/80 dark:bg-emerald-500/10 shadow-lg shadow-emerald-500/10'
            : 'border-gray-300/80 dark:border-gray-700 hover:border-emerald-400 dark:hover:border-emerald-400 bg-white/70 dark:bg-slate-900/60'
          }
          ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}
        `}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".xls,.xlsx,.pdf"
          onChange={handleFileInput}
          className="hidden"
          disabled={isLoading}
        />

        {isLoading ? (
          <div className="flex flex-col items-center gap-3">
            <Loader className="w-8 h-8 text-emerald-500 animate-spin" />
            <p className="text-sm text-gray-600 dark:text-gray-300">
              Importing statement...
            </p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3">
            <Upload className="w-8 h-8 text-emerald-500" />
            <div>
              <p className="font-semibold text-gray-900 dark:text-white">
                Drag and drop your statement
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                or click to browse (XLS, XLSX, PDF • Max 10MB)
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Result Messages */}
      {result.status !== 'idle' && (
        <div className={`
          mt-4 p-4 rounded-xl flex gap-3 border
          ${result.status === 'success'
            ? 'bg-emerald-50/90 dark:bg-emerald-500/10 text-emerald-900 dark:text-emerald-100 border-emerald-200/70 dark:border-emerald-500/20'
            : 'bg-red-50/90 dark:bg-red-500/10 text-red-900 dark:text-red-100 border-red-200/70 dark:border-red-500/20'
          }
        `}>
          {result.status === 'success' ? (
            <Check className="w-5 h-5 flex-shrink-0 mt-0.5" />
          ) : (
            <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
          )}
          <div>
            <p className="font-medium">{result.message}</p>
            {result.summary && (
              <div className="mt-3 text-sm space-y-1">
                <p>
                  Deleted: <span className="font-semibold">{result.summary.deleted}</span>
                </p>
                <p>
                  Imported: <span className="font-semibold">{result.summary.imported}</span>
                </p>
                <p>
                  Date Range:{' '}
                  <span className="font-semibold">
                    {result.summary.dateRange.start} to {result.summary.dateRange.end}
                  </span>
                </p>
                <p>
                  Parse Mode:{' '}
                  <span className="font-semibold">
                    {result.summary.parseEngine || 'unknown'}
                  </span>
                </p>
                <p>
                  Opening Balance:{' '}
                  <span className="font-semibold">
                    {result.summary.openingBalance != null
                      ? `₹${result.summary.openingBalance.toLocaleString('en-IN')}`
                      : 'Not found'}
                  </span>
                </p>
                <p>
                  Closing Balance:{' '}
                  <span className="font-semibold">
                    {result.summary.closingBalance != null
                      ? `₹${result.summary.closingBalance.toLocaleString('en-IN')}`
                      : 'Not found'}
                  </span>
                </p>
                {result.summary.balanceMismatch && (
                  <p className="text-yellow-700 dark:text-yellow-300 font-medium mt-2">
                    ⚠️ Opening balance mismatch detected
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default StatementImport;
