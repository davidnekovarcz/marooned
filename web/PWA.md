# PWA Configuration

This project is now configured as a Progressive Web App (PWA) to provide better mobile experience and offline capabilities.

## Features

- **Installable**: Users can install the app on their mobile device home screen
- **Offline Support**: Service worker caches game assets for offline play
- **Better Performance**: Assets are cached for faster loading
- **Full Screen Mode**: On mobile, the app runs in standalone mode without browser chrome
- **Optimized for Mobile**: Viewport settings optimized for mobile devices

## How It Works

The PWA setup includes:

1. **Web App Manifest** (`manifest.webmanifest`) - Defines app metadata, icons, and display mode
2. **Service Worker** (`sw.js`) - Handles asset caching and offline functionality
3. **PWA Icons** - Generated in multiple sizes for different devices
4. **Meta Tags** - Mobile-optimized viewport and theme configuration

## Caching Strategy

- **Game Assets**: `.obj`, `.mtl`, `.ogg`, `.fbx`, `.gltf`, `.png`, `.jpg`, `.svg` files are cached using CacheFirst strategy
- **Static Assets**: JavaScript, CSS, HTML files are precached during installation
- **External Fonts**: Google Fonts are cached for offline use

## Icons

App icons are located in `/web/public/icons/`:
- `icon.svg` - Source SVG icon
- `icon-192.png` - 192x192 icon for Android
- `icon-512.png` - 512x512 icon for splash screens and high-res displays

To regenerate icons after modifying `icon.svg`, run:
```bash
npm run generate-icons
```

## Testing PWA

1. Build the app: `npm run build`
2. Serve the built app: `npm run preview`
3. Open in Chrome DevTools → Application → Manifest to verify PWA settings
4. Test installation on mobile device or desktop Chrome

## Mobile Installation

On Android:
1. Visit the site in Chrome
2. Tap the "Add to Home Screen" prompt or menu option
3. The app will install as a standalone app

On iOS:
1. Visit the site in Safari
2. Tap the Share button
3. Select "Add to Home Screen"
