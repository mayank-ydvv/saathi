import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Layout } from "./components/Layout";
import { Alerts } from "./screens/Alerts";
import { Digest } from "./screens/Digest";
import { Routine } from "./screens/Routine";
import { Today } from "./screens/Today";
import { ROUTER_FUTURE } from "./routerFuture";
import { LiveDataProvider } from "./state/LiveData";

export function AppRoutes() {
  return (
    <LiveDataProvider>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<Today />} />
          <Route path="alerts" element={<Alerts />} />
          <Route path="digest" element={<Digest />} />
          <Route path="routine" element={<Routine />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </LiveDataProvider>
  );
}

export default function App() {
  return (
    <BrowserRouter future={ROUTER_FUTURE}>
      <AppRoutes />
    </BrowserRouter>
  );
}
