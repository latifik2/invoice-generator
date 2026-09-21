import io
import os
from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.units import cm
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont

from app.models import InvoiceData

# Register Cyrillic Font
FONT_DIR = "/usr/share/fonts/dejavu-sans-fonts"
REGULAR_FONT_PATH = os.path.join(FONT_DIR, "DejaVuSans.ttf")
BOLD_FONT_PATH = os.path.join(FONT_DIR, "DejaVuSans-Bold.ttf")

if os.path.exists(REGULAR_FONT_PATH):
    pdfmetrics.registerFont(TTFont("DejaVu", REGULAR_FONT_PATH))
    font_name = "DejaVu"
else:
    font_name = "Helvetica"

if os.path.exists(BOLD_FONT_PATH):
    pdfmetrics.registerFont(TTFont("DejaVu-Bold", BOLD_FONT_PATH))
    font_bold_name = "DejaVu-Bold"
else:
    font_bold_name = font_name

def generate_pdf_document(invoice_data: InvoiceData) -> io.BytesIO:
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        rightMargin=1.5 * cm,
        leftMargin=1.5 * cm,
        topMargin=1.5 * cm,
        bottomMargin=1.5 * cm
    )

    styles = getSampleStyleSheet()
    
    # Custom Paragraph Styles
    style_title = ParagraphStyle(
        'DocTitle',
        parent=styles['Normal'],
        fontName=font_bold_name,
        fontSize=16,
        leading=20,
        textColor=colors.HexColor('#1E3A8A'),
        spaceAfter=4
    )

    style_sub = ParagraphStyle(
        'DocSub',
        parent=styles['Normal'],
        fontName=font_name,
        fontSize=10,
        leading=14,
        textColor=colors.HexColor('#4B5563'),
        spaceAfter=12
    )

    style_body = ParagraphStyle(
        'DocBody',
        parent=styles['Normal'],
        fontName=font_name,
        fontSize=9,
        leading=12,
        textColor=colors.HexColor('#1F2937')
    )

    style_body_bold = ParagraphStyle(
        'DocBodyBold',
        parent=styles['Normal'],
        fontName=font_bold_name,
        fontSize=9,
        leading=12,
        textColor=colors.HexColor('#1F2937')
    )

    style_tbl_hdr = ParagraphStyle(
        'DocTblHdr',
        parent=styles['Normal'],
        fontName=font_bold_name,
        fontSize=9,
        leading=11,
        textColor=colors.white,
        alignment=1 # Center
    )

    elements = []

    # Title
    elements.append(Paragraph(f"СЧЕТ НА ОПЛАТУ № {invoice_data.document_number}", style_title))
    elements.append(Paragraph(f"от {invoice_data.document_date} г.", style_sub))
    elements.append(HRFlowable(width="100%", thickness=1.5, color=colors.HexColor('#1E3A8A'), spaceAfter=12))

    # Supplier & Client Info Table
    sup_text = f"""<b>ПОСТАВЩИК:</b> {invoice_data.company.name}<br/>
    <b>ИНН/КПП:</b> {invoice_data.company.inn} / {invoice_data.company.kpp}<br/>
    <b>Адрес:</b> {invoice_data.company.address}<br/>
    <b>Банк:</b> {invoice_data.company.bank_name}<br/>
    <b>БИК:</b> {invoice_data.company.bik} | <b>Р/с:</b> {invoice_data.company.account}
    """
    
    cli_text = f"""<b>ПОКУПАТЕЛЬ:</b> {invoice_data.client.name}<br/>
    <b>ИНН/КПП:</b> {invoice_data.client.inn} / {invoice_data.client.kpp}<br/>
    <b>Адрес:</b> {invoice_data.client.address}<br/>
    <b>Контакты:</b> {invoice_data.client.phone} | {invoice_data.client.email}
    """

    req_data = [
        [Paragraph(sup_text, style_body), Paragraph(cli_text, style_body)]
    ]
    req_table = Table(req_data, colWidths=[9.0 * cm, 9.0 * cm])
    req_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), colors.HexColor('#F9FAFB')),
        ('BOX', (0,0), (-1,-1), 0.5, colors.HexColor('#E5E7EB')),
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
        ('PADDING', (0,0), (-1,-1), 8),
    ]))
    elements.append(req_table)
    elements.append(Spacer(1, 12))

    # Items Table
    table_data = [
        [
            Paragraph("№", style_tbl_hdr),
            Paragraph("Наименование", style_tbl_hdr),
            Paragraph("Кол-во", style_tbl_hdr),
            Paragraph("Ед.", style_tbl_hdr),
            Paragraph("Цена, руб.", style_tbl_hdr),
            Paragraph("Сумма, руб.", style_tbl_hdr)
        ]
    ]

    totals = invoice_data.calculate_totals()

    for idx, item in enumerate(invoice_data.items, 1):
        table_data.append([
            Paragraph(str(idx), style_body),
            Paragraph(item.name, style_body),
            Paragraph(f"{item.quantity:g}", style_body),
            Paragraph(item.unit, style_body),
            Paragraph(f"{item.price:,.2f}", style_body),
            Paragraph(f"{item.total:,.2f}", style_body)
        ])

    items_table = Table(table_data, colWidths=[1.0*cm, 7.5*cm, 1.8*cm, 1.2*cm, 3.2*cm, 3.3*cm])
    
    tbl_style = [
        ('BACKGROUND', (0,0), (-1,0), colors.HexColor('#1E3A8A')),
        ('ALIGN', (0,0), (0,-1), 'CENTER'),
        ('ALIGN', (2,0), (3,-1), 'CENTER'),
        ('ALIGN', (4,0), (5,-1), 'RIGHT'),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor('#D1D5DB')),
        ('PADDING', (0,0), (-1,-1), 6),
    ]

    for r in range(1, len(table_data)):
        if r % 2 == 0:
            tbl_style.append(('BACKGROUND', (0, r), (-1, r), colors.HexColor('#F3F4F6')))

    items_table.setStyle(TableStyle(tbl_style))
    elements.append(items_table)
    elements.append(Spacer(1, 12))

    # Summary Totals
    tot_text = f"""
    <b>Итого без НДС:</b> {totals['subtotal']:,.2f} руб.<br/>
    <b>НДС ({invoice_data.tax_rate}%):</b> {totals['vat_amount']:,.2f} руб.<br/>
    <font size=12 color="#1E3A8A"><b>ВСЕГО К ОПЛАТЕ: {totals['total_amount']:,.2f} руб.</b></font>
    """
    tot_p = Paragraph(tot_text, ParagraphStyle('TotP', parent=style_body, alignment=2, leading=16))
    elements.append(tot_p)
    elements.append(Spacer(1, 16))

    # Notes & Signatures
    if invoice_data.notes:
        elements.append(Paragraph(f"<b>Примечание:</b> {invoice_data.notes}", style_body))
        elements.append(Spacer(1, 16))

    sig_text = f"<b>Руководитель:</b> ____________________ ( {invoice_data.company.ceo_name} )&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<b>Главный бухгалтер:</b> ____________________"
    elements.append(Paragraph(sig_text, style_body))

    doc.build(elements)
    buffer.seek(0)
    return buffer
