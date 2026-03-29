"""DB-Modell fuer FPO-Pruefungsplan-Eintraege."""

from sqlalchemy import Column, Integer, Float, String, Boolean
from app.models.database import Base


class FpoPlanDB(Base):
    """Ein Modul aus dem FPO-Pruefungsplan."""

    __tablename__ = "fpo_plan"

    id = Column(Integer, primary_key=True, autoincrement=True)
    studiengang = Column(String(200), nullable=True)
    variante = Column(String(30), nullable=False)  # "Vollzeit" / "Praxisbegleitend"
    pruefungsnummer = Column(String(20), nullable=False)
    name = Column(String(255), nullable=False)
    cp = Column(Float, nullable=True)
    pvl = Column(String(50), nullable=True)
    pruefungsereignis = Column(String(50), nullable=True)
    pruefungsform = Column(String(50), nullable=True)
    semester = Column(Integer, nullable=True)
    ist_wahlpflicht = Column(Boolean, default=False)
    kategorie = Column(String(100), nullable=True)
