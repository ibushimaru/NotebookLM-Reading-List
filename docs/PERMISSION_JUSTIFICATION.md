# Permission Justification for Chrome Web Store

This document contains the justification text for each permission requested by NotebookLM Reading List. Use these descriptions when submitting to Chrome Web Store.

## Permissions

### sidePanel

**Justification:**
The core functionality of our extension is to provide a persistent side panel that displays all NotebookLM notebooks in one place. This permission is essential because users need to see their notebook list while simultaneously viewing NotebookLM content, eliminating the need to switch between tabs constantly.

### storage

**Justification:**
We use local storage to:
1. Cache audio overview information for 3 hours to reduce loading times from 30+ seconds to 2-3 seconds
2. Save user preferences such as custom tags, sorting options, and theme settings
3. Store temporary session data to restore playback state when the panel is reopened

All data is stored locally on the user's device and never transmitted to external servers.

### activeTab

**Justification:**
This permission allows us to interact with the currently active NotebookLM tab to:
1. Extract notebook information when the user opens the side panel
2. Detect when audio overviews are ready for playback
3. Monitor the current state of the NotebookLM interface

We only access NotebookLM tabs and do not interact with any other websites.

### tabs

**Justification:**
We use the tabs API to:
1. Create and manage background tabs for audio playback (our tab pool system)
2. Navigate to specific notebooks when users click audio overview buttons
3. Clean up tabs after audio playback completes
4. Switch between the main NotebookLM tab and audio playback tabs

This enables our 2-3 second fast access feature by pre-loading tabs in the background.

### offscreen

**Justification:**
The offscreen API is critical for three specific features:
1. **AUDIO_PLAYBACK**: Play NotebookLM audio overviews in the background while users continue working
2. **DOM_SCRAPING**: Extract notebook data and audio information from NotebookLM's dynamic interface
3. **IFRAME_SCRIPTING**: Interact with NotebookLM's iframe-based architecture to control playback

Without this permission, users would need to keep audio tabs in the foreground, defeating the purpose of the extension.

### scripting

**Justification:**
We inject content scripts into NotebookLM pages to:
1. Extract notebook metadata (titles, IDs, creation dates)
2. Detect when audio overviews are generated and ready
3. Add event listeners for audio playback control
4. Monitor audio generation progress

The scripts only run on notebooklm.google.com and do not affect any other websites.

## Host Permissions

### https://notebooklm.google.com/*

**Justification:**
This host permission is essential because our extension specifically enhances the NotebookLM experience. We need to:
1. Access the NotebookLM DOM to extract notebook information
2. Control audio playback features
3. Monitor the state of audio overview generation
4. Interact with NotebookLM's interface elements

The extension is designed exclusively for NotebookLM and does not function on any other website.

## Why These Permissions Are Necessary

Our extension provides significant value to NotebookLM users by:

1. **Saving Time**: Reduces audio access time from 30+ seconds to 2-3 seconds
2. **Improving Workflow**: Eliminates the need to navigate through multiple notebooks
3. **Enhancing Organization**: Adds tagging and search capabilities not available in NotebookLM
4. **Enabling Multitasking**: Allows background audio playback while working on other tasks

Each permission directly contributes to these core features. We follow the principle of least privilege and only request permissions that are absolutely necessary for functionality.

## Privacy Commitment

We want to assure reviewers and users that:
- We do NOT collect any user data
- We do NOT connect to any external servers
- We do NOT use analytics or tracking
- All data remains local to the user's device
- Our code is open source and available for inspection

## Technical Implementation Notes

For reviewers interested in the technical details:

1. **Tab Pool System**: We pre-create 2 background tabs to enable instant audio access
2. **Caching Strategy**: Audio metadata is cached for 3 hours using Chrome's storage API
3. **Performance**: We use requestAnimationFrame for 60fps progress updates
4. **Memory Management**: Tabs are automatically cleaned up after audio playback

## Sample Code References

Key files that demonstrate proper permission usage:
- `src/background/background.js`: Tab management and offscreen document creation
- `src/content/content.js`: DOM extraction and event monitoring
- `src/sidepanel/sidepanel.js`: Storage API usage and user interface
- `src/offscreen/offscreen.js`: Audio playback control

## Contact

If you need any clarification about our permission usage, please contact us through:
- GitHub Issues: https://github.com/ibushimaru/NotebookLM-Reading-List/issues
- Email: [Will be provided if required by Chrome Web Store]