from __future__ import annotations

import os
from typing import AsyncGenerator

from dotenv import load_dotenv
from openai import AsyncOpenAI

from app.internal.prompt import PROMPT

load_dotenv()

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
OPENAI_MODEL = os.getenv("OPENAI_MODEL") or "gpt-4o-mini"


def get_ai(
    model: str | None = OPENAI_MODEL,
    api_key: str | None = OPENAI_API_KEY,
) -> AI:
    if not api_key or not model:
        raise ValueError("Both API key and model need to be set")
    return AI(api_key, model)


class AI:
    def __init__(self, api_key: str, model: str):
        self.model = model
        self._client = AsyncOpenAI(api_key=api_key)

    async def review_document(self, document: str) -> AsyncGenerator[str | None, None]:
        """
        Review a patent document and stream structured JSON suggestions.

        Arguments:
            document: Plain text patent document. Must have HTML stripped before
                      calling (see utils.strip_html). Passing HTML wastes tokens
                      and degrades suggestion quality.

        Yields:
            String chunks of a JSON object in the format:
            {
                "issues": [
                    {
                        "type": <error_type>,
                        "severity": <"high"|"medium"|"low">,
                        "paragraph": <paragraph_number>,
                        "description": <description_of_error>,
                        "suggestion": <suggested_correction>
                    },
                    ...
                ]
            }

        Design notes:
            - `response_format={"type": "json_object"}` guarantees valid JSON from
              the model, but streaming means the client receives JSON fragments.
              The client (AppContext.tsx::parseStreamingJSON) implements a
              multi-strategy fallback parser to handle partial corruption.
            - The model streams chunks until the caller signals completion with the
              sentinel string "--- Done sending suggestions ---" appended server-side.
        """
        stream = await self._client.chat.completions.create(
            model=self.model,
            response_format={"type": "json_object"},
            messages=[
                {"role": "system", "content": PROMPT},
                {"role": "user", "content": document},
            ],
            stream=True,
        )

        async for chunk in stream:
            yield chunk.choices[0].delta.content
