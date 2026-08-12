import express from "express";
import { createBooking } from "../controllers/bookingController.js";
import { getOccupiedSeats } from "../controllers/bookingController.js";
import { cacheMiddleware } from "../middleware/cache.js";

const bookingRouter=express.Router();


bookingRouter.post('/create',createBooking)
bookingRouter.get('/seats/:showId', cacheMiddleware({
		prefix: 'booking:seats',
		ttlSeconds: 15,
		keyBuilder: (req) => `booking:seats:${req.params.showId}`,
	}), getOccupiedSeats);

export default bookingRouter;
