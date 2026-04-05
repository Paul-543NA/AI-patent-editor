from sqlalchemy import Column, Integer, String, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime

from app.internal.db import Base


class Document(Base):
    __tablename__ = "document"
    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, nullable=True)
    # New fields for versioning - nullable for backward compatibility
    current_version_id = Column(Integer, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationship to versions
    versions = relationship("DocumentVersion", back_populates="document", cascade="all, delete-orphan")
    
    @property
    def content(self):
        """Get content from current version, or None if no versioning enabled"""
        if self.current_version_id:
            # Find the current version
            current_version = next(
                (v for v in self.versions if v.id == self.current_version_id), 
                None
            )
            return current_version.content if current_version else None
        return None


class DocumentVersion(Base):
    __tablename__ = "document_version"
    id = Column(Integer, primary_key=True, index=True)
    document_id = Column(Integer, ForeignKey("document.id"), nullable=False)
    content = Column(String, nullable=False)
    version_number = Column(Integer, nullable=False)
    version_name = Column(String, nullable=True)  # Optional custom version name
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationship back to document
    document = relationship("Document", back_populates="versions")


