import { AuthForm } from "@/components/auth/auth-form";
import { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Connexion | CollectorVerse TCG",
  description: "Connectez-vous ou inscrivez-vous à CollectorVerse TCG",
};

export default async function LoginPage() {
  // Check if user is already logged in
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // Redirect to home if already authenticated
  if (user) {
    redirect("/");
  }

  return (
    <div className="container flex h-screen w-screen flex-col items-center justify-center">
      <AuthForm />
    </div>
  );
}
