import { useState } from "react";
import { useLocation } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { UserPlus, Shield, Sparkles } from "lucide-react";
import heroImage from "@assets/stock_images/futuristic_ai_artifi_f9d4da05.jpg";

export default function Register() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [name, setName] = useState("");

  const registerMutation = useMutation({
    mutationFn: async (userData: { email: string; password: string; name: string }) => {
      return await apiRequest('POST', '/api/auth/register', userData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/auth/me'] });
      toast({
        title: "회원가입 성공",
        description: "환영합니다! 로그인되었습니다.",
      });
      setLocation('/');
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "회원가입 실패",
        description: error.message || "다시 시도해주세요",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (password !== confirmPassword) {
      toast({
        variant: "destructive",
        title: "비밀번호 불일치",
        description: "비밀번호가 일치하지 않습니다",
      });
      return;
    }

    if (password.length < 8) {
      toast({
        variant: "destructive",
        title: "비밀번호 오류",
        description: "비밀번호는 최소 8자 이상이어야 합니다",
      });
      return;
    }

    registerMutation.mutate({ email, password, name });
  };

  return (
    <div className="relative flex items-center justify-center min-h-screen overflow-hidden">
      {/* Full-bleed hero background with AI trading imagery */}
      <div 
        className="absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: `url(${heroImage})` }}
      />
      
      {/* Dark gradient wash overlay */}
      <div className="absolute inset-0 bg-gradient-to-br from-[#2D1B69]/95 via-[#1E3A8A]/85 to-[#0A0E27]/90" />
      
      {/* Animated gradient flow overlay */}
      <div className="absolute inset-0 bg-gradient-to-br from-[hsl(var(--neon-purple))]/10 via-transparent to-[hsl(var(--neon-cyan))]/10 animate-gradient-flow" />
      
      {/* Floating particles */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-2 h-2 bg-[hsl(var(--neon-purple))] rounded-full animate-float opacity-60" />
        <div className="absolute top-1/3 right-1/3 w-1.5 h-1.5 bg-[hsl(var(--neon-cyan))] rounded-full animate-float opacity-40" style={{ animationDelay: '1s' }} />
        <div className="absolute bottom-1/4 left-1/3 w-2.5 h-2.5 bg-[hsl(var(--neon-purple))] rounded-full animate-float opacity-50" style={{ animationDelay: '2s' }} />
        <div className="absolute top-1/2 right-1/4 w-1 h-1 bg-[hsl(var(--neon-cyan))] rounded-full animate-float opacity-70" style={{ animationDelay: '0.5s' }} />
      </div>

      {/* Main content - glassmorphism card */}
      <div className="relative z-10 w-full max-w-md px-4">
        {/* Dramatic headline */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center mb-4 space-x-2">
            <UserPlus className="w-10 h-10 text-[hsl(var(--neon-purple))] animate-pulse-glow" />
            <Sparkles className="w-8 h-8 text-[hsl(var(--neon-cyan))]" />
            <Shield className="w-10 h-10 text-[hsl(var(--neon-purple))]" />
          </div>
          <h1 className="text-4xl md:text-5xl font-black mb-3 text-gradient-cyber text-glow-purple">
            AI 트레이딩 시작
          </h1>
          <p className="text-lg text-white/90 font-medium">
            인공지능이 당신의 투자 파트너가 됩니다
          </p>
          <p className="text-sm text-white/70 mt-2">
            무료 회원가입 후 바로 시작하세요
          </p>
        </div>

        {/* Glassmorphism register card */}
        <div className="glass-card rounded-lg p-6 shadow-2xl">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name" className="text-white/90">이름</Label>
              <Input
                id="name"
                type="text"
                placeholder="홍길동"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                data-testid="input-name"
                className="bg-white/10 border-white/20 text-white placeholder:text-white/50 focus:border-[hsl(var(--neon-purple))] focus:ring-[hsl(var(--neon-purple))]"
              />
            </div>
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
                className="bg-white/10 border-white/20 text-white placeholder:text-white/50 focus:border-[hsl(var(--neon-purple))] focus:ring-[hsl(var(--neon-purple))]"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password" className="text-white/90">비밀번호</Label>
              <Input
                id="password"
                type="password"
                placeholder="최소 8자 이상"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                data-testid="input-password"
                className="bg-white/10 border-white/20 text-white placeholder:text-white/50 focus:border-[hsl(var(--neon-purple))] focus:ring-[hsl(var(--neon-purple))]"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword" className="text-white/90">비밀번호 확인</Label>
              <Input
                id="confirmPassword"
                type="password"
                placeholder="비밀번호 재입력"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                data-testid="input-confirm-password"
                className="bg-white/10 border-white/20 text-white placeholder:text-white/50 focus:border-[hsl(var(--neon-purple))] focus:ring-[hsl(var(--neon-purple))]"
              />
            </div>
            <Button 
              type="submit" 
              className="w-full bg-gradient-to-r from-[hsl(var(--neon-purple))] to-[hsl(var(--neon-cyan))] hover:opacity-90 text-white font-semibold shadow-lg shadow-[hsl(var(--neon-purple))]/50" 
              disabled={registerMutation.isPending}
              data-testid="button-register"
            >
              {registerMutation.isPending ? "가입 중..." : "회원가입"}
            </Button>
          </form>

          <div className="space-y-2 mt-6 text-center">
            <p className="text-sm text-white/70">
              이미 계정이 있으신가요?{" "}
              <a 
                href="/login" 
                className="text-[hsl(var(--neon-purple))] hover:text-[hsl(var(--neon-cyan))] font-medium transition-colors"
                data-testid="link-login"
              >
                로그인
              </a>
            </p>
            <p className="text-sm text-white/70">
              사용 방법이 궁금하신가요?{" "}
              <a 
                href="/guide" 
                className="text-[hsl(var(--neon-cyan))] hover:text-[hsl(var(--neon-purple))] font-medium transition-colors"
                data-testid="link-guide"
              >
                사용 가이드 보기
              </a>
            </p>
          </div>
        </div>

        {/* Security highlights */}
        <div className="grid grid-cols-3 gap-4 mt-8 text-center">
          <div className="glass-card rounded-lg p-3">
            <Shield className="w-6 h-6 mx-auto mb-1 text-[hsl(var(--neon-purple))]" />
            <p className="text-xs text-white/80 font-medium">안전한 보안</p>
          </div>
          <div className="glass-card rounded-lg p-3">
            <Sparkles className="w-6 h-6 mx-auto mb-1 text-[hsl(var(--neon-cyan))]" />
            <p className="text-xs text-white/80 font-medium">AI 분석</p>
          </div>
          <div className="glass-card rounded-lg p-3">
            <UserPlus className="w-6 h-6 mx-auto mb-1 text-[hsl(var(--neon-purple))]" />
            <p className="text-xs text-white/80 font-medium">무료 시작</p>
          </div>
        </div>
      </div>
    </div>
  );
}
