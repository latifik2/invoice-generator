import io
import os
from docxtpl import DocxTemplate
from num2words import num2words
from app.models import InvoiceData

def generate_docx_document(invoice_data: InvoiceData, template_path: str = "templates/invoice_template.docx") -> io.BytesIO:
    if not os.path.exists(template_path):
        raise FileNotFoundError(f"Шаблон Word не найден по пути: {template_path}")

    doc = DocxTemplate(template_path)
    
    # Calculate totals
    totals = invoice_data.calculate_totals()
    total_amount = totals["total_amount"]
    
    # Склонение суммы прописью (с заглавной буквы, без запятой)
    total_words = num2words(total_amount, lang='ru', to='currency', currency='RUB')
    total_words = total_words.replace(',', '').capitalize()
    
    # Context dictionary for Jinja2 template
    context = {
        "document_number": invoice_data.document_number,
        "document_date": invoice_data.document_date,
        "company": invoice_data.company.dict(),
        "client": invoice_data.client.dict(),
        "items": [
            {
                "name": item.name,
                "unit": item.unit,
                "quantity": item.quantity,
                "price": item.price,
                "total": item.total
            }
            for item in invoice_data.items
        ],
        "tax_rate": invoice_data.tax_rate,
        "totals": totals,
        "total_words": total_words,
        "notes": invoice_data.notes or ""
    }

    # Render template
    doc.render(context)
    
    output_stream = io.BytesIO()
    doc.save(output_stream)
    output_stream.seek(0)
    return output_stream
