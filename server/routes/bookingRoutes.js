import express from "express";
import { createBooking, confirmLoadTestBooking, getOccupiedSeats } from "../controllers/bookingController.js";

const bookingRouter=express.Router();


bookingRouter.post('/create',createBooking)
bookingRouter.post('/load-test/confirm', confirmLoadTestBooking)
bookingRouter.get('/seats/:showId', getOccupiedSeats);

export default bookingRouter;
