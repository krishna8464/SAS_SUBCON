import os
from reportlab.lib.pagesizes import letter
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle

IGNORE_DIRS = {'.git', 'node_modules', 'public', '.env', 'logs'}
IGNORE_FILES = {'package-lock.json', 'bundle.py', 'logBook.log', 'access.log'}
VALID_EXTENSIONS = {'.js', '.json', '.ejs', '.css', '.md'}

pdf_filename = "sas_subcon_codebase.pdf"
doc = SimpleDocTemplate(pdf_filename, pagesize=letter, leftMargin=36, rightMargin=36, topMargin=36, bottomMargin=36)
styles = getSampleStyleSheet()

# Create a clean, small monospace layout style for your raw code snippets
code_style = ParagraphStyle(
    'CodeStyle',
    parent=styles['Normal'],
    fontName='Courier',
    fontSize=7,
    leading=9,
    textColor='#0f172a'
)

story = []

for root, dirs, files in os.walk("."):
    dirs[:] = [d for d in dirs if d not in IGNORE_DIRS]
    for file in files:
        if file in IGNORE_FILES:
            continue
        if os.path.splitext(file)[1] in VALID_EXTENSIONS:
            file_path = os.path.join(root, file)
            
            # Append Header Divider Elements
            story.append(Paragraph(f"<b>{'='*40}</b>", styles['Normal']))
            story.append(Paragraph(f"<b>FILE: {file_path}</b>", styles['Normal']))
            story.append(Paragraph(f"<b>{'='*40}</b>", styles['Normal']))
            story.append(Spacer(1, 6))
            
            try:
                with open(file_path, "r", encoding="utf-8") as infile:
                    # Clean brackets and newlines to prevent PDF parsing crashes
                    content = infile.read().replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;').replace('\n', '<br/>')
                    story.append(Paragraph(content, code_style))
            except Exception as e:
                story.append(Paragraph(f"// Error reading file: {str(e)}", code_style))
            
            story.append(Spacer(1, 15))

doc.build(story)
print(f"Success! Genuine PDF file successfully generated: {pdf_filename}")
