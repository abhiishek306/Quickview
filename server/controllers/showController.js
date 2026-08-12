import axios from 'axios';
import Movie from '../models/Movie.js';
import Show from '../models/Show.js';
import { env } from '../configs/env.js';
import { invalidateCacheByPrefix } from '../middleware/cache.js';

const getTrailerUrl = async (movieId) => {
    try {
        const { data } = await axios.get(`https://api.themoviedb.org/3/movie/${movieId}/videos`, {
            headers: { Authorization: `Bearer ${env.TMDB_API_KEY}` }
        });

        const trailer = (data.results || []).find((video) => video.site === 'YouTube' && video.type === 'Trailer' && video.key)
            || (data.results || []).find((video) => video.site === 'YouTube' && video.key);

        return trailer ? `https://www.youtube.com/watch?v=${trailer.key}` : null;
    } catch (error) {
        console.error(error);
        return null;
    }
};



export const getNowPlayingMovies=async(req,res)=>{
    try{
      const {data}=  await axios.get('https://api.themoviedb.org/3/movie/now_playing',{
        headers:{Authorization:`Bearer ${env.TMDB_API_KEY}`}
        })
        const movies=data.results;
        res.json({success:true,movies:movies})

    }
    catch(error){
        console.error(error);
        res.json({success:false,message:error.message});
    }
}
//Api to add shows to database
export const addShow=async(req,res)=>{
    try{
        const {movieId,showsInput,showPrice}=req.body;
        let movie=await Movie.findById(movieId);
        if(!movie){
            //fetch movie details from TMDB
            const movieDetailsResponse = await axios.get(`https://api.themoviedb.org/3/movie/${movieId}`,{
                headers:{Authorization:`Bearer ${env.TMDB_API_KEY}`}
            });
            const movieCreditsResponse = await axios.get(`https://api.themoviedb.org/3/movie/${movieId}/credits`, {
                headers:{Authorization:`Bearer ${env.TMDB_API_KEY}`}
            }).catch(() => ({ data: { cast: [] } }));

            const movieApiData=movieDetailsResponse.data;
            const movieCreditsData=movieCreditsResponse.data;
            const movieDetails={
                _id:movieId,
                title:movieApiData.title,
                overview:movieApiData.overview,
                poster_path:movieApiData.poster_path,
                backdrop_path:movieApiData.backdrop_path,
                genres:movieApiData.genres,
                casts:movieCreditsData.cast || [],
                release_date:movieApiData.release_date,
                original_language:movieApiData.original_language,
                tagline:movieApiData.tagline || "",
                vote_average:movieApiData.vote_average,
                runtime:movieApiData.runtime,
                trailerUrl: await getTrailerUrl(movieId),
            }

            movie=await Movie.create(movieDetails);
        }
        const showstoCreate=[];
        showsInput.forEach(show=>{
            const showDate=show.date;
            show.time.forEach(time=>{
                const dateTimeString=`${showDate}T${time}`;
                showstoCreate.push({
                    movie:movieId,
                    showDateTime:new Date(dateTimeString),
                    showPrice:showPrice,
                    occupiedSeats:{}
                })
            })
        });
        if(showstoCreate.length>0){
            await Show.insertMany(showstoCreate);
    }
    await invalidateCacheByPrefix(['show:all', 'show:movie', 'show:now-playing']);
    res.json({success:true,message:"Shows added successfully"});
}
    catch(error){
        console.error(error);
        res.json({success:false,message:error.message});
    }
}

// Api to get all shows
export const getShows=async(req,res)=>{
    try{
        const shows=await Show.find({showDateTime:{$gte:new Date()}}).populate('movie').sort({showDateTime:1});

        const uniqueShowsMap = new Map();
        shows.forEach((show) => {
            if (show.movie && !uniqueShowsMap.has(show.movie._id.toString())) {
                uniqueShowsMap.set(show.movie._id.toString(), show.movie);
            }
        });
        res.json({success:true,shows:Array.from(uniqueShowsMap.values())});

    }
    catch(error){
        console.error(error);
        res.json({success:false,message:error.message});
    }
}   
/// Api to get single show from database 
export const getShow=async(req,res)=>{
    try{
        const {movieId}=req.params;
        const shows=await Show.find({movie:movieId,showDateTime:{$gte:new Date()}})
        const movie=await Movie.findById(movieId);
        let trailerUrl = movie?.trailerUrl || null;

        if (!trailerUrl) {
            trailerUrl = await getTrailerUrl(movieId);
            if (movie && trailerUrl) {
                movie.trailerUrl = trailerUrl;
                await movie.save();
            }
        }

        const movieData = movie ? { ...movie.toObject(), trailerUrl } : null;
        const dateTime={};
        shows.forEach(show=>{
            const date=show.showDateTime.toISOString().split("T")[0];
            if(!dateTime[date]){
                dateTime[date]=[];
            }
            dateTime[date].push({
                time:show.showDateTime,showId:show._id});
    })
    res.json({success:true,movie:movieData,dateTime});
}
catch(error){
    console.error(error);
    res.json({success:false,message:error.message});
}
}