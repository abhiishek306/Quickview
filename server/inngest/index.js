
import { Inngest } from "inngest";
import User from "../models/User.js";
import Booking from "../models/Booking.js";
import { releaseSeatLocks } from "../services/seatLocks.js";
import { emitSeatEvent } from "../socket/socket.js";
export const inngest = new Inngest({ id: "movie-ticket-booking" });
// Define your Inngest functions here
const synUserCreation=inngest.createFunction(
    {id:'sync-user-from-clerk'},
    {event:'clerk/user.created'},
    async({event})=>{
        const {id,first_name,last_name,email_addresses,profile_image_url}=event.data;
    const UserData={
        _id:id,
        email:email_addresses[0].email_address,
        name:first_name+" "+last_name,
        image:profile_image_url
    }
    await User.create(UserData)
}
)
//inngest function to delete
const synUserDeletion=inngest.createFunction(
    {id:'delete-user-with-clerk'},
    {event:'clerk/user.deleted'},
    async({event})=>{
        const {id}=event.data;
        await User.findByIdAndDelete(id);
}
)

//inngest to update
const synUserUpdation=inngest.createFunction(
    {id:'update-user-from-clerk'},
    {event:'clerk/user.updated'},
    async({event})=>{
        const {id,first_name,last_name,email_addresses,profile_image_url}=event.data;
    const UserData={
        name:first_name+" "+last_name,
        email:email_addresses[0].email_address,
        image:profile_image_url
    }
        await User.findByIdAndUpdate(id, UserData);
}
)

const expireSeatHold = inngest.createFunction(
    { id: 'expire-seat-hold' },
    { event: 'booking/hold.created' },
    async ({ event, step }) => {
        const { bookingId, showId, seatIds, userId, fencingToken } = event.data;
        await step.sleep('wait-for-hold-expiry', '5m');

        const booking = await Booking.findById(bookingId);
        if (!booking || booking.isPaid || booking.status === 'CONFIRMED') {
            return { expired: false };
        }

        if (booking.status === 'PENDING') {
            const expiredBooking = await Booking.findOneAndUpdate(
                { _id: bookingId, status: 'PENDING', isPaid: false },
                { $set: { status: 'EXPIRED', paymentLink: '' } },
                { new: true },
            );
            if (!expiredBooking) {
                return { expired: false };
            }
        } else if (booking.status !== 'EXPIRED') {
            return { expired: false };
        }

        const releasedSeatIds = await releaseSeatLocks({ showId, seatIds, userId, fencingToken });
        if (releasedSeatIds.length > 0) {
            emitSeatEvent({ showId, event: 'seats:released', payload: { seatIds: releasedSeatIds } });
        }

        return { expired: true, releasedSeatIds };
    },
);

export const functions = [synUserCreation,synUserDeletion,synUserUpdation,expireSeatHold];