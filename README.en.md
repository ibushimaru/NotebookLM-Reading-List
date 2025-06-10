# NotebookLM Reading List

English | [日本語](./README.md)

A Chrome extension for efficiently managing Google NotebookLM's audio overview feature

![Version](https://img.shields.io/badge/version-1.3.0-brightgreen.svg)
![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Chrome Extension](https://img.shields.io/badge/Chrome%20Extension-Manifest%20V3-green.svg)

## Overview

NotebookLM Reading List is a Chrome extension that allows you to centrally manage multiple notebooks created in Google NotebookLM and quickly access the audio overview feature. Manage all notebooks from the side panel and play audio with one click.

## Key Features

### ✅ Implemented Features

- 📚 **Notebook List Display** - Display all NotebookLM notebooks in the side panel
- 🔍 **Search & Filtering** - Filter by title search and icons
- 🎵 **Inline Audio Playback** - Play audio directly in the side panel
- ⚡ **Fast Access** - Access audio in 2-3 seconds with tab pool system
- 📊 **Real-time Progress Display** - Smooth seekbar animation at 60fps
- 🔄 **Automatic State Detection** - Automatically detect and handle audio generation state
- 💾 **Cache Function** - Cache audio information for 3 hours for faster access
- 🏷️ **Tag Management** - Add custom tags to organize notebooks
- 📅 **Sorting Function** - Display by creation date or NotebookLM order
- 🌐 **Multi-language Support** - Supports Japanese and English (follows browser language settings)
- 🌙 **Dark Mode** - Toggle between light and dark themes

## Installation

### Development Version Installation

1. Clone this repository
```bash
git clone https://github.com/ibushimaru/NotebookLM-Reading-List.git
cd NotebookLM-Reading-List
```

2. Open the Chrome extensions page
   - Navigate to `chrome://extensions/`
   - Turn on "Developer mode" in the top right

3. Load the extension
   - Click "Load unpacked"
   - Select the cloned folder

## Usage

1. Open [NotebookLM](https://notebooklm.google.com)
2. Click the extension icon to display the side panel
3. Select a notebook from the list to play audio
4. Click the "Audio Overview" button to start playback

### Feature Details

#### 🎵 Audio Playback Controls
- **Play/Pause**: Control with one click
- **Seek Function**: Click the progress bar to jump to any position
- **Progress Display**: Real-time playback position display

#### 🔍 Search and Filtering
- **Text Search**: Filter by notebook title
- **Icon Filter**: Categorize by NotebookLM icons

## Technical Specifications

- **Chrome Extension Manifest V3**
- **Chrome Side Panel API** - Always-visible side panel
- **Offscreen API** - Background audio playback
- **Content Scripts** - DOM manipulation of NotebookLM pages
- **Service Worker** - Background processing and tab management

### Performance Optimization

- **Tab Pool System**: Prepare tabs in advance for fast access
- **requestAnimationFrame**: Smooth animation at 60fps
- **GPU Acceleration**: Drawing optimization using transform

## Development

### Requirements

- Chrome 114 or later
- Node.js 16 or later (for development tools)

### Project Structure

```
├── manifest.json          # Extension manifest
├── src/
│   ├── background/       # Service Worker
│   ├── content/          # Content Scripts
│   ├── sidepanel/        # Side panel UI
│   └── offscreen/        # Offscreen Document for audio playback
├── icons/                # Extension icons
├── styles/               # Stylesheets
└── docs/                 # Documentation
```

## Troubleshooting

### Common Issues

**Q: Audio won't play**
- A: Make sure the NotebookLM tab is active

**Q: "Extension context invalidated" error appears**
- A: Reload the extension or refresh the page

**Q: Tabs close automatically**
- A: This is normal behavior. Tabs are automatically cleaned up after audio playback ends

## Contributing

Pull requests and issues are welcome!

1. Fork this repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Create a Pull Request

## License

This project is released under the MIT License. See the [LICENSE](./LICENSE) file for details.

## Author

- GitHub: [@ibushimaru](https://github.com/ibushimaru)

## Acknowledgments

- Google NotebookLM Team - For providing an excellent AI summarization tool
- Chrome Extensions Team - For powerful extension APIs
- Contributors - For feedback and improvement suggestions

---

⭐ If this project helped you, please give it a star!

## Support

If you would like to support the development of this project:

<a href="https://buymeacoffee.com/ibushimaru" target="_blank"><img src="https://cdn.buymeacoffee.com/buttons/v2/default-yellow.png" alt="Buy Me A Coffee" style="height: 40px !important;width: 150px !important;" ></a>