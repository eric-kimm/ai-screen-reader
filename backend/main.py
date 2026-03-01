from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import requests
import os
from dotenv import load_dotenv
from elevenlabs.client import ElevenLabs
from elevenlabs.play import play
from . import voice

load_dotenv()

app = FastAPI()

# allows chrome extension to make requests to this server
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"]
)

# amd vLLM endpoint and model name
AMD_ENDPOINT = os.getenv("AMD_VLLM_ENDPOINT")
MODEL = "llava-hf/llava-1.5-7b-hf"

class DescribeRequest(BaseModel):
    html: str       # full page html from chrome extension

class CommandRequest(BaseModel):
    transcript: str  # what the user said
    html: str        # current page html from extension

class ElementRequest(BaseModel):
    element: str     # html snippet of the focused element


def call_llm(prompt: str):
    # sends a text prompt to vllm on amd and returns the response string
    payload = {
        "model": MODEL,
        "messages": [
            {
                "role": "user",
                "content": prompt
            }
        ],
        "max_tokens": 300,
        "temperature": 0.2  # prompt specificity
    }

    response = requests.post(
        f"{AMD_ENDPOINT}/v1/chat/completions",
        json=payload
    )
    response.raise_for_status()
    return response.json()["choices"][0]["message"]["content"]


@app.get("/")
def health_check():
    return {"status": "ok"}

# main endpoint to describe the page based on its HTML content
@app.post("/describe")
async def describe_page(body: DescribeRequest):
    prompt = f"""You are a helpful assistant describing a webpage to someone who cannot see it.
    Speak naturally and conversationally, like you are talking to a person.
    Do not use bullet points or technical terms.
    The page content uses these markers: # means heading, [BTN] means button, 
    [INPUT] means a text field, [LABEL] means a label for a field.
    Start by saying what kind of page this is, then describe what is on it
    and what the person can do. Keep it under 80 words.

    Page content:
    {body.html[:3000]}"""

    description = call_llm(prompt)
    audio = voice.text_to_speech(description)
    play(audio)
    return {"description": description}


# main endpoint to handle user commands
@app.post("/command")
async def handle_command(body: CommandRequest):
    prompt = f"""You are an accessibility assistant for a blind user interacting with a webpage.

    Your job is to classify the user's request as either:
    - "command": the user wants the system to do something on the page
    - "question": the user is asking for information, explanation, or clarification

    Rules:
    - Treat requests to click, open, type, submit, scroll, navigate, select, or read a specific element as "command".
    - Treat requests asking what, where, why, whether, how, or asking for explanation/summary as "question".
    - If the user is primarily seeking information, classify as "question" even if the wording is conversational.
    - If the request is ambiguous, prefer "question".
    - Use the page HTML as the source of truth.
    - Return ONLY valid JSON.
    - Do not include markdown fences or extra text.

    If intent is "command", return:
    {{
    "intent": "command",
    "action": "click" | "fill" | "navigate" | "read" | "scroll" | "unknown",
    "target": "specific element text, label, id, or url",
    "value": "text to type if action is fill, otherwise empty string",
    "answer": ""
    }}

    If intent is "question", return:
    {{
    "intent": "question",
    "action": "",
    "target": "",
    "value": "",
    "answer": "short natural-language answer grounded in the page"
    }}

    User request:
    "{body.transcript}"

    Page HTML:
    {body.html[:3000]}"""""

    result = call_llm(prompt)

    audio = voice.text_to_speech(result)
    play(audio)
    return {"action": result}


# main endpoint to describe an HTML element
@app.post("/element")
async def describe_element(body: ElementRequest):
    prompt = f"""You are an accessibility assistant for blind users.
    Describe this in one short plain english sentence.
    Tell the user what it is and what they can do with it.
    Do not use technical terms.

    Element: {body.element}"""

    description = call_llm(prompt)
    audio = voice.text_to_speech(description)
    play(audio)

    return {"description": description}
