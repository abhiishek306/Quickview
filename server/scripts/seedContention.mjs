import mongoose from 'mongoose';
import Movie from '../models/Movie.js';
import Show from '../models/Show.js';
import { resolveMongoUri } from '../configs/db.js';

const showId = process.env.LOAD_TEST_SHOW_ID;
if (!mongoose.isValidObjectId(showId)) {
  throw new Error('LOAD_TEST_SHOW_ID must be a valid MongoDB ObjectId.');
}

const movieId = 'quickview-load-test';

try {
  await mongoose.connect(resolveMongoUri());
  await Movie.updateOne(
    { _id: movieId },
    {
      $setOnInsert: {
        title: 'Quick View Contention Test',
        overview: 'Temporary movie used by the seat contention test.',
        poster_path: '/test.jpg',
        backdrop_path: '/test.jpg',
        release_date: new Date().toISOString().slice(0, 10),
        genres: [],
        casts: [],
        vote_average: 0,
        runtime: 90,
      },
    },
    { upsert: true },
  );
  await Show.updateOne(
    { _id: showId },
    {
      $setOnInsert: {
        movie: movieId,
        showDateTime: new Date(Date.now() + 24 * 60 * 60 * 1000),
        showPrice: 10,
        occupiedSeats: {},
      },
    },
    { upsert: true },
  );
} finally {
  await mongoose.disconnect();
}