import React from 'react'
import BlurCircle from '../components/BlurCircle'
import MovieCard from '../components/MovieCard'
import { useAppContext } from '../context/AppContext'

const RECENT_DAYS_WINDOW = 90

const Releases = () => {
  const { allMovies } = useAppContext()

  const now = new Date()
  const startWindow = new Date()
  startWindow.setDate(now.getDate() - RECENT_DAYS_WINDOW)

  const recentReleases = allMovies
    .filter((movie) => {
      const releaseDate = new Date(movie.release_date)
      if (Number.isNaN(releaseDate.getTime())) {
        return false
      }

      return releaseDate <= now && releaseDate >= startWindow
    })
    .sort((a, b) => new Date(b.release_date) - new Date(a.release_date))

  return recentReleases.length > 0 ? (
    <div className='relative my-40 mb-60 px-6 md:px-16 lg:px-40 xl:px-44 overflow-hidden min-h-[80vh]'>
      <BlurCircle top='150px' left='0px' />
      <BlurCircle bottom='50px' right='50px' />
      <h1 className='text-lg font-medium my-4'>Recently Released</h1>
      <div className='flex flex-wrap max-sm:justify-center gap-8'>
        {recentReleases.map((movie) => (
          <MovieCard movie={movie} key={movie._id} />
        ))}
      </div>
    </div>
  ) : (
    <div className='flex flex-col items-center justify-center h-screen'>
      <h1 className='text-3xl font-bold text-center'>No Recent Releases Found</h1>
    </div>
  )
}

export default Releases
