"use client";

import {
  Drawer,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Collapse,
  Divider,
  Toolbar,
  Box,
} from "@mui/material";
import {
  Dashboard,
  ExpandLess,
  ExpandMore,
  Groups,
  Person4,
  // Settings,
  AccountBalance,
  History,
} from "@mui/icons-material";
import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import type { SidebarItem } from "../../types/common";

interface SidebarProps {
  open: boolean;
  onClose: () => void;
  width?: number;
}

const sidebarItems: SidebarItem[] = [
  {
    id: "dashboard",
    label: "Dashboard",
    icon: Dashboard,
    path: "/dashboard",
  },
  {
    id: "member-management",
    label: "Members",
    icon: Person4,
    path: "/member-management",
  },
  {
    id: "centers",
    label: "Centers",
    icon: Groups,
    path: "/centers",
  },
  {
    id: "collections",
    label: "Collections",
    icon: Groups,
    path: "/collections",
  },
  {
    id: "portfolio",
    label: "Portfolio",
    icon: AccountBalance,
    path: "/portfolio",
  },
  {
    id: "transactions",
    label: "Transactions",
    icon: History,
    path: "/transactions",
  },
  // {
  //   id: "settings",
  //   label: "Settings",
  //   icon: Settings,
  //   path: "/settings",
  // },
];

export default function Sidebar({ open, onClose, width = 240 }: SidebarProps) {
  const [expandedItems, setExpandedItems] = useState<string[]>([]);
  const navigate = useNavigate();
  const location = useLocation();

  const toggleExpanded = (itemId: string) => {
    setExpandedItems((prev) =>
      prev.includes(itemId) ? prev.filter((id) => id !== itemId) : [...prev, itemId]
    );
  };

  const handleItemClick = (item: SidebarItem) => {
    // if (item.children) {
    //   toggleExpanded(item.id);
    // } else {
    //   navigate(item.path);
    //   // Don't close sidebar on desktop - only on mobile
    //   if (window.innerWidth < 768) {
    //     onClose();
    //   }
    // }

    if (item.children) {
      toggleExpanded(item.id);
      return;
    }

    navigate(item.path);

    if (window.innerWidth < 768) {
      onClose();
    }
  };

  const isItemActive = (path: string) => location.pathname === path;

  const renderSidebarItem = (item: SidebarItem, level = 0) => {
    const hasChildren = item.children && item.children.length > 0;
    const isExpanded = expandedItems.includes(item.id);
    const isActive = isItemActive(item.path);

    return (
      <Box key={item.id}>
        <ListItem disablePadding>
          <ListItemButton
            onClick={() => handleItemClick(item)}
            selected={isActive}
            sx={{
              pl: 2 + level * 2,
              borderRadius: 2,
              mb: 0.5,
              mx: 1,
              "&.Mui-selected": {
                background: "linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%)",
                color: "white",
                "&:hover": {
                  background:
                    "linear-gradient(135deg, #1e40af 0%, #2563eb 100%)",
                },
                "& .MuiListItemIcon-root": {
                  color: "white",
                },
              },
              "&:hover": {
                backgroundColor: "#f1f5f9",
                borderRadius: 2,
              },
            }}
          >
            <ListItemIcon>
              <item.icon />
            </ListItemIcon>
            <ListItemText primary={item.label} />
            {hasChildren && (isExpanded ? <ExpandLess /> : <ExpandMore />)}
          </ListItemButton>
        </ListItem>

        {hasChildren && (
          <Collapse in={isExpanded} timeout="auto" unmountOnExit>
            <List component="div" disablePadding>
              {item.children!.map((child) =>
                renderSidebarItem(child, level + 1)
              )}
            </List>
          </Collapse>
        )}
      </Box>
    );
  };

  return (
    <>
      {/* Mobile Drawer */}
      <Drawer
        variant="temporary"
        open={open}
        onClose={onClose}
        ModalProps={{
          keepMounted: true,
        }}
        sx={{
          display: { xs: "block", md: "none" },
          width: width,
          flexShrink: 0,
          "& .MuiDrawer-paper": {
            width: width,
            boxSizing: "border-box",
            background: "linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)",
            borderRight: "1px solid #e2e8f0",
          },
        }}
      >
        <Toolbar sx={{ minHeight: "70px !important" }} />
        <Box sx={{ overflow: "auto", p: 1 }}>
          <List sx={{ px: 1 }}>
            {sidebarItems.map((item) => renderSidebarItem(item))}
          </List>
          <Divider sx={{ mx: 2, my: 1, borderColor: "#e2e8f0" }} />
        </Box>
      </Drawer>

      {/* Desktop Drawer */}
      <Drawer
        variant="persistent"
        anchor="left"
        open={open}
        sx={{
          display: { xs: "none", md: "block" },
          width: open ? width : 0,
          flexShrink: 0,
          "& .MuiDrawer-paper": {
            width: width,
            boxSizing: "border-box",
            background: "linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)",
            borderRight: "1px solid #e2e8f0",
            transition: "width 0.3s ease-in-out",
          },
        }}
      >
        <Toolbar sx={{ minHeight: "70px !important" }} />
        <Box sx={{ overflow: "auto", p: 1 }}>
          <List sx={{ px: 1 }}>
            {sidebarItems.map((item) => renderSidebarItem(item))}
          </List>
          <Divider sx={{ mx: 2, my: 1, borderColor: "#e2e8f0" }} />
        </Box>
      </Drawer>
    </>
  );
}
