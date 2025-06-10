# QR Transfer Web Interface

A React-based web application for transferring files between devices using QR codes. This application provides both sender and receiver interfaces for secure, offline file transfer.

## Features

### Sender Interface
- Drag & drop file upload
- Configurable chunk size and timing
- QR code generation and sequential display
- Manual navigation and auto-advance modes
- Progress tracking and status indicators

### Receiver Interface
- Camera access and device selection
- Real-time QR code scanning
- Progress visualization with missing chunk tracking
- Data integrity verification with SHA-1 hash
- Automatic file download

## Quick Start

### Prerequisites
- Node.js 18+ 
- npm or yarn
- Modern web browser with camera access

### Installation
```bash
# Install dependencies
npm install
```

### Development Server
```bash
# Start the development server
npm start

# Alternative development command
npm run dev
```

The application will be available at:
- **Local**: http://localhost:5173
- **Network**: http://[your-ip]:5173 (accessible from other devices)

### Production Build
```bash
# Build for production
npm run build

# Preview production build
npm run preview
```

### Deployment

#### Cloudflare Pages
```bash
# Install Wrangler CLI (if not already installed)
npm install -g wrangler

# Deploy to Cloudflare Pages
wrangler pages deploy dist --project-name qrxfer-web

# Or connect your Git repository to Cloudflare Pages with these settings:
# Build command: npm run build
# Build output directory: dist
# Root directory: qrxfer-web
```

#### Other Platforms
The built `dist` folder can be deployed to any static hosting service:
- Vercel: `vercel --prod`
- Netlify: `netlify deploy --prod --dir=dist`
- GitHub Pages: Upload `dist` folder contents

### Testing
```bash
# Run tests
npm test

# Run tests with UI
npm run test:ui

# Run tests once (CI mode)
npm test -- --run
```

### Code Quality
```bash
# Run linter
npm run lint

# Type checking is included in build
npm run build
```

## Usage

1. **Start the server**: `npm start`
2. **Open in browser**: Navigate to http://localhost:5173
3. **Send files**: 
   - Go to `/send` 
   - Upload a file
   - Configure settings
   - Display QR codes
4. **Receive files**:
   - Go to `/receive` on another device
   - Grant camera permissions
   - Scan the QR codes
   - Download the reconstructed file

## Technology Stack

- **React 19** - UI framework
- **TypeScript** - Type safety
- **Vite** - Build tool and dev server
- **TailwindCSS** - Styling
- **Vitest** - Testing framework
- **QRCode.js** - QR code generation
- **jsQR** - QR code scanning

## Protocol

The application implements a custom QR transfer protocol:

1. **Header Phase**: Metadata (file length, SHA-1 hash)
2. **Data Phase**: Base64-encoded chunks with sequence numbers
3. **End Phase**: Transfer completion marker
4. **Integrity**: SHA-1 hash verification

## Browser Compatibility

- Chrome/Edge 90+
- Firefox 88+
- Safari 14+
- Camera access required for receiver

## Security

- All transfers are offline (no internet required)
- SHA-1 hash verification for data integrity
- No data is stored or transmitted to external servers
- Camera access is local only