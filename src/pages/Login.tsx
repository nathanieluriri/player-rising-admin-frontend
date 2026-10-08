import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import ElectricBorder from "@/components/ElectricBorder";
import StadiumSpotlights from "@/components/stadiumSpotlight";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { login, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (isAuthenticated) {
      const from = (location.state as any)?.from?.pathname || "/admin";
      navigate(from, { replace: true });
    }
  }, [isAuthenticated, navigate, location]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      await login(email, password);
      toast.success("Welcome to the locker room.");
      navigate("/admin");
    } catch (error: any) {
      toast.error(error.response?.data?.detail || "Access denied.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen flex items-center justify-center bg-neutral-950 overflow-hidden selection:bg-white selection:text-black">
      
      {/* The New Background */}
      <StadiumSpotlights />
      
      {/* Vignette Overlay to darken edges and focus on the card */}
      <div className="absolute inset-0 z-0 bg-[radial-gradient(circle_at_center,transparent_0%,#000000_100%)] pointer-events-none" />

      <Card className="relative z-10 w-full max-w-md border-white/10 bg-black/60 backdrop-blur-xl shadow-2xl shadow-black">
        <CardHeader className="space-y-2 text-center pb-8">
          <div className="mb-4 flex justify-center">
             <span className="text-[10px] font-black tracking-[0.3em] text-white/40 uppercase">
               Official Admin Portal
             </span>
          </div>
          <CardTitle className="text-4xl font-bold tracking-tighter text-white uppercase">
            Player Rising
          </CardTitle>
          <CardDescription className="text-neutral-400 tracking-wide">
            Sign in to manage the game
          </CardDescription>
        </CardHeader>
        
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-xs font-semibold uppercase tracking-widest text-neutral-400 ml-1">
                Email Address
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="admin@playerrising.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                // Dark, subtle input that lights up slightly on focus
                className="bg-white/5 border-white/10 text-white placeholder:text-neutral-700 focus-visible:ring-1 focus-visible:ring-white/30 focus-visible:border-white/30 h-12 transition-all duration-300"
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password" className="text-xs font-semibold uppercase tracking-widest text-neutral-400 ml-1">
                    Password
                </Label>
              </div>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="bg-white/5 border-white/10 text-white focus-visible:ring-1 focus-visible:ring-white/30 focus-visible:border-white/30 h-12 transition-all duration-300"
              />
            </div>

            <div className="pt-4">
                {/* Using White Electric Border for high contrast */}
                <ElectricBorder color="#ffffff">
                <Button 
                    type="submit" 
                    className="w-full bg-white text-black hover:bg-neutral-200 h-12 font-bold tracking-widest text-sm uppercase transition-all duration-300 rounded-md" 
                    disabled={isLoading}
                >
                    {isLoading ? "Authenticating..." : "Enter Dashboard"}
                </Button>
                </ElectricBorder>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}