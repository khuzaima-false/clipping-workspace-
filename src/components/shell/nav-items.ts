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
  /** Optional "Coming soon" style badge shown next to the label. */
  badge?: string;
};

export const NAV_ITEMS: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Projects", href: "/projects", icon: FolderKanban },
  { label: "Channels", href: "/channels", icon: Radio },
  { label: "Sponsorships", href: "/campaigns", icon: Megaphone, badge: "Coming Soon" },
  { label: "Settings", href: "/settings", icon: Settings, badge: "Coming Soon" },
];
