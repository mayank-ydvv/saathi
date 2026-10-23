import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { RequireAuth } from "./auth/RequireAuth";
import { Layout } from "./components/Layout";
import { Alerts } from "./screens/Alerts";
import { Forgot, Login, SignUp, Verify } from "./screens/auth/AuthScreens";
import { Digest } from "./screens/Digest";
import { Family } from "./screens/Family";
import { Routine } from "./screens/Routine";
import { Today } from "./screens/Today";
import { Visitors } from "./screens/Visitors";
import { ROUTER_FUTURE } from "./routerFuture";
import { LiveDataProvider } from "./state/LiveData";
import { ToastProvider } from "./state/Toast";

export function AppRoutes() {
  return (
    <Routes>
      <Route path="login" element={<Login />} />
      <Route path="signup" element={<SignUp />} />
      <Route path="verify" element={<Verify />} />
      <Route path="forgot" element={<Forgot />} />
      <Route
        element={
          <RequireAuth>
            <LiveDataProvider>
              <ToastProvider>
                <Layout />
              </ToastProvider>
            </LiveDataProvider>
          </RequireAuth>
        }
      >
        <Route index element={<Today />} />
        <Route path="alerts" element={<Alerts />} />
        <Route path="visitors" element={<Visitors />} />
        <Route path="digest" element={<Digest />} />
        <Route path="routine" element={<Routine />} />
        <Route path="family" element={<Family />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter future={ROUTER_FUTURE}>
      <AppRoutes />
    </BrowserRouter>
  );
}
