import { createBrowserRouter, Navigate } from "react-router-dom";
import Login from "./components/adminpages/Login";
import ForgotPassword from "./components/adminpages/ForgotPass";
import CheckEmail from "./components/adminpages/CheckEmail";
import ResetPassword from "./components/adminpages/ResetPassword";
import AdminMainForm from "./components/adminpages/AdminMainForm";

const router = createBrowserRouter([
  { path: '/', element: <Navigate to="/admin" replace /> },
  { path: '/login', element: <Login /> },
  { path: '/forgot-password', element: <ForgotPassword /> },
  { path: '/check-email', element: <CheckEmail /> },
  { path: '/reset-password', element: <ResetPassword /> },
  { path: '/admin', element: <AdminMainForm /> },
]);

export default router;