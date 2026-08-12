import React, { useState } from 'react'
import BlurCircle from './BlurCircle';
import { dummyTrailers } from '../assets/assets'
import { PlayCircleIcon } from 'lucide-react';

const getEmbedUrl = (url) => {
    try {
        const parsedUrl = new URL(url);
        const videoId = parsedUrl.searchParams.get('v');

        if (videoId) {
            return `https://www.youtube.com/embed/${videoId}`;
        }

        return url;
    } catch {
        return url;
    }
};




const TrailersSection = () => {
    const [currentTrailer,setCurrentTrailer]=useState(dummyTrailers[0]);
    const [hasUserSelectedTrailer, setHasUserSelectedTrailer] = useState(false);
    const embedBaseUrl = getEmbedUrl(currentTrailer.videoUrl);
    const embedUrl = `${embedBaseUrl}${embedBaseUrl.includes('?') ? '&' : '?'}autoplay=${hasUserSelectedTrailer ? 1 : 0}&rel=0&modestbranding=1&playsinline=1`;

    const handleTrailerSelect = (trailer) => {
        setHasUserSelectedTrailer(true);
        setCurrentTrailer(trailer);
    };
  return (
    <div className='px-4 sm:px-6 md:px-16 lg:px-24 xl:px-44 py-16 md:py-20 overflow-hidden'>
        <p className='text-gray-300 font-medium text-lg max-w-6xl mx-auto'>Trailers</p>
        <div className='relative mt-6 max-w-6xl mx-auto'>
            <BlurCircle top='-100px' right='-100px'/>
            <div className='relative overflow-hidden rounded-2xl border border-white/10 shadow-2xl shadow-black/30 bg-black/40 aspect-video'>
                <iframe
                    key={currentTrailer.videoUrl}
                    src={embedUrl}
                    title='Movie trailer'
                    className='absolute inset-0 h-full w-full'
                    allow='autoplay; encrypted-media; picture-in-picture'
                    allowFullScreen
                />
            </div>
        </div>
        <div className='mt-8 grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 max-w-6xl mx-auto'>
            {dummyTrailers.map((trailer)=>(
                <button
                    key={trailer.image}
                    type='button'
                    onClick={() => handleTrailerSelect(trailer)}
                    className={`group relative overflow-hidden rounded-xl text-left transition duration-300 hover:-translate-y-1 focus:outline-none focus:ring-2 focus:ring-primary/80 ${currentTrailer.image === trailer.image ? 'ring-2 ring-primary' : 'ring-1 ring-white/10'}`}
                >
                    <div className='relative aspect-video'>
                        <img src={trailer.image} alt="Trailer thumbnail" className='w-full h-full object-cover brightness-75 group-hover:brightness-90 transition' />
                        <div className='absolute inset-0 bg-linear-to-t from-black/40 via-transparent to-transparent' />
                        <PlayCircleIcon strokeWidth={1.6} className='absolute top-1/2 left-1/2 w-10 h-10 sm:w-12 sm:h-12 transform -translate-x-1/2 -translate-y-1/2 text-white drop-shadow-lg' />
                    </div>
                </button>
            ))}

        </div>
    </div>
  )
}

export default TrailersSection