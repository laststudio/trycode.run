import { 
  CodeBracketIcon, 
  DocumentTextIcon, 
  PhotoIcon, 
  MusicalNoteIcon, 
  FilmIcon, 
  DocumentChartBarIcon,
  Cog6ToothIcon,
  GlobeAltIcon,
  DocumentArrowUpIcon,
  ArchiveBoxArrowDownIcon,
} from './icons.ts';

interface FileIconProps {
  className?: string;
}

export function getFileIcon(fileName: string, mimeType?: string) {
  const ext = fileName.split('.').pop()?.toLowerCase() || '';
  
  // Code files
  const codeExtensions = [
    'py', 'js', 'ts', 'jsx', 'tsx', 'rs', 'go', 'java', 'cpp', 'c', 'cs', 'php', 
    'rb', 'swift', 'kt', 'scala', 'r', 'lua', 'pl', 'dart', 'zig', 'jl', 'hs',
    'f90', 'm', 'mm', 'vb', 'fs', 'groovy', 'sh', 'bash', 'ps1', 'sql'
  ];
  
  if (codeExtensions.includes(ext)) {
    return CodeBracketIcon;
  }
  
  // Web files
  if (['html', 'htm', 'css', 'scss', 'sass', 'less', 'vue', 'svelte'].includes(ext)) {
    return GlobeAltIcon;
  }
  
  // Config files
  if (['json', 'yaml', 'yml', 'toml', 'ini', 'cfg', 'conf', 'config', 'env'].includes(ext)) {
    return Cog6ToothIcon;
  }
  
  // Documentation
  if (['md', 'mdx', 'txt', 'rst', 'adoc', 'tex'].includes(ext)) {
    return DocumentTextIcon;
  }
  
  // Images
  if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'ico', 'bmp', 'tiff'].includes(ext)) {
    return PhotoIcon;
  }
  
  // Audio
  if (['mp3', 'wav', 'ogg', 'flac', 'aac', 'm4a'].includes(ext)) {
    return MusicalNoteIcon;
  }
  
  // Video
  if (['mp4', 'webm', 'mov', 'avi', 'mkv'].includes(ext)) {
    return FilmIcon;
  }
  
  // Data
  if (['csv', 'tsv', 'xml', 'xlsx', 'xls'].includes(ext)) {
    return DocumentChartBarIcon;
  }
  
  // Archives
  if (['zip', 'tar', 'gz', 'rar', '7z', 'bz2'].includes(ext)) {
    return ArchiveBoxArrowDownIcon;
  }
  
  // Executables/Scripts
  if (['exe', 'bin', 'app', 'apk', 'dmg', 'deb', 'rpm'].includes(ext)) {
    return DocumentArrowUpIcon;
  }
  
  // Fonts
  if (['ttf', 'otf', 'woff', 'woff2', 'eot'].includes(ext)) {
    return DocumentTextIcon;
  }
  
  // Default based on mime type
  if (mimeType) {
    if (mimeType.startsWith('text/')) return DocumentTextIcon;
    if (mimeType.startsWith('image/')) return PhotoIcon;
    if (mimeType.startsWith('audio/')) return MusicalNoteIcon;
    if (mimeType.startsWith('video/')) return FilmIcon;
    if (mimeType.startsWith('application/')) return DocumentTextIcon;
  }
  
  return DocumentTextIcon;
}

export function FileIcon({ className }: FileIconProps) {
  return <DocumentTextIcon className={className} />;
}

export function FolderIcon({ className }: FileIconProps) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-1-1H5a2 2 0 00-2 2z" />
    </svg>
  );
}