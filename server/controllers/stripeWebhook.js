import Stripe from 'stripe';
import { env } from '../configs/env.js';
import { logger } from '../services/logger.js';
import { confirmPaidBooking } from '../services/bookingConfirmation.js';

const getPaymentIntentId = (paymentIntent) => {
    if (typeof paymentIntent === 'string') {
        return paymentIntent;
    }
    return paymentIntent?.id || null;
};

const processPaidMetadata = async (metadata, paymentIntentId) => {
    const bookingId = metadata?.bookingId;
    if (!bookingId) {
        logger.error('Paid Stripe event is missing bookingId metadata');
        return;
    }

    const seatIds = typeof metadata.seatIds === 'string'
        ? metadata.seatIds.split(',').filter(Boolean)
        : [];
    const result = await confirmPaidBooking({
        bookingId,
        userId: metadata.userId || '',
        showId: metadata.showId || '',
        seatIds,
        fencingToken: metadata.fencingToken || 'missing',
        paymentIntentId,
    });

    if (result.status === 'not_found') {
        logger.error({ bookingId }, 'Paid Stripe event references a missing booking');
    }
};

export const stripeWebhooks = async (request, response) => {
    const stripe = new Stripe(env.STRIPE_SECRET_KEY);
    let event;

    try {
        event = stripe.webhooks.constructEvent(
            request.body,
            request.headers['stripe-signature'],
            env.STRIPE_WEBHOOK_SECRET,
        );
    } catch (error) {
        return response.status(400).send(`Webhook Error:${error.message}`);
    }

    try {
        switch (event.type) {
            case 'checkout.session.completed':
            case 'checkout.session.async_payment_succeeded': {
                const checkoutSession = event.data.object;
                if (checkoutSession.payment_status === 'paid') {
                    await processPaidMetadata(
                        checkoutSession.metadata,
                        getPaymentIntentId(checkoutSession.payment_intent),
                    );
                }
                break;
            }
            case 'payment_intent.succeeded': {
                const paymentIntent = event.data.object;
                await processPaidMetadata(paymentIntent.metadata, paymentIntent.id);
                break;
            }
            default:
                logger.info({ eventType: event.type }, 'Unhandled Stripe event type');
        }

        return response.json({ received: true });
    } catch (error) {
        logger.error({ error, eventId: event.id }, 'Stripe webhook processing failed');
        return response.status(500).send('Internal Server Error');
    }
};