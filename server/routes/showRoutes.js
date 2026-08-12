import express from 'express';
import { getNowPlayingMovies, getShow, getShows } from '../controllers/showController.js';
import { addShow } from '../controllers/showController.js';
import { cacheMiddleware } from '../middleware/cache.js';

const showRouter=express.Router();

showRouter.get('/now-playing', cacheMiddleware({ prefix: 'show:now-playing', ttlSeconds: 300 }), getNowPlayingMovies)
showRouter.post('/add',addShow);
showRouter.get("/all", cacheMiddleware({ prefix: 'show:all', ttlSeconds: 60 }), getShows);
showRouter.get("/:movieId", cacheMiddleware({ prefix: 'show:movie', ttlSeconds: 60 }), getShow);

export default showRouter;