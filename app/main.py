import os
import urllib.parse
from fastapi import FastAPI, HTTPException, Depends
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session

from app.models import InvoiceData
from app.database import get_db
from app.db_models import Company, Client, Document, DocumentItem
from app.services.docx_service import generate_docx_document
from app.services.pdf_service import generate_pdf_document

app = FastAPI(
    title="Document Generator Studio",
    description="API для генерации документов по шаблонам (Счет и Акт)",
    version="1.0.0"
)

# CORS Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount Static Files
static_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), "static")
if os.path.exists(static_dir):
    app.mount("/static", StaticFiles(directory=static_dir), name="static")

@app.get("/")
async def root():
    index_path = os.path.join(static_dir, "index.html")
    if os.path.exists(index_path):
        return FileResponse(index_path)
    return {"message": "Document Generator API is running!"}

def save_document_to_db(invoice_data: InvoiceData, doc_type: str, db: Session):
    # Create or update Company
    company = db.query(Company).filter(Company.inn == invoice_data.company.inn).first()
    if not company:
        company = Company(**invoice_data.company.dict())
        db.add(company)
        db.flush()

    # Create or update Client
    client = db.query(Client).filter(Client.inn == invoice_data.client.inn).first()
    if not client:
        client = Client(**invoice_data.client.dict())
        db.add(client)
        db.flush()

    # Create Document
    document = Document(
        document_number=invoice_data.document_number,
        document_date=invoice_data.document_date,
        tax_rate=invoice_data.tax_rate,
        notes=invoice_data.notes,
        document_type=doc_type,
        company_id=company.id,
        client_id=client.id
    )
    db.add(document)
    db.flush()

    # Create Items
    for item in invoice_data.items:
        db_item = DocumentItem(
            document_id=document.id,
            name=item.name,
            unit=item.unit,
            quantity=item.quantity,
            price=item.price
        )
        db.add(db_item)
    
    db.commit()

@app.post("/api/generate/docx")
async def generate_invoice(invoice: InvoiceData, db: Session = Depends(get_db)):
    try:
        # 1. Сохраняем в БД
        save_document_to_db(invoice, "invoice", db)
        
        # 2. Генерируем документ
        stream = generate_docx_document(invoice, template_path="templates/invoice_template.docx")
        filename = f"Счет_{invoice.document_number}_{invoice.document_date}.docx"
        encoded_filename = urllib.parse.quote(filename)
        return StreamingResponse(
            stream,
            media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            headers={"Content-Disposition": f"attachment; filename*=UTF-8''{encoded_filename}"}
        )
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Ошибка при генерации Word файла: {str(e)}")

@app.post("/api/generate/acceptance")
async def generate_acceptance(invoice: InvoiceData, db: Session = Depends(get_db)):
    try:
        # 1. Сохраняем в БД
        save_document_to_db(invoice, "acceptance", db)
        
        # 2. Генерируем документ
        stream = generate_docx_document(invoice, template_path="templates/acceptance_template.docx")
        filename = f"Акт_{invoice.document_number}_{invoice.document_date}.docx"
        encoded_filename = urllib.parse.quote(filename)
        return StreamingResponse(
            stream,
            media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            headers={"Content-Disposition": f"attachment; filename*=UTF-8''{encoded_filename}"}
        )
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Ошибка при генерации файла Акта: {str(e)}")

@app.post("/api/generate/pdf")
async def generate_pdf(invoice: InvoiceData, db: Session = Depends(get_db)):
    try:
        # Опционально сохраняем в БД при генерации PDF (по желанию)
        save_document_to_db(invoice, "pdf", db)
        
        stream = generate_pdf_document(invoice)
        filename = f"Счет_{invoice.document_number}_{invoice.document_date}.pdf"
        encoded_filename = urllib.parse.quote(filename)
        return StreamingResponse(
            stream,
            media_type="application/pdf",
            headers={"Content-Disposition": f"attachment; filename*=UTF-8''{encoded_filename}"}
        )
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Ошибка при генерации PDF файла: {str(e)}")
