"use client";

import Link from "next/link";
import { Modal } from "@/components/ui/modal";
import { LoginForm } from "@/components/auth/login-form";

export function AuthModal({
  open,
  onClose,
  onAuthenticated,
}: {
  open: boolean;
  onClose: () => void;
  onAuthenticated?: () => void;
}) {
  return (
    <Modal
      open={open}
      title="Sign in or create an account"
      onClose={onClose}
      className="max-w-md border-studio-border bg-studio-panel"
      footer={
        <p className="text-center text-xs text-zinc-500">
          Prefer a full page?{" "}
          <Link
            href="/login"
            className="font-medium text-violet-300 underline-offset-2 hover:underline"
          >
            Open the sign-in page
          </Link>
        </p>
      }
    >
      <LoginForm
        embedded
        redirectTo={null}
        onAuthenticated={() => {
          onAuthenticated?.();
          onClose();
        }}
      />
    </Modal>
  );
}
