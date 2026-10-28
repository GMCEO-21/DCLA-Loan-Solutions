import type React from "react";
export interface SidebarItem {
  id: string;
  label: string;
  icon: React.ComponentType;
  path: string;
  children?: SidebarItem[];
}

export interface LayoutProps {
  children: React.ReactNode;
}
