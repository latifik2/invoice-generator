import os
import urllib.parse
from fastapi import FastAPI, HTTPException, Depends
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session

from app.models import InvoiceData, InvoiceItem, CompanyInfo, ClientInfo
from app.database import get_db
from app.db_models import Company, Client, Document, DocumentItem
from app.services.docx_service import generate_docx_document
from app.services.pdf_service import generate_pdf_document
from pydantic import BaseModel
from typing import List, Optional

class ItemCreate(BaseModel):
    name: str
    unit: str
    quantity: float
    price: float

class DocumentCreate(BaseModel):
    document_number: str
    document_date: str
    tax_rate: float
    notes: Optional[str] = ""
    company_id: int
    client_id: int
    items: List[ItemCreate]

def get_next_document_number(db: Session) -> str:
    last_doc = db.query(Document).order_by(Document.id.desc()).first()
    if not last_doc or not last_doc.document_number:
        return "СЧ-0001"
    
    # Try to extract number and increment
    import re
    match = re.search(r'(\d+)$', last_doc.document_number)
    if match:
        num_str = match.group(1)
        num_len = len(num_str)
        next_num = int(num_str) + 1
        prefix = last_doc.document_number[:-num_len]
        return f"{prefix}{str(next_num).zfill(num_len)}"
    return f"{last_doc.document_number}-1"

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

def _get_invoice_data_from_db(doc_id: int, db: Session) -> InvoiceData:
    doc = db.query(Document).filter(Document.id == doc_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Документ не найден")
    
    company = db.query(Company).filter(Company.id == doc.company_id).first()
    client = db.query(Client).filter(Client.id == doc.client_id).first()
    items = db.query(DocumentItem).filter(DocumentItem.document_id == doc.id).all()
    
    company_info = CompanyInfo(**{c.name: getattr(company, c.name) for c in company.__table__.columns if c.name != "id"}) if company else CompanyInfo()
    client_info = ClientInfo(**{c.name: getattr(client, c.name) for c in client.__table__.columns if c.name != "id"}) if client else ClientInfo()
    
    invoice_items = [InvoiceItem(name=i.name, unit=i.unit, quantity=i.quantity, price=i.price) for i in items]
    
    return InvoiceData(
        document_number=doc.document_number,
        document_date=doc.document_date,
        tax_rate=doc.tax_rate,
        notes=doc.notes,
        company=company_info,
        client=client_info,
        items=invoice_items
    )

@app.get("/api/generate/docx/{doc_id}")
async def generate_invoice(doc_id: int, db: Session = Depends(get_db)):
    try:
        invoice = _get_invoice_data_from_db(doc_id, db)
        stream = generate_docx_document(invoice, template_path="templates/invoice_template.docx")
        filename = f"Счет_{invoice.document_number}_{invoice.document_date}.docx"
        encoded_filename = urllib.parse.quote(filename)
        return StreamingResponse(
            stream,
            media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            headers={"Content-Disposition": f"attachment; filename*=UTF-8''{encoded_filename}"}
        )
    except HTTPException as e:
        raise e
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Ошибка при генерации Word файла: {str(e)}")

@app.get("/api/generate/acceptance/{doc_id}")
async def generate_acceptance(doc_id: int, db: Session = Depends(get_db)):
    try:
        invoice = _get_invoice_data_from_db(doc_id, db)
        stream = generate_docx_document(invoice, template_path="templates/acceptance_template.docx")
        filename = f"Акт_{invoice.document_number}_{invoice.document_date}.docx"
        encoded_filename = urllib.parse.quote(filename)
        return StreamingResponse(
            stream,
            media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            headers={"Content-Disposition": f"attachment; filename*=UTF-8''{encoded_filename}"}
        )
    except HTTPException as e:
        raise e
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Ошибка при генерации файла Акта: {str(e)}")

@app.get("/api/generate/pdf/{doc_id}")
async def generate_pdf(doc_id: int, db: Session = Depends(get_db)):
    try:
        invoice = _get_invoice_data_from_db(doc_id, db)
        stream = generate_pdf_document(invoice)
        filename = f"Счет_{invoice.document_number}_{invoice.document_date}.pdf"
        encoded_filename = urllib.parse.quote(filename)
        return StreamingResponse(
            stream,
            media_type="application/pdf",
            headers={"Content-Disposition": f"attachment; filename*=UTF-8''{encoded_filename}"}
        )
    except HTTPException as e:
        raise e
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Ошибка при генерации PDF файла: {str(e)}")

# --- API Endpoints for Company ---

@app.get("/api/company")
def get_company(db: Session = Depends(get_db)):
    company = db.query(Company).first()
    if not company:
        return {}
    return {c.name: getattr(company, c.name) for c in company.__table__.columns}

@app.post("/api/company")
def update_company(company_data: dict, db: Session = Depends(get_db)):
    company = db.query(Company).first()
    if not company:
        company = Company(**company_data)
        db.add(company)
    else:
        for key, value in company_data.items():
            if hasattr(company, key) and key != "id":
                setattr(company, key, value)
    db.commit()
    db.refresh(company)
    return {c.name: getattr(company, c.name) for c in company.__table__.columns}

# --- API Endpoints for Clients ---

@app.get("/api/clients")
def get_clients(db: Session = Depends(get_db)):
    clients = db.query(Client).all()
    return [{c.name: getattr(client, c.name) for c in client.__table__.columns} for client in clients]

@app.post("/api/clients")
def create_client(client_data: dict, db: Session = Depends(get_db)):
    # Check if client with this INN already exists
    if client_data.get("inn"):
        existing = db.query(Client).filter(Client.inn == client_data.get("inn")).first()
        if existing:
            raise HTTPException(status_code=400, detail="Контрагент с таким ИНН уже существует")
            
    client = Client(**client_data)
    db.add(client)
    db.commit()
    db.refresh(client)
    return {c.name: getattr(client, c.name) for c in client.__table__.columns}

@app.put("/api/clients/{client_id}")
def update_client(client_id: int, client_data: dict, db: Session = Depends(get_db)):
    client = db.query(Client).filter(Client.id == client_id).first()
    if not client:
        raise HTTPException(status_code=404, detail="Контрагент не найден")
        
    for key, value in client_data.items():
        if hasattr(client, key) and key != "id":
            setattr(client, key, value)
            
    db.commit()
    db.refresh(client)
    return {c.name: getattr(client, c.name) for c in client.__table__.columns}

@app.delete("/api/clients/{client_id}")
def delete_client(client_id: int, db: Session = Depends(get_db)):
    client = db.query(Client).filter(Client.id == client_id).first()
    if not client:
        raise HTTPException(status_code=404, detail="Контрагент не найден")
        
    db.delete(client)
    db.commit()
    return {"message": "Контрагент удален"}

# --- API Endpoints for Documents ---

@app.get("/api/documents/next_number")
def next_document_number(db: Session = Depends(get_db)):
    return {"next_number": get_next_document_number(db)}

@app.get("/api/documents")
def get_documents(db: Session = Depends(get_db)):
    docs = db.query(Document).order_by(Document.id.desc()).all()
    results = []
    for d in docs:
        client = db.query(Client).filter(Client.id == d.client_id).first()
        client_name = client.name if client else "Неизвестно"
        results.append({
            "id": d.id,
            "document_number": d.document_number,
            "document_date": d.document_date,
            "client_name": client_name
        })
    return results

@app.get("/api/documents/{doc_id}")
def get_document(doc_id: int, db: Session = Depends(get_db)):
    doc = db.query(Document).filter(Document.id == doc_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Заказ не найден")
    
    items = db.query(DocumentItem).filter(DocumentItem.document_id == doc.id).all()
    items_data = [{"name": i.name, "unit": i.unit, "quantity": i.quantity, "price": i.price} for i in items]
    
    return {
        "id": doc.id,
        "document_number": doc.document_number,
        "document_date": doc.document_date,
        "tax_rate": doc.tax_rate,
        "notes": doc.notes,
        "company_id": doc.company_id,
        "client_id": doc.client_id,
        "items": items_data
    }

@app.post("/api/documents")
def create_document(doc_data: DocumentCreate, db: Session = Depends(get_db)):
    doc = Document(
        document_number=doc_data.document_number,
        document_date=doc_data.document_date,
        tax_rate=doc_data.tax_rate,
        notes=doc_data.notes,
        document_type="order",
        company_id=doc_data.company_id,
        client_id=doc_data.client_id
    )
    db.add(doc)
    db.flush()
    
    for item in doc_data.items:
        db_item = DocumentItem(
            document_id=doc.id,
            name=item.name,
            unit=item.unit,
            quantity=item.quantity,
            price=item.price
        )
        db.add(db_item)
    
    db.commit()
    db.refresh(doc)
    return {"id": doc.id, "message": "Заказ создан"}

@app.put("/api/documents/{doc_id}")
def update_document(doc_id: int, doc_data: DocumentCreate, db: Session = Depends(get_db)):
    doc = db.query(Document).filter(Document.id == doc_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Заказ не найден")
        
    doc.document_number = doc_data.document_number
    doc.document_date = doc_data.document_date
    doc.tax_rate = doc_data.tax_rate
    doc.notes = doc_data.notes
    doc.company_id = doc_data.company_id
    doc.client_id = doc_data.client_id
    
    # Replace items
    db.query(DocumentItem).filter(DocumentItem.document_id == doc.id).delete()
    for item in doc_data.items:
        db_item = DocumentItem(
            document_id=doc.id,
            name=item.name,
            unit=item.unit,
            quantity=item.quantity,
            price=item.price
        )
        db.add(db_item)
        
    db.commit()
    return {"id": doc.id, "message": "Заказ обновлен"}
