import { Settings } from "lucide-react";
import { PagePlaceholder } from "@/components/page-placeholder";

export default function SettingsPage() {
  return (
    <PagePlaceholder
      title="Settings"
      description="Workspace preferences, integrations, and export defaults."
      icon={Settings}
    />
  );
}
