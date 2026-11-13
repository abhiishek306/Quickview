import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import Booking from '../../server/models/Booking.js';
import { resolveMongoUri } from '../../server/configs/db.js';

const require = createRequire(new URL('../../server/package.json', import.meta.url));
const mongoose = require('mongoose');

const showId = process.env.LOAD_TEST_SHOW_ID;
const summaryPath = process.env.LOAD_TEST_SUMMARY_PATH;

const printRow = (label, value, result = '') => {
  console.log(`| ${label.padEnd(27)} | ${String(value).padEnd(14)} | ${result.padEnd(8)} |`);
};

const run = async () => {
  if (!showId || !summaryPath || !process.env.MONGODB_URI) {
    throw new Error('LOAD_TEST_SHOW_ID, LOAD_TEST_SUMMARY_PATH, and MONGODB_URI are required.');
  }

  const summary = JSON.parse(await readFile(summaryPath, 'utf8'));
  await mongoose.connect(resolveMongoUri());

  try {
    const confirmedBookings = await Booking.find({ show: showId, status: 'CONFIRMED', isPaid: true }).lean();
    const confirmedSeats = confirmedBookings.flatMap((booking) => booking.bookedSeats.map(String));
    const seatCounts = new Map();
    for (const seatId of confirmedSeats) {
      seatCounts.set(seatId, (seatCounts.get(seatId) || 0) + 1);
    }

    const duplicateBookings = [...seatCounts.values()].filter((count) => count > 1).length;
    const lockMetrics = summary.metrics.seat_lock_latency?.values || {};
    const requestRate = summary.metrics.http_reqs?.values?.rate || 0;
    const cleanConflicts = summary.metrics.contention_409?.values?.count || 0;
    const serverErrorCount = summary.metrics.contention_5xx?.values?.count || 0;
    const unexpectedCount = summary.metrics.contention_unexpected?.values?.count || 0;
    const checks = [
      ['Confirmed seat total', confirmedSeats.length === 10],
      ['Duplicate show/seat bookings', duplicateBookings === 0],
      ['Clean 409 contention responses', cleanConflicts > 0 && serverErrorCount === 0 && unexpectedCount === 0],
    ];

    console.log('| Metric                      | Value          | Status   |');
    console.log('|-----------------------------|----------------|----------|');
    printRow('Requests/sec', requestRate.toFixed(2));
    printRow('Lock latency p50 (ms)', (lockMetrics['p(50)'] || 0).toFixed(2));
    printRow('Lock latency p95 (ms)', (lockMetrics['p(95)'] || 0).toFixed(2));
    printRow('Lock latency p99 (ms)', (lockMetrics['p(99)'] || 0).toFixed(2));
    printRow('Confirmed seats', confirmedSeats.length, checks[0][1] ? 'PASS' : 'FAIL');
    printRow('Duplicate bookings', duplicateBookings, checks[1][1] ? 'PASS' : 'FAIL');
    printRow('409s / 5xx / unexpected', `${cleanConflicts} / ${serverErrorCount} / ${unexpectedCount}`, checks[2][1] ? 'PASS' : 'FAIL');

    if (checks.some(([, passed]) => !passed)) {
      process.exitCode = 1;
    }
  } finally {
    await mongoose.disconnect();
  }
};

run().catch((error) => {
  console.error('Contention invariant verification failed:', error.message);
  process.exitCode = 1;
});