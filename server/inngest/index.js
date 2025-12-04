
import { Inngest } from "inngest";
import User from "../models/user";
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

export const functions = [synUserCreation,synUserDeletion,synUserUpdation];