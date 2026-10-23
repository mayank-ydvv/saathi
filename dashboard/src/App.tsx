import { lazy, Suspense } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { RequireAuth } from "./auth/RequireAuth";
import { Layout } from "./components/Layout";
import { Loading } from "./components/States";
import { Forgot, Login, SignUp, Verify } from "./screens/auth/AuthScreens";
import { LiveDataProvider } from "./state/LiveData";

// Screens load on first visit (L12): Recharts and the chart screens stay out of the login
// bundle, so the first page a family member sees is small.
const Today = lazy(() => import("./screens/Today").then((m) => ({ default: m.Today })));
const Alerts = lazy(() => import("./screens/Alerts").then((m) => ({ default: m.Alerts })));
const Digest = lazy(() => import("./screens/Digest").then((m) => ({ default: m.Digest })));
const Routine = lazy(() => import("./screens/Routine").then((m) => ({ default: m.Routine })));

function Screen({ children }: { children: React.ReactNode }) {
  return <Suspense fallback={<Loading label="Loading" lines={3} />}>{children}</Suspense>;
}

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
        <Route index element={<Screen><Today /></Screen>} />
        <Route path="alerts" element={<Screen><Alerts /></Screen>} />
        <Route path="digest" element={<Screen><Digest /></Screen>} />
        <Route path="routine" element={<Screen><Routine /></Screen>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  );
}
