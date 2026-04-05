import re
import html

def strip_html(raw_html: str) -> str:
    """
    Remove HTML tags and decode common HTML entities from a raw string.
    Uses regex for tag removal and html.unescape for entities.
    """
    if raw_html is None:
        return ""

    # 1) Remove script and style content
    raw_html = re.sub(r'(?is)<(script|style).*?>.*?</\1>', '', raw_html)

    # 2) Remove all HTML tags
    # Replace <p> with \n\n
    raw_html = re.sub(r'(?s)<p>', '###PARAGRAPH_BREAK###', raw_html)
    raw_html = re.sub(r'(?s)<h1>', '###PARAGRAPH_BREAK###', raw_html)
    raw_html = re.sub(r'(?s)<h2>', '###PARAGRAPH_BREAK###', raw_html)
    raw_html = re.sub(r'(?s)<h3>', '###PARAGRAPH_BREAK###', raw_html)
    raw_html = re.sub(r'(?s)<h4>', '###PARAGRAPH_BREAK###', raw_html)
    raw_html = re.sub(r'(?s)<h5>', '###PARAGRAPH_BREAK###', raw_html)
    raw_html = re.sub(r'(?s)<h6>', '###PARAGRAPH_BREAK###', raw_html)
    raw_html = re.sub(r'(?s)<.*?>', '', raw_html)

    # 3) Decode HTML entities (e.g., &amp; -> &, &nbsp; -> non-breaking space)
    raw_html = html.unescape(raw_html)

    # 4) Replace non-breaking spaces with normal spaces
    raw_html = raw_html.replace('\xa0', ' ')

    # 5) Collapse whitespace
    raw_html = re.sub(r'\s+', ' ', raw_html).strip()

    # 6) Replace <p> with \n\n
    raw_html = raw_html.replace('###PARAGRAPH_BREAK###', '\n\n')

    return raw_html