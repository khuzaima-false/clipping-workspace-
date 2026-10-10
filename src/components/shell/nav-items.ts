import {
  LayoutDashboard,
  FolderKanban,
  Radio,
  Megaphone,
  Settings,
  type LucideIcon,
} from "lucide-react";

export type NavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
};

export const NAV_ITEMS: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Projects", href: "/projects", icon: FolderKanban },
  { label: "Channels", href: "/channels", icon: Radio },
  { label: "Campaigns", href: "/campaigns", icon: Megaphone },
  { label: "Settings", href: "/settings", icon: Settings },
];
