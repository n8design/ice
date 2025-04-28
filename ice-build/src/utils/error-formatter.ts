import * as path from 'path';
import * as fs from 'fs';

// Colors for terminal output
const colors = {
  red: (text: string) => `\x1b[31m${text}\x1b[0m`,
  yellow: (text: string) => `\x1b[33m${text}\x1b[0m`,
  blue: (text: string) => `\x1b[34m${text}\x1b[0m`,
  magenta: (text: string) => `\x1b[35m${text}\x1b[0m`,
  cyan: (text: string) => `\x1b[36m${text}\x1b[0m`,
  white: (text: string) => `\x1b[37m${text}\x1b[0m`,
  gray: (text: string) => `\x1b[90m${text}\x1b[0m`,
  bold: (text: string) => `\x1b[1m${text}\x1b[0m`,
  underline: (text: string) => `\x1b[4m${text}\x1b[0m`,
  bgRed: (text: string) => `\x1b[41m${text}\x1b[0m`,
  bgYellow: (text: string) => `\x1b[43m${text}\x1b[0m`,
  bgBlue: (text: string) => `\x1b[44m${text}\x1b[0m`,
  bgMagenta: (text: string) => `\x1b[45m${text}\x1b[0m`, // Add missing bgMagenta property
};

interface ErrorLocation {
  file?: string;
  line?: number;
  column?: number;
  endLine?: number;
  endColumn?: number;
}

/**
 * Extract location information from esbuild or TypeScript error messages
 */
export function parseErrorLocation(errorMessage: string): ErrorLocation | undefined {
  // Match various filename patterns with line and column
  const patterns = [
    // Standard format: filename:line:column
    /(?:at\s+)?([^:()]+):(\d+):(\d+)/,
    // Format with 'file' prefix: file 'filename' line:column
    /file\s+'([^']+)'.*?(\d+):(\d+)/,
    // Parse esbuild style: [file]:line:column:
    /\[([^\]]+)\]:(\d+):(\d+):/,
    // TypeScript specific: foo.ts(123,45):
    /([^(]+)\((\d+),(\d+)\):/
  ];

  for (const pattern of patterns) {
    const match = errorMessage.match(pattern);
    if (match) {
      return {
        file: match[1],
        line: parseInt(match[2], 10),
        column: parseInt(match[3], 10)
      };
    }
  }

  // If no specific pattern matches, try to find any filename
  const fileMatch = errorMessage.match(/([a-zA-Z0-9_\-/.]+\.(ts|tsx|js|jsx|scss|sass|css))/);
  if (fileMatch) {
    return {
      file: fileMatch[1]
    };
  }

  return undefined;
}

/**
 * Get a code snippet surrounding the error location
 */
export function getCodeSnippet(filePath: string, line: number, column: number): string {
  try {
    if (!fs.existsSync(filePath)) return '';

    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');
    
    // Ensure line number is within range
    if (line < 1 || line > lines.length) return '';
    
    // Get lines before and after the error
    const startLine = Math.max(1, line - 2);
    const endLine = Math.min(lines.length, line + 2);
    
    let snippet = '';
    for (let i = startLine; i <= endLine; i++) {
      const lineContent = lines[i - 1];
      const isErrorLine = i === line;
      
      // Line number and content
      snippet += `${colors.gray(i.toString().padStart(4))} `;
      snippet += isErrorLine ? colors.white(lineContent) : colors.gray(lineContent);
      snippet += '\n';
      
      // Add an indicator for the error position
      if (isErrorLine && column > 0) {
        snippet += `${' '.repeat(5)}`;
        snippet += `${' '.repeat(column - 1)}${colors.red('^')}\n`;
      }
    }
    
    return snippet;
  } catch (error) {
    return '';
  }
}

/**
 * Extracts the filename from an error message or path
 */
function extractFilename(filePath?: string): string | undefined {
  if (!filePath) return undefined;
  return path.basename(filePath);
}

/**
 * Format error for nice terminal display
 */
export function formatBuildError(error: Error | string, projectDir: string = process.cwd()): string {
  const errorStr = typeof error === 'string' ? error : error.message;
  const location = parseErrorLocation(errorStr);
  let filePath = location?.file;
  let formattedError = '';
  
  // Make filepath relative to project if absolute
  if (filePath && path.isAbsolute(filePath)) {
    filePath = path.relative(projectDir, filePath);
  }
  
  const fileType = filePath ? getFileType(filePath) : undefined;
  const filename = extractFilename(filePath);
  
  // Error header with file type badge if available
  formattedError += `\n${colors.bgRed(' ERROR ')}`;
  if (fileType) {
    formattedError += ` ${formatFileTypeBadge(fileType)}`;
  }
  formattedError += ` ${colors.bold(colors.red('Build failed'))}\n\n`;
  
  // Filename in bold if available
  if (filename) {
    formattedError += `${colors.bold(colors.white(filename))}: `;
  }
  
  // Error message
  formattedError += `${colors.white(errorStr.split('\n')[0])}\n`;
  
  // File location with path
  if (filePath && location?.line) {
    formattedError += `\n${colors.cyan('→')} ${colors.bold(filePath)}:${colors.yellow(location.line.toString())}:${colors.yellow(location.column?.toString() || '1')}\n\n`;
    
    // Add code snippet if file exists
    try {
      const fullPath = path.resolve(projectDir, filePath);
      const snippet = getCodeSnippet(fullPath, location.line, location.column || 1);
      if (snippet) {
        formattedError += snippet + '\n';
      }
    } catch (e) {
      // Ignore snippet errors
    }
  }
  
  return formattedError;
}

/**
 * Get file type based on extension
 */
function getFileType(filePath: string): string | undefined {
  const ext = path.extname(filePath).toLowerCase();
  
  switch (ext) {
    case '.ts': return 'TypeScript';
    case '.tsx': return 'TSX';
    case '.js': return 'JavaScript';
    case '.jsx': return 'JSX';
    case '.scss': return 'SCSS';
    case '.sass': return 'Sass';
    case '.css': return 'CSS';
    case '.html': return 'HTML';
    case '.json': return 'JSON';
    default: return undefined;
  }
}

/**
 * Format a badge for the file type
 */
function formatFileTypeBadge(fileType: string): string {
  // Color coding for different file types
  switch (fileType) {
    case 'TypeScript':
    case 'TSX':
      return colors.bgBlue(` ${fileType} `);
    case 'SCSS':
    case 'Sass':
    case 'CSS':
      return colors.bgMagenta(` ${fileType} `); // Now this will work
    default:
      return colors.bgYellow(colors.white(` ${fileType} `));
  }
}

/**
 * Format compilation success message
 */
export function formatSuccess(message: string): string {
  return `\n${colors.bgYellow(colors.white(' SUCCESS '))} ${colors.bold(colors.white(message))}\n`;
}
