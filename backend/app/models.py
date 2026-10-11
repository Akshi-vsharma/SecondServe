from datetime import datetime
from sqlalchemy import String, Integer, Float, Date, DateTime, ForeignKey, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from .database import Base

class Batch(Base):
    __tablename__ = "batches"
    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(160))
    category: Mapped[str] = mapped_column(String(80))
    mrp_per_unit: Mapped[float] = mapped_column(Float)
    pack_size: Mapped[str] = mapped_column(String(60))
    quantity_total: Mapped[int] = mapped_column(Integer)
    quantity_remaining: Mapped[int] = mapped_column(Integer)
    date_type: Mapped[str] = mapped_column(String(20))
    printed_date: Mapped[datetime | None] = mapped_column(Date, nullable=True)
    storage_requirements: Mapped[str] = mapped_column(String(200))
    consumption_per_day: Mapped[float | None] = mapped_column(Float, nullable=True)
    target_buyer: Mapped[str] = mapped_column(String(50), default="household")
    image_path: Mapped[str | None] = mapped_column(String(255), nullable=True)
    packaging_damaged: Mapped[bool] = mapped_column(default=False)
    status: Mapped[str] = mapped_column(String(30), default="pending")
    buying_price: Mapped[float | None] = mapped_column(Float, nullable=True)
    selling_price: Mapped[float | None] = mapped_column(Float, nullable=True)
    explanation_json: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_demo: Mapped[bool] = mapped_column(default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    orders: Mapped[list["OrderItem"]] = relationship(back_populates="batch")

class Order(Base):
    __tablename__ = "orders"
    id: Mapped[int] = mapped_column(primary_key=True)
    customer_name: Mapped[str] = mapped_column(String(100))
    total: Mapped[float] = mapped_column(Float)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    items: Mapped[list["OrderItem"]] = relationship(back_populates="order")

class OrderItem(Base):
    __tablename__ = "order_items"
    id: Mapped[int] = mapped_column(primary_key=True)
    order_id: Mapped[int] = mapped_column(ForeignKey("orders.id"))
    batch_id: Mapped[int] = mapped_column(ForeignKey("batches.id"))
    quantity: Mapped[int] = mapped_column(Integer)
    unit_price: Mapped[float] = mapped_column(Float)
    order: Mapped[Order] = relationship(back_populates="items")
    batch: Mapped[Batch] = relationship(back_populates="orders")
