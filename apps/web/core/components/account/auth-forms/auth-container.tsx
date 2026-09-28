import type { ReactNode } from "react";
export function AuthContainer({ children }: { children: ReactNode }) {
  return (
    <div className="flex w-full flex-grow flex-col items-center justify-center py-6">
      <div className="relative flex w-full max-w-[28rem] flex-col gap-5 rounded-2xl border border-subtle bg-surface-1 p-6 shadow-[0_18px_60px_rgba(26,45,90,0.12)] sm:p-8">
        {children}
      </div>
    </div>
  );
}
