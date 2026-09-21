from sqlalchemy import Column, Integer, String, Float, ForeignKey, DateTime
from sqlalchemy.orm import relationship
from datetime import datetime
from .database import Base

class Company(Base):
    __tablename__ = "companies"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)
    inn = Column(String)
    kpp = Column(String)
    ogrn = Column(String)
    address = Column(String)
    phone = Column(String)
    email = Column(String)
    bank_name = Column(String)
    bik = Column(String)
    account = Column(String)
    corr_account = Column(String)
    ceo_name = Column(String)

    documents = relationship("Document", back_populates="company")

class Client(Base):
    __tablename__ = "clients"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)
    inn = Column(String)
    kpp = Column(String)
    ogrn = Column(String)
    address = Column(String)
    phone = Column(String)
    email = Column(String)
    bank_name = Column(String)
    bik = Column(String)
    account = Column(String)
    corr_account = Column(String)
    contact_person = Column(String)

    documents = relationship("Document", back_populates="client")

class Document(Base):
    __tablename__ = "documents"

    id = Column(Integer, primary_key=True, index=True)
    document_number = Column(String, index=True)
    document_date = Column(String)
    tax_rate = Column(Float, default=20.0)
    notes = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # "invoice" или "acceptance"
    document_type = Column(String, default="invoice")

    company_id = Column(Integer, ForeignKey("companies.id"))
    client_id = Column(Integer, ForeignKey("clients.id"))

    company = relationship("Company", back_populates="documents")
    client = relationship("Client", back_populates="documents")
    items = relationship("DocumentItem", back_populates="document", cascade="all, delete-orphan")

class DocumentItem(Base):
    __tablename__ = "document_items"

    id = Column(Integer, primary_key=True, index=True)
    document_id = Column(Integer, ForeignKey("documents.id"))
    name = Column(String)
    unit = Column(String)
    quantity = Column(Float)
    price = Column(Float)

    document = relationship("Document", back_populates="items")
