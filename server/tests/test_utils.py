from app.utils import strip_html


def test_strip_html_removes_tags():
    result = strip_html("<b>Hello world</b>")
    assert result == "Hello world"


def test_strip_html_preserves_paragraph_breaks():
    result = strip_html("<p>First</p><p>Second</p>")
    assert "First" in result
    assert "Second" in result
    assert "\n\n" in result


def test_strip_html_decodes_html_entities():
    result = strip_html("&amp; &lt; &gt; &quot;")
    assert "&" in result
    assert "<" in result
    assert ">" in result
    assert '"' in result


def test_strip_html_handles_empty_string():
    assert strip_html("") == ""


def test_strip_html_handles_none():
    assert strip_html(None) == ""


def test_strip_html_removes_script_content():
    result = strip_html("<script>alert('xss')</script>Safe text")
    assert "alert" not in result
    assert "Safe text" in result


def test_strip_html_removes_style_content():
    result = strip_html("<style>.foo { color: red }</style>Visible text")
    assert "color" not in result
    assert "Visible text" in result


def test_strip_html_collapses_whitespace():
    result = strip_html("<p>   lots   of   spaces   </p>")
    assert "  " not in result
    assert "lots" in result
