import React from 'react'
import BlurCircle from '../components/BlurCircle'
import MovieCard from '../components/MovieCard'
import { useAppContext } from '../context/AppContext'

const Theaters = () => {
  const { allMovies } = useAppContext()

  const inTheaters = allMovies
    .filter((movie) => {
      const releaseDate = new Date(movie.release_date)
      return !Number.isNaN(releaseDate.getTime()) && releaseDate <= new Date()
    })
    .sort((a, b) => new Date(b.release_date) - new Date(a.release_date))

  return inTheaters.length > 0 ? (
    <div className='relative my-40 mb-60 px-6 md:px-16 lg:px-40 xl:px-44 overflow-hidden min-h-[80vh]'>
      <BlurCircle top='150px' left='0px' />
      <BlurCircle bottom='50px' right='50px' />
      <h1 className='text-lg font-medium my-4'>In Theaters Now</h1>
      <div className='flex flex-wrap max-sm:justify-center gap-8'>
        {inTheaters.map((movie) => (
          <MovieCard movie={movie} key={movie._id} />
        ))}
      </div>
    </div>
  ) : (
    <div className='flex flex-col items-center justify-center h-screen'>
      <h1 className='text-3xl font-bold text-center'>No Movies Currently In Theaters</h1>
    </div>
  )
}

export default Theaters
