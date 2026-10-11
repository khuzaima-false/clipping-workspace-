import type { Metadata } from "next";
import { LoginForm } from "@/components/auth/login-form";
import { Logo } from "@/components/ui/logo";

export const metadata: Metadata = {
  title: "Sign in · Forgevyn Clipping Workspace",
  description: "Sign in or create your Forgevyn Clipping Workspace account.",
};

export default function LoginPage() {
  return (
    <div className="flex min-h-screen flex-col bg-zinc-950 text-zinc-100">
      <header className="flex items-center px-6 py-5">
        <Logo size="md" />
      </header>

      <main className="flex flex-1 items-center justify-center px-4 pb-16">
        <LoginForm />
      </main>

      <footer className="px-6 pb-6 text-center text-xs text-zinc-600">
        1080p clipping workspace · Projects, Channels &amp; Campaigns
      </footer>
    </div>
  );
}
