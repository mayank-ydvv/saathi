import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { RequireAuth } from "./auth/RequireAuth";
import { Layout } from "./components/Layout";
import { Alerts } from "./screens/Alerts";
import { Forgot, Login, SignUp, Verify } from "./screens/auth/AuthScreens";
import { Digest } from "./screens/Digest";
import { Routine } from "./screens/Routine";
import { Today } from "./screens/Today";
import { ROUTER_FUTURE } from "./routerFuture";
import { LiveDataProvider } from "./state/LiveData";

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
              <Layout />
            </LiveDataProvider>
          </RequireAuth>
        }
      >
        <Route index element={<Today />} />
        <Route path="alerts" element={<Alerts />} />
        <Route path="digest" element={<Digest />} />
        <Route path="routine" element={<Routine />} />
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
