from contextlib import asynccontextmanager
from typing import List, Dict
import json

from fastapi import Depends, FastAPI, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import insert, select, update, func, delete
from sqlalchemy.orm import Session

from app.internal.ai import AI, get_ai
from app.internal.data import DOCUMENT_1, DOCUMENT_2
from app.internal.db import Base, SessionLocal, engine, get_db
from app.internal.simple_upgrade_workflow import SimpleDocumentUpgradeWorkflow

import app.models as models
import app.schemas as schemas
from app.utils import strip_html


@asynccontextmanager
async def lifespan(_: FastAPI):
    # Create the database tables
    Base.metadata.create_all(bind=engine)
    # Insert seed data
    with SessionLocal() as db:
        # Create documents with titles
        db.execute(insert(models.Document).values(
            id=1, title="Wireless optogenetic device for remotely controlling neural activities"
        ))
        db.execute(insert(models.Document).values(
            id=2, title="Microfluidic Device for Blood Oxygenation"
        ))
        
        # Create initial versions for the documents
        db.execute(insert(models.DocumentVersion).values(
            document_id=1, 
            content=DOCUMENT_1, 
            version_number=1
        ))
        db.execute(insert(models.DocumentVersion).values(
            document_id=2, 
            content=DOCUMENT_2, 
            version_number=1
        ))
        
        # Get the version IDs and update documents to point to them
        version_1 = db.scalar(select(models.DocumentVersion).where(
            models.DocumentVersion.document_id == 1,
            models.DocumentVersion.version_number == 1
        ))
        version_2 = db.scalar(select(models.DocumentVersion).where(
            models.DocumentVersion.document_id == 2,
            models.DocumentVersion.version_number == 1
        ))
        
        if version_1:
            db.execute(update(models.Document).where(models.Document.id == 1).values(current_version_id=version_1.id))
        if version_2:
            db.execute(update(models.Document).where(models.Document.id == 2).values(current_version_id=version_2.id))
        
        db.commit()
    yield


app = FastAPI(lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# WebSocket connection manager for upgrade progress
class UpgradeConnectionManager:
    def __init__(self):
        self.active_connections: Dict[str, WebSocket] = {}

    async def connect(self, websocket: WebSocket, session_id: str):
        await websocket.accept()
        self.active_connections[session_id] = websocket

    def disconnect(self, session_id: str):
        if session_id in self.active_connections:
            del self.active_connections[session_id]

    async def send_progress_update(self, session_id: str, data: dict):
        if session_id in self.active_connections:
            try:
                await self.active_connections[session_id].send_text(json.dumps(data))
            except:
                # Remove connection if it's no longer active
                self.disconnect(session_id)

upgrade_manager = UpgradeConnectionManager()


@app.get("/")
def root():
    """Health check endpoint"""
    return {"message": "Server is running", "websocket_endpoint": "/ws"}


@app.get("/documents")
def list_documents(db: Session = Depends(get_db)) -> List[schemas.DocumentSummary]:
    """List all available documents (id and title only)."""
    documents = db.scalars(select(models.Document)).all()
    return documents


@app.get("/document/{document_id}")
def get_document(
    document_id: int, db: Session = Depends(get_db)
) -> schemas.DocumentRead:
    """Get a document from the database"""
    document = db.scalar(select(models.Document).where(models.Document.id == document_id))
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")
    return document


@app.get("/document/{document_id}/versions")
def get_document_versions(
    document_id: int, db: Session = Depends(get_db)
) -> List[schemas.DocumentVersionRead]:
    """Get all versions of a document"""
    document = db.scalar(select(models.Document).where(models.Document.id == document_id))
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")
    
    versions = db.scalars(
        select(models.DocumentVersion)
        .where(models.DocumentVersion.document_id == document_id)
        .order_by(models.DocumentVersion.version_number)
    ).all()
    return versions


@app.get("/document/{document_id}/version/{version_id}")
def get_document_version(
    document_id: int, version_id: int, db: Session = Depends(get_db)
) -> schemas.DocumentVersionRead:
    """Get a specific version of a document"""
    version = db.scalar(
        select(models.DocumentVersion)
        .where(
            models.DocumentVersion.document_id == document_id,
            models.DocumentVersion.id == version_id
        )
    )
    if not version:
        raise HTTPException(status_code=404, detail="Document version not found")
    return version


@app.post("/document/{document_id}/version")
def create_document_version(
    document_id: int, version: schemas.DocumentVersionCreate, db: Session = Depends(get_db)
) -> schemas.DocumentVersionRead:
    """Create a new version of a document"""
    # Check if document exists
    document = db.scalar(select(models.Document).where(models.Document.id == document_id))
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")
    
    # Get the next version number
    max_version = db.scalar(
        select(func.max(models.DocumentVersion.version_number))
        .where(models.DocumentVersion.document_id == document_id)
    ) or 0
    
    new_version_number = max_version + 1
    
    # Create new version
    new_version = models.DocumentVersion(
        document_id=document_id,
        content=version.content,
        version_number=new_version_number,
        version_name=version.version_name
    )
    db.add(new_version)
    db.commit()
    db.refresh(new_version)
    
    # Update document's current version
    db.execute(
        update(models.Document)
        .where(models.Document.id == document_id)
        .values(current_version_id=new_version.id)
    )
    db.commit()
    
    return new_version


@app.put("/document/{document_id}/version/{version_id}")
def update_document_version(
    document_id: int, version_id: int, version: schemas.DocumentVersionUpdate, db: Session = Depends(get_db)
) -> schemas.DocumentVersionRead:
    """Update a specific version of a document"""
    # Check if version exists
    existing_version = db.scalar(
        select(models.DocumentVersion)
        .where(
            models.DocumentVersion.document_id == document_id,
            models.DocumentVersion.id == version_id
        )
    )
    if not existing_version:
        raise HTTPException(status_code=404, detail="Document version not found")
    
    # Update the version
    db.execute(
        update(models.DocumentVersion)
        .where(models.DocumentVersion.id == version_id)
        .values(content=version.content)
    )
    db.commit()
    db.refresh(existing_version)
    
    return existing_version


@app.post("/document/{document_id}/switch-version/{version_id}")
def switch_document_version(
    document_id: int, version_id: int, db: Session = Depends(get_db)
) -> schemas.DocumentRead:
    """Switch the current version of a document"""
    # Check if document exists
    document = db.scalar(select(models.Document).where(models.Document.id == document_id))
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")
    
    # Check if version exists
    version = db.scalar(
        select(models.DocumentVersion)
        .where(
            models.DocumentVersion.document_id == document_id,
            models.DocumentVersion.id == version_id
        )
    )
    if not version:
        raise HTTPException(status_code=404, detail="Document version not found")
    
    # Update document's current version
    db.execute(
        update(models.Document)
        .where(models.Document.id == document_id)
        .values(current_version_id=version_id)
    )
    db.commit()
    db.refresh(document)
    
    return document


@app.delete("/document/{document_id}/version/{version_id}")
def delete_document_version(
    document_id: int, version_id: int, db: Session = Depends(get_db)
):
    """Delete a specific version of a document"""
    # Check if document exists
    document = db.scalar(select(models.Document).where(models.Document.id == document_id))
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")
    
    # Check if version exists and belongs to this document
    version = db.scalar(
        select(models.DocumentVersion)
        .where(
            models.DocumentVersion.document_id == document_id,
            models.DocumentVersion.id == version_id
        )
    )
    if not version:
        raise HTTPException(status_code=404, detail="Document version not found")
    
    # Prevent deletion of the current version
    if document.current_version_id == version_id:
        raise HTTPException(
            status_code=400, 
            detail="Cannot delete the current version. Please switch to another version first."
        )
    
    # Check if this is the only version left
    version_count = db.scalar(
        select(func.count(models.DocumentVersion.id))
        .where(models.DocumentVersion.document_id == document_id)
    )
    if version_count <= 1:
        raise HTTPException(
            status_code=400,
            detail="Cannot delete the last remaining version of a document"
        )
    
    # Delete the version
    db.execute(
        delete(models.DocumentVersion)
        .where(models.DocumentVersion.id == version_id)
    )
    db.commit()
    
    return {"message": f"Version {version.version_number} deleted successfully", "version_id": version_id}


@app.post("/save/{document_id}/version/{version_id}")
def save_document_version(
    document_id: int, version_id: int, document: schemas.DocumentBase, db: Session = Depends(get_db)
):
    """Save a specific version of a document"""
    # Check if document exists
    existing_document = db.scalar(select(models.Document).where(models.Document.id == document_id))
    if not existing_document:
        raise HTTPException(status_code=404, detail="Document not found")
    
    # Check if version exists and belongs to this document
    existing_version = db.scalar(
        select(models.DocumentVersion)
        .where(
            models.DocumentVersion.document_id == document_id,
            models.DocumentVersion.id == version_id
        )
    )
    if not existing_version:
        raise HTTPException(status_code=404, detail="Document version not found")
    
    # Update the specific version
    db.execute(
        update(models.DocumentVersion)
        .where(models.DocumentVersion.id == version_id)
        .values(content=document.content)
    )
    db.commit()
    
    return {"document_id": document_id, "version_id": version_id, "content": document.content}


@app.post("/save/{document_id}")
def save(
    document_id: int, document: schemas.DocumentBase, db: Session = Depends(get_db)
):
    """Save the document to the database (backward compatible)"""
    # Check if document exists
    existing_document = db.scalar(select(models.Document).where(models.Document.id == document_id))
    if not existing_document:
        raise HTTPException(status_code=404, detail="Document not found")
    
    # If document has versioning enabled, update the current version
    if existing_document.current_version_id:
        # Get current version info for logging
        current_version = db.scalar(
            select(models.DocumentVersion)
            .where(models.DocumentVersion.id == existing_document.current_version_id)
        )
        
        # Update the current version
        db.execute(
            update(models.DocumentVersion)
            .where(models.DocumentVersion.id == existing_document.current_version_id)
            .values(content=document.content)
        )
    else:
        # Legacy behavior - create first version for backward compatibility
        # This allows legacy documents to be upgraded to versioned documents
        first_version = models.DocumentVersion(
            document_id=document_id,
            content=document.content,
            version_number=1
        )
        db.add(first_version)
        db.flush()  # Get the ID without committing
        
        # Update document to point to this version
        db.execute(
            update(models.Document)
            .where(models.Document.id == document_id)
            .values(current_version_id=first_version.id)
        )
    
    db.commit()
    return {"document_id": document_id, "content": document.content}


@app.websocket("/ws/upgrade/{document_id}/{session_id}")
async def upgrade_websocket(websocket: WebSocket, document_id: int, session_id: str):
    """WebSocket endpoint for upgrade progress updates"""
    await upgrade_manager.connect(websocket, session_id)
    try:
        while True:
            # Keep the connection alive
            await websocket.receive_text()
    except WebSocketDisconnect:
        upgrade_manager.disconnect(session_id)


@app.post("/document/{document_id}/upgrade")
async def upgrade_document_automatically(
    document_id: int,
    session_id: str = None,
    db: Session = Depends(get_db),
    ai: AI = Depends(get_ai)
) -> Dict:
    """
    Trigger the agentic document upgrade workflow.

    Uses a dual-channel communication pattern:
    - HTTP POST (this endpoint): blocks until the workflow completes, returns the
      final summary (improvements applied, iterations run, new version ID).
    - WebSocket /ws/upgrade/{document_id}/{session_id}: streams per-claim progress
      events in real time (upgrade_started, suggestions_found, processing_suggestion,
      suggestion_applied/skipped, upgrade_complete).

    The client must open the WebSocket *before* sending this HTTP request to avoid
    missing early progress events. Session IDs are UUIDs generated client-side,
    allowing multiple concurrent upgrades across different documents.

    On success, creates a new DocumentVersion with the improved content and updates
    the document's current_version_id.
    """
    # Get the current document
    document = db.scalar(select(models.Document).where(models.Document.id == document_id))
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")
    
    # Get the current version content
    if not document.current_version_id:
        raise HTTPException(status_code=400, detail="Document has no current version")
    
    current_version = db.scalar(
        select(models.DocumentVersion)
        .where(models.DocumentVersion.id == document.current_version_id)
    )
    if not current_version:
        raise HTTPException(status_code=404, detail="Current document version not found")
    
    try:
        # Create and run the upgrade workflow with WebSocket support
        workflow = SimpleDocumentUpgradeWorkflow(
            ai, 
            max_iterations=3,
            websocket_session_id=session_id,
            websocket_manager=upgrade_manager
        )
        result = await workflow.upgrade_document(current_version.content)
        
        if result["success"] and result["improved_document"] != current_version.content:
            # Create a new version with the improved content
            max_version = db.scalar(
                select(func.max(models.DocumentVersion.version_number))
                .where(models.DocumentVersion.document_id == document_id)
            ) or 0
            
            new_version_number = max_version + 1
            
            new_version = models.DocumentVersion(
                document_id=document_id,
                content=result["improved_document"],
                version_number=new_version_number,
                version_name=f"Auto-upgraded v{new_version_number} ({result['total_improvements']} improvements)"
            )
            db.add(new_version)
            db.commit()
            db.refresh(new_version)
            
            # Update document's current version
            db.execute(
                update(models.Document)
                .where(models.Document.id == document_id)
                .values(current_version_id=new_version.id)
            )
            db.commit()
            
            # Return the result with version info
            result["new_version_id"] = new_version.id
            result["new_version_number"] = new_version_number
        
        # Send completion update via WebSocket
        if session_id:
            await upgrade_manager.send_progress_update(session_id, {
                "type": "upgrade_complete",
                "result": result
            })
        
        return result
        
    except Exception as e:
        if session_id:
            await upgrade_manager.send_progress_update(session_id, {
                "type": "upgrade_error",
                "error": str(e)
            })
        raise HTTPException(status_code=500, detail=f"Failed to upgrade document: {str(e)}")


@app.websocket("/ws")
async def websocket(websocket: WebSocket, ai: AI = Depends(get_ai)):
    await websocket.accept()
    
    while True:
        try:
            document = await websocket.receive_text()
            document = strip_html(document)
            
            # Send the document to the AI
            async for chunk in ai.review_document(document):
                if chunk is not None:  # Handle the str | None type
                    await websocket.send_text(chunk)


            # Send acknowledgment back to client
            await websocket.send_text(f" --- Done sending suggestions ---")
            
        except WebSocketDisconnect:
            break
        except Exception as e:
            print(f"[ws] Error processing document: {e}")
            continue
 