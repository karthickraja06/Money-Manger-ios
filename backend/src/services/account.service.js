const Account = require("../models/Account");

module.exports.getOrCreateAccountAndUpdateBalance = async (
  user_id,
  bank_name,
  parsedTxn
) => {
  let account = await Account.findOne({ user_id, bank_name });

  if (!account) {
    account = await Account.create({
      user_id,
      bank_name
    });
  }

  // Priority 1: Balance explicitly present in SMS
  if (parsedTxn.balance_from_sms !== null) {
    account.current_balance = parsedTxn.balance_from_sms;
    account.balance_source = "sms";
    account.last_balance_update_at = new Date();
  }
  // Priority 2: Derived calculation (only if no SMS balance)
  else if (parsedTxn.type !== "unknown" && account.current_balance !== null) {
    if (parsedTxn.type === "debit") {
      account.current_balance -= parsedTxn.amount;
    } else if (parsedTxn.type === "credit") {
      account.current_balance += parsedTxn.amount;
    }
    account.balance_source = "calculated";
    account.last_balance_update_at = new Date();
  }

  await account.save();
  return account;
};
