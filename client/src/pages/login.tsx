import { useState } from "react";
import { useLocation } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { SiGoogle, SiNaver } from "react-icons/si";
import { MessageCircle, TrendingUp, Zap, Bot } from "lucide-react";
import heroImage from "@assets/stock_images/futuristic_ai_artifi_11460e5f.jpg";

export default function Login() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const loginMutation = useMutation({
    mutationFn: async (credentials: { email: string; password: string }) => {
      return await apiRequest('POST', '/api/auth/login', credentials);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/auth/me'] });
      setLocation('/');
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "로그인 실패",
        description: error.message || "이메일 또는 비밀번호를 확인해주세요",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loginMutation.mutate({ email, password });
  };

  const handleSocialLogin = (provider: string) => {
    window.location.href = `/api/auth/${provider}`;
  };

  return (
    <div className="relative flex items-center justify-center min-h-screen overflow-hidden">
      {/* Full-bleed hero background with AI trading imagery */}
      <div 
        className="absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: `url(${heroImage})` }}
      />
      
      {/* Dark gradient wash overlay for text readability */}
      <div className="absolute inset-0 bg-gradient-to-br from-[#0A0E27]/95 via-[#1E3A8A]/85 to-[#2D1B69]/90" />
      
      {/* Animated gradient flow overlay */}
      <div className="absolute inset-0 bg-gradient-to-br from-[hsl(var(--neon-cyan))]/10 via-transparent to-[hsl(var(--neon-purple))]/10 animate-gradient-flow" />
      
      {/* Floating particles */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-2 h-2 bg-[hsl(var(--neon-cyan))] rounded-full animate-float opacity-60" />
        <div className="absolute top-1/3 right-1/3 w-1.5 h-1.5 bg-[hsl(var(--neon-purple))] rounded-full animate-float opacity-40" style={{ animationDelay: '1s' }} />
        <div className="absolute bottom-1/4 left-1/3 w-2.5 h-2.5 bg-[hsl(var(--neon-cyan))] rounded-full animate-float opacity-50" style={{ animationDelay: '2s' }} />
        <div className="absolute top-1/2 right-1/4 w-1 h-1 bg-[hsl(var(--neon-purple))] rounded-full animate-float opacity-70" style={{ animationDelay: '0.5s' }} />
      </div>

      {/* Main content - glassmorphism card */}
      <div className="relative z-10 w-full max-w-md px-4">
        {/* Dramatic headline */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center mb-4 space-x-2">
            <Bot className="w-10 h-10 text-[hsl(var(--neon-cyan))] animate-pulse-glow" />
            <TrendingUp className="w-8 h-8 text-[hsl(var(--neon-purple))]" />
            <Zap className="w-10 h-10 text-[hsl(var(--neon-cyan))]" />
          </div>
          <h1 className="text-4xl md:text-5xl font-black mb-3 text-gradient-cyber text-glow-cyan">
            키움 AI 트레이딩
          </h1>
          <p className="text-lg text-white/90 font-medium">
            AI가 자동으로 시장을 분석하고 투자합니다
          </p>
          <p className="text-sm text-white/70 mt-2">
            GPT-4 기반 실시간 자동매매 플랫폼
          </p>
        </div>

        {/* Glassmorphism login card */}
        <div className="glass-card rounded-lg p-6 shadow-2xl">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-white/90">이메일</Label>
              <Input
                id="email"
                type="email"
                placeholder="example@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                data-testid="input-email"
                className="bg-white/10 border-white/20 text-white placeholder:text-white/50 focus:border-[hsl(var(--neon-cyan))] focus:ring-[hsl(var(--neon-cyan))]"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password" className="text-white/90">비밀번호</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                data-testid="input-password"
                className="bg-white/10 border-white/20 text-white placeholder:text-white/50 focus:border-[hsl(var(--neon-cyan))] focus:ring-[hsl(var(--neon-cyan))]"
              />
            </div>
            <Button 
              type="submit" 
              className="w-full bg-gradient-to-r from-[hsl(var(--neon-cyan))] to-[hsl(var(--neon-purple))] hover:opacity-90 text-white font-semibold shadow-lg shadow-[hsl(var(--neon-cyan))]/50" 
              disabled={loginMutation.isPending}
              data-testid="button-login"
            >
              {loginMutation.isPending ? "로그인 중..." : "로그인"}
            </Button>
          </form>

          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-white/20" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-transparent px-2 text-white/70">또는</span>
            </div>
          </div>

          <div className="space-y-2">
            <Button
              variant="outline"
              className="w-full bg-white/5 border-white/20 text-white hover:bg-white/10"
              onClick={() => handleSocialLogin('google')}
              data-testid="button-google-login"
            >
              <SiGoogle className="mr-2 h-4 w-4" />
              Google 로그인
            </Button>
            <Button
              variant="outline"
              className="w-full bg-white/5 border-white/20 text-white hover:bg-white/10"
              onClick={() => handleSocialLogin('kakao')}
              data-testid="button-kakao-login"
            >
              <MessageCircle className="mr-2 h-4 w-4" />
              Kakao 로그인
            </Button>
            <Button
              variant="outline"
              className="w-full bg-white/5 border-white/20 text-white hover:bg-white/10"
              onClick={() => handleSocialLogin('naver')}
              data-testid="button-naver-login"
            >
              <SiNaver className="mr-2 h-4 w-4" />
              Naver 로그인
            </Button>
          </div>

          <p className="text-sm text-center mt-6 text-white/70">
            계정이 없으신가요?{" "}
            <a 
              href="/register" 
              className="text-[hsl(var(--neon-cyan))] hover:text-[hsl(var(--neon-purple))] font-medium transition-colors"
              data-testid="link-register"
            >
              회원가입
            </a>
          </p>
        </div>

        {/* Feature highlights */}
        <div className="grid grid-cols-3 gap-4 mt-8 text-center">
          <div className="glass-card rounded-lg p-3">
            <Bot className="w-6 h-6 mx-auto mb-1 text-[hsl(var(--neon-cyan))]" />
            <p className="text-xs text-white/80 font-medium">AI 자동매매</p>
          </div>
          <div className="glass-card rounded-lg p-3">
            <TrendingUp className="w-6 h-6 mx-auto mb-1 text-[hsl(var(--neon-purple))]" />
            <p className="text-xs text-white/80 font-medium">실시간 분석</p>
          </div>
          <div className="glass-card rounded-lg p-3">
            <Zap className="w-6 h-6 mx-auto mb-1 text-[hsl(var(--neon-cyan))]" />
            <p className="text-xs text-white/80 font-medium">폭풍 스캐일</p>
          </div>
        </div>
      </div>
    </div>
  );
}
