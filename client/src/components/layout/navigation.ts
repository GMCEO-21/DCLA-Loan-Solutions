import Dashboard from "@mui/icons-material/Dashboard";
import Groups from "@mui/icons-material/Groups";
import Person4 from "@mui/icons-material/Person4";
import AccountBalance from "@mui/icons-material/AccountBalance";
import History from "@mui/icons-material/History";
import AdminPanelSettings from "@mui/icons-material/AdminPanelSettings";
import FactCheck from "@mui/icons-material/FactCheck";
import Payments from "@mui/icons-material/Payments";
import Percent from "@mui/icons-material/Percent";
import { canAccessPath } from "@features/auth/access";

export const navigationWidth = 240;
export const headerHeight = 64;
const navigationItems = [
  { label: "Dashboard", path: "/dashboard", icon: Dashboard },
  { label: "Members", path: "/member-management", icon: Person4 },
  { label: "Centers", path: "/centers", icon: Groups },
  { label: "Collections", path: "/collections", icon: Payments },
  { label: "Portfolio", path: "/portfolio", icon: AccountBalance },
  { label: "Transactions", path: "/transactions", icon: History },
  { label: "Approvals", path: "/approvals", icon: FactCheck },
  { label: "Waivers", path: "/waivers", icon: Percent },
  { label: "User Management", path: "/admin/users", icon: AdminPanelSettings },
];
export function getNavigationItems(role?: string | null) {
  return navigationItems.filter((item) => canAccessPath(role, item.path));
}
