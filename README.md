# AutoDev Frontend

React application with TypeScript and Vite for SDLC developer automation.

## Tech Stack

- **Framework**: React 19
- **Build Tool**: Vite 8
- **Language**: TypeScript 6.0 (strict mode)
- **Logging**: Custom structured logger
- **Code Quality**: ESLint 9 + Prettier

## Project Structure

```
src/
├── main.tsx          # Application entry point
├── App.tsx           # Root component
├── App.css           # App-specific styles
├── index.css         # Global styles
├── vite-env.d.ts     # Vite type declarations
└── utils/
    └── logger.ts     # Structured logging utility
```

## Scripts

```bash
# Development
npm run dev           # Start dev server on port 3000

# Build
npm run build         # Type check + production build
npm run preview       # Preview production build

# Code Quality
npm run lint          # Check code with ESLint
npm run lint:fix      # Fix ESLint issues
npm run format        # Format code with Prettier
npm run format:check  # Check formatting
```

## Configuration

- **TypeScript**: Strict mode, React JSX transform
- **ESLint**: Flat config (ESLint 9), React + TypeScript rules
- **Prettier**: Single quotes, 2-space tabs, 100 char width
- **Vite**: React plugin, port 3000

## Development

The app includes a sample counter button with structured logging integration. Open the browser console to see log output in JSON format.

## Logging

```typescript
import { logger } from './utils/logger';

logger.info('Message', { meta: 'data' });
logger.warn('Warning');
logger.error('Error');
logger.debug('Debug info'); // Only in development
```
