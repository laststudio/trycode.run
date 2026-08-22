import { useState, useRef, useEffect } from 'react';
import { ChevronDownIcon, CheckIcon } from '@heroicons/react/24/outline';
import { LANGUAGES, Language } from '../../utils/languages';
import clsx from 'clsx';

interface MobileLanguageSelectorProps {
  value: string;
  onChange: (langId: string) => void;
  languages?: typeof LANGUAGES;
  disabled?: boolean;
  className?: string;
}

export function MobileLanguageSelector({ 
  value, 
  onChange, 
  languages = LANGUAGES,
  disabled = false,
  className = '',
}: MobileLanguageSelectorProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const filteredLanguages = languages.filter(lang =>
    lang.name.toLowerCase().includes(search.toLowerCase()) ||
    lang.id.toLowerCase().includes(search.toLowerCase())
  );

  const selectedLang = languages.find(l => l.id === value) || languages[0];

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node) &&
          triggerRef.current && !triggerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className={clsx('relative', className)} ref={dropdownRef}>
      <button
        ref={triggerRef}
        onClick={() => !disabled && setOpen(!open)}
        disabled={disabled}
        className={clsx(
          'flex items-center gap-2 px-3 py-2 bg-card border border-border rounded-lg text-sm hover:bg-accent transition-colors',
          disabled && 'opacity-50 cursor-not-allowed'
        )}
        aria-haspopup="listbox"
        aria-expanded={open}
        type="button"
      >
        <span className="font-mono text-sm truncate max-w-[120px]">{selectedLang.name}</span>
        <ChevronDownIcon className={clsx('w-4 h-4 text-muted-foreground', open && 'rotate-180')} />
      </button>

      {open && (
        <div className="absolute bottom-full left-0 right-0 mb-1 bg-popover border border-border rounded-lg shadow-lg py-1 z-20 max-h-64 overflow-auto">
          <div className="p-2 border-b border-border">
            <input
              type="text"
              placeholder="Search languages..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full px-3 py-1.5 text-sm bg-background border border-border rounded-lg outline-none focus:border-primary"
              autoFocus
            />
          </div>
          <div className="py-1 max-h-64 overflow-auto">
            {filteredLanguages.map(lang => (
              <button
                key={lang.id}
                onClick={() => {
                  onChange(lang.id);
                  setOpen(false);
                }}
                className={clsx(
                  'w-full px-3 py-2 text-left text-sm rounded-lg transition-colors flex items-center gap-2',
                  value === lang.id ? 'bg-primary/10 text-primary' : 'hover:bg-accent'
                )}
              >
                <span className="font-medium">{lang.name}</span>
                <span className="text-xs text-muted-foreground ml-auto">{lang.version}</span>
                {value === lang.id && <CheckIcon className="w-4 h-4 text-primary ml-auto" />}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export function getLanguageById(languages: typeof LANGUAGES, id: string): Language | undefined {
  return languages.find(l => l.id === id);
}