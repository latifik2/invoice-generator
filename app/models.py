from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import date

class CompanyInfo(BaseModel):
    name: str = Field(default="ООО «Инновационные Технологии»")
    inn: str = Field(default="7701234567")
    kpp: str = Field(default="770101001")
    ogrn: str = Field(default="")
    address: str = Field(default="г. Москва, ул. Тверская, д. 10, оф. 402")
    phone: str = Field(default="+7 (495) 123-45-67")
    email: str = Field(default="info@innotech.ru")
    bank_name: str = Field(default="АО «Альфа-Банк»")
    bik: str = Field(default="044525593")
    account: str = Field(default="40702810900000001234")
    corr_account: str = Field(default="30101810200000000593")
    ceo_name: str = Field(default="Иванов И.И.")

class ClientInfo(BaseModel):
    name: str = Field(default="АО «Вектор Прогресса»")
    inn: str = Field(default="7802987654")
    kpp: str = Field(default="780201001")
    ogrn: str = Field(default="")
    address: str = Field(default="г. Санкт-Петербург, Невский пр., д. 50")
    phone: str = Field(default="+7 (812) 987-65-43")
    email: str = Field(default="contact@vector.ru")
    bank_name: str = Field(default="ПАО Сбербанк")
    bik: str = Field(default="044525225")
    account: str = Field(default="40702810000000000001")
    corr_account: str = Field(default="30101810400000000225")
    contact_person: str = Field(default="Петров П.П.")

class InvoiceItem(BaseModel):
    name: str
    unit: str = "шт."
    quantity: float = 1.0
    price: float = 0.0
    
    @property
    def total(self) -> float:
        return round(self.quantity * self.price, 2)

class InvoiceData(BaseModel):
    document_number: str = Field(default="СЧ-0042")
    document_date: str = Field(default=str(date.today()))
    company: CompanyInfo = Field(default_factory=CompanyInfo)
    client: ClientInfo = Field(default_factory=ClientInfo)
    items: List[InvoiceItem] = Field(default_factory=list)
    tax_rate: float = Field(default=20.0, description="Ставка НДС в % (0 - без НДС)")
    notes: Optional[str] = Field(default="Оплата в течение 5 банковских дней с момента выставления счета.")

    def calculate_totals(self):
        subtotal = sum(item.quantity * item.price for item in self.items)
        vat_amount = subtotal * (self.tax_rate / 100.0) if self.tax_rate > 0 else 0.0
        total_amount = round(subtotal + vat_amount, 2)
        
        total_rubles = int(total_amount)
        total_kopecks = int(round((total_amount - total_rubles) * 100))
        
        return {
            "subtotal": round(subtotal, 2),
            "vat_amount": round(vat_amount, 2),
            "total_amount": total_amount,
            "total_rubles": total_rubles,
            "total_kopecks": f"{total_kopecks:02d}"
        }
