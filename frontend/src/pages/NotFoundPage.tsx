import { Link } from 'react-router-dom';
import { HomeIcon, SearchIcon, CodeBracketIcon } from '../utils/icons.ts';

export function NotFoundPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="text-center">
        <div className="mb-8">
          <span className="text-9xl font-bold text-muted-foreground/20">404</span>
        </div>
        <h1 className="text-3xl font-bold mb-4">Page not found</h1>
        <p className="text-muted-foreground mb-8 max-w-md mx-auto">
          Sorry, we couldn't find the page you're looking for. It might have been moved or doesn't exist.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link to="/" className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 transition-colors">
            <HomeIcon className="w-5 h-5" />
            Go home
          </Link>
          <Link to="/projects" className="inline-flex items-center gap-2 px-6 py-3 border border-border rounded-lg font-medium hover:bg-accent transition-colors">
            <SearchIcon className="w-5 h-5" />
            Browse projects
          </Link>
          <Link to="/editor" className="inline-flex items-center gap-2 px-6 py-3 bg-muted hover:bg-muted/80 rounded-lg font-medium transition-colors">
            <CodeBracketIcon className="w-5 h-5" />
            New editor
          </Link>
        </div>
      </div>
    </div>
  );
}