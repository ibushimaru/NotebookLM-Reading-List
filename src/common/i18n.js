/**
 * i18n Helper Module for Chrome Extension
 * Provides internationalization support with fallback handling
 */

(function() {

  // Check if we're in a Chrome extension context
  const isExtensionContext = typeof chrome !== 'undefined' && chrome.i18n;

  /**
   * Get a localized message with fallback support
   * @param {string} messageName - The message key
   * @param {string|Array} substitutions - Optional substitutions for placeholders
   * @returns {string} The localized message or the message key if not found
   */
  function getMessage(messageName, substitutions) {
    if (!messageName) {
      console.warn('i18n: getMessage called without messageName');
      return '';
    }

    if (isExtensionContext) {
      try {
        const message = chrome.i18n.getMessage(messageName, substitutions);
        // If message is empty, chrome.i18n.getMessage returns empty string
        return message || messageName;
      } catch (error) {
        console.error('i18n: Error getting message:', error);
        return messageName;
      }
    } else {
      // Development fallback - return the key itself
      console.warn(`i18n: Chrome extension context not available. Returning key: ${messageName}`);
      return messageName;
    }
  }

  /**
   * Replace text content in all elements with data-i18n attributes
   * @param {HTMLElement|Document} rootElement - The root element to search within (default: document)
   */
  function translateDocument(rootElement = document) {
    if (!rootElement) {
      console.warn('i18n: translateDocument called without valid root element');
      return;
    }

    // Find all elements with data-i18n attribute
    const elements = rootElement.querySelectorAll('[data-i18n]');
    
    elements.forEach(element => {
      const messageName = element.getAttribute('data-i18n');
      if (!messageName) return;

      // Check for placeholder substitutions in data-i18n-substitutions attribute
      const substitutionsAttr = element.getAttribute('data-i18n-substitutions');
      let substitutions = null;
      
      if (substitutionsAttr) {
        try {
          // Parse JSON array of substitutions with validation
          const parsed = JSON.parse(substitutionsAttr);
          if (Array.isArray(parsed) || typeof parsed === 'string') {
            substitutions = parsed;
          } else {
            console.warn(`i18n: Invalid substitutions format for ${messageName}, expected array or string`);
          }
        } catch (error) {
          console.error(`i18n: Invalid substitutions JSON for ${messageName}:`, error);
        }
      }

      // Get the translated message
      const translatedText = getMessage(messageName, substitutions);

      // Handle different element types
      if (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA') {
        // For input elements, check for specific attribute targets
        const targetAttr = element.getAttribute('data-i18n-target');
        
        if (targetAttr === 'placeholder') {
          element.placeholder = translatedText;
        } else if (targetAttr === 'value') {
          element.value = translatedText;
        } else if (targetAttr === 'title') {
          element.title = translatedText;
        } else {
          // Default to placeholder for inputs
          element.placeholder = translatedText;
        }
      } else if (element.tagName === 'IMG') {
        // For images, set alt text or title
        const targetAttr = element.getAttribute('data-i18n-target');
        
        if (targetAttr === 'alt') {
          element.alt = translatedText;
        } else if (targetAttr === 'title') {
          element.title = translatedText;
        } else {
          // Default to alt for images
          element.alt = translatedText;
        }
      } else {
        // For other elements, check if we should set an attribute or text content
        const targetAttr = element.getAttribute('data-i18n-target');
        
        if (targetAttr) {
          element.setAttribute(targetAttr, translatedText);
        } else {
          // Default to text content
          element.textContent = translatedText;
        }
      }
    });
  }

  /**
   * Translate attributes specified in data-i18n-attrs
   * Format: data-i18n-attrs="title:tooltip_key,aria-label:label_key"
   */
  function translateAttributes(rootElement = document) {
    const elements = rootElement.querySelectorAll('[data-i18n-attrs]');
    
    elements.forEach(element => {
      const attrsString = element.getAttribute('data-i18n-attrs');
      if (!attrsString) return;

      // Parse attribute mappings
      const attrMappings = attrsString.split(',').map(mapping => mapping.trim());
      
      attrMappings.forEach(mapping => {
        const [attrName, messageName] = mapping.split(':').map(s => s.trim());
        if (attrName && messageName) {
          const translatedText = getMessage(messageName);
          element.setAttribute(attrName, translatedText);
        }
      });
    });
  }

  /**
   * Initialize i18n translations when DOM is ready
   */
  function initializeI18n() {
    // Set the document language based on Chrome's UI language
    if (isExtensionContext && document.documentElement) {
      const uiLang = chrome.i18n.getUILanguage();
      // Set the primary language code (e.g., 'ja' from 'ja-JP')
      document.documentElement.lang = uiLang.split('-')[0];
    }
    
    // Translate the document
    translateDocument();
    translateAttributes();

    // Set up observer for dynamically added content
    if (typeof MutationObserver !== 'undefined') {
      const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
          if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
            mutation.addedNodes.forEach((node) => {
              if (node.nodeType === Node.ELEMENT_NODE) {
                // Translate the newly added element and its children
                translateDocument(node);
                translateAttributes(node);
              }
            });
          }
        });
      });

      // Start observing
      if (document.body) {
        observer.observe(document.body, {
          childList: true,
          subtree: true
        });
      } else {
        // Wait for body to be available
        document.addEventListener('DOMContentLoaded', () => {
          if (document.body) {
            observer.observe(document.body, {
              childList: true,
              subtree: true
            });
          }
        });
      }
    }
  }

  // Auto-initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeI18n);
  } else {
    // DOM is already loaded
    initializeI18n();
  }

  // Export functions for manual use
  window.i18n = {
    getMessage,
    translateDocument,
    translateAttributes,
    initializeI18n
  };

  // Also export for module systems if available
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
      getMessage,
      translateDocument,
      translateAttributes,
      initializeI18n
    };
  }
})();