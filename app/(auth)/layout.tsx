export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen w-full relative overflow-hidden bg-[#F5F3F0] flex flex-col justify-between">
      {/* Decorative Orbs */}
      <div className="pointer-events-none absolute -top-[190px] -left-[150px] w-[600px] h-[600px] rounded-full bg-[radial-gradient(circle_at_45%_45%,#C7B8F5,#7C74F0_50%,transparent_72%)] opacity-50 blur-[44px]" />
      <div className="pointer-events-none absolute -bottom-[210px] -right-[130px] w-[560px] h-[560px] rounded-full bg-[radial-gradient(circle_at_45%_45%,#F2C572,#E8A23D_60%,transparent_78%)] opacity-30 blur-[52px]" />
      <div className="pointer-events-none absolute top-[28%] right-[6%] w-[260px] h-[260px] rounded-full bg-[radial-gradient(circle,rgba(199,184,245,0.5),transparent_70%)] blur-[26px]" />

      {/* Grid pattern overlay */}
      <div className="pointer-events-none absolute inset-0 grid-pattern" />

      {/* Main Content Area */}
      <div className="relative z-10 flex-1 flex flex-col">{children}</div>
    </div>
  );
}
