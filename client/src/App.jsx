import React from 'react'
import Navbar from './components/Navbar'
import { Routes } from 'react-router-dom'
import { Route } from 'react-router-dom'
import { useLocation } from 'react-router-dom'

import Home from './pages/Home'
import Movies from './pages/Movies'
import Favorite from './pages/Favorite'
import MyBookings from './pages/MyBookings'
import SeatLayout from './pages/SeatLayout'
import MoviesDetails from './pages/MoviesDetails'
import {Toaster } from 'react-hot-toast';
import Footer from './components/Footer'
import Layout from './pages/admin/Layout'
import AddShows from './pages/admin/AddShows'
import Dashboard from './pages/admin/Dashboard'
import ListShows from './pages/admin/ListShows'
import ListBooking from './pages/admin/ListBooking'
import { useAppContext } from './context/AppContext'
import { SignIn } from '@clerk/clerk-react'
import Loading from './components/Loading'

const App = () => {
  const isAdminRoute=useLocation().pathname.startsWith('/admin');

  const {user}=useAppContext();
  return (
    <>
      <Toaster />
      {!isAdminRoute && <Navbar />} 
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/movies" element={<Movies />} />
        <Route path="/movies/:id" element={<MoviesDetails />} />
        <Route path="/movies/:id/:date" element={<SeatLayout />} />
        <Route path='/loading/:nextUrl' element ={<Loading/>} />
        <Route path="/favorites" element={<Favorite />} />
        <Route path="/my-bookings" element={<MyBookings />} />
        <Route path='/admin/*' element={ user? <Layout /> : (
          <div className='min-h-screen flex justify-center items-center'><SignIn fallbackRedirectUrl={'/admin'}  /></div>
        )}> 
        <Route index element={<Dashboard />} />
        <Route path="add-shows" element={<AddShows/>} />
        <Route path="list-shows" element={<ListShows/>} />
        <Route path="list-booking" element={<ListBooking/>} />





        </Route>
      </Routes>
       {!isAdminRoute && <Footer />}
    </>
  )
}

export default App
