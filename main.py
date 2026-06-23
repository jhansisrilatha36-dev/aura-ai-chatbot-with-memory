import os
import uuid
from datetime import datetime
from typing import Dict, List, Optional
from fastapi import FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

# Initialize FastAPI application
app = FastAPI(
    title="Custom AI Chatbot with Memory",
    description="A FastAPI backend integrated with Google Gemini to maintain session-based conversation history.",
    version="1.0.0"
)

# Enable CORS for all origins (useful during local development)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# In-memory dictionary to store session-based conversation history
# Structure: { session_id: [{"role": "user"|"model", "content": str, "timestamp": str}] }
sessions_memory: Dict[str, List[dict]] = {}

# Pydantic schemas for request validation
class ChatRequest(BaseModel):
    session_id: Optional[str] = Field(default=None, description="Unique session ID. If not provided, a new one will be generated.")
    message: str = Field(..., min_length=1, description="The user message to send to the chatbot.")
    model: Optional[str] = Field(default="gemini-2.5-flash", description="The Gemini model to use.")

class ChatResponse(BaseModel):
    session_id: str
    response: str
    history: List[dict]
    model_used: str

class StatusResponse(BaseModel):
    gemini_api_key_configured: bool
    active_sessions_count: int
    available_models: List[str]

# API Endpoints
@app.get("/api/status", response_model=StatusResponse)
async def get_status():
    """
    Check backend status, check if Gemini API key is configured, and return session counts and available models.
    """
    api_key = os.getenv("GEMINI_API_KEY")
    is_configured = bool(api_key and not api_key.startswith("your_gemini_api_key"))
    
    # Pre-defined list of supported models in the UI
    available_models = [
        "gemini-2.5-flash",
        "gemini-2.5-pro",
        "gemini-1.5-flash",
        "gemini-1.5-pro"
    ]
    
    return StatusResponse(
        gemini_api_key_configured=is_configured,
        active_sessions_count=len(sessions_memory),
        available_models=available_models
    )

def generate_mock_response(history: List[dict]) -> str:
    """
    Generates a simulated LLM response that parses the conversation history
    to demonstrate active session memory when no Gemini API key is configured.
    """
    # Find all user messages
    user_messages = [m for m in history if m["role"] == "user"]
    last_user_msg = user_messages[-1]["content"] if user_messages else ""
    
    # Simple extraction of facts to "remember"
    remembers = {}
    for m in user_messages:
        text = m["content"].lower()
        if "my name is " in text:
            parts = m["content"].split("my name is ")
            if len(parts) > 1:
                name = parts[1].strip().split()[0].rstrip('.,!?;').title()
                remembers["name"] = name
        if "favorite color is " in text:
            parts = m["content"].split("favorite color is ")
            if len(parts) > 1:
                color = parts[1].strip().split()[0].rstrip('.,!?;')
                remembers["color"] = color
        if "favorite food is " in text:
            parts = m["content"].split("favorite food is ")
            if len(parts) > 1:
                food = parts[1].strip().split()[0].rstrip('.,!?;')
                remembers["food"] = food

    text_lower = last_user_msg.lower()
    
    # Custom query handlers showing memory recall
    if "what is my name" in text_lower or "who am i" in text_lower:
        if "name" in remembers:
            return f"Your name is **{remembers['name']}**! I remember you telling me that earlier in this session."
        else:
            return "I don't know your name yet! Try telling me: *'My name is Alex'*."
            
    if "what is my favorite color" in text_lower:
        if "color" in remembers:
            return f"Your favorite color is **{remembers['color']}**! I retrieved this from our current conversation log."
        else:
            return "I don't know your favorite color yet! Try telling me: *'My favorite color is violet'*."

    if "what is my favorite food" in text_lower:
        if "food" in remembers:
            return f"Your favorite food is **{remembers['food']}**! (Stored in active session history)."
        else:
            return "I don't know your favorite food yet! Try telling me: *'My favorite food is sushi'*."
            
    if "hello" in text_lower or "hi" in text_lower or "hey" in text_lower:
        greeting = f"Hello **{remembers['name']}**" if "name" in remembers else "Hello there"
        return f"{greeting}! Welcome to the chatbot. Since you haven't set up the `GEMINI_API_KEY` in the `.env` file, I am running in **Mock Memory Mode**. I will simulate an LLM and show you how session memory works!"
        
    # Default echo response that lists current memory items
    history_summary = []
    for m in history[:-1]:
        role_label = "👤 User" if m["role"] == "user" else "🤖 AI"
        history_summary.append(f"{role_label}: {m['content']}")
        
    history_str = "\n".join(history_summary)
    
    response = f"I received your message: *\"{last_user_msg}\"*\n\n"
    response += "**[Mock Memory Mode Active]**\n"
    response += "I can read the entire session memory array. Here is what is stored in the memory array right now:\n\n"
    
    if history_summary:
        response += f"```markdown\n{history_str}\n```\n\n"
    else:
        response += "*(No previous messages in memory)*\n\n"
        
    if remembers:
        response += "State items extracted from history:\n"
        for k, v in remembers.items():
            response += f"- **{k.capitalize()}**: {v}\n"
        response += "\n"
        
    response += "💡 To connect a real Gemini AI instance, configure your `GEMINI_API_KEY` inside the `.env` file and restart the server."
    return response


@app.post("/api/chat", response_model=ChatResponse)
async def chat(request: ChatRequest):
    """
    Send a message to the chatbot. Maintains conversation history in memory for the active session.
    """
    api_key = os.getenv("GEMINI_API_KEY")
    
    # Use existing session_id or generate a new one
    session_id = request.session_id or str(uuid.uuid4())
    
    # Initialize history for session if not already present
    if session_id not in sessions_memory:
        sessions_memory[session_id] = []
        
    session_history = sessions_memory[session_id]
    
    # Get current timestamp
    timestamp = datetime.now().strftime("%I:%M %p")
    
    # Append the new user message to the conversation history
    new_user_message = {
        "role": "user",
        "content": request.message,
        "timestamp": timestamp
    }
    session_history.append(new_user_message)
    
    # Check if Gemini API key is configured
    is_key_missing = not api_key or api_key.startswith("your_gemini_api_key") or api_key.strip() == ""
    
    if is_key_missing:
        # Fallback to Mock LLM Mode to allow immediate testing without an API key
        ai_response_text = generate_mock_response(session_history)
        ai_timestamp = datetime.now().strftime("%I:%M %p")
        new_ai_message = {
            "role": "model",
            "content": ai_response_text,
            "timestamp": ai_timestamp
        }
        session_history.append(new_ai_message)
        
        return ChatResponse(
            session_id=session_id,
            response=ai_response_text,
            history=session_history,
            model_used="mock-model"
        )
    
    # Call Gemini API using the official google-genai SDK
    try:
        # Import the official google-genai library
        from google import genai
        from google.genai import types
        
        # Initialize Gemini Client
        client = genai.Client(api_key=api_key)
        
        # Format session history into the SDK content structure
        contents = []
        for msg in session_history:
            contents.append(
                types.Content(
                    role=msg["role"],
                    parts=[types.Part.from_text(text=msg["content"])]
                )
            )
            
        # Call the Gemini model
        # The contents list represents the full dialogue history
        response = client.models.generate_content(
            model=request.model,
            contents=contents
        )
        
        # Validate response content
        if not response or not response.text:
            raise ValueError("Empty response received from the Gemini API.")
            
        ai_response_text = response.text
        
        # Append AI response to the history
        ai_timestamp = datetime.now().strftime("%I:%M %p")
        new_ai_message = {
            "role": "model",
            "content": ai_response_text,
            "timestamp": ai_timestamp
        }
        session_history.append(new_ai_message)
        
        return ChatResponse(
            session_id=session_id,
            response=ai_response_text,
            history=session_history,
            model_used=request.model
        )
        
    except ImportError:
        # Fallback error if SDK is not installed or import fails
        if session_history and session_history[-1] == new_user_message:
            session_history.pop()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Google GenAI SDK is not installed or failed to load. Run pip install -r requirements.txt."
        )
    except Exception as e:
        # Revert the history state by removing the last user message so the user can retry
        if session_history and session_history[-1] == new_user_message:
            session_history.pop()
        
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Gemini API Error: {str(e)}"
        )

@app.delete("/api/chat/{session_id}", status_code=status.HTTP_200_OK)
async def clear_chat(session_id: str):
    """
    Clear conversation memory for a specific session ID.
    """
    if session_id in sessions_memory:
        del sessions_memory[session_id]
        return {"status": "success", "message": f"Session {session_id} history cleared."}
    else:
        return {"status": "ignored", "message": f"Session {session_id} not found or already empty."}

# Serve the static files from the static directory
# This serves index.html at root (/)
try:
    if not os.path.exists("static"):
        os.makedirs("static")
    app.mount("/", StaticFiles(directory="static", html=True), name="static")
except Exception as e:
    print(f"Warning: Could not mount static files folder. Error: {e}")

if __name__ == "__main__":
    import uvicorn
    # Read host and port from environment or fallback to defaults
    host = os.getenv("HOST", "127.0.0.1")
    port = int(os.getenv("PORT", "8000"))
    print(f"Starting server on http://{host}:{port}...")
    uvicorn.run("main:app", host=host, port=port, reload=True)
