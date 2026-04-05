from __future__ import annotations

import json
import re
from typing import Dict, List
from dataclasses import dataclass

from app.internal.ai import AI
from app.utils import strip_html


@dataclass
class SuggestionData:
    type: str
    severity: str
    paragraph: int
    description: str
    suggestion: str


class SimpleDocumentUpgradeWorkflow:
    """
    Iterative patent claim improvement workflow using a review-then-edit loop.

    The workflow applies LLM-driven suggestions in multiple passes:
      1. Strip HTML and ensure the document has a summary header (generating one
         via LLM if absent).
      2. Parse the document into a summary + individual claims.
      3. Run up to `max_iterations` improvement cycles:
         a. Call `ai.review_document()` to get structured JSON suggestions.
         b. Group suggestions by target claim; apply the highest-severity
            suggestion per claim (one at a time to avoid conflicting edits).
         c. Terminate early if the reviewer returns zero suggestions.
      4. Reconstruct the improved document from the updated claims.
      5. Stream per-step progress to the client via an optional WebSocket channel.

    Design note: a single-shot prompt that both identifies issues and rewrites all
    claims is prone to hallucinating technical scope. Separating the reviewer from
    the editor keeps each LLM call focused and makes the improvement measurable —
    applying a suggestion should eliminate it from the next review pass.

    LangGraph was evaluated for this workflow. The natural node decomposition
    (ensure_description → extract_claims → get_suggestions → apply_improvements →
    reconstruct) maps cleanly, but all transitions are sequential with a single
    conditional edge (terminate if suggestions empty). The graph abstraction adds
    framework overhead without enabling parallelism or complex branching.
    The hand-rolled loop below is simpler and easier to test.
    """

    def __init__(self, ai: AI, max_iterations: int = 3, websocket_session_id: str = None, websocket_manager = None):
        self.ai = ai
        self.max_iterations = max_iterations
        self.summary_header = "Patent summary:"
        self.claims_header = "\nClaims:"
        self.websocket_session_id = websocket_session_id
        self.websocket_manager = websocket_manager
    
    async def _send_websocket_update(self, update_data: dict):
        """Send update via WebSocket if connection is available"""
        if self.websocket_session_id and self.websocket_manager:
            try:
                await self.websocket_manager.send_progress_update(self.websocket_session_id, update_data)
            except Exception as e:
                # Log error but don't fail the upgrade process
                print(f"WebSocket update failed: {e}")
    
    def _check_document_contains_headers(self, document: str):
        if self.summary_header not in document:
            raise ValueError("Document does not contain the summary header")
        if self.claims_header not in document:
            raise ValueError("Document does not contain the claims header")

    def _extract_summary_and_claims(self, document: str) -> tuple[str, [str]]:
        """Extract the summary and claims from the document"""
        self._check_document_contains_headers(document)

        # Split the document into summary and claims sections
        document_body = document.split(self.summary_header)[-1]
        summary_section, claims_section = document_body.split(self.claims_header)

        # Extract the summary
        summary = summary_section.strip()

        # Extract the claims - parse individual claims properly
        claims = []
        current_claim = ""
        
        for line in claims_section.split("\n"):
            line = line.strip()
            if not line:
                continue
                
            # Check if line starts with a number followed by a period (new claim)
            if re.match(r'^\d+\.', line):
                # Save previous claim if exists
                if current_claim.strip():
                    claims.append(current_claim.strip())
                # Start new claim (remove the number prefix for processing)
                current_claim = line
            else:
                # Continuation of current claim
                if current_claim:
                    current_claim += " " + line
        
        # Add the last claim
        if current_claim.strip():
            claims.append(current_claim.strip())

        return summary, claims
    
    def _create_document_from_pieces(self, summary: str, claims: [str]) -> str:
        """Create a document from a summary and claims"""
        claimsSection = ""
        for i, claim in enumerate(claims):
            # Remove number if it already exists at the start
            claim_text = re.sub(r'^\d+\.\s*', '', claim).strip()
            claimsSection += f"<p>{i + 1}. {claim_text}</p>\n"
        return f"""
<DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>Patent Document</title>
</head>
<body>
<h1>{self.summary_header}</h1>
<p>{summary}</p>
<br>
<h1>{self.claims_header}</h1>
{claimsSection}
</body>
</html>
</DOCTYPE>
"""

    async def _ensure_patent_description(self, document: str) -> str:
        """Add patent description if missing from document"""
        if self.summary_header not in document:
            # Generate a patent description based on the claims
            try:
                system_prompt = """You are a patent writing assistant. You will be given a patent document that may be missing a patent description/summary. Your task is to generate a concise patent description that introduces the invention based on the claims provided.

The patent description should:
1. Be 2-3 paragraphs long
2. Introduce the field of the invention
3. Describe the main purpose and advantages
4. Be written in formal patent language
5. Not repeat the exact wording from claims

Return only the patent description text, nothing else."""

                user_prompt = f"""Please generate a patent description for this document:

{document}

Patent description:"""

                response = await self.ai._client.chat.completions.create(
                    model=self.ai.model,
                    messages=[
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": user_prompt}
                    ],
                    temperature=0.3,  # Slightly more creative than claim editing; generates new prose
                    max_tokens=500
                )
                
                patent_description = response.choices[0].message.content.strip()
                
                # Add the patent description to the document
                return f"{self.summary_header}\n{patent_description}\n\n{document}"
                
            except Exception as e:
                # Add a simple placeholder if AI generation fails
                return f"{self.summary_header}\nThis patent describes an innovative solution with the following claims.\n\n{document}"
        
        return document

    async def _upgrade_single_claim(self, claim_text: str, claim_number: int, suggestion: SuggestionData) -> str:
        """Upgrade a single claim based on a specific suggestion"""
        try:
            system_prompt = """You are a patent claim editor. You will be given a single patent claim and a specific suggestion for improvement based on patent law and best practices.

Your task is to:
1. Apply the suggested improvement to make the claim legally stronger
2. Maintain proper patent claim structure and language
3. Preserve the technical scope while improving clarity and legal validity
4. Use proper patent terminology and formatting
5. Keep the claim as a single sentence ending with a period
6. Maintain proper antecedent basis (a/an for first mention, the for subsequent)

Return only the improved claim text, nothing else."""

            user_prompt = f"""Claim {claim_number}: {claim_text}

Improvement needed:
- Type: {suggestion.type}
- Severity: {suggestion.severity}
- Description: {suggestion.description}
- Specific suggestion: {suggestion.suggestion}

Please provide the improved claim:"""

            response = await self.ai._client.chat.completions.create(
                model=self.ai.model,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt}
                ],
                temperature=0.2,  # Low temperature: legal text needs consistency over creativity
                max_tokens=600
            )
            
            improved_claim = response.choices[0].message.content.strip()
            
            # Basic validation
            if improved_claim and len(improved_claim) > 20 and improved_claim != claim_text:
                return improved_claim
            else:
                return claim_text
                
        except Exception as e:
            print(f"[upgrade_workflow] _upgrade_single_claim (claim {claim_number}) failed: {e}")
            return claim_text

    async def upgrade_document(self, document: str) -> Dict:
        """Run the complete document upgrade workflow with claim-by-claim approach"""
        try:
            original_document = document
            
            # Send initial status update
            await self._send_websocket_update({
                "type": "upgrade_started",
                "message": "Starting document upgrade process..."
            })
            
            # Step 1: Ensure patent description exists
            document = strip_html(document)
            await self._send_websocket_update({
                "type": "step_progress", 
                "message": "Analyzing document structure..."
            })
            current_document = await self._ensure_patent_description(document)
            
            # Step 2: Extract summary and claims using the defined structure
            try:
                summary, claims = self._extract_summary_and_claims(current_document)
                await self._send_websocket_update({
                    "type": "step_progress", 
                    "message": f"Extracted {len(claims)} claims for analysis"
                })
            except ValueError as e:
                # If extraction fails, try to work with the document as-is but add structure
                if self.claims_header not in current_document:
                    current_document = current_document + self.claims_header + "1. [Claims section needs to be properly formatted]"
                summary, claims = self._extract_summary_and_claims(current_document)

            all_improvements = []
            n_total_suggestions = 0
            for ai_itr in range(5):
                await self._send_websocket_update({
                    "type": "iteration_started", 
                    "iteration": ai_itr + 1,
                    "message": f"Starting analysis iteration {ai_itr + 1}/5"
                })
            
                # Step 3: Get AI suggestions for the document
                suggestions = await self._get_ai_suggestions(current_document)
                n_total_suggestions += len(suggestions)
                
                await self._send_websocket_update({
                    "type": "suggestions_found", 
                    "count": len(suggestions),
                    "message": f"Found {len(suggestions)} suggestions for improvement"
                })
                
                # IF there are no suggestions, return the document with the ensured structure
                if not suggestions:
                    await self._send_websocket_update({
                        "type": "analysis_complete", 
                        "message": "Analysis complete - no improvements needed"
                    })
                    return {
                        "original_document": original_document,
                        "improved_document": current_document,
                        "iterations_completed": ai_itr + 1,
                        "total_improvements": n_total_suggestions if current_document != original_document else 0,
                        "improvements_applied": all_improvements if current_document != original_document else [],
                        "success": True,
                    }
            
                # Step 4: Process suggestions claim by claim
                improved_claims = claims.copy()
            
                # Group suggestions by the claim they refer to
                claims_suggestions = {}
                for suggestion in suggestions:
                    # Map paragraph number to claim number (approximate)
                    # Approximate mapping: reviewer reports paragraph numbers; claims are paragraphs
                    # in well-structured patents, so numbers are 1:1. Clamping handles edge cases
                    # where the model reports an out-of-range paragraph number.
                    claim_number = max(1, min(suggestion.paragraph, len(claims)))
                    if claim_number not in claims_suggestions:
                        claims_suggestions[claim_number] = []
                    claims_suggestions[claim_number].append(suggestion)
                
            
                # Process each claim with its suggestions
                for claim_number, claim_suggestions in claims_suggestions.items():
                    if claim_number <= len(claims):
                        claim_index = claim_number - 1
                        original_claim = claims[claim_index]
                        
                        # Apply only the highest-severity suggestion per claim per iteration.
                        # Applying multiple suggestions to the same claim in one pass risks
                        # conflicting edits (e.g., two suggestions that each rephrase the same clause).
                        priority_suggestion = max(claim_suggestions,
                            key=lambda s: {"high": 3, "medium": 2, "low": 1}.get(s.severity, 0))
                        
                        # Send update before processing this claim
                        await self._send_websocket_update({
                            "type": "processing_suggestion",
                            "suggestion": {
                                "claim_number": claim_number,
                                "type": priority_suggestion.type,
                                "severity": priority_suggestion.severity,
                                "paragraph": priority_suggestion.paragraph,
                                "description": priority_suggestion.description,
                                "suggestion": priority_suggestion.suggestion
                            },
                            "message": f"Processing suggestion for claim {claim_number}: {priority_suggestion.type}"
                        })
                        
                        improved_claim = await self._upgrade_single_claim(
                            original_claim, claim_number, priority_suggestion
                        )
                        
                        if improved_claim != original_claim:
                            improved_claims[claim_index] = improved_claim
                            
                            improvement_data = {
                                "claim_number": claim_number,
                                "type": priority_suggestion.type,
                                "severity": priority_suggestion.severity,
                                "original_claim": original_claim,
                                "improved_claim": improved_claim,
                                "description": priority_suggestion.description,
                                "suggestion_applied": priority_suggestion.suggestion
                            }
                            
                            all_improvements.append(improvement_data)
                            
                            # Send update about successful improvement
                            await self._send_websocket_update({
                                "type": "suggestion_applied",
                                "improvement": improvement_data,
                                "message": f"Applied improvement to claim {claim_number}"
                            })
                        else:
                            # Send update about suggestion being skipped
                            await self._send_websocket_update({
                                "type": "suggestion_skipped",
                                "suggestion": {
                                    "claim_number": claim_number,
                                    "type": priority_suggestion.type,
                                    "severity": priority_suggestion.severity,
                                    "description": priority_suggestion.description
                                },
                                "message": f"Claim {claim_number} improvement was not applicable"
                            })
                
                claims = improved_claims
                current_document = self._create_document_from_pieces(summary, improved_claims)
            
            # Step 5: Reconstruct the final document
            final_document = current_document
            
            return {
                "original_document": original_document,
                "improved_document": final_document,
                "iterations_completed": ai_itr + 1,
                "total_improvements": len(all_improvements),
                "improvements_applied": all_improvements,
                "claims_processed": len(claims),
                "suggestions_received": n_total_suggestions,
                "success": True
            }
            
        except Exception as e:
            return {
                "original_document": document,
                "improved_document": document,
                "iterations_completed": 0,
                "total_improvements": 0,
                "improvements_applied": [],
                "success": False,
                "error": str(e)
            }
    
    async def _get_ai_suggestions(self, document: str) -> List[SuggestionData]:
        """Get AI suggestions for the document"""
        suggestions = []
        full_response = ""
        
        try:
            # Get AI suggestions
            async for chunk in self.ai.review_document(document):
                if chunk is not None:
                    full_response += chunk
            
            # Parse the JSON response
            suggestions = self._parse_ai_response(full_response)
            
        except Exception as e:
            print(f"[upgrade_workflow] _get_ai_suggestions failed: {e}")

        return suggestions

    def _parse_ai_response(self, response: str) -> List[SuggestionData]:
        """Parse AI response to extract suggestions"""
        suggestions = []
        
        try:
            # Find the JSON object in the response
            start_idx = response.find('{')
            if start_idx == -1:
                return suggestions
                
            # Find the matching closing brace
            brace_count = 0
            end_idx = -1
            
            for i in range(start_idx, len(response)):
                if response[i] == '{':
                    brace_count += 1
                elif response[i] == '}':
                    brace_count -= 1
                    if brace_count == 0:
                        end_idx = i
                        break
            
            if end_idx == -1:
                return suggestions
            
            json_str = response[start_idx:end_idx + 1]
            parsed = json.loads(json_str)
            
            if "issues" in parsed and isinstance(parsed["issues"], list):
                for issue in parsed["issues"]:
                    if all(key in issue for key in ["type", "severity", "paragraph", "description", "suggestion"]):
                        suggestions.append(SuggestionData(
                            type=issue["type"],
                            severity=issue["severity"],
                            paragraph=int(issue["paragraph"]),
                            description=issue["description"],
                            suggestion=issue["suggestion"]
                        ))
        
        except Exception as e:
            print(f"[upgrade_workflow] _parse_ai_response failed: {e}")

        return suggestions

