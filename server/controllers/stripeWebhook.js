import stripe from 'stripe';
import Booking from '../models/Booking.js';
import { env } from '../configs/env.js';

export const stripeWebhooks=async(request,response)=>{
    const stripeInstance=new stripe(env.STRIPE_SECRET_KEY);
    const sig=request.headers['stripe-signature'];

    let event;

    try{
        event=stripeInstance.webhooks.constructEvent(request.body,sig,env.STRIPE_WEBHOOK_SECRET);
    }
    catch(error){
        return response.status(400).send(`Webhook Error:${error.message}`);
    }

     try{
        switch(event.type){
            case "payment_intent.succeeded":{
                const paymentIntent=event.data.object;
                const bookingId = paymentIntent?.metadata?.bookingId;
                if (!bookingId) {
                    console.error('payment_intent.succeeded missing bookingId in metadata');
                    break;
                }
                try {
                    const result = await Booking.findByIdAndUpdate(bookingId,{isPaid:true,paymentLink:""});
                    if (!result) {
                        console.error('Booking not found for id:', bookingId);
                    }
                } catch (e) {
                    console.error('DB update error for bookingId', bookingId, e.message);
                    // Return 200 to avoid infinite retries if this is a non-recoverable id issue
                }
                break;

            }
            case "checkout.session.completed":{
                const session = event.data.object;
                const bookingId = session?.metadata?.bookingId;
                if (!bookingId) {
                    console.error('checkout.session.completed missing bookingId in metadata');
                    break;
                }
                try {
                    const result = await Booking.findByIdAndUpdate(bookingId,{isPaid:true,paymentLink:""});
                    if (!result) {
                        console.error('Booking not found for id:', bookingId);
                    }
                } catch (e) {
                    console.error('DB update error for bookingId', bookingId, e.message);
                }
                break;
            }
            default:console.log('Unhandled event type:',event.type);
        }
        response.json({received:true});

     }
     catch(err){
        console.error("WebHook processing error:",err);
        response.status(500).send('Internal Server Error');


     }

}