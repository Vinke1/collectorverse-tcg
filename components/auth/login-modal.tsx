"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { AuthForm } from "@/components/auth/auth-form";
import { useState } from "react";
import { useLanguage } from "@/components/providers/language-provider";

interface LoginModalProps {
  children: React.ReactNode;
}

export function LoginModal({ children }: LoginModalProps) {
  const [isOpen, setIsOpen] = useState(false);
  const { t } = useLanguage();

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-center">{t.auth.welcome.title}</DialogTitle>
          <DialogDescription className="text-center">
            {t.auth.welcome.desc}
          </DialogDescription>
        </DialogHeader>
        <AuthForm isModal className="mt-4" />
      </DialogContent>
    </Dialog>
  );
}

