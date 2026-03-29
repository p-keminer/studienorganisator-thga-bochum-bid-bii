"""
SQLAlchemy-Datenbankmodelle und Session-Management.

Schema-Design basiert auf der Datenquellen-Analyse (siehe docs/DATENQUELLEN.md).
"""

from datetime import datetime

from sqlalchemy import (
    Column,
    Integer,
    String,
    Float,
    Boolean,
    Text,
    DateTime,
    ForeignKey,
    JSON,
)
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase, relationship

from app.core.config import settings


# === Engine + Session ===

engine = create_async_engine(settings.database_url, echo=settings.debug_mode)
async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


async def init_db():
    """
    Erstellt alle Tabellen. Bei Schema-Aenderungen (fehlende Spalten)
    werden betroffene Tabellen automatisch neu erstellt.

    Fuer Produktion: Alembic-Migrationen verwenden.
    Fuer Entwicklung: drop + recreate ist akzeptabel.
    """
    async with engine.begin() as conn:
        # Versuche Tabellen zu erstellen
        await conn.run_sync(Base.metadata.create_all)

        # Schema-Validierung: Pruefen ob alle Spalten existieren
        try:
            from sqlalchemy import inspect as sa_inspect

            def _validate_schema(connection):
                inspector = sa_inspect(connection)
                for table_name, table in Base.metadata.tables.items():
                    if not inspector.has_table(table_name):
                        continue
                    existing_columns = {c["name"] for c in inspector.get_columns(table_name)}
                    expected_columns = {c.name for c in table.columns}
                    missing = expected_columns - existing_columns
                    if missing:
                        # Schema stimmt nicht — Tabelle droppen und neu erstellen
                        table.drop(connection, checkfirst=True)
                        table.create(connection, checkfirst=True)

            await conn.run_sync(_validate_schema)
        except Exception:
            # Fallback: Alles droppen und neu erstellen
            await conn.run_sync(Base.metadata.drop_all)
            await conn.run_sync(Base.metadata.create_all)


async def get_db():
    """Dependency fuer FastAPI — liefert eine DB-Session."""
    async with async_session() as session:
        yield session


# === Modelle ===


class DokumentDB(Base):
    """Hochgeladenes Quelldokument."""

    __tablename__ = "documents"

    id = Column(Integer, primary_key=True, autoincrement=True)
    dateiname = Column(String(255), nullable=False)
    doc_type = Column(String(50), nullable=True)
    semester = Column(String(50), nullable=True)
    stand = Column(String(50), nullable=True)
    uploaded_at = Column(DateTime, default=datetime.utcnow)

    # Beziehung zu extrahierten Veranstaltungen
    veranstaltungen = relationship("VeranstaltungDB", back_populates="dokument")


class VeranstaltungDB(Base):
    """Extrahierte Veranstaltung (ein Block aus der Veranstaltungsliste)."""

    __tablename__ = "veranstaltungen"

    id = Column(Integer, primary_key=True, autoincrement=True)
    document_id = Column(Integer, ForeignKey("documents.id"), nullable=False)
    modul_nummer = Column(String(20), nullable=False, index=True)
    typ = Column(String(5), nullable=False)
    name = Column(String(255), nullable=False)
    extraction_confidence = Column(Float, default=1.0)

    dokument = relationship("DokumentDB", back_populates="veranstaltungen")
    termine = relationship("TerminDB", back_populates="veranstaltung", cascade="all, delete-orphan")


class TerminDB(Base):
    """Einzelner Termin einer Veranstaltung."""

    __tablename__ = "termine"

    id = Column(Integer, primary_key=True, autoincrement=True)
    veranstaltung_id = Column(Integer, ForeignKey("veranstaltungen.id"), nullable=False)
    tag = Column(String(10), nullable=False)
    start_zeit = Column(String(10), nullable=False)
    end_zeit = Column(String(10), nullable=False)
    raum = Column(String(50), nullable=True)
    dozent_kuerzel = Column(String(10), nullable=True)
    dozent_name = Column(String(100), nullable=True)
    klassen = Column(JSON, nullable=True)
    gruppe = Column(String(20), nullable=True)
    bemerkung = Column(Text, nullable=True)

    veranstaltung = relationship("VeranstaltungDB", back_populates="termine")


class ModulMetaDB(Base):
    """Zusaetzliche Metadaten aus FPO und Modulhandbuch."""

    __tablename__ = "modul_meta"

    id = Column(Integer, primary_key=True, autoincrement=True)
    modul_nummer = Column(String(20), nullable=False, unique=True, index=True)
    curriculum_kuerzel = Column(String(20), nullable=True)
    ects = Column(Integer, nullable=True)
    sws = Column(Integer, nullable=True)
    sws_detail = Column(JSON, nullable=True)
    pruefungsformen = Column(JSON, nullable=True)
    pvl = Column(String(100), nullable=True)
    empfohlenes_semester = Column(Integer, nullable=True)
    pflicht = Column(Boolean, nullable=True)
    studiengaenge = Column(JSON, nullable=True)
    modul_verantwortlicher = Column(String(200), nullable=True)
    voraussetzungen = Column(Text, nullable=True)
    inhalt = Column(Text, nullable=True)
    lernziele = Column(Text, nullable=True)


class DozentenMappingDB(Base):
    """Kuerzel-zu-Name Mapping fuer Dozenten."""

    __tablename__ = "dozenten_mappings"

    id = Column(Integer, primary_key=True, autoincrement=True)
    kuerzel = Column(String(10), nullable=False, unique=True, index=True)
    name = Column(String(100), nullable=False)
    voller_name = Column(String(200), nullable=True)


class PlanEintragDB(Base):
    """Benutzerdefinierter Wochenplan-Eintrag."""

    __tablename__ = "plan_eintraege"

    id = Column(Integer, primary_key=True, autoincrement=True)
    modul_nummer = Column(String(20), nullable=False)
    veranstaltungs_typ = Column(String(5), nullable=False)
    display_name = Column(String(255), nullable=False)
    tag = Column(String(10), nullable=False)
    start_zeit = Column(String(10), nullable=False)
    end_zeit = Column(String(10), nullable=False)
    slot = Column(Integer, nullable=False, default=0)
    raum = Column(String(50), nullable=True)
    dozent = Column(String(200), nullable=True)
    gruppe = Column(String(20), nullable=True)
    farbe = Column(String(20), default="#3b82f6")
    notizen = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
