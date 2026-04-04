import { useLoginForm } from "@/hooks/useLoginForm";
import { FloatingParticles } from "@/components/lux/auth/FloatingParticles";
import { GoogleLoadingOverlay } from "@/components/lux/auth/GoogleLoadingOverlay";
import { LoginCard } from "@/components/lux/auth/LoginCard";

export default function LoginPage() {
  const form = useLoginForm();

  return (
    <>
      {form.googleLoading && <GoogleLoadingOverlay />}
      <div className="min-h-[100dvh] bg-background flex items-center justify-center p-4 sm:p-6 relative overflow-hidden">
        {/* Ambient glow */}
        <div
          className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[500px] h-[500px] rounded-full bg-primary/5 blur-[120px] pointer-events-none"
          aria-hidden="true"
        />
        <FloatingParticles />
        <LoginCard {...form} />
      </div>
    </>
  );
}
