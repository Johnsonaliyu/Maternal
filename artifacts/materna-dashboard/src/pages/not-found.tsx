import { AlertCircle } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="materna-shell flex min-h-[100dvh] w-full items-center justify-center px-5">
      <section className="w-full max-w-md rounded-[2rem] border border-border bg-card p-8 shadow-[0_24px_70px_hsl(247_29%_24%_/_0.1)]">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[hsl(var(--accent)/0.16)] text-[hsl(14_55%_42%)]">
            <AlertCircle size={22} aria-hidden="true" />
          </div>
          <h1 className="font-serif text-2xl text-foreground">Page not found</h1>
        </div>
        <p className="mt-5 text-sm leading-6 text-muted-foreground">
          This operations page only has one live view. Return to the Afeeyah AI overview to check the health line.
        </p>
      </section>
    </div>
  );
}
