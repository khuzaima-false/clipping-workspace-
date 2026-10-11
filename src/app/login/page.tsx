import type { Metadata } from "next";
import { LoginForm } from "@/components/auth/login-form";
import { Logo } from "@/components/ui/logo";

export const metadata: Metadata = {
  title: "Sign in · Forgevyn Clipping Workspace",
  description: "Sign in or create your Forgevyn Clipping Workspace account.",
};

export default function LoginPage() {
  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden bg-zinc-950 text-zinc-100">
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="absolute -top-32 left-1/2 h-96 w-[44rem] -translate-x-1/2 rounded-full bg-[radial-gradient(ellipse_at_center,rgba(124,58,237,0.22),transparent_65%)]" />
        <div className="absolute bottom-0 right-0 h-72 w-72 rounded-full bg-[radial-gradient(circle,rgba(59,130,246,0.16),transparent_65%)]" />
      </div>
      <header className="relative flex items-center px-6 py-5">
        <Logo size="md" />
      </header>

      <main className="relative flex flex-1 items-center justify-center px-4 pb-16">
        <LoginForm />
      </main>

      <footer className="relative px-6 pb-6 text-center text-xs text-zinc-600">
        AI video clipper · Shorts, Reels &amp; TikToks
      </footer>
    </div>
  );
}
