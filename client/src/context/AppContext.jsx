import { createContext, useContext, useEffect, useState } from "react";
import axios from "axios";
import { useAuth, useUser } from "@clerk/clerk-react";
import { useLocation, useNavigate } from "react-router-dom";
import { toast } from "react-hot-toast";
axios.defaults.baseURL=import.meta.env.VITE_BASE_URL

const TMDB_GENRE_MAP = {
    28: "Action",
    12: "Adventure",
    16: "Animation",
    35: "Comedy",
    80: "Crime",
    99: "Documentary",
    18: "Drama",
    10751: "Family",
    14: "Fantasy",
    36: "History",
    27: "Horror",
    10402: "Music",
    9648: "Mystery",
    10749: "Romance",
    878: "Science Fiction",
    10770: "TV Movie",
    53: "Thriller",
    10752: "War",
    37: "Western",
}

const normalizeNowPlayingMovie = (movie) => ({
    _id: String(movie.id),
    id: movie.id,
    title: movie.title,
    overview: movie.overview || "",
    poster_path: movie.poster_path,
    backdrop_path: movie.backdrop_path,
    release_date: movie.release_date,
    original_language: movie.original_language,
    tagline: "",
    vote_average: movie.vote_average || 0,
    runtime: 0,
    genres: (movie.genre_ids || []).map((genreId) => ({
        id: genreId,
        name: TMDB_GENRE_MAP[genreId] || "Other",
    })),
    casts: [],
})



export const AppContext = createContext();
export const AppProvider=({children})=>{

    const [isAdmin,setIsAdmin]=useState(false);

    const[shows,setShows]=useState([]);
    const[nowPlayingMovies,setNowPlayingMovies]=useState([]);
    const[favoriteMovies,setFavoriteMovies]=useState([]);
    const image_base_url=import.meta.env.VITE_TMDB_IMAGE_BASE_URL;
    const {user}=useUser();
    const {getToken}=useAuth();
    const location=useLocation();
    const navigate=useNavigate();

    const fetchIsAdmin=async()=>{
        try{
            const {data}=await axios.get('/api/admin/is-admin',{
                headers:{Authorization:`Bearer ${await getToken()}`}
            })
            setIsAdmin(data.isAdmin);
            if(!data.isAdmin && location.pathname.startsWith('/admin')){
                navigate('/');
            toast.error('Access denied. Admins only.');
            }

        }
        catch(error){
            console.error(error)
        }
    }

    const fetchShows=async()=>{
        try{
            const {data}=await axios.get('/api/show/all')
            if(data.success){
                setShows(data.shows);
            }
            else{
                toast.error(data.message);
            }

        }
        catch(error){
            console.error(error);
        }}

    const fetchNowPlayingMovies = async () => {
        try {
            const { data } = await axios.get('/api/show/now-playing')
            if (data.success) {
                const normalizedMovies = (data.movies || []).map(normalizeNowPlayingMovie)
                setNowPlayingMovies(normalizedMovies)
            }
        } catch (error) {
            console.error(error)
        }
    }

    const allMovies = (() => {
        const movieMap = new Map()
        ;[...shows, ...nowPlayingMovies].forEach((movie) => {
            const movieId = String(movie._id || movie.id)
            if (!movieMap.has(movieId)) {
                movieMap.set(movieId, movie)
            }
        })
        return Array.from(movieMap.values())
    })()

          const fetchFavoriteMovies=async()=>{
            try{
                const {data}=await axios.get('/api/user/favorites',{
                    headers:{Authorization:`Bearer ${await getToken()}`}
                });
                if(data.success){
                    setFavoriteMovies(data.movies);
                }
                else{
                    toast.error(data.message);
                }

            }
            catch(error){
                console.error(error);
            }}

        useEffect(()=>{
        fetchShows();
        fetchNowPlayingMovies();
        },[]);
    useEffect(()=>{
        if(user){
        fetchIsAdmin();
        fetchFavoriteMovies();
        }
    },[user]);

    const value={axios,fetchIsAdmin,user,getToken,navigate,isAdmin,shows,nowPlayingMovies,allMovies,favoriteMovies,fetchFavoriteMovies,image_base_url};
    return (
        <AppContext.Provider value={value}>
            {children}
        </AppContext.Provider>
    )
}

export const useAppContext = () => useContext(AppContext);