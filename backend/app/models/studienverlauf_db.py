"""DB-Modell fuer Studienverlaufsplan."""

from sqlalchemy import Column, Integer, String, Boolean
from app.models.database import Base


class StudienverlaufDB(Base):
    """Ein Modul im Studienverlaufsplan."""

    __tablename__ = "studienverlauf"

    id = Column(Integer, primary_key=True, autoincrement=True)
    plan_name = Column(String(100), nullable=False)  # z.B. "Vollzeit" oder "Praxisbegleitend"
    studiengang = Column(String(200), nullable=True)
    anzahl_semester = Column(Integer, default=6)
    name = Column(String(255), nullable=False)
    semester = Column(Integer, nullable=False)
    hat_pvl = Column(Boolean, default=False)
