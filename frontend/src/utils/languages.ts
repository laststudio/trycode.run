export const LANGUAGES = [
  { id: 'python', name: 'Python', version: '3.11', extensions: ['.py'], mime: 'text/x-python', wasm: 'pyodide' },
  { id: 'javascript', name: 'JavaScript', version: '20', extensions: ['.js', '.mjs'], mime: 'application/javascript', wasm: 'quickjs' },
  { id: 'typescript', name: 'TypeScript', version: '5.4', extensions: ['.ts', '.tsx'], mime: 'application/typescript', wasm: 'quickjs' },
  { id: 'rust', name: 'Rust', version: '1.80', extensions: ['.rs'], mime: 'text/rust', wasm: 'wasmer' },
  { id: 'go', name: 'Go', version: '1.22', extensions: ['.go'], mime: 'text/x-go', wasm: 'native' },
  { id: 'java', name: 'Java', version: '21', extensions: ['.java'], mime: 'text/x-java', wasm: 'native' },
  { id: 'cpp', name: 'C++', version: '13', extensions: ['.cpp', '.cc', '.cxx', '.hpp', '.h'], mime: 'text/x-c++', wasm: 'native' },
  { id: 'c', name: 'C', version: '13', extensions: ['.c', '.h'], mime: 'text/x-c', wasm: 'native' },
  { id: 'csharp', name: 'C#', version: '8.0', extensions: ['.cs'], mime: 'text/x-csharp', wasm: 'native' },
  { id: 'php', name: 'PHP', version: '8.3', extensions: ['.php', '.phtml'], mime: 'text/x-php', wasm: 'native' },
  { id: 'ruby', name: 'Ruby', version: '3.3', extensions: ['.rb'], mime: 'text/x-ruby', wasm: 'native' },
  { id: 'swift', name: 'Swift', version: '5.10', extensions: ['.swift'], mime: 'text/x-swift', wasm: 'native' },
  { id: 'kotlin', name: 'Kotlin', version: '1.9', extensions: ['.kt', '.kts'], mime: 'text/x-kotlin', wasm: 'native' },
  { id: 'scala', name: 'Scala', version: '3.4', extensions: ['.scala', '.sc'], mime: 'text/x-scala', wasm: 'native' },
  { id: 'r', name: 'R', version: '4.4', extensions: ['.r', '.R'], mime: 'text/x-r', wasm: 'native' },
  { id: 'lua', name: 'Lua', version: '5.4', extensions: ['.lua'], mime: 'text/x-lua', wasm: 'native' },
  { id: 'perl', name: 'Perl', version: '5.38', extensions: ['.pl', '.pm'], mime: 'text/x-perl', wasm: 'native' },
  { id: 'dart', name: 'Dart', version: '3.4', extensions: ['.dart'], mime: 'application/dart', wasm: 'native' },
  { id: 'zig', name: 'Zig', version: '0.13', extensions: ['.zig'], mime: 'text/x-zig', wasm: 'native' },
  { id: 'julia', name: 'Julia', version: '1.10', extensions: ['.jl'], mime: 'text/x-julia', wasm: 'native' },
  { id: 'haskell', name: 'Haskell', version: '9.8', extensions: ['.hs', '.lhs'], mime: 'text/x-haskell', wasm: 'native' },
  { id: 'fortran', name: 'Fortran', version: '13', extensions: ['.f90', '.f95', '.f03', '.f08'], mime: 'text/x-fortran', wasm: 'native' },
  { id: 'objectivec', name: 'Objective-C', version: '13', extensions: ['.m', '.mm'], mime: 'text/x-objective-c', wasm: 'native' },
  { id: 'vbnet', name: 'VB.NET', version: '8.0', extensions: ['.vb'], mime: 'text/x-vb', wasm: 'native' },
  { id: 'fsharp', name: 'F#', version: '8.0', extensions: ['.fs', '.fsx'], mime: 'text/x-fsharp', wasm: 'native' },
  { id: 'groovy', name: 'Groovy', version: '4.0', extensions: ['.groovy', '.gvy', '.gy', '.gsh'], mime: 'text/x-groovy', wasm: 'native' },
  { id: 'html', name: 'HTML/CSS/JS', version: '5', extensions: ['.html', '.htm', '.css', '.js'], mime: 'text/html', wasm: 'browser' },
  { id: 'sql', name: 'SQL (SQLite)', version: '3.45', extensions: ['.sql'], mime: 'text/x-sql', wasm: 'native' },
  { id: 'bash', name: 'Bash', version: '5.2', extensions: ['.sh', '.bash'], mime: 'application/x-shellscript', wasm: 'native' },
  { id: 'powershell', name: 'PowerShell', version: '7.4', extensions: ['.ps1', '.psm1', '.psd1'], mime: 'text/x-powershell', wasm: 'native' },
];

export function getLanguageById(id: string) {
  return LANGUAGES.find(l => l.id === id) || LANGUAGES[0];
}

export function getLanguageByExtension(ext: string) {
  return LANGUAGES.find(l => l.extensions.includes(ext)) || LANGUAGES[0];
}