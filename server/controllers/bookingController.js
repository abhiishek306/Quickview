import mongoose from 'mongoose';
import Show from '../models/Show.js';
import Booking from '../models/Booking.js';
import Stripe from 'stripe';
import { env, loadTestModeEnabled } from '../configs/env.js';
import { inngest } from '../inngest/index.js';
import { logger } from '../services/logger.js';
import { acquireSeatLocks, DEFAULT_HOLD_TTL_MS, getSeatLocks, releaseSeatLocks } from '../services/seatLocks.js';
import { confirmPaidBooking } from '../services/bookingConfirmation.js';
import { emitSeatEvent } from '../socket/socket.js';

const getAuthUserId = (req) => {
    if (loadTestModeEnabled) {
        const testUserId = req.get('x-load-test-user');
        if (testUserId && testUserId.length <= 128) {
            return testUserId;
        }
    }

    if (typeof req.auth === 'function') {
        const authResult = req.auth();
        if (authResult?.userId) {
            return authResult.userId;
        }
    }

    if (req.auth?.userId) {
        return req.auth.userId;
    }

    if (process.env.NODE_ENV === 'development') {
        return process.env.DEV_BOOKING_USER_ID || 'dev-user';
    }

    return null;
};

const emitReleasedSeats = (showId, seatIds) => {
    if (seatIds.length > 0) {
        emitSeatEvent({ showId, event: 'seats:released', payload: { seatIds } });
    }
};

export const createBooking = async (req, res) => {
    let reservation;
    let booking;

    try {
        const userId = getAuthUserId(req);
        if (!userId) {
            return res.status(401).json({ success: false, message: 'Unauthorized' });
        }

        const { showId, selectedSeats } = req.body;
        const maxSeats = loadTestModeEnabled ? 10 : 5;
        if (
            !mongoose.isValidObjectId(showId)
            || !Array.isArray(selectedSeats)
            || selectedSeats.length === 0
            || selectedSeats.length > maxSeats
            || selectedSeats.some((seat) => typeof seat !== 'string' || !/^[A-Z]\d{1,2}$/.test(seat))
            || new Set(selectedSeats).size !== selectedSeats.length
        ) {
            return res.status(400).json({ success: false, message: 'A valid showId and unique seat IDs are required.' });
        }

        const showData = await Show.findById(showId).populate('movie');
        if (!showData) {
            return res.status(404).json({ success: false, message: 'Show not found' });
        }
        if (!showData.movie?.title) {
            return res.status(400).json({ success: false, message: 'Movie details unavailable for this show.' });
        }

        const alreadyBooked = selectedSeats.filter((seat) => showData.occupiedSeats?.[seat]);
        if (alreadyBooked.length > 0) {
            return res.status(409).json({
                success: false,
                message: 'Some selected seats are already booked. Please choose different seats.',
                conflictingSeatIds: alreadyBooked,
            });
        }

        try {
            reservation = await acquireSeatLocks({
                showId,
                seatIds: selectedSeats,
                userId,
                ttlMs: DEFAULT_HOLD_TTL_MS,
            });
        } catch (error) {
            logger.error({ error, showId }, 'Seat reservation service unavailable');
            return res.status(503).json({ success: false, message: 'Seat reservation is temporarily unavailable.' });
        }

        if (!reservation.success) {
            return res.status(409).json({
                success: false,
                message: 'Some selected seats are currently held. Please choose different seats.',
                conflictingSeatIds: reservation.conflictingSeatIds,
            });
        }

        booking = await Booking.create({
            user: userId,
            show: showId,
            amount: showData.showPrice * selectedSeats.length,
            bookedSeats: selectedSeats,
            status: 'PENDING',
            fencingToken: reservation.fencingToken,
            holdExpiresAt: new Date(reservation.expiresAt),
        });

        emitSeatEvent({
            showId,
            event: 'seats:locked',
            payload: { seatIds: selectedSeats, userId, expiresAt: reservation.expiresAt },
        });

        if (!loadTestModeEnabled) {
            try {
                await inngest.send({
                    name: 'booking/hold.created',
                    data: {
                        bookingId: booking._id.toString(),
                        showId,
                        seatIds: selectedSeats,
                        userId,
                        fencingToken: reservation.fencingToken,
                        ttlMs: DEFAULT_HOLD_TTL_MS,
                    },
                });
            } catch (error) {
                logger.error({ error, bookingId: booking._id }, 'Failed scheduling seat hold expiry');
                throw error;
            }
        }

        if (loadTestModeEnabled) {
            return res.json({
                success: true,
                bookingId: booking._id.toString(),
                holdExpiresAt: reservation.expiresAt,
            });
        }

        const bookingOrigin = req.headers.origin || env.CLIENT_URL || 'http://localhost:5173';
        const stripe = new Stripe(env.STRIPE_SECRET_KEY);
        const session = await stripe.checkout.sessions.create({
            success_url: `${bookingOrigin}/my-bookings`,
            cancel_url: `${bookingOrigin}/my-bookings`,
            line_items: [{
                price_data: {
                    currency: 'usd',
                    product_data: { name: showData.movie.title },
                    unit_amount: Math.floor(booking.amount) * 100,
                },
                quantity: 1,
            }],
            mode: 'payment',
            metadata: {
                bookingId: booking._id.toString(),
                userId,
                showId,
                seatIds: selectedSeats.join(','),
                fencingToken: reservation.fencingToken,
            },
            payment_intent_data: {
                metadata: {
                    bookingId: booking._id.toString(),
                    userId,
                    showId,
                    seatIds: selectedSeats.join(','),
                    fencingToken: reservation.fencingToken,
                },
            },
            expires_at: Math.floor(Date.now() / 1000) + 30 * 60,
        }, {
            idempotencyKey: `checkout_${booking._id}_${reservation.fencingToken}`,
        });

        booking.paymentLink = session.url;
        await booking.save();
        return res.json({ success: true, url: session.url, bookingId: booking._id.toString() });
    } catch (error) {
        if (booking && reservation?.fencingToken) {
            await Booking.updateOne(
                { _id: booking._id, status: 'PENDING' },
                { $set: { status: 'EXPIRED', paymentLink: '' } },
            );
        }

        if (reservation?.success && req.body?.showId) {
            try {
                const releasedSeatIds = await releaseSeatLocks({
                    showId: req.body.showId,
                    seatIds: req.body.selectedSeats,
                    userId: getAuthUserId(req),
                    fencingToken: reservation.fencingToken,
                });
                emitReleasedSeats(req.body.showId, releasedSeatIds);
            } catch (releaseError) {
                logger.error({ releaseError }, 'Failed releasing reservation after checkout error');
            }
        }

        logger.error({ error }, 'Booking creation failed');
        return res.status(500).json({ success: false, message: 'Unable to create booking.' });
    }
};

export const getOccupiedSeats = async (req, res) => {
    try {
        const { showId } = req.params;
        const showData = await Show.findById(showId);
        if (!showData) {
            return res.status(404).json({ success: false, message: 'Show not found' });
        }

        const seatLocks = await getSeatLocks(showId);
        return res.json({
            success: true,
            occupiedSeats: Object.keys(showData.occupiedSeats || {}),
            seatLocks,
        });
    } catch (error) {
        logger.error({ error }, 'Failed loading occupied seats');
        return res.status(500).json({ success: false, message: 'Unable to load seat availability.' });
    }
};

export const confirmLoadTestBooking = async (req, res) => {
    if (!loadTestModeEnabled) {
        return res.sendStatus(404);
    }

    try {
        const booking = await Booking.findById(req.body.bookingId);
        if (!booking) {
            return res.status(404).json({ success: false, message: 'Booking not found.' });
        }

        const result = await confirmPaidBooking({
            bookingId: booking._id.toString(),
            userId: booking.user,
            showId: booking.show,
            seatIds: booking.bookedSeats.map(String),
            fencingToken: booking.fencingToken,
            paymentIntentId: null,
            refundOnConflict: false,
        });
        if (result.status !== 'confirmed') {
            return res.status(409).json({ success: false, message: 'Reservation expired or conflicted.' });
        }

        return res.json({ success: true, status: result.status });
    } catch (error) {
        logger.error({ error }, 'Load-test booking confirmation failed');
        return res.status(500).json({ success: false, message: 'Unable to confirm test booking.' });
    }
};