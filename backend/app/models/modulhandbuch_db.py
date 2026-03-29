"""DB-Modell fuer Modulhandbuch-Eintraege."""

from sqlalchemy import Column, Integer, Float, String, Text
from app.models.database import Base


class ModulhandbuchDB(Base):
    """Ein Modul aus dem Modulhandbuch."""

    __tablename__ = "modulhandbuch"

    id = Column(Integer, primary_key=True, autoincrement=True)
    studiengang = Column(String(200), nullable=True)
    name = Column(String(255), nullable=False)
    kuerzel = Column(String(20), nullable=True)
    niveau = Column(String(50), nullable=True)
    studiensemester = Column(String(100), nullable=True)
    modulverantwortlicher = Column(String(200), nullable=True)
    sprache = Column(String(50), nullable=True)
    zuordnung = Column(String(500), nullable=True)
    sws_vorlesung = Column(Integer, nullable=True)
    sws_uebung = Column(Integer, nullable=True)
    sws_praktikum = Column(Integer, nullable=True)
    sws_seminar = Column(Integer, nullable=True)
    sws_su = Column(Integer, nullable=True)
    arbeitsaufwand = Column(String(200), nullable=True)
    credit_points = Column(Float, nullable=True)
    pvl = Column(Text, nullable=True)
    empfohlene_voraussetzungen = Column(Text, nullable=True)
    lernziele = Column(Text, nullable=True)
    inhalt = Column(Text, nullable=True)
    pruefungsformen = Column(String(200), nullable=True)
