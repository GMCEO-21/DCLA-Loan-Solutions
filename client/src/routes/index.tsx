import { Routes, Route, Navigate } from "react-router-dom";
import { Suspense, lazy } from "react";
import type { ReactElement } from "react";
import { useAuthStore } from "@features/auth/authStore";
import FullScreenLoader from "@components/common/FullScreenLoader";
import ForbiddenPage from "@components/common/ForbiddenPage";
import { canAccessPath, getDefaultRouteForRole } from "@features/auth/access";

const LoginPage = lazy(() => import("@features/auth/pages/LoginPage"));
const DashboardPage = lazy(
  () => import("@features/dashboard/pages/DashboardPage"),
);
const MemberManagementPage = lazy(
  () => import("@features/member/MemberManagementPage"),
);
const CentersPage = lazy(() => import("@features/centers/pages/CentersPage"));
const CollectionsPage = lazy(
  () => import("@features/collections/pages/CollectionsPage"),
);
const PortfolioPage = lazy(
  () => import("@features/portfolio/pages/PortfolioPage"),
);
const TransactionHistoryPage = lazy(
  () => import("@features/transactions/pages/TransactionHistoryPage"),
);
const UserManagementPage = lazy(
  () => import("@features/users/pages/UserManagementPage"),
);
const RepaymentApprovalsPage = lazy(
  () => import("@features/repayments/pages/RepaymentApprovalsPage"),
);
const LoanWaiversPage = lazy(
  () => import("@features/loans/pages/LoanWaiversPage"),
);

export default function AppRouter() {
  const token = useAuthStore((state) => state.token);
  const role = useAuthStore((state) => state.user?.role);
  const isInitialized = useAuthStore((state) => state.isInitialized);
  const defaultAuthenticatedRoute = getDefaultRouteForRole(role);
  const renderProtectedRoute = (path: string, element: ReactElement) => {
    if (!token) {
      return <Navigate to="/login" />;
    }
    return canAccessPath(role, path) ? element : <ForbiddenPage />;
  };

  if (!isInitialized) {
    return <FullScreenLoader />;
  }

  return (
    <Suspense fallback={<FullScreenLoader />}>
      <Routes>
        <Route
          path="/"
          element={
            <Navigate to={token ? defaultAuthenticatedRoute : "/login"} />
          }
        />
        <Route
          path="/login"
          element={
            token ? (
              <Navigate to={defaultAuthenticatedRoute} replace />
            ) : (
              <LoginPage />
            )
          }
        />
        <Route
          path="/dashboard"
          element={renderProtectedRoute("/dashboard", <DashboardPage />)}
        />
        <Route
          path="/member-management"
          element={renderProtectedRoute(
            "/member-management",
            <MemberManagementPage />,
          )}
        />
        <Route
          path="/centers"
          element={renderProtectedRoute("/centers", <CentersPage />)}
        />
        <Route
          path="/collections"
          element={renderProtectedRoute("/collections", <CollectionsPage />)}
        />
        <Route
          path="/portfolio"
          element={renderProtectedRoute("/portfolio", <PortfolioPage />)}
        />
        <Route
          path="/transactions"
          element={renderProtectedRoute(
            "/transactions",
            <TransactionHistoryPage />,
          )}
        />
        <Route
          path="/admin/users"
          element={renderProtectedRoute("/admin/users", <UserManagementPage />)}
        />
        <Route
          path="/approvals"
          element={renderProtectedRoute(
            "/approvals",
            <RepaymentApprovalsPage />,
          )}
        />
        <Route
          path="/waivers"
          element={renderProtectedRoute("/waivers", <LoanWaiversPage />)}
        />
        <Route
          path="*"
          element={
            <Navigate
              to={token ? defaultAuthenticatedRoute : "/login"}
              replace
            />
          }
        />
      </Routes>
    </Suspense>
  );
}
