import mongoose from 'mongoose';


const bookingSchema = new mongoose.Schema({
    user:{type:String, required:true,ref:'User'},
    show:{type:String,required:true,ref:'Show'},
    amount:{type:Number,required:true},
    bookedSeats:{type:Array,required:true},
    isPaid:{type:Boolean,default:false},
    status:{type:String,enum:['PENDING','CONFIRMED','EXPIRED','EXPIRED_CONFLICT'],default:'PENDING'},
    fencingToken:{type:String},
    holdExpiresAt:{type:Date},
    paymentLink:{type:String},
},{timestamps:true});

const Booking=mongoose.model("Booking",bookingSchema);

export default Booking;
