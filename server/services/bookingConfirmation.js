import mongoose from 'mongoose';
import Stripe from 'stripe';
import Booking from '../models/Booking.js';
import Show from '../models/Show.js';
import { env } from '../configs/env.js';
import { releaseSeatLocks, verifySeatLocks } from './seatLocks.js';
import { emitSeatEvent, emitSeatUpdate } from '../socket/socket.js';
import { invalidateCacheByPrefix } from '../middleware/cache.js';
import { logger } from './logger.js';

class SeatCommitConflict extends Error {}

const sameSeats = (left, right) => {
  const sortedLeft = [...left].sort();
  const sortedRight = [...right].sort();
  return sortedLeft.length === sortedRight.length
    && sortedLeft.every((seat, index) => seat === sortedRight[index]);
};

const refundPayment = async ({ bookingId, fencingToken, paymentIntentId }) => {
  if (!paymentIntentId) {
    return;
  }

  const stripe = new Stripe(env.STRIPE_SECRET_KEY);
  await stripe.refunds.create({ payment_intent: paymentIntentId }, {
    idempotencyKey: `refund_expired_${bookingId}_${fencingToken}`,
  });
};

const publishConfirmedBooking = async ({ showId, seatIds, userId, fencingToken }) => {
  const releasedSeatIds = await releaseSeatLocks({ showId, seatIds, userId, fencingToken });
  emitSeatEvent({
    showId,
    event: 'seats:booked',
    payload: { seatIds, occupiedSeats: seatIds },
  });
  emitSeatUpdate({
    showId,
    occupiedSeats: Object.keys((await Show.findById(showId).lean())?.occupiedSeats || {}),
  });
  if (releasedSeatIds.length > 0) {
    emitSeatEvent({ showId, event: 'seats:released', payload: { seatIds: releasedSeatIds } });
  }
  await invalidateCacheByPrefix(['booking:seats']);
};

const markExpiredConflict = async ({ bookingId, fencingToken, paymentIntentId, refundOnConflict }) => {
  const booking = await Booking.findById(bookingId);
  if (!booking) {
    return { status: 'not_found' };
  }
  const bookingFencingToken = booking.fencingToken || String(fencingToken);
  const fencingTokenFilter = booking.fencingToken
    ? { fencingToken: booking.fencingToken }
    : { fencingToken: { $exists: false } };

  await Booking.updateOne(
    { _id: bookingId, status: { $ne: 'CONFIRMED' }, ...fencingTokenFilter },
    { $set: { status: 'EXPIRED_CONFLICT', isPaid: false, paymentLink: '' } },
  );

  const currentBooking = await Booking.findById(bookingId);
  if (currentBooking?.status === 'CONFIRMED') {
    return { status: 'confirmed', booking: currentBooking };
  }

  const releasedSeatIds = await releaseSeatLocks({
    showId: booking.show,
    seatIds: booking.bookedSeats.map(String),
    userId: booking.user,
    fencingToken: bookingFencingToken,
  });
  if (releasedSeatIds.length > 0) {
    emitSeatEvent({ showId: booking.show, event: 'seats:released', payload: { seatIds: releasedSeatIds } });
  }

  if (refundOnConflict) {
    await refundPayment({ bookingId, fencingToken: bookingFencingToken, paymentIntentId });
  }

  return { status: 'expired_conflict' };
};

export const confirmPaidBooking = async ({
  bookingId,
  userId,
  showId,
  seatIds,
  fencingToken,
  paymentIntentId,
  refundOnConflict = true,
}) => {
  const booking = await Booking.findById(bookingId);
  if (!booking) {
    return { status: 'not_found' };
  }

  if (
    booking.user !== userId
    || booking.show !== showId
    || booking.fencingToken !== String(fencingToken)
    || !sameSeats(booking.bookedSeats.map(String), seatIds.map(String))
  ) {
    logger.warn({
      bookingId,
      userMatches: booking.user === userId,
      showMatches: booking.show === showId,
      fencingTokenMatches: booking.fencingToken === String(fencingToken),
      seatsMatch: sameSeats(booking.bookedSeats.map(String), seatIds.map(String)),
    }, 'Booking confirmation metadata mismatch');
    return markExpiredConflict({ bookingId, fencingToken: String(fencingToken), paymentIntentId, refundOnConflict });
  }

  if (booking.status === 'CONFIRMED' && booking.isPaid) {
    await publishConfirmedBooking({ showId, seatIds, userId, fencingToken });
    return { status: 'confirmed', booking };
  }

  const holdCheck = await verifySeatLocks({ showId, seatIds, userId, fencingToken });
  if (!holdCheck.valid) {
    logger.warn({ bookingId, missingSeatIds: holdCheck.missingSeatIds }, 'Booking seat hold verification failed');
    return markExpiredConflict({ bookingId, fencingToken: String(fencingToken), paymentIntentId, refundOnConflict });
  }

  const session = await mongoose.startSession();
  let alreadyConfirmed = false;
  try {
    await session.withTransaction(async () => {
      alreadyConfirmed = false;
      const currentBooking = await Booking.findById(bookingId).session(session);
      if (currentBooking?.status === 'CONFIRMED' && currentBooking.isPaid) {
        alreadyConfirmed = true;
        return;
      }

      if (
        !currentBooking
        || currentBooking.status !== 'PENDING'
        || currentBooking.fencingToken !== String(fencingToken)
      ) {
        throw new SeatCommitConflict('Booking is no longer pending.');
      }

      const occupiedSeatFilter = { _id: showId };
      const seatUpdates = {};
      for (const seatId of seatIds) {
        occupiedSeatFilter[`occupiedSeats.${seatId}`] = { $exists: false };
        seatUpdates[`occupiedSeats.${seatId}`] = userId;
      }

      const showUpdate = await Show.updateOne(
        occupiedSeatFilter,
        { $set: seatUpdates },
        { session },
      );
      if (showUpdate.matchedCount !== 1) {
        throw new SeatCommitConflict('One or more seats have already been booked.');
      }

      const bookingUpdate = await Booking.updateOne(
        { _id: bookingId, status: 'PENDING', fencingToken: String(fencingToken) },
        { $set: { status: 'CONFIRMED', isPaid: true, paymentLink: '' } },
        { session },
      );
      if (bookingUpdate.matchedCount !== 1) {
        throw new SeatCommitConflict('Booking is no longer pending.');
      }
    });
  } catch (error) {
    if (error instanceof SeatCommitConflict) {
      logger.warn({ bookingId, reason: error.message }, 'Booking MongoDB seat transaction conflicted');
      const currentBooking = await Booking.findById(bookingId);
      if (currentBooking?.status === 'CONFIRMED' && currentBooking.isPaid) {
        alreadyConfirmed = true;
      } else {
        return markExpiredConflict({ bookingId, fencingToken: String(fencingToken), paymentIntentId, refundOnConflict });
      }
    } else {
      throw error;
    }
  } finally {
    await session.endSession();
  }

  if (alreadyConfirmed) {
    await publishConfirmedBooking({ showId, seatIds, userId, fencingToken });
    return { status: 'confirmed', booking: await Booking.findById(bookingId) };
  }

  await publishConfirmedBooking({ showId, seatIds, userId, fencingToken });

  return { status: 'confirmed', booking: await Booking.findById(bookingId) };
};