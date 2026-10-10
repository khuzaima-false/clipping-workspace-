import type { Metadata } from "next";
import { LoginForm } from "@/components/auth/login-form";

export const metadata: Metadata = {
  title: "Sign in · Forgevyn Clipping Workspace",
  description: "Sign in or create your Forgevyn Clipping Workspace account.",
};

export default function LoginPage() {
  return (
    <div className="flex min-h-screen flex-col bg-zinc-950 text-zinc-100">
      <header className="flex items-center gap-2.5 px-6 py-5">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-600 text-white">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-4.5 w-4.5"
            aria-hidden
          >
            <rect x="2" y="4" width="20" height="16" rx="2" />
            <path d="m7 4 5 6 5-6" />
          </svg>
        </span>
        <span className="text-sm font-semibold tracking-tight text-zinc-100">
          Forgevyn
          <span className="text-zinc-500"> Clipping</span>
        </span>
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
