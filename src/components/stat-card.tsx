"use client";

import type { LucideIcon } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface StatCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  color?: string;
}

export const StatCard = ({ title, value, icon: Icon, color }: StatCardProps) => {
  return (
    <Card className="text-center">
      <CardHeader className="flex flex-col items-center space-y-2 pb-2">
        <Icon className={cn('h-6 w-6 text-muted-foreground', color)} />
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
      </CardContent>
    </Card>
  );
};
