#!/bin/bash

# Build script for NotebookLM Reading List Chrome Extension
# This script creates a zip file for Chrome Web Store submission

echo "Building NotebookLM Reading List extension..."

# Set variables
EXTENSION_NAME="notebooklm-reading-list"
VERSION=$(grep '"version"' manifest.json | sed 's/.*"version": "\(.*\)".*/\1/')
OUTPUT_DIR="dist"
ZIP_NAME="${EXTENSION_NAME}-v${VERSION}.zip"

# Create output directory
mkdir -p $OUTPUT_DIR

# Create temporary directory for build
TEMP_DIR=$(mktemp -d)
echo "Using temporary directory: $TEMP_DIR"

# Copy files to temp directory, excluding unwanted files
echo "Copying files..."
rsync -av --exclude-from='.gitignore' \
  --exclude='.git' \
  --exclude='.gitignore' \
  --exclude='.env' \
  --exclude='.env.example' \
  --exclude='dist' \
  --exclude='*.sh' \
  --exclude='CHROME_WEBSTORE_RELEASE_PLAN.md' \
  --exclude='CONTRIBUTING.md' \
  --exclude='docs/SCREENSHOT_GUIDE.md' \
  --exclude='docs/PERMISSION_JUSTIFICATION.md' \
  --exclude='docs/CHROME_STORE_LISTING.md' \
  --exclude='ScreenShot' \
  --exclude='*.log' \
  --exclude='*.tmp' \
  --exclude='.DS_Store' \
  --exclude='Thumbs.db' \
  . $TEMP_DIR/

# Verify required files exist
echo "Verifying required files..."
REQUIRED_FILES=(
  "manifest.json"
  "src/background/background.js"
  "src/sidepanel/sidepanel.html"
  "src/sidepanel/sidepanel.js"
  "src/sidepanel/sidepanel.css"
  "icons/icon16.png"
  "icons/icon48.png"
  "icons/icon128.png"
  "_locales/en/messages.json"
  "_locales/ja/messages.json"
)

for file in "${REQUIRED_FILES[@]}"; do
  if [ ! -f "$TEMP_DIR/$file" ]; then
    echo "ERROR: Required file missing: $file"
    rm -rf $TEMP_DIR
    exit 1
  fi
done

# Create zip file
echo "Creating zip file..."
cd $TEMP_DIR
zip -r "../$OUTPUT_DIR/$ZIP_NAME" . -x "*.DS_Store" -x "__MACOSX/*"
cd ..

# Clean up
echo "Cleaning up..."
rm -rf $TEMP_DIR

# Display result
echo ""
echo "✅ Build complete!"
echo "📦 Output: $OUTPUT_DIR/$ZIP_NAME"
echo "📏 Size: $(du -h $OUTPUT_DIR/$ZIP_NAME | cut -f1)"
echo ""
echo "Next steps:"
echo "1. Test the extension by loading $OUTPUT_DIR/$ZIP_NAME in Chrome"
echo "2. Create screenshots according to docs/SCREENSHOT_GUIDE.md"
echo "3. Prepare promotional images"
echo "4. Submit to Chrome Web Store"

# Verify zip contents
echo ""
echo "Zip contents summary:"
unzip -l "$OUTPUT_DIR/$ZIP_NAME" | tail -n 1