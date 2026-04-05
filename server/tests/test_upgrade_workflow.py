"""
Tests for SimpleDocumentUpgradeWorkflow's pure parsing and reconstruction methods.
These tests cover the document structure parsing and AI response parsing logic
without making any AI API calls.
"""
import pytest
from unittest.mock import MagicMock

from app.internal.simple_upgrade_workflow import SimpleDocumentUpgradeWorkflow


SAMPLE_DOCUMENT = (
    "Patent summary:\n"
    "This patent describes a test device.\n"
    "\nClaims:\n"
    "1. A device comprising a first component.\n"
    "2. The device of claim 1, wherein the first component is made of metal.\n"
    "3. The device of claim 1, further comprising a second component.\n"
)


@pytest.fixture
def workflow():
    ai_mock = MagicMock()
    return SimpleDocumentUpgradeWorkflow(ai=ai_mock)


class TestExtractSummaryAndClaims:
    def test_extracts_summary_correctly(self, workflow):
        summary, _ = workflow._extract_summary_and_claims(SAMPLE_DOCUMENT)
        assert "test device" in summary

    def test_extracts_correct_number_of_claims(self, workflow):
        _, claims = workflow._extract_summary_and_claims(SAMPLE_DOCUMENT)
        assert len(claims) == 3

    def test_claims_contain_numbered_prefixes(self, workflow):
        _, claims = workflow._extract_summary_and_claims(SAMPLE_DOCUMENT)
        assert claims[0].startswith("1.")
        assert claims[1].startswith("2.")
        assert claims[2].startswith("3.")

    def test_raises_if_missing_summary_header(self, workflow):
        doc = "\nClaims:\n1. A device.\n"
        with pytest.raises(ValueError, match="summary header"):
            workflow._extract_summary_and_claims(doc)

    def test_raises_if_missing_claims_header(self, workflow):
        doc = "Patent summary:\nSome summary text.\n"
        with pytest.raises(ValueError, match="claims header"):
            workflow._extract_summary_and_claims(doc)


class TestCreateDocumentFromPieces:
    def test_output_contains_all_claim_paragraphs(self, workflow):
        # _create_document_from_pieces produces HTML for the editor, not for re-parsing.
        # Verify the output contains one <p> tag per claim.
        summary, claims = workflow._extract_summary_and_claims(SAMPLE_DOCUMENT)
        html_doc = workflow._create_document_from_pieces(summary, claims)
        import re
        paragraph_tags = re.findall(r"<p>\d+\.", html_doc)
        assert len(paragraph_tags) == len(claims)

    def test_output_contains_claim_text(self, workflow):
        summary, claims = workflow._extract_summary_and_claims(SAMPLE_DOCUMENT)
        html_doc = workflow._create_document_from_pieces(summary, claims)
        assert "first component" in html_doc

    def test_output_is_valid_html(self, workflow):
        html_doc = workflow._create_document_from_pieces("A test patent.", ["1. A device."])
        assert "<body>" in html_doc
        assert "</body>" in html_doc


class TestParseAiResponse:
    def test_extracts_valid_suggestions(self, workflow):
        response = """{
            "issues": [
                {
                    "type": "antecedent_basis",
                    "severity": "high",
                    "paragraph": 1,
                    "description": "Missing antecedent basis",
                    "suggestion": "Change 'the component' to 'a component'"
                }
            ]
        }"""
        suggestions = workflow._parse_ai_response(response)
        assert len(suggestions) == 1
        assert suggestions[0].type == "antecedent_basis"
        assert suggestions[0].severity == "high"
        assert suggestions[0].paragraph == 1

    def test_handles_malformed_json_gracefully(self, workflow):
        # Truncated JSON (simulates a streaming boundary issue)
        response = '{"issues": [{"type": "structure", "severity": "low", "paragraph"'
        suggestions = workflow._parse_ai_response(response)
        assert isinstance(suggestions, list)

    def test_returns_empty_list_on_no_issues_key(self, workflow):
        response = '{"result": "ok", "data": []}'
        suggestions = workflow._parse_ai_response(response)
        assert suggestions == []

    def test_returns_empty_list_on_empty_string(self, workflow):
        suggestions = workflow._parse_ai_response("")
        assert suggestions == []

    def test_extracts_multiple_suggestions(self, workflow):
        response = """{
            "issues": [
                {
                    "type": "punctuation",
                    "severity": "low",
                    "paragraph": 2,
                    "description": "Missing period",
                    "suggestion": "Add period at end"
                },
                {
                    "type": "ambiguity",
                    "severity": "medium",
                    "paragraph": 3,
                    "description": "Vague term",
                    "suggestion": "Replace 'approximately' with a specific value"
                }
            ]
        }"""
        suggestions = workflow._parse_ai_response(response)
        assert len(suggestions) == 2
        assert suggestions[0].severity == "low"
        assert suggestions[1].severity == "medium"
