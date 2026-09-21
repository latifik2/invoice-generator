import sys
import os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from app.models import InvoiceData, CompanyInfo, ClientInfo, InvoiceItem
from app.services.docx_service import generate_docx_document
from app.services.xlsx_service import generate_xlsx_document
from app.services.pdf_service import generate_pdf_document

def test_all_generators():
    invoice = InvoiceData(
        document_number="ТЕСТ-001",
        document_date="2026-09-18",
        company=CompanyInfo(name="Тестовая Компания ООО"),
        client=ClientInfo(name="Тестовый Заказчик АО"),
        items=[
            InvoiceItem(name="Тестовая услуга 1", quantity=2, price=5000),
            InvoiceItem(name="Тестовая услуга 2", quantity=1, price=12000)
        ],
        tax_rate=20.0
    )

    print("Testing DOCX generation...")
    docx_stream = generate_docx_document(invoice)
    assert docx_stream.getvalue(), "DOCX output stream is empty!"
    print("✓ DOCX generated successfully! Size:", len(docx_stream.getvalue()), "bytes")

    print("Testing XLSX generation...")
    xlsx_stream = generate_xlsx_document(invoice)
    assert xlsx_stream.getvalue(), "XLSX output stream is empty!"
    print("✓ XLSX generated successfully! Size:", len(xlsx_stream.getvalue()), "bytes")

    print("Testing PDF generation...")
    pdf_stream = generate_pdf_document(invoice)
    assert pdf_stream.getvalue(), "PDF output stream is empty!"
    print("✓ PDF generated successfully! Size:", len(pdf_stream.getvalue()), "bytes")

    print("ALL GENERATORS TESTED AND WORKING PERFECTLY!")

if __name__ == "__main__":
    test_all_generators()
