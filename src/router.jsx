import { createBrowserRouter, Navigate } from 'react-router-dom'
import Login from './components/adminpages/Login'
import ForgotPassword from './components/adminpages/ForgotPass'
import CheckEmail from './components/adminpages/CheckEmail'
import ResetPassword from './components/adminpages/ResetPassword'

const router = createBrowserRouter([
  { path: '/', element: <Navigate to="/login" replace /> }, // CHANGE THIS TO LOAD A DIFFERENT PAGE AT THE START
  { path: '/login', element: <Login /> },
  { path: '/forgot-password', element: <ForgotPassword /> },
  { path: '/check-email', element: <CheckEmail /> },
  { path: '/reset-password', element: <ResetPassword /> },
])

export default router