import Show from "../models/Show.js"
import Booking from "../models/Booking.js";
import Stripe from 'stripe';
import { emitSeatUpdate } from "../socket/socket.js";
import { env } from "../configs/env.js";
import { invalidateCacheByPrefix } from "../middleware/cache.js";

const getAuthUserId = (req) => {
    if (typeof req.auth === 'function') {
        const authResult = req.auth();
        if (authResult?.userId) {
            return authResult.userId;
        }
    }

    if (req.auth?.userId) {
        return req.auth.userId;
    }

    if (process.env.NODE_ENV !== 'production') {
        return process.env.DEV_BOOKING_USER_ID || 'dev-user';
    }

    return null;
};

//function 
const checkSeatsAvailability = async(showId,selectedSeats)=>{
    try{
    const showData= await Show.findById(showId)
    if(!showData){
        return false;
    }
    const occupiedSeats=showData.occupiedSeats;
    const isAnySeatTaken=selectedSeats.some(seat=>occupiedSeats[seat]);
    return !isAnySeatTaken;
}
    catch(error){
    console.log(error.message);
    return false;
    }
}

export const createBooking=async(req,res)=>{
    try{
        const userId = getAuthUserId(req);
        if (!userId) {
            return res.status(401).json({ success: false, message: 'Unauthorized' });
        }
        const{showId,selectedSeats}=req.body;
        if (!showId || !Array.isArray(selectedSeats) || selectedSeats.length === 0) {
            return res.status(400).json({ success: false, message: 'showId and selectedSeats are required.' });
        }

        if (selectedSeats.length > 5) {
            return res.status(400).json({ success: false, message: 'Maximum 5 seats can be booked at once.' });
        }

        const bookingOrigin = req.headers.origin || env.CLIENT_URL || 'http://localhost:5173';
        const isAvailable=await checkSeatsAvailability(showId,selectedSeats);
        if(!isAvailable){
            return res.status(409).json({success:false,message:'Some selected seats are already booked. Please choose different seats.'});
    }
    const showData=await Show.findById(showId).populate('movie');
    if (!showData) {
        return res.status(404).json({ success: false, message: 'Show not found' });
    }

    if (!showData.movie?.title) {
        return res.status(400).json({ success: false, message: 'Movie details unavailable for this show.' });
    }

    //create a new booking
    const booking=await Booking.create({
        user:userId,
        show:showId,
        amount:showData.showPrice * selectedSeats.length,
        bookedSeats:selectedSeats,
    })
    selectedSeats.forEach(seat=>{
        showData.occupiedSeats[seat]=userId;
    })
    showData.markModified('occupiedSeats');
    await showData.save();

    try {
        //stripe gateway
        const stripeInstance=new Stripe(env.STRIPE_SECRET_KEY);
        //creating line items for stripe 
        const line_items=[{
            price_data:{
                currency:'usd',
                product_data:{
                    name:showData.movie.title
                },
                unit_amount:Math.floor(booking.amount) * 100,
            },
            quantity:1,
            }
        ]
        const session=await stripeInstance.checkout.sessions.create({
            success_url:`${bookingOrigin}/my-bookings`,
            cancel_url:`${bookingOrigin}/my-bookings`,
            line_items:line_items,
            mode:'payment',
            metadata:{
                bookingId:booking._id.toString(),
            },
            payment_intent_data: {
                metadata: {
                    bookingId: booking._id.toString(),
                }
            },
            expires_at:Math.floor(Date.now()/1000)+30*60, //30 minutes
        }, {
            idempotencyKey: `checkout_${booking._id.toString()}`,
        });

        booking.paymentLink=session.url;
        await booking.save();
        await invalidateCacheByPrefix(['booking:seats']);

        emitSeatUpdate({
            showId: showId.toString(),
            occupiedSeats: Object.keys(showData.occupiedSeats),
        });

        res.json({success:true,url:session.url});
    } catch (stripeError) {
        // Roll back reserved seats and booking if Stripe session creation fails.
        selectedSeats.forEach((seat) => {
            if (showData.occupiedSeats[seat] === userId) {
                delete showData.occupiedSeats[seat];
            }
        });
        showData.markModified('occupiedSeats');
        await showData.save();
        await Booking.findByIdAndDelete(booking._id);
        await invalidateCacheByPrefix(['booking:seats']);

        emitSeatUpdate({
            showId: showId.toString(),
            occupiedSeats: Object.keys(showData.occupiedSeats),
        });

        return res.status(502).json({ success: false, message: 'Unable to initialize payment session. Please try again.' });
    }
}
    catch(error){
        console.log(error.message);
        res.status(500).json({success:false,message:error.message});
    }
}

export const getOccupiedSeats=async(req,res)=>{
    try{
        const {showId}=req.params;
        const showData=await Show.findById(showId);

        if (!showData) {
            return res.status(404).json({ success: false, message: 'Show not found' });
        }

        const occupiedSeats=Object.keys(showData.occupiedSeats);

        res.json({success:true,occupiedSeats});

    }
    catch(error){
        console.log(error.message);
        res.json({success:false,message:error.message});
    }
}
