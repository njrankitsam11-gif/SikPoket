/**
 * SikPoket Chat Helper
 * Manages the AI Research Assistant using Chrome's local window.ai API.
 * Uses cached bookmarks and notes as context for answers.
 */

(function(global) {
  const ChatHelper = {
    session: null,
    
    // Check if the AI model is available
    isAvailable: async function() {
      try {
        const lm = window.ai?.languageModel || window.LanguageModel;
        if (lm) {
          const capabilities = await lm.capabilities();
          return capabilities.available === 'readily' || capabilities.available === 'after-download';
        }
      } catch (e) {
        console.warn('AI not available:', e);
      }
      return false;
    },

    // Initialize an AI chat session with context
    initSession: async function(contextItems) {
      const lm = window.ai?.languageModel || window.LanguageModel;
      if (!lm) throw new Error("AI not supported");

      // Format context from user's bookmarks and notes
      let contextStr = "You are the SikPoket AI Research Assistant. Your goal is to answer questions based strictly on the user's saved notes and bookmarks provided below.\n\nContext:\n";
      
      let addedTokens = 0;
      for (const item of contextItems) {
        const title = item.title || item.url || item.name || 'Untitled';
        const content = item.content || '';
        const itemStr = `[Title: ${title}]\n${content ? `[Content: ${content}]\n` : ''}`;
        
        // Basic length check to avoid blowing up the prompt context window (rough approximation)
        if (addedTokens + itemStr.length > 25000) break;
        
        contextStr += itemStr + "\n";
        addedTokens += itemStr.length;
      }

      this.session = await lm.create({
        systemPrompt: contextStr
      });
      return this.session;
    },

    // Send a message to the AI
    prompt: async function(message) {
      if (!this.session) throw new Error("Session not initialized");
      return await this.session.prompt(message);
    },

    // Clean up
    destroy: function() {
      if (this.session) {
        try { this.session.destroy(); } catch (e) {}
        this.session = null;
      }
    }
  };

  global.ChatHelper = ChatHelper;
})(typeof window !== 'undefined' ? window : globalThis);
