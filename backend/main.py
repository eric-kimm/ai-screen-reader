from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

app = FastAPI()

# for chrome extension to make requests to server
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# data for routes
class DescribeRequest(BaseModel):
    screenshot: str         # base 64 encoded image

class CommandRequest(BaseModel):
    transcript: str         # user command
    html: str               # html of page

class ElementRequest(BaseModel):
    element: str         # html snippet of element

@app.get("/")
def health_check():
    return {"status": "ok"}

# receivees screenshot, sends vision to LLM, returns llms response (page description)
@app.post("/describe")
async def describe_page(body: DescribeRequest):
    # add vLLM call here
    return {"description": "placeholder"}

# receives transcript and html, sends to LLM, returns llms response (command result)
@app.post("/command")
async def handle_command(body: CommandRequest):
    return {"action": "placeholder"}

# recieves html snippet of element, return plain english description of what it is
@app.post("/element")
async def handle_element(body: ElementRequest):
    return {"description": "placeholder"}

