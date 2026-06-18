from fastapi import FastAPI
from pydantic import BaseModel
import requests
import json
import os
from reportlab.pdfgen import canvas
from reportlab.lib import colors
from fastapi.responses import FileResponse
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfbase import pdfmetrics
from fastapi.middleware.cors import CORSMiddleware
from reportlab.lib.utils import simpleSplit, ImageReader
from datetime import datetime
from PIL import Image

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

class PromptRequest(BaseModel):
    prompt: str

class PDFRequest(BaseModel):
    aiResponse: str

FONT_NAME = None
FONT_BOLD = None

def init_fonts():
    global FONT_NAME, FONT_BOLD
    if FONT_NAME is not None:
        return
    try:
        pdfmetrics.registerFont(TTFont('PolishFont', 'dejavu-sans.book.ttf'))
        pdfmetrics.registerFont(TTFont('PolishFont-Bold', 'dejavu-sans.bold.ttf'))
        FONT_NAME = 'PolishFont'
        FONT_BOLD = 'PolishFont-Bold'
    except Exception as e:
        print(f"Font registration failed: {e}, falling back to Helvetica")
        FONT_NAME = 'Helvetica'
        FONT_BOLD = 'Helvetica-Bold'

def draw_wrapped(pdf, x, y, text, font, size, max_width, line_height, margin_bottom):
    lines = simpleSplit(text, font, size, max_width)
    if not lines:
        lines = ['']
    for line in lines:
        y = check_page(pdf, y, margin_bottom)
        pdf.setFont(font, size)
        pdf.drawString(x, y, line)
        y -= line_height
    return y

def check_page(pdf, y, margin_bottom):
    if y < margin_bottom:
        pdf.showPage()
        draw_watermark(pdf)
        return 770
    return y

def draw_watermark(pdf):
    try:
        img_path = os.path.join(os.path.dirname(__file__), 'rythmio_logo.png')
        pil_img = Image.open(img_path).convert('RGBA')
        r, g, b, a = pil_img.split()
        a = a.point(lambda x: max(0, int(x * 0.08)))
        r = r.point(lambda x: 99)
        g = g.point(lambda x: 102)
        b = b.point(lambda x: 241)
        pil_img = Image.merge('RGBA', (r, g, b, a))
        
        rl_img = ImageReader(pil_img)
        
        w, h = 595, 842
        iw, ih = 350, 250
        pdf.drawImage(rl_img, (w - iw) / 2, 50, iw, ih, preserveAspectRatio=True, mask='auto')
    except Exception as e:
        print(f"Watermark failed: {e}")

@app.post("/chat")
def chat(body: PromptRequest):
    response = requests.post("http://localhost:11434/api/generate", json={
        "model": "gemma4",
        "prompt": body.prompt,
        "stream": False
    })
    result = response.json()
    return {"response": result["response"]}

@app.post("/generate_pdf")
def generate_pdf(body: PDFRequest):
    init_fonts()
    fileName = 'RaportAI.pdf'
    documentTitle = 'Raport AI'

    pdf = canvas.Canvas(fileName)
    pdf.setTitle(documentTitle)
    draw_watermark(pdf)

    margin_left = 45
    margin_right = 45
    margin_bottom = 50
    page_width = 595
    max_width = page_width - margin_left - margin_right
    body_font_size = 11
    body_lh = body_font_size * 1.45
    small_font_size = 10
    small_lh = small_font_size * 1.35

    y = 770

    data = None
    try:
        data = json.loads(body.aiResponse)
    except (json.JSONDecodeError, TypeError):
        data = None

    if data and isinstance(data, dict):
        # --- Title ---
        y = check_page(pdf, y, margin_bottom)
        pdf.setFont(FONT_BOLD, 26)
        pdf.setFillColor(colors.black)
        pdf.drawCentredString(page_width / 2, y, 'RAPORT EKG')
        y -= 30

        pdf.setFont(FONT_NAME, 10)
        pdf.drawCentredString(page_width / 2, y, f'Wygenerowano: {datetime.now().strftime("%d.%m.%Y %H:%M")}')
        y -= 18

        pdf.setStrokeColor(colors.HexColor('#6366f1'))
        pdf.setLineWidth(2)
        pdf.line(margin_left, y, page_width - margin_right, y)
        y -= 22

        # --- Summary ---
        summary = data.get('summary', '').strip()
        if summary:
            y = check_page(pdf, y, margin_bottom)
            pdf.setFont(FONT_BOLD, 14)
            pdf.drawString(margin_left, y, 'Podsumowanie kliniczne')
            y -= 20
            y = draw_wrapped(pdf, margin_left + 5, y, summary, FONT_NAME, body_font_size, max_width - 10, body_lh, margin_bottom)
            y -= 10

        # --- Findings ---
        findings = data.get('findings', [])
        if findings and isinstance(findings, list):
            y = check_page(pdf, y, margin_bottom)
            pdf.setFont(FONT_BOLD, 14)
            pdf.drawString(margin_left, y, 'Szczegółowe wnioski')
            y -= 22
            for f in findings:
                y = check_page(pdf, y, margin_bottom)
                bullet = f'\u2022  {f}'
                y = draw_wrapped(pdf, margin_left + 10, y, bullet, FONT_NAME, body_font_size, max_width - 20, body_lh, margin_bottom)
                y -= 4

        # --- Recommendation ---
        rec = data.get('recommendation', '').strip()
        if rec:
            y = check_page(pdf, y, margin_bottom)
            y -= 8
            rec_lines = simpleSplit(rec, FONT_NAME, small_font_size, max_width - 20)
            rec_text_height = len(rec_lines) * small_lh + 30
            box_bottom = y - rec_text_height
            if box_bottom < margin_bottom:
                pdf.showPage()
                draw_watermark(pdf)
                y = 770
                box_bottom = y - rec_text_height
            
            pdf.setStrokeColor(colors.HexColor('#818cf8'))
            pdf.setFillColor(colors.HexColor('#f5f3ff'))
            pdf.roundRect(margin_left, box_bottom, max_width, rec_text_height, 6, fill=1, stroke=1)
            
            pdf.setFont(FONT_BOLD, 11)
            pdf.setFillColor(colors.HexColor('#4f46e5'))
            pdf.drawString(margin_left + 10, y + 4, 'Zalecenia')
            
            y = draw_wrapped(pdf, margin_left + 10, y - 24, rec, FONT_NAME, small_font_size, max_width - 20, small_lh, margin_bottom)
            y = box_bottom - 8

        y = check_page(pdf, y, margin_bottom)
        pdf.setStrokeColor(colors.HexColor('#ccc'))
        pdf.setLineWidth(1)
        pdf.line(margin_left, y, page_width - margin_right, y)
        y -= 14
        pdf.setFont(FONT_NAME, 8)
        pdf.setFillColor(colors.HexColor('#999'))
        pdf.drawCentredString(page_width / 2, y, 'Wygenerowano przez Rythmio  |  Raport ma charakter informacyjny i nie zastepuje diagnozy lekarskiej.')

    else:
        textLines = body.aiResponse.split('\n')
        pdf.setFont(FONT_BOLD, 26)
        pdf.drawCentredString(page_width / 2, y, 'RAPORT EKG')
        y -= 30
        pdf.line(margin_left, y, page_width - margin_right, y)
        y -= 22

        for line in textLines:
            if isinstance(line, bytes):
                line = line.decode('utf-8')
            y = check_page(pdf, y, margin_bottom)
            y = draw_wrapped(pdf, margin_left, y, line, FONT_NAME, body_font_size, max_width, body_lh, margin_bottom)

    pdf.save()
    return FileResponse(path=fileName, filename="RaportAI.pdf", media_type='application/pdf')