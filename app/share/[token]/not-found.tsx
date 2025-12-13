import Link from "next/link";
import { Button } from "@/components/ui/button";
import { AlertCircle, Home } from "lucide-react";

export default function ShareNotFound() {
  return (
    <div className="container mx-auto px-4 pt-20 pb-8">
      <div className="max-w-md mx-auto text-center space-y-6">
        <div className="flex justify-center">
          <div className="p-4 bg-destructive/10 rounded-full">
            <AlertCircle className="w-16 h-16 text-destructive" />
          </div>
        </div>
        <div className="space-y-2">
          <h1 className="text-2xl font-bold">Lien de partage invalide</h1>
          <p className="text-muted-foreground">
            Ce lien a expiré ou n&apos;existe pas. Les liens de partage sont valides pendant 24 heures.
          </p>
        </div>
        <Button asChild>
          <Link href="/">
            <Home className="w-4 h-4 mr-2" />
            Retour à l&apos;accueil
          </Link>
        </Button>
      </div>
    </div>
  );
}
