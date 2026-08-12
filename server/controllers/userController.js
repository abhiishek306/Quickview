import { clerkClient } from "@clerk/express";
import Booking from "../models/Booking.js";
import Movie from "../models/Movie.js";

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


export const getUserBookings=async(req,res)=>{
    try{
        const user=getAuthUserId(req);

        if (!user) {
            return res.status(401).json({ success: false, message: 'Unauthorized' });
        }

        const bookings=await Booking.find({user}).populate(
            {
                path:"show",
                populate:{path:"movie"}
            }
        ).sort({createdAt:-1});
        res.json({success:true,bookings});

    }
    catch(error){
        console.error(error.message);
        res.json({success:false,message:error.message});

    }}

    //api controller function to update favourite movie in clerk

    export const updateFavorite=async(req,res)=>{
        try{
            const {movieId}=req.body;
                const userId=getAuthUserId(req);

                if (!userId) {
                    return res.status(401).json({ success: false, message: 'Unauthorized' });
                }


            const user=await clerkClient.users.getUser(userId);

            if(!user.privateMetadata.favorites){
                user.privateMetadata.favorites=[];
            }

            if(!user.privateMetadata.favorites.includes(movieId)){
                user.privateMetadata.favorites.push(movieId);
            }
            else{
                user.privateMetadata.favorites=user.privateMetadata.favorites.filter(id=>id!==movieId);
            }
            await clerkClient.users.updateUserMetadata(userId,{privateMetadata:user.privateMetadata})
            res.json({success:true,message:"favourite movie  updated successfully"});

        }
        catch(error){
             console.error(error.message);
        res.json({success:false,message:error.message});
        }
        }
            

      export const getFavorites=async(req,res)=>{
        try{
            const userId=getAuthUserId(req);

            if (!userId) {
                return res.status(401).json({ success: false, message: 'Unauthorized' });
            }

            const user=await clerkClient.users.getUser(userId);
            const favorites=user.privateMetadata.favorites;


            const movies=await Movie.find({_id:{$in:favorites}});
            res.json({success:true,movies});


        }  
        catch(error){
            console.error(error.message);
            res.json({success:false,message:error.message});
        }
    }