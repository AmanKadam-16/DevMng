import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Waves, Heart } from "lucide-react";

export default function Home() {
  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center bg-gradient-to-b from-background to-muted p-4">
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <CardTitle className="flex items-center justify-center gap-2 text-4xl md:text-5xl font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
            <Waves className="w-8 h-8 md:w-10 md:h-10 animate-bounce" />
            Hello World!
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <p className="text-center text-muted-foreground text-lg">
            Welcome to this ShadcnUI and Tailwind CSS demo application. This is a
            simple example showing how to create beautiful and responsive user
            interfaces.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button size="lg" className="bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70">
              Get Started
            </Button>
            <Button size="lg" variant="outline" className="group">
              Learn More
              <Heart className="ml-2 w-4 h-4 transition-transform group-hover:scale-125 text-red-500" />
            </Button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-8">
            <Card>
              <CardContent className="pt-6">
                <h3 className="text-lg font-semibold mb-2">ShadcnUI</h3>
                <p className="text-sm text-muted-foreground">
                  Beautiful, reusable components built with Radix UI and Tailwind CSS.
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <h3 className="text-lg font-semibold mb-2">Tailwind CSS</h3>
                <p className="text-sm text-muted-foreground">
                  A utility-first CSS framework for rapid UI development.
                </p>
              </CardContent>
            </Card>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}