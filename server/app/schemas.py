from pydantic import BaseModel, ConfigDict
from typing import Optional, List
from datetime import datetime


class DocumentBase(BaseModel):
    content: Optional[str] = None  # Now optional since it's derived from current version


class DocumentSummary(BaseModel):
    """Lightweight document descriptor returned by GET /documents."""
    model_config = ConfigDict(from_attributes=True)

    id: int
    title: Optional[str] = None


class DocumentRead(DocumentBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    title: Optional[str] = None
    current_version_id: Optional[int] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


class DocumentVersionBase(BaseModel):
    content: str
    version_name: Optional[str] = None


class DocumentVersionCreate(DocumentVersionBase):
    pass


class DocumentVersionRead(DocumentVersionBase):
    model_config = ConfigDict(from_attributes=True)
    
    id: int
    document_id: int
    version_number: int
    created_at: datetime
    updated_at: datetime


class DocumentVersionUpdate(BaseModel):
    content: str


class DocumentWithVersions(DocumentRead):
    versions: List[DocumentVersionRead] = []


