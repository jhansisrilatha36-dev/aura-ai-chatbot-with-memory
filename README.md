# AURA // Custom AI Chatbot with Memory

A premium, production-ready web application showcasing **session-based conversation memory** integrated with Google's Large Language Models (LLMs) using the official `google-genai` SDK. 

The chatbot features a modern **glassmorphism dark UI** with animated glowing backdrops, interactive sample suggestion cards, real-time API connection heartbeats, message formatting, and clean error recovery states.

---

## 🏗️ Architecture Flow

The flowchart below demonstrates the sequence of data transfers when a user interacts with the chatbot:

```
                  ┌───────────────────────────────┐
                  │          User Input           │
                  └───────────────┬───────────────┘
                                  │
                                  ▼
                  ┌───────────────────────────────┐
                  │    Frontend Chat Interface    │
                  └───────────────┬───────────────┘
                                  │ POST /api/chat {message, session_id}
                                  ▼
                  ┌───────────────────────────────┐
                  │          Backend API          │
                  └───────────────┬───────────────┘
                                  │
                                  ▼
                  ┌───────────────────────────────┐
                  │   Conversation Memory Array   │
                  │   (In-Memory DB per Session)  │
                  └───────────────┬───────────────┘
                                  │
                                  ▼
                  ┌───────────────────────────────┐
                  │         Gemini LLM API        │
                  │     (Full History Sent)       │
                  └───────────────┬───────────────┘
                                  │
                                  ▼
                  ┌───────────────────────────────┐
                  │          AI Response          │
                  └───────────────┬───────────────┘
                                  │
                                  ▼
                  ┌───────────────────────────────┐
                  │      Update Chat History      │
                  │  (Append User + AI Messages)  │
                  └───────────────────────────────┘
```

---

## 🧠 How Memory Works

Unlike stateless LLM integrations that treat every request in isolation, this chatbot maintains memory using **Session History Injection**:

1. **Session Identification**: The frontend generates a unique, persistent UUID-like token (`session_id`) and stores it in the browser's local storage. This ensures the session persists across tab updates or page refreshes.
2. **In-Memory Store**: The backend (FastAPI) maintains a global dictionary structure:
   ```python
   sessions_memory = {
       "session_id_1": [
           {"role": "user", "content": "Hi, I'm Alex.", "timestamp": "04:30 PM"},
           {"role": "model", "content": "Nice to meet you, Alex!", "timestamp": "04:30 PM"}
       ]
   }
   ```
3. **Context Accumulation**: When the user enters a new message:
   - The backend appends it to the matching session history.
   - The backend fetches the **entire** accumulated list of messages.
   - The list is formatted into Gemini SDK-compatible `Content` structures.
   - The complete log is sent to the Gemini API via the `google-genai` SDK.
4. **Contextual Generation**: Because the Gemini LLM receives the full history of the conversation, it understands the context of previous questions and answers (e.g., "What was my name?").
5. **State Resetting**: Clicking the **Clear Memory** button sends a deletion request (`DELETE /api/chat/{session_id}`) which removes the session's entry from the server's dictionary, completely resetting the AI's memory.

---

## 🛠️ Setup & Installation Instructions

### Prerequisites
- Python 3.10 or higher
- A Google Gemini API Key. You can get one for free at [Google AI Studio](https://aistudio.google.com/).

### Step 1: Clone or Open the Workspace
Ensure you are in the project folder containing the source files:
```bash
cd DECODE1
```

### Step 2: Set Up a Python Virtual Environment (Recommended)
Create and activate a virtual environment to manage dependencies cleanly:
```bash
# Windows
python -m venv venv
venv\Scripts\activate

# macOS / Linux
python3 -m venv venv
source venv/bin/activate
```

### Step 3: Install Dependencies
Install all required Python packages:
```bash
pip install -r requirements.txt
```

### Step 4: Configure the Environment Variables
1. Copy the `.env.example` file to `.env`:
   ```bash
   cp .env.example .env
   ```
2. Open `.env` and fill in your Gemini API key:
   ```env
   GEMINI_API_KEY=AIzaSyYourActualKeyHere
   PORT=8000
   HOST=127.0.0.1
   ```

---

## 🚀 Running the Application

Start the FastAPI backend server by running:
```bash
python main.py
```
This launches the server with hot-reloads enabled. You will see output similar to:
```text
INFO:     Uvicorn running on http://127.0.0.1:8000 (Press CTRL+C to quit)
INFO:     Started reloader process [...]
INFO:     Started server process [...]
```

### Accessing the Chatbot
Open your web browser and navigate to:
**[http://127.0.0.1:8000](http://127.0.0.1:8000)**

---

## 📁 File Structure

```text
DECODE1/
│
├── static/                 # Frontend Static Directory
│   ├── index.html          # Chat interface structure & layouts
│   ├── style.css           # Premium dark-theme glassmorphism CSS
│   └── app.js              # Frontend interactive logic & API calls
│
├── .env                    # Local environment secrets (ignored by Git)
├── .env.example            # Environment variables template
├── main.py                 # FastAPI backend, Memory store & SDK integration
├── requirements.txt        # Backend python dependencies
└── README.md               # Project documentation
```

---

## 🚀 Future Improvements

To scale this project to production-grade levels, the following features can be added:
1. **Persistent Session Storage**: Transition from in-memory dictionary-based storage (which clears when the backend server restarts) to a persistent cache like Redis, MongoDB, or PostgreSQL.
2. **Conversation Summarization**: For extremely long sessions, compress or summarize early messages to stay within the model's token limits and minimize API costs.
3. **User Authentication**: Implement a secure login mechanism (JWT authentication) to separate conversations between different users instead of relying on local storage IDs alone.
4. **Export History**: Allow users to download their conversation logs as markdown, PDF, or JSON files.
5. **Streaming Responses**: Enable streaming tokens (SSE - Server Sent Events) so the user sees the AI typing in real-time, letter by letter.
