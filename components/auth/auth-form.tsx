"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Icons } from "@/components/ui/icons";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { login, signup, signInWithOAuth } from "@/app/login/actions";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/components/providers/language-provider";

interface AuthFormProps extends React.HTMLAttributes<HTMLDivElement> {
  isModal?: boolean;
}

export function AuthForm({ className, isModal, ...props }: AuthFormProps) {
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const { t } = useLanguage();
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  async function handleLogin(formData: FormData) {
    setIsLoading(true);
    setMessage(null);
    const result = await login(formData);
    setIsLoading(false);

    if (result?.error) {
      setMessage({ type: "error", text: result.error });
    }
  }

  async function handleSignup(formData: FormData) {
    setIsLoading(true);
    setMessage(null);
    const result = await signup(formData);
    setIsLoading(false);

    if (result?.error) {
      setMessage({ type: "error", text: result.error });
    } else if (result?.success) {
      setMessage({ type: "success", text: result.success });
    }
  }

  const handleOAuth = async (provider: "discord" | "google") => {
    setIsLoading(true);
    setMessage(null);
    const result = await signInWithOAuth(provider);
    
    if (result?.error) {
      setMessage({ type: "error", text: result.error });
      setIsLoading(false);
    }
    // If successful, it redirects, so we don't need to unset loading
  };

  const CardWrapper = ({ children }: { children: React.ReactNode }) => {
    if (isModal) {
      return <div className="border-none shadow-none">{children}</div>;
    }
    return <Card>{children}</Card>;
  };

  return (
    <div className={cn("mx-auto flex w-full flex-col justify-center space-y-6 sm:w-[350px]", className)} {...props}>
      <Tabs defaultValue="login" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="login">{t.auth.login.tab}</TabsTrigger>
          <TabsTrigger value="register">{t.auth.register.tab}</TabsTrigger>
        </TabsList>
        
        <TabsContent value="login">
          <CardWrapper>
            {!isModal && (
              <CardHeader>
                <CardTitle>{t.auth.login.title}</CardTitle>
                <CardDescription>
                  {t.auth.login.desc}
                </CardDescription>
              </CardHeader>
            )}
            <div className={cn(isModal ? "pt-4" : "")}>
              <CardContent className="space-y-2">
                <form action={handleLogin}>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="email">{t.auth.fields.email}</Label>
                      <Input
                        id="email"
                        name="email"
                        type="email"
                        placeholder="m@exemple.com"
                        required
                        disabled={isLoading}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="password">{t.auth.fields.password}</Label>
                      <Input
                        id="password"
                        name="password"
                        type="password"
                        required
                        disabled={isLoading}
                      />
                    </div>
                    <Button className="w-full" type="submit" disabled={isLoading}>
                      {isLoading && (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      )}
                      {t.auth.login.submit}
                    </Button>
                  </div>
                </form>
              </CardContent>
              <CardFooter className="flex flex-col gap-4">
                 <div className="relative w-full">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-background px-2 text-muted-foreground">
                      {t.auth.or}
                    </span>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4 w-full">
                  <Button variant="outline" onClick={() => handleOAuth("discord")} disabled={isLoading}>
                    {isLoading ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                       <Icons.discord className="mr-2 h-4 w-4" />
                    )}
                    Discord
                  </Button>
                  <Button variant="outline" onClick={() => handleOAuth("google")} disabled={isLoading}>
                     {isLoading ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Icons.google className="mr-2 h-4 w-4" />
                    )}
                    Google
                  </Button>
                </div>
                 {message && (
                  <p
                    className={`text-sm text-center ${
                      message.type === "error" ? "text-destructive" : "text-green-600"
                    }`}
                  >
                    {message.text}
                  </p>
                )}
              </CardFooter>
            </div>
          </CardWrapper>
        </TabsContent>
        
        <TabsContent value="register">
          <CardWrapper>
            {!isModal && (
              <CardHeader>
                <CardTitle>{t.auth.register.title}</CardTitle>
                <CardDescription>
                  {t.auth.register.desc}
                </CardDescription>
              </CardHeader>
            )}
            <div className={cn(isModal ? "pt-4" : "")}>
              <CardContent className="space-y-2">
                <form action={handleSignup}>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="register-email">{t.auth.fields.email}</Label>
                      <Input
                        id="register-email"
                        name="email"
                        type="email"
                        placeholder="m@exemple.com"
                        required
                        disabled={isLoading}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="register-password">{t.auth.fields.password}</Label>
                      <Input
                        id="register-password"
                        name="password"
                        type="password"
                        required
                        disabled={isLoading}
                      />
                    </div>
                    <Button className="w-full" type="submit" disabled={isLoading}>
                      {isLoading && (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      )}
                      {t.auth.register.submit}
                    </Button>
                  </div>
                </form>
              </CardContent>
              <CardFooter className="flex flex-col gap-4">
                <div className="relative w-full">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-background px-2 text-muted-foreground">
                      {t.auth.or}
                    </span>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4 w-full">
                   <Button variant="outline" onClick={() => handleOAuth("discord")} disabled={isLoading}>
                    {isLoading ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                       <Icons.discord className="mr-2 h-4 w-4" />
                    )}
                    Discord
                  </Button>
                  <Button variant="outline" onClick={() => handleOAuth("google")} disabled={isLoading}>
                     {isLoading ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Icons.google className="mr-2 h-4 w-4" />
                    )}
                    Google
                  </Button>
                </div>
                {message && (
                  <p
                    className={`text-sm text-center ${
                      message.type === "error" ? "text-destructive" : "text-green-600"
                    }`}
                  >
                    {message.text}
                  </p>
                )}
              </CardFooter>
            </div>
          </CardWrapper>
        </TabsContent>
      </Tabs>
    </div>
  );
}
