/**
 * Public (unauthenticated) pages: portfolio `/p/[slug]`, delivery `/d/[token]`.
 * Must stay outside PlatformAuthGate.
 */
export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen bg-[#0a0a0a] text-white">{children}</div>;
}
