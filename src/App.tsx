import { lazy, Suspense } from "react";
import { BrowserRouter, Navigate, Routes, Route } from "react-router-dom";
import { Navbar } from "./components/Navbar";
import { Home } from "./pages/Home";
import { BuildDetail } from "./pages/BuildDetail";
import { NotFound } from "./pages/NotFound";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { PageTransition } from "./components/PageTransition";
import { AuthProvider } from "./context/AuthContext";

// Pages most visitors never open are split into their own chunks.
const named = <K extends string>(load: () => Promise<Record<K, React.ComponentType>>, name: K) =>
  lazy(() => load().then((m) => ({ default: m[name] })));
const BuilderPage = named(() => import("./pages/BuilderPage"), "BuilderPage");
const AdvisorPage = named(() => import("./pages/AdvisorPage"), "AdvisorPage");
const AdminLogin = named(() => import("./pages/AdminLogin"), "AdminLogin");
const AdminLayout = named(() => import("./pages/admin/AdminLayout"), "AdminLayout");
const BuildsPage = named(() => import("./pages/admin/BuildsPage"), "BuildsPage");
const BuildEditorPage = named(() => import("./pages/admin/BuildEditorPage"), "BuildEditorPage");
const ComponentsPage = named(() => import("./pages/admin/ComponentsPage"), "ComponentsPage");
const SettingsPage = named(() => import("./pages/admin/SettingsPage"), "SettingsPage");
const PricesPage = named(() => import("./pages/admin/PricesPage"), "PricesPage");
const VisitorBuildsPage = named(() => import("./pages/admin/VisitorBuildsPage"), "VisitorBuildsPage");
const StoresManager = named(() => import("./components/admin/StoresManager"), "StoresManager");

function RouteFallback() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <div className="shimmer h-10 w-48 rounded-lg" />
      <div className="shimmer mt-6 h-64 rounded-xl" />
    </div>
  );
}

function App() {
  return (
    <AuthProvider>
      <BrowserRouter basename={import.meta.env.BASE_URL}>
        <Navbar />
        <main>
          <PageTransition>
            <Suspense fallback={<RouteFallback />}>
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/build/:id" element={<BuildDetail />} />
              <Route path="/builder" element={<BuilderPage />} />
              <Route path="/advisor" element={<AdvisorPage />} />
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
                <Route path="builds" element={<BuildsPage />} />
                <Route path="builds/new" element={<BuildEditorPage />} />
                <Route path="builds/:id" element={<BuildEditorPage key="edit" />} />
                <Route path="components" element={<ComponentsPage />} />
                <Route path="prices" element={<PricesPage />} />
                <Route path="visitor-builds" element={<VisitorBuildsPage />} />
                <Route path="stores" element={<StoresManager />} />
                <Route path="settings" element={<SettingsPage />} />
                <Route path="*" element={<Navigate to="builds" replace />} />
              </Route>
              <Route path="*" element={<NotFound />} />
            </Routes>
            </Suspense>
          </PageTransition>
        </main>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
