import { AuthForm } from "@/components/auth/auth-form";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Connexion | CollectorVerse TCG",
  description: "Connectez-vous ou inscrivez-vous à CollectorVerse TCG",
};

export default function LoginPage() {
  return (
    <div className="container flex h-screen w-screen flex-col items-center justify-center">
      <AuthForm />
    </div>
  );
}
