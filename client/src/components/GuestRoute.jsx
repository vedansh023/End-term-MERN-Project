import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

function GuestRoute({ children }) {
  const { user, loading } = useAuth();

  if (loading) {
    return <div className="loading">Loading SplitFair...</div>;
  }

  if (user) {
    return <Navigate to="/" replace />;
  }

  return children;
}

export default GuestRoute;
