"use client";

import { useState, useMemo } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  ArrowDownToLine,
  ArrowUpToLine,
  Dices,
  Sigma,
  Loader2,
  ChevronsDown,
} from 'lucide-react';

import {
  calculateStats,
  parseDiceFormula,
  simulateRoll,
  calculateProbabilityDistribution,
  type RollResult,
  type DiceTerm,
} from '@/lib/dice-utils';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { ChartContainer, ChartTooltipContent } from '@/components/ui/chart';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import Link from 'next/link';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { StatCard } from '@/components/stat-card';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';


export function DiceRoller() {
  const { toast } = useToast();
  const [formula, setFormula] = useState('');
  const [rollResult, setRollResult] = useState<RollResult | null>(null);
  const [isRolling, setIsRolling] = useState(false);
  const [rollKey, setRollKey] = useState(0);

  const { parsedFormula, error } = useMemo(() => {
    const parsed = parseDiceFormula(formula);
    const err = !parsed && formula.trim() !== '' ? 'Invalid dice formula' : null;
    return { parsedFormula: parsed, error: err };
  }, [formula]);

  const stats = useMemo(() => {
    if (!parsedFormula || error) return { min: 0, max: 0, avg: 0, avgFloored: 0 };
    return calculateStats(parsedFormula);
  }, [parsedFormula, error]);

  const probabilityData = useMemo(() => {
    if (!parsedFormula || error) return [];
    
    // Check if formula is too complex for stats calculation which is a proxy for graph complexity
    if (parsedFormula.length > 0 && stats.max > 1000) {
      return [];
    }

    return calculateProbabilityDistribution(parsedFormula);
  }, [parsedFormula, error, stats.max]);

  const handleRoll = () => {
    if (!parsedFormula || error) {
      toast({
        variant: 'destructive',
        title: 'Invalid Formula',
        description: 'Please enter a valid dice formula to roll.',
      });
      return;
    }
    setIsRolling(true);
    setRollResult(null);
    setTimeout(() => {
      setRollResult(simulateRoll(parsedFormula));
      setIsRolling(false);
      setRollKey(prev => prev + 1);
    }, 500);
  };
  
  const tooltipContent = useMemo(() => {
    if (!rollResult || rollResult.details.length === 0) return null;

    const positiveRolls = rollResult.details.filter(d => d.sign === 1);
    const negativeRolls = rollResult.details.filter(d => d.sign === -1);

    return (
      <div>
        {positiveRolls.length > 0 && (
          <div>
            <p className="font-semibold">Rolls:</p>
            <div className="flex flex-wrap gap-1">
              {positiveRolls.map((d, i) => (
                <span key={i} className="rounded-md bg-green-100 px-2 py-1 text-xs text-green-800 dark:bg-green-900 dark:text-green-200">
                  {d.value} (d{d.sides})
                </span>
              ))}
            </div>
          </div>
        )}
        {/* Negative rolls might not be correctly handled with new parser, hiding for now */}
        {rollResult.modifier !== 0 && <p className="mt-2 font-semibold">Modifier: {rollResult.modifier > 0 ? '+' : ''}{rollResult.modifier}</p>}
        <p className="mt-2 border-t border-border pt-2 font-bold">Total: {rollResult.total}</p>
      </div>
    );
  }, [rollResult]);


  return (
    <TooltipProvider>
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-5">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Dice Formula</CardTitle>
            </CardHeader>
            <CardContent>
              <Input
                type="text"
                placeholder="e.g., 2d6+4*1d4-2"
                value={formula}
                onChange={(e) => setFormula(e.target.value)}
                className={cn('text-lg', error ? 'border-destructive focus-visible:ring-destructive' : '')}
              />
              {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Statistics</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-4 sm:grid-cols-2">
              <StatCard title="Minimum" value={error ? '-' : stats.min} icon={ArrowDownToLine} color="text-blue-500" />
              <StatCard title="Maximum" value={error ? '-' : stats.max} icon={ArrowUpToLine} color="text-red-500" />
              <StatCard title="Average" value={error ? '-' : stats.avg.toFixed(2)} icon={Sigma} color="text-green-500" />
              <StatCard title="Avg (Floor)" value={error ? '-' : stats.avgFloored} icon={ChevronsDown} color="text-purple-500" />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Simulation</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col items-center justify-center space-y-4">
               <Tooltip>
                <TooltipTrigger asChild>
                  <div className="flex h-24 w-24 items-center justify-center rounded-lg bg-secondary">
                    {isRolling ? (
                      <Loader2 className="h-12 w-12 animate-spin text-accent" />
                    ) : rollResult !== null ? (
                      <span key={rollKey} className="animate-in fade-in zoom-in-50 text-5xl font-bold text-accent">
                          {rollResult.total}
                      </span>
                    ) : (
                      <Dices className="h-12 w-12 text-muted-foreground" />
                    )}
                  </div>
                </TooltipTrigger>
                {tooltipContent && (
                  <TooltipContent side="bottom" className="max-w-xs">
                    {tooltipContent}
                  </TooltipContent>
                )}
              </Tooltip>
              <Button
                size="lg"
                onClick={handleRoll}
                disabled={isRolling || !!error || !formula}
                className="w-full bg-accent text-accent-foreground hover:bg-accent/90"
              >
                {isRolling ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Dices className="mr-2 h-4 w-4" />}
                {isRolling ? 'Rolling...' : 'Roll the dice!'}
              </Button>
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-3">
          <Card className="h-full">
            <CardHeader>
              <CardTitle>Probability Distribution</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="relative aspect-video w-full overflow-hidden rounded-md bg-muted">
                {probabilityData.length > 0 ? (
                  <ChartContainer
                    config={{ probability: { label: 'Probability', color: 'hsl(var(--accent))' } }}
                    className="h-full w-full"
                  >
                    <BarChart accessibilityLayer data={probabilityData} margin={{ top: 20, right: 20, bottom: 20, left: 0 }} >
                      <CartesianGrid vertical={false} />
                      <XAxis dataKey="value" tickLine={false} axisLine={false} tickMargin={8} />
                      <YAxis tickFormatter={(value) => `${(value * 100).toFixed(0)}%`} tickLine={false} axisLine={false} tickMargin={8} />
                      <RechartsTooltip
                        cursor={false}
                        content={
                          <ChartTooltipContent
                            formatter={(value, name, item) => (
                              <div className="flex flex-col">
                                <span>Value: {item.payload.value}</span>
                                <span>
                                  Chance: {(item.payload.probability * 100).toFixed(2)}%
                                </span>
                              </div>
                            )}
                            hideLabel
                          />
                        }
                      />
                      <Bar dataKey="probability" fill="var(--color-probability)" radius={4} />
                    </BarChart>
                  </ChartContainer>
                ) : (
                  <div className="flex h-full w-full flex-col items-center justify-center text-center text-muted-foreground">
                      <p>{(parsedFormula && stats.max > 1000) ? "Formula too complex to display probability graph." : "Enter a valid formula to generate a graph."}</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
      <footer className="mt-12 space-y-6">
          <Card>
            <CardContent className="p-6">
              <Accordion type="single" collapsible className="w-full">
                <AccordionItem value="how-it-works">
                  <AccordionTrigger className="text-lg font-semibold">
                    How It Works?
                  </AccordionTrigger>
                  <AccordionContent className="space-y-4 pt-2 text-muted-foreground">
                    <p>
                      The calculator parses your dice formula using standard mathematical order of operations (PEMDAS/BODMAS). It identifies dice (e.g., "2d6"), numbers, and operators. The probability distribution is calculated for simple formulas (addition/subtraction only) by finding all possible outcomes and their likelihood.
                    </p>
                    <div>
                      <h3 className="mb-2 font-semibold text-foreground">
                        Example Formulas:
                      </h3>
                      <ul className="list-disc list-inside space-y-1">
                        <li>
                          <code className="rounded-md bg-muted px-2 py-1 font-code">
                            3d8+4
                          </code>{' '}
                          - Roll three 8-sided dice and add 4.
                        </li>
                        <li>
                          <code className="rounded-md bg-muted px-2 py-1 font-code">
                            1d20-2
                          </code>{' '}
                          - Roll one 20-sided die and subtract 2.
                        </li>
                         <li>
                          <code className="rounded-md bg-muted px-2 py-1 font-code">
                            2d6*2+1d10
                          </code>{' '}
                          - Roll two 6-sided dice, multiply the sum by 2, then add the result of one 10-sided die.
                        </li>
                        <li>
                          <code className="rounded-md bg-muted px-2 py-1 font-code">
                            (1d6+4)/2
                          </code>{' '}
                          - Parentheses are not yet supported. This will be calculated as 1d6 + (4/2).
                        </li>
                      </ul>
                    </div>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </CardContent>
          </Card>
          <div className="flex items-center justify-center">
            <Link
              href="https://github.com/stalker168"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 rounded-full bg-card p-2 pr-4 text-sm text-foreground transition-colors hover:bg-muted"
            >
              <Avatar className="h-10 w-10">
                <AvatarImage
                  src="/dice-forge/SalamanderWeb.webp"
                  alt="Salamander"
                  className="w-full h-full object-cover"
                />
                <AvatarFallback>S</AvatarFallback>
              </Avatar>
              <div className="flex flex-col">
                <span className="font-semibold">Made by Salamander</span>
                <span className="text-xs text-muted-foreground">
                  github.com/stalker168
                </span>
              </div>
            </Link>
          </div>
        </footer>
    </TooltipProvider>
  );
}
