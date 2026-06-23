/**
 * AURA CHAT - Frontend Application Logic
 * Maintains live session memory, binds UI events, and connects to the FastAPI backend.
 */

document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const chatForm = document.getElementById('chat-form');
    const chatInput = document.getElementById('chat-input');
    const sendBtn = document.getElementById('send-btn');
    const chatMessages = document.getElementById('chat-messages');
    const welcomeView = document.getElementById('welcome-view');
    const typingIndicator = document.getElementById('typing-indicator');
    const clearChatBtn = document.getElementById('clear-chat-btn');
    const modelSelector = document.getElementById('model-selector');
    const statusDot = document.getElementById('status-dot');
    const statusText = document.getElementById('status-text');
    const errorBanner = document.getElementById('error-banner');
    const errorMessage = document.getElementById('error-message');
    const closeError = document.getElementById('close-error');
    const sessionDisplay = document.getElementById('session-display');
    const suggestionCards = document.querySelectorAll('.suggestion-card');

    // App State
    let sessionId = getOrCreateSessionId();
    let isServerConnected = false;

    // Initialize UI
    sessionDisplay.textContent = sessionId.substring(0, 15) + '...';
    checkBackendStatus();

    // Enable/Disable Send Button based on Input Content
    chatInput.addEventListener('input', () => {
        sendBtn.disabled = chatInput.value.trim() === '' || !isServerConnected;
    });

    // Handle Form Submission (Send Message)
    chatForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const text = chatInput.value.trim();
        if (text === '') return;

        sendMessage(text);
    });

    // Clear Memory Click Handler
    clearChatBtn.addEventListener('click', async () => {
        if (confirm("Are you sure you want to clear this chatbot's memory? This will wipe the active conversation history.")) {
            try {
                const response = await fetch(`/api/chat/${sessionId}`, {
                    method: 'DELETE'
                });
                const result = await response.json();
                
                if (response.ok) {
                    // Clear message bubbles from UI (except typing indicator)
                    const wrappers = chatMessages.querySelectorAll('.message-wrapper:not(#typing-indicator)');
                    wrappers.forEach(w => w.remove());
                    
                    // Show Welcome screen again
                    welcomeView.classList.remove('hidden');
                    
                    // Notify User
                    showSuccessToast("Conversation memory has been wiped clean.");
                } else {
                    showError(result.detail || "Failed to clear memory session.");
                }
            } catch (err) {
                showError("Network error: Could not reach the server to clear memory.");
            }
        }
    });

    // Suggestion Cards Helper
    suggestionCards.forEach(card => {
        card.addEventListener('click', () => {
            const prompt = card.getAttribute('data-prompt');
            chatInput.value = prompt;
            sendBtn.disabled = false;
            chatInput.focus();
        });
    });

    // Close Error Banner
    closeError.addEventListener('click', () => {
        errorBanner.classList.add('hidden');
    });

    /**
     * Session ID Manager
     * Generates a unique user session ID or retrieves the existing one from localStorage.
     */
    function getOrCreateSessionId() {
        let sid = localStorage.getItem('aura_chat_session_id');
        if (!sid) {
            // Generate simple UUID-like string
            sid = 'aura_' + Math.random().toString(36).substring(2, 11) + '_' + Date.now();
            localStorage.setItem('aura_chat_session_id', sid);
        }
        return sid;
    }

    /**
     * Check Backend API Status
     */
    async function checkBackendStatus() {
        try {
            const response = await fetch('/api/status');
            const data = await response.json();
            
            if (response.ok) {
                isServerConnected = true;
                
                // Update status visual
                statusDot.className = 'status-dot online';
                statusText.textContent = 'Server Online';
                
                if (chatInput.value.trim() !== '') {
                    sendBtn.disabled = false;
                }
                
                // Check if API key is configured
                if (!data.gemini_api_key_configured) {
                    showWarning("Notice: GEMINI_API_KEY is not set. The chatbot is running in Demo (Mock Memory) Mode. Fill your key in .env to enable live generation.");
                } else {
                    errorBanner.classList.add('hidden');
                }
            } else {
                setOfflineState("Server Error");
            }
        } catch (err) {
            setOfflineState("Connection Lost");
        }
    }

    function setOfflineState(message) {
        isServerConnected = false;
        statusDot.className = 'status-dot offline';
        statusText.textContent = message;
        sendBtn.disabled = true;
        showError("Failed to connect to the backend server. Make sure FastAPI is running (python main.py).");
    }

    /**
     * Core function to handle sending messages
     */
    async function sendMessage(text) {
        // 1. Update UI: Append User Bubble
        appendMessage('user', text);
        
        // Clear input field and disable UI
        chatInput.value = '';
        sendBtn.disabled = true;
        chatInput.disabled = true;
        
        // Hide welcome view
        welcomeView.classList.add('hidden');
        
        // Show typing loading indicator
        typingIndicator.classList.remove('hidden');
        scrollToBottom();

        // 2. Build API Request
        const modelSelected = modelSelector.value;
        
        try {
            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    session_id: sessionId,
                    message: text,
                    model: modelSelected
                })
            });
            
            const data = await response.json();
            
            // Hide typing indicator
            typingIndicator.classList.add('hidden');
            
            if (response.ok) {
                // 3. Update UI: Append AI Bubble
                appendMessage('model', data.response);
            } else {
                showError(data.detail || "An error occurred while generating the response.");
                // Add a small inline system warning
                appendSystemWarning(data.detail || "API request failed. Your message was not saved in memory history. Please retry.");
            }
        } catch (err) {
            typingIndicator.classList.add('hidden');
            showError("Network error: Could not reach the API backend.");
            appendSystemWarning("Network error: Connection refused by server. Please verify uvicorn is running.");
        } finally {
            // Re-enable Input UI
            chatInput.disabled = false;
            chatInput.focus();
            if (chatInput.value.trim() !== '') {
                sendBtn.disabled = false;
            }
        }
    }

    /**
     * Render message bubble in DOM
     */
    function appendMessage(role, text) {
        const wrapper = document.createElement('div');
        wrapper.className = `message-wrapper ${role}-wrapper`;

        const avatar = document.createElement('div');
        avatar.className = `avatar ${role}-avatar`;
        avatar.innerHTML = role === 'user' ? '<i class="fa-solid fa-user"></i>' : '<i class="fa-solid fa-robot"></i>';

        const bubble = document.createElement('div');
        bubble.className = `message-bubble ${role}-bubble`;
        
        // Body Content
        const contentDiv = document.createElement('div');
        contentDiv.className = 'bubble-content';
        
        if (role === 'model') {
            contentDiv.innerHTML = formatMarkdown(text);
        } else {
            // Simple newline to break conversion for User text to keep it light
            contentDiv.innerHTML = `<p>${escapeHTML(text).replace(/\n/g, '<br>')}</p>`;
        }
        
        bubble.appendChild(contentDiv);

        // Timestamp
        const timestamp = document.createElement('span');
        timestamp.className = 'timestamp';
        timestamp.textContent = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        bubble.appendChild(timestamp);

        wrapper.appendChild(avatar);
        wrapper.appendChild(bubble);

        // Insert before the typing indicator
        chatMessages.insertBefore(wrapper, typingIndicator);
        scrollToBottom();
    }

    /**
     * Render a system warning line directly inside the conversation list
     */
    function appendSystemWarning(text) {
        const warningDiv = document.createElement('div');
        warningDiv.style.textAlign = 'center';
        warningDiv.style.color = '#f87171';
        warningDiv.style.fontSize = '0.8rem';
        warningDiv.style.margin = '10px 0';
        warningDiv.style.padding = '6px 12px';
        warningDiv.style.background = 'rgba(239, 68, 68, 0.1)';
        warningDiv.style.borderRadius = '8px';
        warningDiv.style.border = '1px solid rgba(239, 68, 68, 0.15)';
        warningDiv.innerHTML = `<i class="fa-solid fa-circle-info"></i> ${escapeHTML(text)}`;
        
        chatMessages.insertBefore(warningDiv, typingIndicator);
        scrollToBottom();
    }

    /**
     * Scroll the conversation window to the bottom
     */
    function scrollToBottom() {
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    /**
     * Custom lightweight HTML escaper
     */
    function escapeHTML(str) {
        return str.replace(/[&<>'"]/g, 
            tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)
        );
    }

    /**
     * Custom lightweight markdown parser to format Gemini responses
     */
    function formatMarkdown(text) {
        if (!text) return '';
        
        let escaped = escapeHTML(text);
        
        // 1. Fenced Code Blocks: ```lang\ncode\n```
        const codeBlockRegex = /```(?:[a-zA-Z0-9]+)?\n([\s\S]*?)```/g;
        escaped = escaped.replace(codeBlockRegex, (match, code) => {
            return `<pre><code>${code.trim()}</code></pre>`;
        });
        
        // 2. Inline Code: `code`
        const inlineCodeRegex = /`([^`]+)`/g;
        escaped = escaped.replace(inlineCodeRegex, '<code>$1</code>');
        
        // 3. Bold Text: **text**
        const boldRegex = /\*\*([^*]+)\*\*/g;
        escaped = escaped.replace(boldRegex, '<strong>$1</strong>');
        
        // Split lines to handle lists
        const lines = escaped.split('\n');
        let inList = false;
        const processedLines = lines.map(line => {
            const trimmed = line.trim();
            // Match * list items or - list items
            if (trimmed.startsWith('* ') || trimmed.startsWith('- ')) {
                let liContent = trimmed.substring(2);
                let prefix = '';
                if (!inList) {
                    inList = true;
                    prefix = '<ul style="margin: 8px 0 8px 20px; list-style-type: disc;">';
                }
                return prefix + `<li>${liContent}</li>`;
            } else {
                let suffix = '';
                if (inList) {
                    inList = false;
                    suffix = '</ul>';
                }
                return suffix + line;
            }
        });
        
        if (inList) {
            processedLines.push('</ul>');
        }
        
        let finalHtml = processedLines.join('\n');
        
        // Format paragraphs (double newline splits)
        finalHtml = finalHtml.split('\n\n').map(p => {
            const pTrim = p.trim();
            if (pTrim.startsWith('<pre>') || pTrim.startsWith('<ul') || pTrim.startsWith('</ul')) {
                return p;
            }
            return `<p style="margin-bottom: 8px; line-height: 1.5;">${p.replace(/\n/g, '<br>')}</p>`;
        }).join('');
        
        return finalHtml;
    }

    /**
     * Show Error Banner
     */
    function showError(msg) {
        errorBanner.classList.remove('warning');
        errorBanner.querySelector('.error-title').textContent = "System Error";
        errorBanner.querySelector('.error-icon').className = "fa-solid fa-triangle-exclamation error-icon";
        errorMessage.textContent = msg;
        errorBanner.classList.remove('hidden');
        
        // Automatically hide error after 8 seconds
        setTimeout(() => {
            errorBanner.classList.add('hidden');
        }, 8000);
    }

    /**
     * Show Warning Banner
     */
    function showWarning(msg) {
        errorBanner.classList.add('warning');
        errorBanner.querySelector('.error-title').textContent = "Demo Memory Mode Active";
        errorBanner.querySelector('.error-icon').className = "fa-solid fa-circle-info error-icon";
        errorMessage.textContent = msg;
        errorBanner.classList.remove('hidden');
    }

    /**
     * Simple visual Toast for notifications
     */
    function showSuccessToast(message) {
        const toast = document.createElement('div');
        toast.style.position = 'absolute';
        toast.style.bottom = '90px';
        toast.style.left = '50%';
        toast.style.transform = 'translateX(-50%)';
        toast.style.background = 'rgba(124, 58, 237, 0.9)';
        toast.style.color = '#fff';
        toast.style.padding = '8px 20px';
        toast.style.borderRadius = '20px';
        toast.style.fontSize = '0.85rem';
        toast.style.fontWeight = '600';
        toast.style.backdropFilter = 'blur(10px)';
        toast.style.boxShadow = '0 5px 15px rgba(0,0,0,0.3)';
        toast.style.zIndex = '99';
        toast.style.animation = 'fadeInOut 2.5s ease-in-out forwards';
        
        const style = document.createElement('style');
        style.innerHTML = `
            @keyframes fadeInOut {
                0% { opacity: 0; transform: translate(-50%, 10px); }
                15% { opacity: 1; transform: translate(-50%, 0); }
                85% { opacity: 1; transform: translate(-50%, 0); }
                100% { opacity: 0; transform: translate(-50%, -10px); }
            }
        `;
        document.head.appendChild(style);
        
        toast.innerHTML = `<i class="fa-solid fa-circle-check"></i> ${message}`;
        document.querySelector('.app-container').appendChild(toast);
        
        setTimeout(() => {
            toast.remove();
            style.remove();
        }, 2600);
    }

    // Keep checking API status every 15 seconds to ensure heartbeat
    setInterval(checkBackendStatus, 15000);
});
