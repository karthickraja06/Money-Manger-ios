// Simple dedupe script: find accounts with same user_id + bank_name and merge them
// Usage: node src/tools/dedupeAccounts.js

const mongoose = require('mongoose');
const Account = require('../models/Account');
const Transaction = require('../models/Transaction');
const db = require('../config/db');

async function run() {
  await db.connect();

  const groups = await Account.aggregate([
    { $match: {} },
    { $group: { _id: { user_id: '$user_id', bank_name: '$bank_name' }, count: { $sum: 1 }, ids: { $push: '$_id' }, docs: { $push: '$$ROOT' } } },
    { $match: { count: { $gt: 1 } } }
  ]);

  console.log('Found', groups.length, 'duplicate account-groups');

  for (const g of groups) {
    const docs = g.docs;
    // Choose winner: prefer one with account_number, then most recent last_balance_update_at
    docs.sort((a, b) => {
      if (a.account_number && !b.account_number) return -1;
      if (b.account_number && !a.account_number) return 1;
      const at = new Date(b.last_balance_update_at || b.created_at).getTime();
      const bt = new Date(a.last_balance_update_at || a.created_at).getTime();
      return at - bt;
    });

    const winner = docs[0];
    const losers = docs.slice(1);

    console.log('Merging', losers.length, 'into', winner._id.toString());

    // Reassign transactions
    const loserIds = losers.map(l => l._id);
    await Transaction.updateMany({ account_id: { $in: loserIds } }, { $set: { account_id: winner._id } });

    // Merge balances if winner missing
    for (const loser of losers) {
      if ((winner.current_balance === null || winner.current_balance === undefined) && (loser.current_balance !== null && loser.current_balance !== undefined)) {
        winner.current_balance = loser.current_balance;
        winner.balance_source = loser.balance_source || winner.balance_source;
      }
    }

    // Save winner
    await Account.updateOne({ _id: winner._id }, { $set: { current_balance: winner.current_balance, balance_source: winner.balance_source } });

    // Remove losers
    await Account.deleteMany({ _id: { $in: loserIds } });
  }

  console.log('Done dedupe');
  process.exit(0);
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
