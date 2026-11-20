import { BrowserRouter, Navigate, Routes, Route } from "react-router-dom";
import { Navbar } from "./components/Navbar";
import { Home } from "./pages/Home";
import { BuildDetail } from "./pages/BuildDetail";
import { AdminLogin } from "./pages/AdminLogin";
import { AdminDashboard } from "./pages/AdminDashboard";
import { AdminLayout } from "./pages/admin/AdminLayout";
import { ComponentsPage } from "./pages/admin/ComponentsPage";
import { SettingsPage } from "./pages/admin/SettingsPage";
import { StoresManager } from "./components/admin/StoresManager";
import { NotFound } from "./pages/NotFound";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { PageTransition } from "./components/PageTransition";
import { AuthProvider } from "./context/AuthContext";

function App() {
  return (
    <AuthProvider>
      <BrowserRouter basename={import.meta.env.BASE_URL}>
        <Navbar />
        <main>
          <PageTransition>
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/build/:id" element={<BuildDetail />} />
              <Route path="/admin/login" element={<AdminLogin />} />
              <Route
                path="/admin"
                element={
                  <ProtectedRoute>
                    <AdminLayout />
                  </ProtectedRoute>
                }
              >
                <Route index element={<Navigate to="builds" replace />} />
                <Route path="builds" element={<AdminDashboard />} />
                <Route path="components" element={<ComponentsPage />} />
                <Route path="stores" element={<StoresManager />} />
                <Route path="settings" element={<SettingsPage />} />
                <Route path="*" element={<Navigate to="builds" replace />} />
              </Route>
              <Route path="*" element={<NotFound />} />
            </Routes>
          </PageTransition>
        </main>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
