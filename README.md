# ai-screen-reader

Our project is an accessibility tool that helps blind users navigate 
websites through voice commands and keyboard navigation. A Chrome 
extension captures the current page HTML and sends it to a FastAPI 
backend, which passes it to a vision LLM running on AMD Dev Cloud. 

## Setup
```
git clone https://github.com/eric-kimm/ai-screen-reader.git
cd ai-screen-reader
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
brew bundle
```

Create `backend/.env`:
```
AMD_VLLM_ENDPOINT=http://165.245.142.81:8000
ELEVENLABS_API_KEY=your_key_here
```

Run the server:
```
uvicorn backend.main:app --reload
```

## LLM Tests

Describe a page:
```
curl -X POST http://127.0.0.1:8000/describe \
  -H "Content-Type: application/json" \
  -d '{"html": "<h1>Welcome</h1><button>Login</button>"}'
```

Read a focused element:
```
curl -X POST http://127.0.0.1:8000/element \
  -H "Content-Type: application/json" \
  -d '{"element": "<input type=email placeholder=Enter your email />"}'
```
