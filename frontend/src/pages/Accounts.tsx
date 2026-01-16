import { useStore } from '../store';
import { formatCurrency } from '../utils/formatters';

export const Accounts = () => {
  const { accounts } = useStore();

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full">
      <div className="mb-8">
        <h2 className="text-3xl font-bold text-gray-900 mb-2">Accounts</h2>
        <p className="text-gray-600">Manage all your bank accounts in one place.</p>
      </div>

      {accounts.length === 0 ? (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
          <p className="text-gray-500">No accounts found</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {accounts.map((account) => (
            <div
              key={account.id}
              className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow hover:border-blue-200"
            >
              <div className="mb-6">
                <p className="text-sm text-gray-600 mb-2">Bank Name</p>
                <h3 className="text-xl font-bold text-gray-900">
                  {account.bankName}
                </h3>
              </div>

              <div className="mb-6 pb-6 border-b border-gray-100">
                <p className="text-sm text-gray-600 mb-2">Account Number</p>
                <p className="text-lg font-mono text-gray-700">
                  {account.accountNumber}
                </p>
              </div>

              <div className="mb-4">
                <p className="text-sm text-gray-600 mb-2">Current Balance</p>
                <p className="text-3xl font-bold text-gray-900">
                  {formatCurrency(account.balance)}
                </p>
              </div>

              <div className="flex items-center justify-between">
                <span
                  className={`text-xs font-medium px-3 py-1 rounded-full ${
                    account.balanceSource === 'sms'
                      ? 'bg-blue-100 text-blue-700'
                      : 'bg-gray-100 text-gray-700'
                  }`}
                >
                  {account.balanceSource === 'sms' ? 'SMS Update' : 'Calculated'}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
