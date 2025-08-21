import { DiceRoller } from '@/components/dice-roller';

export default function Home() {
  return (
    <div className="flex min-h-screen w-full flex-col bg-background font-body text-foreground">
      <main className="flex-1">
        <div className="container mx-auto max-w-5xl px-4 py-8 md:py-12">
          <header className="mb-8 text-center md:mb-12">
            <h1 className="font-headline text-4xl font-bold tracking-tighter text-primary sm:text-5xl md:text-6xl">
              DiceForge
            </h1>
            <p className="mt-3 text-lg text-muted-foreground md:text-xl">
              Your ultimate companion for tabletop dice calculations.
            </p>
          </header>

          <DiceRoller />
        </div>
      </main>
    </div>
  );
}
