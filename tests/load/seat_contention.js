import http from 'k6/http';
import { Counter, Trend } from 'k6/metrics';
import { sleep } from 'k6';

const lockLatency = new Trend('seat_lock_latency', true);
const conflictResponses = new Counter('contention_409');
const serverErrors = new Counter('contention_5xx');
const unexpectedResponses = new Counter('contention_unexpected');
const seatIds = ['A1', 'A2', 'A3', 'A4', 'A5', 'A6', 'A7', 'A8', 'A9', 'B1'];

export const options = {
  summaryTrendStats: ['avg', 'min', 'med', 'max', 'p(50)', 'p(95)', 'p(99)'],
  scenarios: {
    seat_contention: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '15s', target: 1000 },
        { duration: '2s', target: 0 },
      ],
      gracefulRampDown: '0s',
    },
  },
};

export default function () {
  if (__ITER > 0) {
    sleep(1);
    return;
  }

  const headers = {
    'Content-Type': 'application/json',
    'x-load-test-run': 'true',
    'x-load-test-user': `load-vu-${__VU}`,
  };
  const startedAt = Date.now();
  const response = http.post(
    `${__ENV.K6_BASE_URL}/api/booking/create`,
    JSON.stringify({ showId: __ENV.K6_LOAD_TEST_SHOW_ID, selectedSeats: seatIds }),
    { headers },
  );
  lockLatency.add(Date.now() - startedAt);

  if (response.status === 409) {
    conflictResponses.add(1);
    return;
  }
  if (response.status >= 500 || response.status === 0) {
    serverErrors.add(1);
    return;
  }
  if (response.status !== 200) {
    unexpectedResponses.add(1);
    return;
  }

  let booking;
  try {
    booking = response.json();
  } catch {
    unexpectedResponses.add(1);
    return;
  }
  if (!booking?.success || !booking.bookingId) {
    unexpectedResponses.add(1);
    return;
  }

  const confirmation = http.post(
    `${__ENV.K6_BASE_URL}/api/booking/load-test/confirm`,
    JSON.stringify({ bookingId: booking.bookingId }),
    { headers },
  );
  if (confirmation.status === 409) {
    conflictResponses.add(1);
  } else if (confirmation.status >= 500 || confirmation.status === 0) {
    serverErrors.add(1);
  } else if (confirmation.status !== 200) {
    unexpectedResponses.add(1);
  }
}

export function handleSummary(data) {
  return {
    [__ENV.K6_SUMMARY_PATH]: JSON.stringify(data),
  };
}