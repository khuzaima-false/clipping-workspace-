import { redirect } from "next/navigation";

/**
 * The workspace root has no content of its own — send visitors to the
 * dashboard (the canonical landing route).
 */
export default function WorkspaceHomePage() {
  redirect("/dashboard");
}
