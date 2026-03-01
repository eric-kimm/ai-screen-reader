from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import requests
import os
from dotenv import load_dotenv
from elevenlabs.client import ElevenLabs
from elevenlabs.play import play
from . import voice
import json

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
MODEL = "llava-hf/llava-1.5-13b-hf"

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
        "temperature": 0.2
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
    prompt = f"""You are a voice assistant describing a webpage to a blind user.
    Speak naturally like a friend describing what's on screen out loud.

    Good example:
    "You're on a personal portfolio page for Aarav Mehta. There's an article called The Quiet Revolution of Everyday Innovation that you can open and read, or browse all articles. You can also check out the owner's Github and LinkedIn. What would you like to do?"

    Bad example (never do this):
    "You can click on the Continue Reading button. If you want to view all articles you can click View All."

    Rules — read these carefully:
    - 2-3 sentences maximum, no more
    - Never say click, button, link, option, tab, menu, or any UI term
    - Never say "if you want" — just say what they can do directly
    - Never repeat the same action twice in different words
    - Use "open", "read", "go to", "explore", "check out"
    - End with one short natural question like "What would you like to do?"

    Page content:
    {body.html[:4000]}"""

    description = call_llm(prompt)
    print("Description", description)
    # audio = voice.text_to_speech(description)
    # play(audio)
    return {"description": description}


# main endpoint to handle user commands
@app.post("/command")
async def handle_command(body: CommandRequest):
    prompt = f"""You are an accessibility browser agent for a blind user.

    Decide whether the user's request is a QUESTION or a COMMAND.

    Definitions:
    - QUESTION: the user wants information, explanation, summary, status, or location from the current page.
    - COMMAND: the user wants the browser to do something on the current page, such as click, type, submit, open, check, choose, expand, scroll, focus, or navigate.

    Decision rules:
    - If the request asks for information about the page, classify it as "question".
    - If the request asks to perform an action on the page, classify it as "command".
    - If the request mixes both, choose the user's primary intent.
    - If intent is ambiguous, default to "question".
    - Use the supplied HTML as the only source of truth.
    - Do not invent elements, links, labels, or page state that are not supported by the HTML.

    Output requirements:
    - Return valid JSON only.
    - Do not wrap the JSON in markdown fences.
    - Every response must match exactly one of the schemas below.

    If the intent is "question", return:
    {{
    "intent": "question",
    "answer": "A concise natural-language answer grounded only in the page HTML. If the HTML does not contain enough information, say that clearly.",
    "script": "",
    "confirmation": ""
    }}

    If the intent is "command", return:
    {{
    "intent": "command",
    "answer": "",
    "script": "Plain JavaScript only. Generate a self-contained script that can run in the page context and execute the requested action using the HTML as guidance.",
    "confirmation": "A short confirmation statement the assistant can speak after running the script, such as 'Opened the sign in menu.'"
    }}

    Script rules for commands:
    - Output plain executable JavaScript only inside the "script" field.
    - Prefer robust element targeting by visible text, aria-label, name, id, placeholder, associated label text, role, or href.
    - If multiple reasonable matches exist, pick the best supported by the HTML.
    - Use standard DOM APIs only.
    - The script should perform the action directly when possible.
    - If typing into a field, set the value and dispatch input/change events.
    - If clicking a control, ensure the chosen element is interactable and then click it.
    - If scrolling or focusing is needed before interaction, include that.
    - If the command cannot be completed from the HTML with reasonable confidence, set "script" to an empty string and set "confirmation" to a short statement explaining that the action could not be completed confidently.
    - Do not include explanations outside the JSON.

    User request:
    "{body.transcript}"

    Page HTML:
    {body.html[:3000]}"""
   
    json_result = call_llm(prompt)

    try:
        parsed = json.loads(json_result)
    except json.JSONDecodeError:
        raise HTTPException(status_code=500, detail="Model returned invalid JSON")

    intent = parsed.get("intent")
    if intent not in {"command", "question"}:
        raise HTTPException(status_code=500, detail="Model returned invalid intent")

    result = {
        "intent": intent,
        "answer": parsed.get("answer", ""),
        "script": parsed.get("script", ""),
        "confirmation": parsed.get("confirmation", ""),
    }

    if result["intent"] == "command" and result["confirmation"]:
        audio = voice.text_to_speech(result["confirmation"])
        play(audio)
    elif result["intent"] == "question" and result["answer"]:
        audio = voice.text_to_speech(result["answer"])
        play(audio)

    return result

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
