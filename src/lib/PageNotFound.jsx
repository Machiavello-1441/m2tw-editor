import React from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Button } from '@/components/ui/button';
import { Castle } from 'lucide-react';

export default function PageNotFound() {
  return (
    <div className="dark min-h-screen bg-background flex items-center justify-center">
      <div className="text-center space-y-4">
        <Castle className="w-12 h-12 text-primary mx-auto" />
        <h1 className="text-3xl font-bold text-foreground">404</h1>
        <p className="text-muted-foreground">This page does not exist in the kingdom.</p>
        <Link to={createPageUrl('Home')}>
          <Button>Return Home</Button>
        </Link>
      </div>
    </div>
  );
}