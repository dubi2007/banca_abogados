export default function WebmailLayout({ children }: { children: React.ReactNode }) {
  return (
    <main id="webmail-main" className="flex min-h-dvh min-w-0 flex-1 flex-col bg-parchment">
      {children}
    </main>
  );
}
