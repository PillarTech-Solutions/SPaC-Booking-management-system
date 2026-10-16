import { createBrowserRouter, Navigate } from "react-router-dom";
import Login from "./admin/Login";
import ForgotPassword from "./admin/ForgotPass";
import CheckEmail from "./admin/CheckEmail";
import ResetPassword from "./admin/ResetPassword";
import AdminMainForm from "./admin/AdminMainForm";

const router = createBrowserRouter([
  { path: '/', element: <Navigate to="/admin" replace /> },
  { path: '/login', element: <Login /> },
  { path: '/forgot-password', element: <ForgotPassword /> },
  { path: '/check-email', element: <CheckEmail /> },
  { path: '/reset-password', element: <ResetPassword /> },
  { path: '/admin', element: <AdminMainForm /> },
]);

export default router;