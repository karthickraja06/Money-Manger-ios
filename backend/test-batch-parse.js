    // #!/usr/bin/env node

    // /**
    //  * Test script to verify batch parsing is working correctly
    //  * Usage: node test-batch-parse.js
    //  */

    // const mongoose = require('mongoose');
    // const Transaction = require('./src/models/Transaction');
    // const { parseTransactionsInBatches } = require('./src/services/gemini.service');

    // const DB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/money-manager';

    // async function main() {
    //   try {
    //     console.log('\n🔌 Connecting to MongoDB...');
    //     await mongoose.connect(DB_URI);
    //     console.log('✅ Connected\n');

    //     // Get unparsed transactions
    //     console.log('📊 Fetching transactions...');
    //     let allTransactions = await Transaction.find({});
    //     let unparsedTransactions = allTransactions.filter(t => true); //!t.ai_parsed)
        
    //     console.log(`📈 Total transactions: ${allTransactions.length}`);
    //     console.log(`🔴 Unparsed: ${unparsedTransactions.length}`);
    //     console.log(`🟢 Already parsed: ${allTransactions.length - unparsedTransactions.length}\n`);

    //     if (unparsedTransactions.length === 0) {
    //       console.log('✅ All transactions already parsed!');
    //       await mongoose.disconnect();
    //       return;
    //     }

    //     // Show sample
    //     console.log('📋 Sample unparsed transactions:');
    //     for (let i = 0; i < Math.min(3, unparsedTransactions.length); i++) {
    //       const tx = unparsedTransactions[i];
    //       console.log(`  [${i}] ID: ${tx._id}`);
    //       console.log(`      raw_message length: ${tx.raw_message ? tx.raw_message.length : 0}`);
    //       console.log(`      Preview: ${tx.raw_message ? tx.raw_message.substring(0, 60) : '(empty)'}...`);
    //     }
    //     console.log();

    //     // Test with first 10 transactions only
    //     const testCount = Math.min(10, unparsedTransactions.length);
    //     const testTransactions = unparsedTransactions.slice(0, testCount).map(tx => ({
    //       id: tx._id.toString(),
    //       raw_message: tx.raw_message || ''
    //     }));

    //     console.log(`🚀 Testing batch parse with ${testCount} transactions...\n`);
        
    //     const results = await parseTransactionsInBatches(testTransactions, {
    //       maxTokens: 200000,
    //       maxBatchSize: 50
    //     });

    //     console.log(`\n📊 Results Summary:`);
    //     console.log(`   Total: ${results.length}`);
        
    //     const validResults = results.filter(r => r.valid);
    //     const invalidResults = results.filter(r => !r.valid);
    //     const errorResults = results.filter(r => r.error);

    //     console.log(`   Valid: ${validResults.length}`);
    //     console.log(`   Invalid: ${invalidResults.length}`);
    //     console.log(`   Errors: ${errorResults.length}\n`);

    //     // Show some successful parses
    //     if (validResults.length > 0) {
    //       console.log('✅ Sample valid parses:');
    //       for (let i = 0; i < Math.min(3, validResults.length); i++) {
    //         const r = validResults[i];
    //         const data = r.data || {};
    //         console.log(`  [${i}] ${r.transaction_id.substring(0, 8)}...`);
    //         console.log(`      Type: ${data.type}, Amount: ${data.amount}, Merchant: ${data.merchant}`);
    //       }
    //     }

    //     // Show some errors
    //     if (errorResults.length > 0) {
    //       console.log('\n❌ Sample errors:');
    //       for (let i = 0; i < Math.min(3, errorResults.length); i++) {
    //         const r = errorResults[i];
    //         console.log(`  [${i}] ${r.transaction_id.substring(0, 8)}...`);
    //         console.log(`      Error: ${r.error}`);
    //       }
    //     }

    //     console.log('\n✅ Test complete!');
        
    //   } catch (error) {
    //     console.error('❌ Error:', error.message);
    //     console.error(error.stack);
    //   } finally {
    //     await mongoose.disconnect();
    //     process.exit(0);
    //   }
    // }

    // main();
